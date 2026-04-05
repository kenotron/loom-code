import { describe, it, expect } from 'bun:test'
import {
  createInitialCommandPaletteState, openPalette, closePalette,
  setQuery, moveSelection, selectedItem,
} from '../state'
import { CommandPalette } from '../CommandPalette'

const items = [
  { id: 'switch-model', label: 'Switch model', description: 'Change AI model', group: 'session', action: () => {} },
  { id: 'new-session', label: 'New session', description: 'Start fresh', group: 'session', action: () => {} },
  { id: 'settings', label: 'Settings', description: 'Open settings', group: 'app', action: () => {} },
]

describe('@loom-code/ui-command-palette', () => {
  it('exports CommandPalette component', () => {
    expect(typeof CommandPalette).toBe('function')
  })

  it('opens and closes correctly', () => {
    let state = createInitialCommandPaletteState(items)
    expect(state.open).toBe(false)
    state = openPalette(state)
    expect(state.open).toBe(true)
    expect(state.selectedIndex).toBe(0)
    state = closePalette(state)
    expect(state.open).toBe(false)
  })

  it('filters items by query — matches label, description, group', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    state = setQuery(state, 'session')
    expect(state.filteredItems.length).toBeGreaterThanOrEqual(2)
    state = setQuery(state, 'new')
    expect(state.filteredItems).toHaveLength(1)
    expect(state.filteredItems[0].id).toBe('new-session')
  })

  it('empty query shows all items', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    state = setQuery(state, '')
    expect(state.filteredItems).toHaveLength(3)
  })

  it('moveSelection wraps around', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    expect(state.selectedIndex).toBe(0)
    state = moveSelection(state, 'up')
    expect(state.selectedIndex).toBe(2)
    state = moveSelection(state, 'down')
    expect(state.selectedIndex).toBe(0)
  })

  it('selectedItem returns highlighted item', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    state = moveSelection(state, 'down')
    expect(selectedItem(state)?.id).toBe('new-session')
  })
})
