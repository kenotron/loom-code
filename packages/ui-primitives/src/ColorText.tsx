import { Text } from 'ink'
import { resolveToken } from './theme'
import type { TokenName } from './theme'

export interface ColorTextProps {
  token: TokenName
  children: string
  bold?: boolean
}

/**
 * Renders a styled text element using a semantic token name.
 *
 * The token resolves to the correct fg hex + attributes for the detected
 * theme mode (dark/light) and color depth (truecolor/ansi16).
 */
export function ColorText({ token, children, bold = false }: ColorTextProps) {
  const resolved = resolveToken(token)
  const isDim = resolved.attrs === 2
  return (
    <Text color={resolved.fg} dimColor={isDim} bold={bold || resolved.attrs === 1}>
      {children}
    </Text>
  )
}
