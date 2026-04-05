import type { CommandItem, CommandPaletteState } from './types'

export function createInitialCommandPaletteState(items: CommandItem[] = []): CommandPaletteState {
  return { open: false, query: '', items, filteredItems: items, selectedIndex: 0 }
}

export function openPalette(state: CommandPaletteState): CommandPaletteState {
  return { ...state, open: true, query: '', filteredItems: state.items, selectedIndex: 0 }
}

export function closePalette(state: CommandPaletteState): CommandPaletteState {
  return { ...state, open: false, query: '', selectedIndex: 0 }
}

export function setQuery(state: CommandPaletteState, query: string): CommandPaletteState {
  const q = query.toLowerCase()
  const filteredItems = state.items.filter(
    item =>
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.group?.toLowerCase().includes(q)
  )
  return { ...state, query, filteredItems, selectedIndex: 0 }
}

export function moveSelection(state: CommandPaletteState, direction: 'up' | 'down'): CommandPaletteState {
  const len = state.filteredItems.length
  if (len === 0) return state
  const next = direction === 'down'
    ? (state.selectedIndex + 1) % len
    : (state.selectedIndex - 1 + len) % len
  return { ...state, selectedIndex: next }
}

export function selectedItem(state: CommandPaletteState): CommandItem | undefined {
  return state.filteredItems[state.selectedIndex]
}
