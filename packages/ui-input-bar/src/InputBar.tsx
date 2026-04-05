import { useState, useCallback } from 'react'
import { updateValue, submitValue, toggleMic } from './state'
import type { InputBarProps } from './types'

const MIC_ICON = '🎤'
const MIC_ACTIVE_ICON = '●'

/**
 * InputBar — pure chat input. No slash commands. No settings.
 *
 * App-layer concerns (tools, settings, session management) live in the
 * Ctrl-P command palette, not here. This component handles ONLY text input.
 *
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 */
export function InputBar({ initialState, callbacks, placeholder = '▸' }: InputBarProps) {
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

  return (
    <box style={{ flexDirection: 'row' }}>
      <text>{placeholder} </text>
      <input
        onInput={handleInput}
        onSubmit={handleSubmit}
        style={{ flexGrow: 1 }}
        focused
      />
      {callbacks.onVoiceToggle !== undefined && (
        <text>{state.micActive ? MIC_ACTIVE_ICON : MIC_ICON}</text>
      )}
    </box>
  )
}
