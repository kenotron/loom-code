import { ColorText } from './ColorText'
import type { ColorTextProps } from './ColorText'

export type BrightTextProps = Omit<ColorTextProps, 'token'>

/**
 * Convenience wrapper — renders primary (white/intense) text.
 * Equivalent to <ColorText token="text.primary">.
 */
export function BrightText({ children, attributes }: BrightTextProps) {
  return <ColorText token="text.primary" attributes={attributes}>{children}</ColorText>
}
