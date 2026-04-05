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

// Keyboard
import { useKeyboard } from '@opentui/react'

// Session + commands
import { createSession } from './session'
import { createDefaultCommands } from './commands'

export function App() {
  // ── Core state ────────────────────────────────────────────────
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

  // ── Submit handler ────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      // Show user message immediately
      const msgId = crypto.randomUUID()
      setHistoryState(prev => appendUserMessage(prev, msgId, text))

      // Start assistant stream
      const streamId = crypto.randomUUID()
      setHistoryState(prev => startAssistantStream(prev, streamId))

      // Update attention panel intent
      setAttentionState(prev => updateIntent(prev, text))

      try {
        await session.runTurn(text, {
          onToken: (token: string) => {
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
        const errMsg = err instanceof Error ? err.message : String(err)
        setHistoryState(prev => appendToken(prev, `\n[error: ${errMsg}]`))
      } finally {
        setHistoryState(prev => finalizeStream(prev))
      }
    },
    [session],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────
  useKeyboard(key => {
    // Ctrl+P → toggle command palette
    if (key.ctrl && key.name === 'p') {
      key.preventDefault()
      setPaletteState(prev => (prev.open ? closePalette(prev) : openPalette(prev)))
      return
    }
    // When palette is open: arrow keys navigate, Escape closes
    // (key.name is lowercase: 'up', 'down', 'escape' — @opentui/core convention)
    if (paletteState.open) {
      if (key.name === 'up') {
        key.preventDefault()
        setPaletteState(prev => moveSelection(prev, 'up'))
      } else if (key.name === 'down') {
        key.preventDefault()
        setPaletteState(prev => moveSelection(prev, 'down'))
      } else if (key.name === 'escape') {
        key.preventDefault()
        setPaletteState(prev => closePalette(prev))
      }
    }
  })

  // ── Layout ────────────────────────────────────────────────────
  return (
    <box style={{ flexDirection: 'column', height: '100%' }}>
      <StatusBar state={statusState} />
      <AttentionPanel state={attentionState} />
      <box style={{ flexGrow: 1, overflow: 'hidden' }}>
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
      />
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
