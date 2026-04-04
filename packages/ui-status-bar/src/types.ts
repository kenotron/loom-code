/**
 * State for the status bar — updated by LoomSession on each turn.
 */
export interface StatusBarState {
  /** LLM model identifier, e.g. 'claude-opus-4' */
  model: string
  /** Running token count for this session */
  tokenCount: number
  /** Full session UUID */
  sessionId: string
}

/**
 * Props for the StatusBar component.
 */
export interface StatusBarProps {
  state: StatusBarState
}
