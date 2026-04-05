/**
 * Terminal color theming with semantic tokens, dark/light modes, and
 * automatic color-depth downconversion.
 *
 * opentui always emits \x1b[38;2;R;G;Bm (24-bit RGB). It cannot emit raw
 * ANSI 16-color codes via fg props. Our downconversion strategy:
 *
 *   truecolor terminal  → use exact hex via 24-bit RGB
 *   other terminal      → use ANSI 16 approximation hex + bold attribute
 *                         for "bright" intensity (bold = \x1b[1m = the same
 *                         intensity signal as ANSI 90-97 "bright" range)
 *
 * ANSI 16 color reference (hex = RGB equivalent of ANSI code):
 *
 *   97 bright white   #ffffff  (+ bold)
 *   96 bright cyan    #55ffff
 *   92 bright green   #55ff55
 *   93 bright yellow  #ffff55
 *   91 bright red     #ff5555
 *   37 white/gray     #aaaaaa
 *   90 dark gray      #555555
 *   30 black          #222222
 */

// ── Semantic token names ────────────────────────────────────────────
// Dot-notation string union. Exhaustive, autocomplete-friendly.

export type TokenName =
  | 'text.primary'       // main content text
  | 'text.muted'         // tool names, unselected items
  | 'text.dim'           // arrows, timestamps, collapse indicators
  | 'text.dimmer'        // separators, empty-state hints
  | 'label.user'         // "you" speaker label
  | 'label.ai'           // "ai" speaker label
  | 'status.running'     // spinner, "generating", thinking
  | 'status.success'     // checkmark, completed
  | 'status.error'       // error icon, failure
  | 'accent.prompt'      // prompt arrow "▸", mic icon, palette ">"
  | 'surface.bg'         // root background

// ── Color value ─────────────────────────────────────────────────────
// Each token resolves to one of these per theme mode.

export interface ColorValue {
  /** Exact 24-bit hex for truecolor terminals. */
  hex: string
  /**
   * ANSI 16 approximation hex — the RGB equivalent of a 16-color code.
   * On non-truecolor terminals, this hex is sent instead of `hex`.
   */
  ansi16: string
  /**
   * When true, bold (\x1b[1m) is added on non-truecolor terminals.
   * This is the ANSI "bright" intensity signal — ANSI 97 (bright white)
   * is literally ANSI 37 (white) + bold.
   */
  bright?: boolean
}

// ── Theme definition ────────────────────────────────────────────────

export type ThemeDef = Record<TokenName, ColorValue>

// ── Detection types ─────────────────────────────────────────────────

export type ColorDepth = 'truecolor' | 'ansi16'
export type ThemeMode = 'dark' | 'light'

// ── Resolved output ─────────────────────────────────────────────────
// What components actually consume — maps directly to opentui props.

export interface ResolvedColor {
  /** Hex string for the `fg` (or `bg`) prop. */
  fg: string
  /** Attribute bitmask — 0 or 1 (BOLD) for bright on non-truecolor. */
  attrs: number
}

// ── Detection — module-level singletons ─────────────────────────────
// Set once at import time. Never changes during process lifetime.

/** Color depth: truecolor when COLORTERM=truecolor|24bit, else ansi16. */
export const colorDepth: ColorDepth = (() => {
  const ct = process.env.COLORTERM?.toLowerCase()
  return (ct === 'truecolor' || ct === '24bit') ? 'truecolor' : 'ansi16'
})()

/**
 * Theme mode: dark or light.
 *
 * Priority: LOOM_CODE_THEME > COLORFGBG heuristic > default 'dark'.
 * COLORFGBG format is "fg;bg" — bg index > 6 suggests a light background.
 */
export const themeMode: ThemeMode = (() => {
  const explicit = process.env.LOOM_CODE_THEME?.toLowerCase()
  if (explicit === 'light' || explicit === 'dark') return explicit

  const colorfgbg = process.env.COLORFGBG
  if (colorfgbg) {
    const bg = parseInt(colorfgbg.split(';').pop() ?? '', 10)
    if (!isNaN(bg) && bg > 6) return 'light'
  }

  return 'dark'
})()

// ── Theme definitions ───────────────────────────────────────────────

const dark: ThemeDef = {
  // ansi16 = 'transparent' (alpha=0) tells the Zig renderer to skip emitting
  // a fg escape code entirely, so the terminal's own default foreground renders
  // at full native intensity. '#ffffff' here would still emit \x1b[38;2;255;255;255m
  // which Apple Terminal renders as dim gray.
  'text.primary':    { hex: '#ffffff', ansi16: 'transparent', bright: true },  // 97
  'text.muted':      { hex: '#909090', ansi16: '#aaaaaa' },               // 37
  'text.dim':        { hex: '#505050', ansi16: '#555555' },               // 90
  'text.dimmer':     { hex: '#303030', ansi16: '#555555' },               // 90
  'label.user':      { hex: '#4fc3f7', ansi16: '#55ffff' },              // 96
  'label.ai':        { hex: '#69f0ae', ansi16: '#55ff55' },              // 92
  'status.running':  { hex: '#ffd740', ansi16: '#ffff55' },              // 93
  'status.success':  { hex: '#69f0ae', ansi16: '#55ff55' },              // 92
  'status.error':    { hex: '#ff6b6b', ansi16: '#ff5555' },              // 91
  'accent.prompt':   { hex: '#7cb9e8', ansi16: '#55ffff' },              // 96
  'surface.bg':      { hex: '#0a0a0a', ansi16: '#222222' },              // 30
}

const light: ThemeDef = {
  'text.primary':    { hex: '#1a1a1a', ansi16: 'transparent', bright: true },  // terminal default
  'text.muted':      { hex: '#606060', ansi16: '#555555' },              // 90
  'text.dim':        { hex: '#909090', ansi16: '#aaaaaa' },              // 37
  'text.dimmer':     { hex: '#b0b0b0', ansi16: '#aaaaaa' },              // 37
  'label.user':      { hex: '#0277bd', ansi16: '#55ffff' },              // 96
  'label.ai':        { hex: '#2e7d32', ansi16: '#55ff55' },              // 92
  'status.running':  { hex: '#f57f17', ansi16: '#ffff55' },              // 93
  'status.success':  { hex: '#2e7d32', ansi16: '#55ff55' },              // 92
  'status.error':    { hex: '#c62828', ansi16: '#ff5555' },              // 91
  'accent.prompt':   { hex: '#1565c0', ansi16: '#55ffff' },              // 96
  'surface.bg':      { hex: '#f5f5f5', ansi16: '#ffffff', bright: true },// 97
}

const themes: Record<ThemeMode, ThemeDef> = { dark, light }

// ── Core API ────────────────────────────────────────────────────────

/**
 * Resolve a semantic token to concrete fg + attrs for the current terminal.
 *
 * Uses module-level `themeMode` and `colorDepth` (set once at import from env).
 * The result maps directly to opentui `fg` and `attributes` props.
 */
export function resolveToken(name: TokenName): ResolvedColor {
  const cv = themes[themeMode][name]
  if (colorDepth === 'truecolor') {
    return { fg: cv.hex, attrs: 0 }
  }
  return {
    fg: cv.ansi16,
    attrs: cv.bright ? 1 : 0,   // 1 = TextAttributes.BOLD
  }
}
