// @loom-code/ui-input-bar — Public API

// Types
export type { InputBarState, InputBarCallbacks, InputBarProps } from './types'

// Pure state machine
export {
  createInitialInputBarState,
  updateValue,
  submitValue,
  toggleMic,
} from './state'

// Component
export { InputBar } from './InputBar'
