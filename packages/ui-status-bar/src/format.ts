import type { StatusBarState } from './types'

/**
 * Format a token count for compact display.
 * Uses 'k' suffix for counts >= 1000, with 1 decimal place.
 * Examples: 500 → "500", 1000 → "1k", 2100 → "2.1k", 10500 → "10.5k"
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return String(count)
  const k = count / 1000
  const rounded = Math.round(k * 10) / 10
  return `${rounded}k`
}

/**
 * Truncate a session UUID to its first 8 characters for compact display.
 * Example: "05476974-dc35-..." → "05476974"
 */
export function truncateSessionId(sessionId: string): string {
  return sessionId.slice(0, 8)
}

/**
 * Format the complete status bar line from session state.
 * Layout: "claude-opus-4  2.1k tokens  #05476974"
 */
export function formatStatusLine(state: StatusBarState): string {
  return `${state.model}  ${formatTokenCount(state.tokenCount)} tokens  #${truncateSessionId(state.sessionId)}`
}
