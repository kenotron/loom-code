import { formatStatusLine } from './format'
import type { StatusBarProps } from './types'

/**
 * StatusBar — a single-line display showing model name, token count, and session ID.
 *
 * Renders using @opentui/react terminal primitives.
 * All formatting logic lives in format.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 *
 * Layout: │ claude-opus-4  2.1k tokens  #05476974 │
 */
export function StatusBar({ state }: StatusBarProps) {
  return <text>{formatStatusLine(state)}</text>
}
