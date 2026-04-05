import { BrightText, ColorText, resolveToken } from '@loom-code/ui-primitives'
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
        <ColorText token="accent.prompt">{'> '}</ColorText>
        <input
          placeholder="search commands..."
          focused
          onInput={(val) => onQueryChange?.(val)}
          onSubmit={() => {
            const item = state.filteredItems[state.selectedIndex]
            if (item) onExecute?.(item)
          }}
          fg={resolveToken('text.primary').fg}
          style={{ flexGrow: 1 }}
        />
      </box>
      <ColorText token="text.dimmer">{'─'.repeat(40)}</ColorText>
      {visible.map((item, i) => {
        const isSelected = i === state.selectedIndex
        const prefix = isSelected ? '▸ ' : '  '
        const desc = item.description ? `  ${item.description}` : ''
        const label = `${prefix}${item.label}${desc}`
        return isSelected
          ? <BrightText key={item.id} attributes={1}>{label}</BrightText>
          : <ColorText key={item.id} token="text.muted">{label}</ColorText>
      })}
    </box>
  )
}
