import { useState, useCallback, useRef } from 'react'
import { Box, Text, Static, useStdout, useInput } from 'ink'
import TextInput from 'ink-text-input'
import type { ToolCallRow } from '@loom-code/ui-chat-history'
import { createSession } from './session'

// ── Types ─────────────────────────────────────────────────────────────────────

type CompletedExchange = {
  id: string
  userContent: string
  aiContent: string
  toolCalls: ToolCallRow[]
}

type LiveState = {
  /** User message for the current in-flight turn (displayed in live zone). */
  userContent: string
  /** AI response streaming in this turn. */
  streamingContent: string
  /** Tool calls active in this turn. */
  activeToolCalls: ToolCallRow[]
  /** True from submit until the first token arrives. */
  isThinking: boolean
}

// ── Visual constants ──────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export function App() {
  const { stdout } = useStdout()
  const termWidth = stdout?.columns ?? 80
  const sepLine = '─'.repeat(termWidth)

  // Session is created once and never replaced
  const [session] = useState(() => createSession())

  // ── State split: Static (completed) vs live (current turn) ────────────────
  const [completedExchanges, setCompletedExchanges] = useState<CompletedExchange[]>([])

  const [live, setLive] = useState<LiveState>({
    userContent: '',
    streamingContent: '',
    activeToolCalls: [],
    isThinking: false,
  })

  // Keep a ref in sync so async callbacks see the latest live state
  // without capturing a stale closure.
  const liveRef = useRef(live)
  liveRef.current = live

  const [inputValue, setInputValue] = useState('')
  const [tokenCount, setTokenCount] = useState(0)

  // In-flight tool calls: keyed by tool name for O(1) onToolEnd lookup
  const toolCallMapRef = useRef<Map<string, ToolCallRow>>(new Map())

  // Derived display values (stable, no extra state)
  const modelName = process.env.MODEL ?? 'claude-opus-4-5'
  const sessionShort = session.sessionId.slice(0, 8)
  const statusLine = `${modelName}  ${tokenCount < 1000 ? tokenCount : (tokenCount / 1000).toFixed(1) + 'k'} tokens  #${sessionShort}`

  // ── Turn execution ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const userContent = text.trim()

      // Clear input immediately and initialise live state for this turn
      setInputValue('')
      setLive({
        userContent,
        streamingContent: '',
        activeToolCalls: [],
        isThinking: true,
      })
      toolCallMapRef.current.clear()

      try {
        await session.runTurn(userContent, {
          onToken: (token: string) => {
            setLive(prev => ({
              ...prev,
              isThinking: false,
              streamingContent: prev.streamingContent + token,
            }))
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
              activeToolCalls: [...toolCallMapRef.current.values()],
            }))
          },

          onToolEnd: (name: string, success: boolean, output: string) => {
            const call = toolCallMapRef.current.get(name)
            if (call) {
              call.status = success ? 'success' : 'error'
              call.error = success ? undefined : output
              toolCallMapRef.current.set(name, call)
              setLive(prev => ({
                ...prev,
                activeToolCalls: [...toolCallMapRef.current.values()],
              }))
            }
          },
        })
      } catch (err) {
        if (!session.isCancelled) {
          const errMsg = err instanceof Error ? err.message : String(err)
          setLive(prev => ({
            ...prev,
            streamingContent: prev.streamingContent + `\n[error: ${errMsg}]`,
          }))
        }
      } finally {
        // Capture the latest live state (via ref) and push it to Static zone,
        // then reset live so the live zone returns to idle.
        const finalLive = liveRef.current
        setCompletedExchanges(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            userContent: finalLive.userContent,
            aiContent: finalLive.streamingContent,
            toolCalls: finalLive.activeToolCalls,
          },
        ])
        setLive({ userContent: '', streamingContent: '', activeToolCalls: [], isThinking: false })
      }
    },
    [session],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useInput((input, key) => {
    // Esc during a turn → cancel the running response
    if (key.escape && live.isThinking) {
      session.cancel()
    }
    // Ctrl-P → command palette (TODO)
    if (key.ctrl && input === 'p') {
      // placeholder — will open command palette in a future iteration
    }
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
       * Zone 1 — Static: completed exchanges.
       * Ink renders these once to stdout and never touches them again;
       * they become normal terminal scrollback.
       */}
      <Static items={completedExchanges}>
        {exchange => (
          <Box key={exchange.id} flexDirection="column">
            {/* User message bubble */}
            <Box>
              <Text>{'  '}</Text>
              <Text bold color="#ffffff" backgroundColor="#1e1e1e">
                {exchange.userContent}
              </Text>
              <Text>{'  '}</Text>
            </Box>

            {/* Blank line */}
            <Text>{' '}</Text>

            {/* Tool calls for this exchange */}
            {exchange.toolCalls.map(call => (
              <Box key={call.id} flexDirection="row">
                <Text>{'  '}</Text>
                <Text color={TOOL_COLOR[call.status]}>{TOOL_ICON[call.status] + ' '}</Text>
                <Text color="#909090">
                  {call.toolName + (call.error ? '  ' + call.error : '')}
                </Text>
              </Box>
            ))}

            {/* AI response text */}
            {exchange.aiContent ? <Text>{exchange.aiContent}</Text> : null}

            {/* Full-width separator */}
            <Text dimColor>{sepLine}</Text>
          </Box>
        )}
      </Static>

      {/*
       * Zone 2 — Live: current in-flight turn + input.
       * Re-rendered by ink on every state change via log-update.
       * Must stay small (< terminal height) to avoid flicker.
       */}
      <Box flexDirection="column">
        {/* In-flight user message */}
        {live.userContent ? (
          <Box>
            <Text>{'  '}</Text>
            <Text bold color="#ffffff" backgroundColor="#1e1e1e">
              {live.userContent}
            </Text>
            <Text>{'  '}</Text>
          </Box>
        ) : null}
        {live.userContent ? <Text>{' '}</Text> : null}

        {/* Active tool calls */}
        {live.activeToolCalls.map(call => (
          <Box key={call.id} flexDirection="row">
            <Text>{'  '}</Text>
            <Text color={TOOL_COLOR[call.status]}>{TOOL_ICON[call.status] + ' '}</Text>
            <Text color="#909090">
              {call.toolName + (call.error ? '  ' + call.error : '')}
            </Text>
          </Box>
        ))}

        {/* Streaming AI response with blinking cursor */}
        {live.streamingContent ? <Text>{live.streamingContent + '▌'}</Text> : null}

        {/* Separator line */}
        <Text dimColor>{sepLine}</Text>

        {/* Prompt arrow + text input */}
        <Box flexDirection="row">
          {live.isThinking ? (
            <Text color="#ffd740">{'⠋ '}</Text>
          ) : (
            <Text color="#7cb9e8">{'▸ '}</Text>
          )}
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            focus={!live.isThinking}
            placeholder={live.isThinking ? 'generating… Esc to cancel' : ''}
          />
        </Box>

        {/* Status: model · tokens · session */}
        <Text dimColor>{statusLine}</Text>
      </Box>
    </>
  )
}
