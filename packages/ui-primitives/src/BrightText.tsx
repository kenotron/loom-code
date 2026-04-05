/**
 * BrightText — primary text rendered at full intensity across terminal types.
 *
 * The challenge: opentui always emits 24-bit RGB escape codes (e.g.
 * \x1b[38;2;255;255;255m). On terminals that don't declare COLORTERM=truecolor
 * (like Apple Terminal), this renders as dim gray rather than bright white.
 *
 * Strategy (same insight as OpenAI Codex highlight.rs):
 *   - Truecolor terminal → use explicit #ffffff via 24-bit RGB (sharp, correct)
 *   - Other terminals    → no explicit fg + attributes=BOLD
 *
 * The bold attribute (\x1b[1m) is the original ANSI meaning of "bright/intense".
 * ANSI 97 (bright white) is literally just ANSI 7 (white) + bold intensity.
 * Using bold with the terminal's own default foreground gives full brightness
 * on any terminal regardless of color depth — no COLORTERM required.
 */

const colorterm = process.env.COLORTERM?.toLowerCase()
const IS_TRUECOLOR = colorterm === 'truecolor' || colorterm === '24bit'

const BOLD = 1

export interface BrightTextProps {
  children: string
  /** Additional text attributes (bold is added automatically on non-truecolor). */
  attributes?: number
}

export function BrightText({ children, attributes = 0 }: BrightTextProps) {
  if (IS_TRUECOLOR) {
    return <text fg="#ffffff" attributes={attributes}>{children}</text>
  }
  // No explicit fg = terminal's own default foreground.
  // Bold attribute signals "bright/intense" — the same mechanism behind ANSI 97.
  return <text attributes={attributes | BOLD}>{children}</text>
}
