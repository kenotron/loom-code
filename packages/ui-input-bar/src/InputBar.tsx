import { useState, useCallback } from 'react'
import { resolveToken, ColorText } from '@loom-code/ui-primitives'
import { updateValue, submitValue, toggleMic } from './state'
import type { InputBarProps } from './types'

const MIC_ICON = '🎤'
const MIC_ACTIVE_ICON = '●'
const SEPARATOR_CHAR = '─'

/**
 * InputBar — pure chat input. No slash commands. No settings.
 *
 * App-layer concerns (tools, settings, session management) live in the
 * Ctrl-P command palette, not here. This component handles ONLY text input.
 *
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 *
 * Renders as a 3-line box:
 *   Line 1: ────────────────────── (separator, full width, text.dimmer color)
 *   Line 2: ▸ [input or ⠋ thinking] (prompt + input)
 *   Line 3: (empty padding line)
 */
export function InputBar({ initialState, callbacks, placeholder = '▸', focused, termWidth, isThinking }: InputBarProps) {
  const [state, setState] = useState(initialState)

  const handleInput = useCallback((value: string) => {
    setState(prev => updateValue(prev, value))
    callbacks.onValueChange?.(value)
  }, [callbacks])

  const handleSubmit = useCallback(() => {
    const { newState, submitted } = submitValue(state)
    setState(newState)
    if (submitted !== null) {
      callbacks.onSubmit(submitted)
    }
  }, [state, callbacks])

  const handleMicToggle = useCallback(() => {
    const next = toggleMic(state)
    setState(next)
    callbacks.onVoiceToggle?.()
  }, [state, callbacks])

  const width = termWidth ?? 80
  const separator = SEPARATOR_CHAR.repeat(width)
  const promptColor = resolveToken('accent.prompt')
  const thinkingColor = resolveToken('status.running')

  return (
    <box bg="#141414" style={{ flexDirection: 'column' }}>
      {/* Line 1: separator */}
      <ColorText token="text.dimmer">{separator}</ColorText>
      {/* Line 2: prompt + input */}
      <box style={{ flexDirection: 'row' }}>
        {isThinking ? (
          <text fg={thinkingColor.fg} attributes={thinkingColor.attrs}>{'⠋ '}</text>
        ) : (
          <text fg={promptColor.fg} attributes={promptColor.attrs}>{'▸ '}</text>
        )}
        <input
          value={state.value}
          onInput={handleInput}
          onSubmit={handleSubmit}
          fg={resolveToken('text.primary').fg}
          attributes={resolveToken('text.primary').attrs}
          style={{ flexGrow: 1 }}
          focused={focused !== false && !isThinking}
          placeholder={isThinking ? 'generating… Esc to cancel' : ''}
        />
        {callbacks.onVoiceToggle !== undefined && (
          <text fg={promptColor.fg}>{state.micActive ? MIC_ACTIVE_ICON : MIC_ICON}</text>
        )}
      </box>
      {/* Line 3: padding */}
      <text>{' '}</text>
    </box>
  )
}
