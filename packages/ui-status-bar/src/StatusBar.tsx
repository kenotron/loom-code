import { Box, Text } from 'ink'
import { ColorText } from '@loom-code/ui-primitives'
import { formatStatusLine } from './format'
import type { StatusBarProps } from './types'

/**
 * StatusBar — a single-line display showing model name, token count, and session ID.
 *
 * Renders using ink terminal primitives.
 * All formatting logic lives in format.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 *
 * Layout: │ claude-opus-4  2.1k tokens  #05476974 │
 *
 * Style: dim white (text.dim token)
 */
export function StatusBar({ state }: StatusBarProps) {
  return (
    <Box flexDirection="row">
      <Text>{'  '}</Text>
      <ColorText token="text.dim">{formatStatusLine(state)}</ColorText>
    </Box>
  )
}
