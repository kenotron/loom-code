import type { InputBarState } from './types'

/**
 * Create the initial empty state for an input bar.
 */
export function createInitialInputBarState(): InputBarState {
  return { value: '', micActive: false }
}

/**
 * Update the text value — returns new state without mutating the original.
 */
export function updateValue(state: InputBarState, value: string): InputBarState {
  return { ...state, value }
}

/**
 * Submit the current input value.
 *
 * Returns: { newState (value cleared), submitted (trimmed text or null if empty/whitespace-only) }
 *
 * Pattern: the caller receives both the new state (to apply to React state) and the
 * submitted text (to send to LoomSession). If submitted is null, the input was empty.
 */
export function submitValue(state: InputBarState): {
  newState: InputBarState
  submitted: string | null
} {
  const trimmed = state.value.trim()
  return {
    newState: { ...state, value: '' },
    submitted: trimmed.length > 0 ? trimmed : null,
  }
}

/**
 * Toggle the microphone active/inactive state — returns new state without mutating.
 */
export function toggleMic(state: InputBarState): InputBarState {
  return { ...state, micActive: !state.micActive }
}
