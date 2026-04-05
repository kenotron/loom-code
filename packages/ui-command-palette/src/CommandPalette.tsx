import type { CommandPaletteProps } from './types'

const MAX_VISIBLE = 8

/**
 * CommandPalette — thin display component for the command palette overlay.
 *
 * Returns null when closed. When open, renders a vertical box with:
 * - A search input (focused, accepts typing) showing "> {query}"
 * - A separator line
 * - Up to 8 filtered items, selected item prefixed with "▸ ", others with "  "
 *
 * The <input> is freshly mounted each time the palette opens (component
 * returns null when closed), so it starts with an empty buffer. ✓
 *
 * Arrow navigation and Escape are handled by App.tsx via useKeyboard.
 * Enter / submit executes the currently selected item via onSubmit.
 *
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 */
export function CommandPalette({ state, onQueryChange, onExecute }: CommandPaletteProps) {
  if (!state.open) return null

  const visible = state.filteredItems.slice(0, MAX_VISIBLE)

  return (
    <box style={{ flexDirection: 'column' }}>
      <box style={{ flexDirection: 'row' }}>
        <text fg="white">{'> '}</text>
        <input
          placeholder="search commands..."
          focused
          onInput={(val) => onQueryChange?.(val)}
          onSubmit={() => {
            const item = state.filteredItems[state.selectedIndex]
            if (item) onExecute?.(item)
          }}
          style={{ flexGrow: 1, fg: 'white' }}
        />
      </box>
      <text fg="white">{'\u2500'.repeat(40)}</text>
      {visible.map((item, i) => {
        const prefix = i === state.selectedIndex ? '▸ ' : '  '
        const desc = item.description ? `  ${item.description}` : ''
        // Selected item is bold (attributes=1), others are normal white
        const attrs = i === state.selectedIndex ? 1 : undefined
        return (
          <text key={item.id} fg="white" attributes={attrs}>{`${prefix}${item.label}${desc}`}</text>
        )
      })}
    </box>
  )
}
