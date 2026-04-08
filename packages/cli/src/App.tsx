import { useState, useCallback, useRef, useEffect } from 'react'
import os from 'os'
import path from 'path'
import { Box, Text, Static, useStdout, useInput } from 'ink'
import Markdown from '@loom-code/ui-markdown'
import type { ToolCallRow } from '@loom-code/ui-chat-history'
import { createSession } from './session'

// ── Hook: readline-style line editor ─────────────────────────────────────────
//
// Supported shortcuts:
//   Ctrl-A / Home   — move to start of line
//   Ctrl-E / End    — move to end of line
//   Ctrl-B / ←      — move back one char
//   Ctrl-F / →      — move forward one char
//   Alt-B           — move back one word
//   Alt-F           — move forward one word
//   Ctrl-K          — kill to end of line
//   Ctrl-U          — kill to start of line
//   Ctrl-W / Alt-BS — kill previous word
//   Ctrl-D          — delete char under cursor  (if line non-empty)
//   Ctrl-H / BS     — delete char before cursor
//   Ctrl-L          — clear (reset value)
//   Ctrl-T          — transpose chars around cursor

interface LineEditorState {
  value: string
  cursor: number
}

interface LineEditorActions {
  setValue: (v: string) => void
  reset: () => void
}

function useLineEditor(
  focused: boolean,
  onSubmit: (value: string) => void,
): [LineEditorState, LineEditorActions] {
  const [state, setState] = useState<LineEditorState>({ value: '', cursor: 0 })

  // helper — move cursor, clamped
  const move = (s: LineEditorState, pos: number): LineEditorState => ({
    ...s,
    cursor: Math.max(0, Math.min(pos, s.value.length)),
  })

  // find start of previous word (from pos)
  const prevWordBoundary = (v: string, pos: number): number => {
    let i = pos - 1
    while (i > 0 && v[i] === ' ') i--
    while (i > 0 && v[i - 1] !== ' ') i--
    return Math.max(0, i)
  }

  // find end of next word (from pos)
  const nextWordBoundary = (v: string, pos: number): number => {
    let i = pos
    while (i < v.length && v[i] === ' ') i++
    while (i < v.length && v[i] !== ' ') i++
    return i
  }

  useInput(
    (input, key) => {
      setState(s => {
        const { value: v, cursor: c } = s

        // ── Submit ──────────────────────────────────────────────────────────
        if (key.return) {
          const trimmed = v.trim()
          if (trimmed) {
            setTimeout(() => onSubmit(trimmed), 0)
            return { value: '', cursor: 0 }
          }
          return s
        }

        // ── Movement ────────────────────────────────────────────────────────
        if ((key.ctrl && input === 'a') || key.home) return move(s, 0)
        if ((key.ctrl && input === 'e') || key.end)  return move(s, v.length)
        if ((key.ctrl && input === 'b') || key.leftArrow)  return move(s, c - 1)
        if ((key.ctrl && input === 'f') || key.rightArrow) return move(s, c + 1)
        // Alt-B / Alt-F arrive as escape sequences: \x1bb and \x1bf
        if (input === '\x1bb') return move(s, prevWordBoundary(v, c))
        if (input === '\x1bf') return move(s, nextWordBoundary(v, c))

        // ── Deletion ────────────────────────────────────────────────────────
        if ((key.ctrl && input === 'h') || key.backspace || key.delete) {
          if (c === 0) return s
          return { value: v.slice(0, c - 1) + v.slice(c), cursor: c - 1 }
        }
        if (key.ctrl && input === 'd') {
          if (c >= v.length) return s
          return { value: v.slice(0, c) + v.slice(c + 1), cursor: c }
        }
        if (key.ctrl && input === 'k') {
          return { value: v.slice(0, c), cursor: c }
        }
        if (key.ctrl && input === 'u') {
          return { value: v.slice(c), cursor: 0 }
        }
        // Ctrl-W / Alt-Backspace — kill previous word
        if ((key.ctrl && input === 'w') || input === '\x1b\x7f') {
          const wb = prevWordBoundary(v, c)
          return { value: v.slice(0, wb) + v.slice(c), cursor: wb }
        }

        // ── Transpose ───────────────────────────────────────────────────────
        if (key.ctrl && input === 't') {
          if (c < 2) return s
          const pos = c === v.length ? c - 1 : c
          const swapped = v.slice(0, pos - 1) + v[pos] + v[pos - 1] + v.slice(pos + 1)
          return { value: swapped, cursor: Math.min(pos + 1, v.length) }
        }

        // ── Clear line ──────────────────────────────────────────────────────
        if (key.ctrl && input === 'l') {
          return { value: '', cursor: 0 }
        }

        // ── Regular character insertion ──────────────────────────────────────
        if (input && !key.ctrl && !key.meta && input.length === 1) {
          return {
            value: v.slice(0, c) + input + v.slice(c),
            cursor: c + 1,
          }
        }

        return s
      })
    },
    { isActive: focused },
  )

  const actions: LineEditorActions = {
    setValue: (v: string) => setState({ value: v, cursor: v.length }),
    reset: () => setState({ value: '', cursor: 0 }),
  }

  return [state, actions]
}

// ── Component: LineInput ─────────────────────────────────────────────────────
// Renders the text with a block cursor at the insertion point.

function LineInput({
  value,
  cursor,
  placeholder,
  focused,
}: {
  value: string
  cursor: number
  placeholder?: string
  focused: boolean
}) {
  if (!focused && value === '') {
    return <Text dimColor>{placeholder ?? ''}</Text>
  }

  // Render text with a highlighted cursor character
  const before = value.slice(0, cursor)
  const atCursor = value[cursor] ?? ' '
  const after = value.slice(cursor + 1)

  return (
    <Text>
      {before}
      <Text inverse>{atCursor}</Text>
      {after}
    </Text>
  )
}

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
  userContent: string    // shown as gray-bg user bubble
  blocks: TurnBlock[]    // ordered sequence being built in real time
  isThinking: boolean    // true from submit until first token
  thinkingText: string   // accumulated extended-thinking deltas (empty when disabled)
}

// ── Visual constants ─────────────────────────────────────────────────────────

const TOOL_ICON: Record<ToolCallRow['status'], string> = {
  running: '○',   // hollow circle = in progress
  success: '●',   // filled circle = done
  error:   '✗',
}

const TOOL_COLOR: Record<ToolCallRow['status'], string> = {
  running: '#606060',   // muted — not done yet
  success: '#505050',   // slightly dimmer when done (not to distract)
  error:   '#ff6b6b',
}

const TOOL_NAME_COLOR: Record<ToolCallRow['status'], string> = {
  running: '#ffd740',   // gold = active
  success: '#606060',   // dim when finished
  error:   '#ff6b6b',
}

const TOOL_ARG_COLOR: Record<ToolCallRow['status'], string> = {
  running: '#d0d0d0',   // bright = working on this
  success: '#505050',   // dim when done
  error:   '#ff9999',
}

/**
 * Extract the most informative single argument from a tool's input for display.
 * Returns a short string like a file path, command snippet, or pattern.
 */
function formatToolArg(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const inp = input as Record<string, unknown>

  // File system tools
  if (toolName === 'read_file' || toolName === 'write_file' ||
      toolName === 'edit_file' || toolName === 'file_info' ||
      toolName === 'list_directory') {
    const p = inp.path ?? inp.file_path
    if (typeof p === 'string') return shortenPath(p)
  }
  if (toolName === 'glob') {
    const pattern = inp.pattern
    if (typeof pattern === 'string') return pattern
  }
  // Shell
  if (toolName === 'run_command') {
    const cmd = inp.command
    if (typeof cmd === 'string') return cmd.length > 60 ? cmd.slice(0, 57) + '…' : cmd
  }
  // Tasks
  if (toolName === 'add_task' || toolName === 'update_task' || toolName === 'complete_task') {
    const title = inp.title ?? inp.id
    if (typeof title === 'string') return title.length > 40 ? title.slice(0, 37) + '…' : title
  }
  // Skills
  if (toolName === 'load_skill' || toolName === 'run_skill') {
    const name = inp.name
    if (typeof name === 'string') return name
  }
  // Fallback: first string value
  for (const v of Object.values(inp)) {
    if (typeof v === 'string' && v.length > 0) {
      return v.length > 50 ? v.slice(0, 47) + '…' : v
    }
  }
  return ''
}

/** Shorten an absolute path for display: replace home with ~ and truncate. */
function shortenPath(p: string): string {
  const home = process.env.HOME ?? ''
  if (home && p.startsWith(home)) p = '~' + p.slice(home.length)
  // Keep last ~3 segments if too long
  const parts = p.split('/')
  if (parts.length > 4) {
    p = '…/' + parts.slice(-3).join('/')
  }
  return p
}

// ── Banner ───────────────────────────────────────────────────────────────────

const HOME = os.homedir()
function fmtCwd(cwd: string) {
  return cwd.startsWith(HOME) ? '~' + cwd.slice(HOME.length) : cwd
}

function Banner({ model }: { model: string }) {
  const folder = fmtCwd(process.cwd())
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text>{' '}</Text>
      <Box flexDirection="row">
        <Text color="#606060">loom</Text>
        <Text color="#ffd740"> · </Text>
        <Text bold color="#ffffff">code</Text>
      </Box>
      <Text>{' '}</Text>
      <Box flexDirection="column" paddingLeft={2}>
        <Box flexDirection="row">
          <Text color="#505050">model   </Text>
          <Text color="#909090">{model}</Text>
        </Box>
        <Box flexDirection="row">
          <Text color="#505050">folder  </Text>
          <Text color="#909090">{folder}</Text>
        </Box>
        <Box flexDirection="row">
          <Text color="#505050">help    </Text>
          <Text color="#909090">type /help · Esc cancels · Ctrl-P commands</Text>
        </Box>
      </Box>
      <Text>{' '}</Text>
    </Box>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

const USER_BG = '#383838'

/**
 * User message bubble — full-width real background, not fake padded strings.
 * Box with backgroundColor fills the entire computed area (including padding)
 * so multiline messages render cleanly with no black/gray artifacts.
 */
function UserBubble({ content, width }: { content: string; width: number }) {
  return (
    <Box
      flexDirection="column"
      width={width}
      backgroundColor={USER_BG}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="#ffffff">{content}</Text>
    </Box>
  )
}

function ToolRow({ call }: { call: ToolCallRow }) {
  const arg = formatToolArg(call.toolName, call.input)
  const icon = TOOL_ICON[call.status]
  const iconColor = TOOL_COLOR[call.status]
  const nameColor = TOOL_NAME_COLOR[call.status]
  const argColor = TOOL_ARG_COLOR[call.status]

  return (
    <Box flexDirection="row">
      <Text>{'  '}</Text>
      <Text color={iconColor}>{icon + ' '}</Text>
      <Text color={nameColor}>{call.toolName}</Text>
      {arg ? (
        <>
          <Text color="#404040">{' · '}</Text>
          <Text color={argColor}>{arg}</Text>
        </>
      ) : null}
      {call.error ? (
        <Text color="#ff6b6b">{'  ' + call.error.split('\n')[0]}</Text>
      ) : null}
    </Box>
  )
}

/**
 * Renders an ordered sequence of text + tool blocks.
 * Uses @loom-code/ui-markdown (ESM fork of ink-markdown) which handles
 * partial markdown gracefully during streaming — no plain/rendered swap.
 *
 * Margin rules:
 *   • Consecutive tool calls → no gap between them (packed group)
 *   • Tool group preceded by text → blank line before the first call
 *   • Tool group followed by text → blank line after the last call
 */
function TurnBlocks({ blocks, cursor = false }: { blocks: TurnBlock[]; cursor?: boolean }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'tool') {
          const prevIsText = i > 0 && blocks[i - 1]?.type === 'text'
          const nextIsText = i < blocks.length - 1 && blocks[i + 1]?.type === 'text'
          return (
            <Box key={block.call.id} flexDirection="column">
              {prevIsText && <Text> </Text>}
              <ToolRow call={block.call} />
              {nextIsText && <Text> </Text>}
            </Box>
          )
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

// ── ThinkingIndicator ────────────────────────────────────────────────────────
//
// Shows a 🧠 prefix followed by a short rolling summary of the model's
// reasoning text. The full thinking content is truncated to one line so
// it doesn't overwhelm the live zone.

function ThinkingIndicator({ text, width }: { text: string; width: number }) {
  // Take the last line of thinking that has real content (skip blank lines)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const lastLine = lines[lines.length - 1] ?? ''

  // Reserve space for the "🧠 " prefix (3 chars) and some padding
  const maxLen = Math.max(10, width - 6)
  const preview = lastLine.length > maxLen
    ? '…' + lastLine.slice(lastLine.length - (maxLen - 1))
    : lastLine

  return (
    <Box flexDirection="row" paddingLeft={2}>
      <Text>{'🧠 '}</Text>
      <Text color="#808080" italic>{preview || 'thinking…'}</Text>
    </Box>
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
    thinkingText: '',
  })

  // Ref kept in sync so the async finally block reads the latest committed state
  const liveRef = useRef(live)
  liveRef.current = live

  const [tokenCount, setTokenCount] = useState(0)

  // ── Line editor (readline-style shortcuts) ────────────────────────────────
  const inputFocused = !live.isThinking
  // Use a ref so the submit callback inside useLineEditor always sees the latest handleSubmit
  const handleSubmitRef = useRef<(text: string) => void>(() => {})
  const [editorState, editorActions] = useLineEditor(inputFocused, (text) => handleSubmitRef.current(text))

  // Mutable map: tool name → ToolCallRow object reference (for O(1) onToolEnd lookup)
  // The same object is referenced inside live.blocks so mutating it updates the display.
  const toolCallMapRef = useRef<Map<string, ToolCallRow>>(new Map())

  // Stores the error message synchronously so the finally block can include it in the
  // completed exchange. Using a ref avoids the React async-state race where setLive
  // in catch() hasn't been processed before finally() reads liveRef.current.
  const turnErrorRef = useRef<string | null>(null)

  const modelName = process.env.MODEL ?? 'claude-sonnet-4-6'
  const sessionShort = session.sessionId.slice(0, 8)
  const statusLine = `${modelName}  ${tokenCount < 1000 ? tokenCount : (tokenCount / 1000).toFixed(1) + 'k'} tokens  #${sessionShort}`

  // ── Turn execution ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const userContent = text.trim()

      setLive({ userContent, blocks: [], isThinking: true, thinkingText: '' })
      toolCallMapRef.current.clear()

      turnErrorRef.current = null

      try {
        await session.runTurn(userContent, {
          onThinking: (delta: string) => {
            setLive(prev => ({ ...prev, thinkingText: prev.thinkingText + delta }))
          },

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
              // Clear thinkingText once real response tokens start arriving
              return { ...prev, isThinking: false, thinkingText: '', blocks }
            })
            setTokenCount(prev => prev + 1)
          },

          onToolStart: (id: string, name: string, input: unknown) => {
            const call: ToolCallRow = {
              id,
              toolName: name,
              status: 'running',
              input,
              startedAt: Date.now(),
            }
            toolCallMapRef.current.set(id, call)
            setLive(prev => ({
              ...prev,
              blocks: [...prev.blocks, { type: 'tool', call }],
            }))
          },

          onToolEnd: (id: string, name: string, success: boolean, output: string) => {
            let call = toolCallMapRef.current.get(id)
            if (!call) {
              // Denied by hook before onToolStart — insert it now
              call = { id, toolName: name, status: success ? 'success' : 'error', startedAt: Date.now() }
              call.error = success ? undefined : output
              toolCallMapRef.current.set(id, call)
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
        // Store the error synchronously in a ref so the finally block can access it.
        // We CANNOT call setLive here and then rely on liveRef.current in finally —
        // React batches state updates asynchronously, so the ref wouldn't be updated
        // by the time finally runs, and the setLive from finally would overwrite it.
        if (!session.isCancelled) {
          turnErrorRef.current = err instanceof Error ? err.message : String(err)
        }
      } finally {
        const finalLive = liveRef.current
        const errorMsg = turnErrorRef.current
        // Append error as a text block so it renders in the completed exchange
        const finalBlocks: TurnBlock[] = errorMsg
          ? [...finalLive.blocks, { type: 'text' as const, content: `[error: ${errorMsg}]` }]
          : finalLive.blocks
        setCompletedExchanges(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            userContent: finalLive.userContent,
            blocks: finalBlocks,
          },
        ])
        turnErrorRef.current = null
        setLive({ userContent: '', blocks: [], isThinking: false, thinkingText: '' })
      }
    },
    [session],
  )
  handleSubmitRef.current = handleSubmit

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
      <Static items={[{ id: '__banner__', type: 'banner' as const }, ...completedExchanges.map(e => ({ ...e, type: 'exchange' as const }))]}>
        {item => {
          if (item.type === 'banner') {
            return <Banner key="__banner__" model={modelName} />
          }
          return (
            <Box key={item.id} flexDirection="column">
              <UserBubble content={item.userContent} width={termWidth} />
              <Text>{' '}</Text>
              <TurnBlocks blocks={item.blocks} />
              <Text>{' '}</Text>
            </Box>
          )
        }}
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

        {/* Extended thinking indicator — shown while model is reasoning */}
        {live.thinkingText.length > 0 ? (
          <ThinkingIndicator text={live.thinkingText} width={termWidth} />
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
          <LineInput
            value={editorState.value}
            cursor={editorState.cursor}
            placeholder={live.isThinking ? 'generating… Esc to cancel' : ''}
            focused={inputFocused}
          />
        </Box>
        <Text dimColor>{'─'.repeat(termWidth)}</Text>

        {/* Status bar */}
        <Text dimColor>{' ' + statusLine}</Text>
      </Box>
    </>
  )
}
