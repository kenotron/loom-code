import { useState, useCallback, useRef, useEffect } from 'react'
import { Box, Text, Static, useStdout, useInput } from 'ink'
import TextInput from 'ink-text-input'
import Markdown from '@loom-code/ui-markdown'
import type { ToolCallRow } from '@loom-code/ui-chat-history'
import { createSession } from './session'

// ── Hook: track terminal dimensions ─────────────────────────────────────────

function useTerminalDimensions() {
  const { stdout } = useStdout()
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  })

  useEffect(() => {
    if (!stdout) return
    const handleResize = () => setDimensions({ width: stdout.columns, height: stdout.rows })
    stdout.on('resize', handleResize)
    return () => { stdout.off('resize', handleResize) }
  }, [stdout])

  return dimensions
}

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * A single ordered content block within a turn.
 * Preserves the exact sequence of text segments and tool calls as they happened.
 */
type TurnBlock =
  | { type: 'text'; content: string }
  | { type: 'tool'; call: ToolCallRow }

/**
 * A completed exchange (user message + AI response) stored in the Static zone.
 * blocks is ordered chronologically: text before tool call, tool call, text after.
 */
type CompletedExchange = {
  id: string
  userContent: string
  blocks: TurnBlock[]
}

/**
 * The live in-flight turn.
 * Same ordered blocks structure, but ToolCallRow objects are still mutable
 * (status updates from onToolEnd come in after onToolStart).
 */
type LiveState = {
  userContent: string   // shown as gray-bg user bubble
  blocks: TurnBlock[]   // ordered sequence being built in real time
  isThinking: boolean   // true from submit until first token
}

// ── Visual constants ─────────────────────────────────────────────────────────

const TOOL_ICON: Record<ToolCallRow['status'], string> = {
  running: '⠋',
  success: '✓',
  error: '✗',
}

const TOOL_COLOR: Record<ToolCallRow['status'], string> = {
  running: '#ffd740',
  success: '#69f0ae',
  error: '#ff6b6b',
}

// ── Sub-components ───────────────────────────────────────────────────────────

const USER_BG = '#383838'

function UserBubble({ content, width }: { content: string; width: number }) {
  const blank   = ' '.repeat(width)
  const msgLine = ('  ' + content).padEnd(width)
  return (
    <Box flexDirection="column">
      <Text backgroundColor={USER_BG}>{blank}</Text>
      <Text bold color="#ffffff" backgroundColor={USER_BG}>{msgLine}</Text>
      <Text backgroundColor={USER_BG}>{blank}</Text>
    </Box>
  )
}

function ToolRow({ call }: { call: ToolCallRow }) {
  return (
    <Box flexDirection="row">
      <Text>{'  '}</Text>
      <Text color={TOOL_COLOR[call.status]}>{TOOL_ICON[call.status] + ' '}</Text>
      <Text color="#909090">
        {call.toolName}{call.error ? '  ' + call.error.split('\n')[0] : ''}
      </Text>
    </Box>
  )
}

/**
 * Renders an ordered sequence of text + tool blocks.
 * Uses @loom-code/ui-markdown (ESM fork of ink-markdown) which handles
 * partial markdown gracefully during streaming — no plain/rendered swap.
 */
function TurnBlocks({ blocks, cursor = false }: { blocks: TurnBlock[]; cursor?: boolean }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'tool') {
          return <ToolRow key={block.call.id} call={block.call} />
        }
        const isLast = i === blocks.length - 1
        return (
          <Markdown key={i} cursor={cursor && isLast}>
            {block.content}
          </Markdown>
        )
      })}
    </>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function App() {
  const { width: termWidth } = useTerminalDimensions()

  const [session] = useState(() => createSession())

  // ── State split: Static (completed) vs live (current turn) ────────────────
  const [completedExchanges, setCompletedExchanges] = useState<CompletedExchange[]>([])

  const [live, setLive] = useState<LiveState>({
    userContent: '',
    blocks: [],
    isThinking: false,
  })

  // Ref kept in sync so the async finally block reads the latest committed state
  const liveRef = useRef(live)
  liveRef.current = live

  const [inputValue, setInputValue] = useState('')
  const [tokenCount, setTokenCount] = useState(0)

  // Mutable map: tool name → ToolCallRow object reference (for O(1) onToolEnd lookup)
  // The same object is referenced inside live.blocks so mutating it updates the display.
  const toolCallMapRef = useRef<Map<string, ToolCallRow>>(new Map())

  const modelName = process.env.MODEL ?? 'claude-opus-4-5'
  const sessionShort = session.sessionId.slice(0, 8)
  const statusLine = `${modelName}  ${tokenCount < 1000 ? tokenCount : (tokenCount / 1000).toFixed(1) + 'k'} tokens  #${sessionShort}`

  // ── Turn execution ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const userContent = text.trim()

      setInputValue('')
      setLive({ userContent, blocks: [], isThinking: true })
      toolCallMapRef.current.clear()

      try {
        await session.runTurn(userContent, {
          onToken: (token: string) => {
            setLive(prev => {
              const blocks = [...prev.blocks]
              const last = blocks[blocks.length - 1]
              if (last?.type === 'text') {
                // Append token to the current text block
                blocks[blocks.length - 1] = { type: 'text', content: last.content + token }
              } else {
                // Start a new text block (after a tool call, or first token)
                blocks.push({ type: 'text', content: token })
              }
              return { ...prev, isThinking: false, blocks }
            })
            setTokenCount(prev => prev + 1)
          },

          onToolStart: (name: string) => {
            const call: ToolCallRow = {
              id: crypto.randomUUID(),
              toolName: name,
              status: 'running',
              startedAt: Date.now(),
            }
            toolCallMapRef.current.set(name, call)
            setLive(prev => ({
              ...prev,
              blocks: [...prev.blocks, { type: 'tool', call }],
            }))
          },

          onToolEnd: (name: string, success: boolean, output: string) => {
            let call = toolCallMapRef.current.get(name)
            if (!call) {
              // Denied by hook before onToolStart — insert it now
              call = { id: crypto.randomUUID(), toolName: name, status: 'error', startedAt: Date.now() }
              call.status = success ? 'success' : 'error'
              call.error = success ? undefined : output
              toolCallMapRef.current.set(name, call)
              const captured = call
              setLive(prev => ({
                ...prev,
                blocks: [...prev.blocks, { type: 'tool', call: captured }],
              }))
              return
            }
            // Mutate the ToolCallRow in place (same object reference in blocks)
            call.status = success ? 'success' : 'error'
            call.error = success ? undefined : output
            // New array reference triggers re-render; block objects updated in place
            setLive(prev => ({ ...prev, blocks: [...prev.blocks] }))
          },
        })
      } catch (err) {
        if (!session.isCancelled) {
          const errMsg = err instanceof Error ? err.message : String(err)
          setLive(prev => {
            const blocks = [...prev.blocks]
            const last = blocks[blocks.length - 1]
            if (last?.type === 'text') {
              blocks[blocks.length - 1] = { type: 'text', content: last.content + `\n[error: ${errMsg}]` }
            } else {
              blocks.push({ type: 'text', content: `[error: ${errMsg}]` })
            }
            return { ...prev, blocks }
          })
        }
      } finally {
        const finalLive = liveRef.current
        setCompletedExchanges(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            userContent: finalLive.userContent,
            blocks: finalLive.blocks,
          },
        ])
        setLive({ userContent: '', blocks: [], isThinking: false })
      }
    },
    [session],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useInput((input, key) => {
    if (key.escape && (live.isThinking || live.blocks.length > 0)) {
      session.cancel()
    }
    if (key.ctrl && input === 'p') {
      // command palette — TODO
    }
  })

  // ── Render ────────────────────────────────────────────────────────────────
  const isActiveTurn = live.userContent !== ''
  const lastBlock = live.blocks[live.blocks.length - 1]
  const showCursor = isActiveTurn && lastBlock?.type === 'text'

  return (
    <>
      {/*
       * Zone 1 — Static: completed exchanges.
       * Ink renders these once to stdout; they become permanent terminal scrollback.
       */}
      <Static items={completedExchanges}>
        {exchange => (
          <Box key={exchange.id} flexDirection="column">
            <UserBubble content={exchange.userContent} width={termWidth} />
            <Text>{' '}</Text>
            <TurnBlocks blocks={exchange.blocks} />
          </Box>
        )}
      </Static>

      {/*
       * Zone 2 — Live: current in-flight turn + input chrome.
       * Re-rendered by ink on every state change via log-update.
       * Must stay compact (< terminal height) to avoid flicker.
       */}
      <Box flexDirection="column">
        {/* In-flight user message */}
        {isActiveTurn ? (
          <>
            <UserBubble content={live.userContent} width={termWidth} />
            <Text>{' '}</Text>
          </>
        ) : null}

        {/* Ordered blocks: text and tool calls interleaved as they arrived */}
        {live.blocks.length > 0 ? (
          <TurnBlocks blocks={live.blocks} cursor={showCursor} />
        ) : null}

        {/* Input — lines above and below */}
        <Text dimColor>{'─'.repeat(termWidth)}</Text>
        <Box flexDirection="row" paddingX={1}>
          {live.isThinking ? (
            <Text color="#ffd740">{'⠋ '}</Text>
          ) : (
            <Text color="#909090">{'> '}</Text>
          )}
          <TextInput
            value={live.isThinking ? '' : inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            focus={!live.isThinking}
            placeholder={live.isThinking ? 'generating… Esc to cancel' : ''}
          />
        </Box>
        <Text dimColor>{'─'.repeat(termWidth)}</Text>

        {/* Status bar */}
        <Text dimColor>{' ' + statusLine}</Text>
      </Box>
    </>
  )
}
