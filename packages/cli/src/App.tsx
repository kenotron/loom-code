import { useState, useCallback, useRef } from 'react'
// State machines
import { createInitialInputBarState } from '@loom-code/ui-input-bar'
import { createInitialAttentionState, updateIntent } from '@loom-code/ui-attention-panel'
import {
  createInitialChatHistoryState,
  appendUserMessage,
  startAssistantStream,
  appendToken,
  finalizeStream,
  addToolCall,
  updateToolCall,
  toggleGroup,
} from '@loom-code/ui-chat-history'
import {
  createInitialCommandPaletteState,
  openPalette,
  closePalette,
  setQuery as setPaletteQuery,
  moveSelection,
  selectedItem,
} from '@loom-code/ui-command-palette'

// Types
import type { StatusBarState } from '@loom-code/ui-status-bar'
import type { InputBarState } from '@loom-code/ui-input-bar'
import type { AttentionState } from '@loom-code/ui-attention-panel'
import type { ChatHistoryState } from '@loom-code/ui-chat-history'
import type { CommandPaletteState } from '@loom-code/ui-command-palette'

// Components
import { StatusBar } from '@loom-code/ui-status-bar'
import { AttentionPanel } from '@loom-code/ui-attention-panel'
import { ChatHistory } from '@loom-code/ui-chat-history'
import { InputBar } from '@loom-code/ui-input-bar'
import { CommandPalette } from '@loom-code/ui-command-palette'

// Keyboard + terminal dimensions
import { useKeyboard, useTerminalDimensions } from '@opentui/react'

// Detect terminal color capability once at startup.
// Without COLORTERM=truecolor, opentui falls back to 256-color mode where
// explicit #ffffff maps to a dim white. In that case we pass undefined so
// the terminal's own default foreground (always rendered at full intensity)
// is used instead.


// Session + commands
import { createSession } from './session'
import { createDefaultCommands } from './commands'

export function App() {
  const { width: termWidth, height: termHeight } = useTerminalDimensions()

  // ── Core state ────────────────────────────────────────────────────────────
  const [session] = useState(() => createSession())

  const [statusState, setStatusState] = useState<StatusBarState>({
    model: process.env.MODEL ?? 'claude-opus-4-5',
    tokenCount: 0,
    sessionId: session.sessionId,
  })
  const [attentionState, setAttentionState] = useState<AttentionState>(() =>
    createInitialAttentionState(),
  )
  const [historyState, setHistoryState] = useState<ChatHistoryState>(() =>
    createInitialChatHistoryState(),
  )
  const [inputState, setInputState] = useState<InputBarState>(() =>
    createInitialInputBarState(),
  )
  const [paletteState, setPaletteState] = useState<CommandPaletteState>(() => {
    const commands = createDefaultCommands({
      onNewSession: () => {
        setHistoryState(createInitialChatHistoryState())
        setAttentionState(createInitialAttentionState())
      },
      onClearHistory: () => setHistoryState(createInitialChatHistoryState()),
    })
    return createInitialCommandPaletteState(commands)
  })

  // Track in-flight tool calls so we can map name → id for onToolEnd
  const toolCallIdRef = useRef<Map<string, string>>(new Map())

  // ── Submit / queue ────────────────────────────────────────────────────────
  // Guard against concurrent submits (ref avoids re-render on change)
  const isRunning = useRef(false)

  // Visual indicator while waiting for first token
  const [isThinking, setIsThinking] = useState(false)

  // Queue for messages submitted while AI is running
  const messageQueueRef = useRef<string[]>([])

  // Ref kept in sync with the latest runTurn so the queue processor
  // always gets the non-stale version without a circular useCallback dep.
  const runTurnRef = useRef<(text: string, skipUserMessage?: boolean) => Promise<void>>(
    async () => {},
  )

  /**
   * Core turn executor. Shows the user message (unless already shown when
   * queued), starts the stream, and processes the next queued message when done.
   *
   * @param text            The prompt text to send.
   * @param skipUserMessage When true, the user message was already appended to
   *                        history at queue time — don't append it again.
   */
  const runTurn = useCallback(
    async (text: string, skipUserMessage = false) => {
      isRunning.current = true

      if (!skipUserMessage) {
        const msgId = crypto.randomUUID()
        setHistoryState(prev => appendUserMessage(prev, msgId, text))
      }

      // Start assistant stream
      const streamId = crypto.randomUUID()
      setHistoryState(prev => startAssistantStream(prev, streamId))

      // Update attention panel intent
      setAttentionState(prev => updateIntent(prev, text))

      setIsThinking(true)
      let firstToken = true

      try {
        await session.runTurn(text, {
          onToken: (token: string) => {
            if (firstToken) {
              setIsThinking(false)
              firstToken = false
            }
            setHistoryState(prev => appendToken(prev, token))
            setStatusState(prev => ({
              ...prev,
              tokenCount: prev.tokenCount + 1,
            }))
          },
          onToolStart: (name: string) => {
            const toolId = crypto.randomUUID()
            toolCallIdRef.current.set(name, toolId)
            setHistoryState(prev => addToolCall(prev, toolId, name))
          },
          onToolEnd: (name: string, success: boolean, output: string) => {
            const toolId = toolCallIdRef.current.get(name)
            if (toolId) {
              setHistoryState(prev =>
                updateToolCall(
                  prev,
                  toolId,
                  success ? 'success' : 'error',
                  success ? output : undefined,
                  success ? undefined : output,
                ),
              )
              toolCallIdRef.current.delete(name)
            }
          },
        })
      } catch (err) {
        // Don't surface an error if the turn was intentionally cancelled
        if (!session.isCancelled) {
          const errMsg = err instanceof Error ? err.message : String(err)
          setHistoryState(prev => appendToken(prev, `\n[error: ${errMsg}]`))
        }
      } finally {
        isRunning.current = false
        setIsThinking(false)
        setHistoryState(prev => finalizeStream(prev))

        // Process the next queued message (if any). Use the ref so we always
        // get the current version of runTurn even after re-renders.
        const next = messageQueueRef.current[0]
        messageQueueRef.current = messageQueueRef.current.slice(1)
        if (next) {
          // The queued message was already appended to history at queue time.
          setTimeout(() => runTurnRef.current(next, true), 50)
        }
      }
    },
    [session],
  )

  // Keep ref in sync so queue processing never captures a stale closure.
  runTurnRef.current = runTurn

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      // If already running, enqueue and show the message immediately
      if (isRunning.current) {
        const queuedMsgId = crypto.randomUUID()
        setHistoryState(prev => appendUserMessage(prev, queuedMsgId, text))
        messageQueueRef.current = [...messageQueueRef.current, text]
        return
      }

      await runTurn(text)
    },
    [runTurn],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboard(key => {
    // Ctrl-P → toggle palette
    if (key.ctrl && key.name === 'p') {
      key.preventDefault()
      setPaletteState(prev => prev.open ? closePalette(prev) : openPalette(prev))
      return
    }

    // Escape: close palette OR cancel running response
    if (key.name === 'escape') {
      key.preventDefault()
      if (paletteState.open) {
        setPaletteState(prev => closePalette(prev))
      } else if (isRunning.current) {
        messageQueueRef.current = []
        session.cancel()
      }
      return
    }

    // Palette navigation (only when open)
    if (paletteState.open) {
      if (key.name === 'up') {
        key.preventDefault()
        setPaletteState(prev => moveSelection(prev, 'up'))
      } else if (key.name === 'down') {
        key.preventDefault()
        setPaletteState(prev => moveSelection(prev, 'down'))
      }
    }
    // Ctrl-C: do NOT intercept — let the process exit normally
  })

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <box bg="#0a0a0a" style={{ flexDirection: 'column', height: '100%' }}>
      <box style={{ flexGrow: 1, overflow: 'hidden' }}>
        <AttentionPanel state={attentionState} />
        <ChatHistory
          state={historyState}
          onToggleGroup={id => setHistoryState(prev => toggleGroup(prev, id))}
        />
      </box>
      <InputBar
        initialState={inputState}
        callbacks={{
          onSubmit: handleSubmit,
          onValueChange: (value: string) =>
            setInputState(prev => ({ ...prev, value })),
        }}
        focused={!paletteState.open}
        termWidth={termWidth}
        isThinking={isThinking}
      />
      <StatusBar state={statusState} />
      {paletteState.open && (
        <CommandPalette
          state={paletteState}
          onClose={() => setPaletteState(prev => closePalette(prev))}
          onQueryChange={q => setPaletteState(prev => setPaletteQuery(prev, q))}
          onSelectionChange={i =>
            setPaletteState(prev => ({ ...prev, selectedIndex: i }))
          }
          onExecute={item => {
            item.action()
            setPaletteState(prev => closePalette(prev))
          }}
        />
      )}
    </box>
  )
}
