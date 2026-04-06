import { Text } from 'ink'
import { resolveToken } from './theme'

export interface BrightTextProps {
  children: string
  bold?: boolean
}

/**
 * Convenience wrapper — renders primary (white/intense) text.
 * Equivalent to <ColorText token="text.primary">.
 */
export function BrightText({ children, bold = false }: BrightTextProps) {
  const resolved = resolveToken('text.primary')
  return (
    <Text color={resolved.fg} bold={bold || resolved.attrs === 1}>
      {children}
    </Text>
  )
}
