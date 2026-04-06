import { Box } from 'ink'
import TextInput from 'ink-text-input'
import { BrightText, ColorText } from '@loom-code/ui-primitives'
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
 * Arrow navigation and Escape are handled by App.tsx via useInput.
 * Enter / submit executes the currently selected item via onExecute.
 *
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 */
export function CommandPalette({ state, onQueryChange, onExecute }: CommandPaletteProps) {
  if (!state.open) return null

  const visible = state.filteredItems.slice(0, MAX_VISIBLE)

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <ColorText token="accent.prompt">{'> '}</ColorText>
        <TextInput
          value={state.query}
          onChange={val => onQueryChange?.(val)}
          onSubmit={() => {
            const item = state.filteredItems[state.selectedIndex]
            if (item) onExecute?.(item)
          }}
          focus
          placeholder="search commands..."
        />
      </Box>
      <ColorText token="text.dimmer">{'─'.repeat(40)}</ColorText>
      {visible.map((item, i) => {
        const isSelected = i === state.selectedIndex
        const prefix = isSelected ? '▸ ' : '  '
        const desc = item.description ? `  ${item.description}` : ''
        const label = `${prefix}${item.label}${desc}`
        return isSelected ? (
          <BrightText key={item.id} bold>
            {label}
          </BrightText>
        ) : (
          <ColorText key={item.id} token="text.muted">
            {label}
          </ColorText>
        )
      })}
    </Box>
  )
}
