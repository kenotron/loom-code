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
export function InputBar({ state: externalState, callbacks, placeholder = '▸' }: InputBarProps) {
  const [state, setState] = useState(externalState)

  const handleInput = useCallback((value: string) => {
    const next = updateValue(state, value)
    setState(next)
    callbacks.onValueChange?.(value)
  }, [state, callbacks])

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
        value={state.value}
        onInput={handleInput}
        onSubmit={handleSubmit}
        focused
      />
      {callbacks.onVoiceToggle !== undefined && (
        <text>{state.micActive ? MIC_ACTIVE_ICON : MIC_ICON}</text>
      )}
    </box>
  )
}
