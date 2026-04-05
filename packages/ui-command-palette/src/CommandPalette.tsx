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
export function CommandPalette({ state, onQueryChange, onExecute, textFg }: CommandPaletteProps) {
  if (!state.open) return null

  const visible = state.filteredItems.slice(0, MAX_VISIBLE)

  return (
    <box style={{ flexDirection: 'column' }}>
      <box style={{ flexDirection: 'row' }}>
        <text fg="#7cb9e8">{'> '}</text>
        <input
          placeholder="search commands..."
          focused
          onInput={(val) => onQueryChange?.(val)}
          onSubmit={() => {
            const item = state.filteredItems[state.selectedIndex]
            if (item) onExecute?.(item)
          }}
          fg={textFg}
          style={{ flexGrow: 1 }}
        />
      </box>
      <text fg="#303030">{'─'.repeat(40)}</text>
      {visible.map((item, i) => {
        const isSelected = i === state.selectedIndex
        const prefix = isSelected ? '▸ ' : '  '
        const desc = item.description ? `  ${item.description}` : ''
        return (
          <text
            key={item.id}
            fg={isSelected ? textFg : '#909090'}
            attributes={isSelected ? 1 : 0}
          >
            {`${prefix}${item.label}${desc}`}
          </text>
        )
      })}
    </box>
  )
}
