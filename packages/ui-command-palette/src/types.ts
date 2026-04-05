export interface CommandItem {
  id: string
  label: string
  description?: string
  group?: string
  action: () => void | Promise<void>
}

export interface CommandPaletteState {
  open: boolean
  query: string
  items: CommandItem[]
  filteredItems: CommandItem[]
  selectedIndex: number
}

export interface CommandPaletteProps {
  state: CommandPaletteState
  onClose?: () => void
  onExecute?: (item: CommandItem) => void
  onQueryChange?: (query: string) => void
  onSelectionChange?: (index: number) => void
  /** Explicit foreground color for primary text. Omit to use terminal default (safe for non-truecolor terminals). */
  textFg?: string
}
