import type { CommandPaletteProps } from './types'

const MAX_VISIBLE = 8

/**
 * CommandPalette — thin display component for the command palette overlay.
 *
 * Returns null when closed. When open, renders a vertical box with:
 * - A search line showing "> {query}"
 * - A separator line
 * - Up to 8 filtered items, selected item prefixed with "▸ ", others with "  "
 *
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 */
export function CommandPalette({ state }: CommandPaletteProps) {
  if (!state.open) return null

  const visible = state.filteredItems.slice(0, MAX_VISIBLE)

  return (
    <box style={{ flexDirection: 'column' }}>
      <text>{`> ${state.query}`}</text>
      <text>{'─'.repeat(40)}</text>
      {visible.map((item, i) => {
        const prefix = i === state.selectedIndex ? '▸ ' : '  '
        const desc = item.description ? `  ${item.description}` : ''
        return (
          <text key={item.id}>{`${prefix}${item.label}${desc}`}</text>
        )
      })}
    </box>
  )
}
