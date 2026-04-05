import { resolveToken } from './theme'
import type { TokenName } from './theme'

export interface ColorTextProps {
  token: TokenName
  children: string
  attributes?: number
}

/**
 * Renders a styled text element using a semantic token name.
 *
 * The token resolves to the correct fg hex + attributes for the detected
 * theme mode (dark/light) and color depth (truecolor/ansi16).
 */
export function ColorText({ token, children, attributes = 0 }: ColorTextProps) {
  const resolved = resolveToken(token)
  return (
    <text fg={resolved.fg} attributes={resolved.attrs | attributes}>
      {children}
    </text>
  )
}
