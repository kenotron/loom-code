/**
 * Runtime state for the input bar — managed externally by the CLI controller.
 */
export interface InputBarState {
  /** Current text value of the input field */
  value: string
  /** True when voice capture is active */
  micActive: boolean
}

/**
 * Event handler callbacks for the input bar.
 * Wired to session control logic by the CLI assembly.
 */
export interface InputBarCallbacks {
  /** Called when the user submits (Enter). Receives the trimmed text. */
  onSubmit: (text: string) => void
  /** Called when the text value changes (optional — for controlled input). */
  onValueChange?: (value: string) => void
  /** Called when the mic button is toggled (optional — for voice support). */
  onVoiceToggle?: () => void
}

/**
 * Props for the InputBar component.
 */
export interface InputBarProps {
  /** Initial state — used at mount time. The component manages its editing buffer after mount. */
  initialState: InputBarState
  callbacks: InputBarCallbacks
  /** Placeholder text shown when input is empty. Default: '▸' */
  placeholder?: string
  /**
   * Whether the input field should be focused (i.e. receive typed characters).
   * Defaults to true. Pass false when another input — e.g. the command palette
   * search box — should hold focus so typed keys don't go to both fields.
   */
  focused?: boolean
  /** Explicit foreground color for input text. Omit to use terminal default (safe for non-truecolor terminals). */
  textFg?: string
}
