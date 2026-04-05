import type { CommandItem } from '@loom-code/ui-command-palette'

/**
 * Build the default command list for the command palette.
 *
 * Each command maps to a callback supplied by the App — the palette
 * itself has no direct knowledge of session or state management.
 */
export function createDefaultCommands(callbacks: {
  onNewSession?: () => void
  onClearHistory?: () => void
}): CommandItem[] {
  return [
    {
      id: 'new-session',
      label: 'New session',
      description: 'Start a fresh conversation',
      group: 'Session',
      action: callbacks.onNewSession ?? (() => {}),
    },
    {
      id: 'clear-history',
      label: 'Clear history',
      description: 'Clear the conversation display',
      group: 'Session',
      action: callbacks.onClearHistory ?? (() => {}),
    },
    {
      id: 'switch-model-haiku',
      label: 'Switch to claude-haiku-4-5',
      description: 'Faster, cheaper model',
      group: 'Model',
      action: () => {},
    },
    {
      id: 'switch-model-opus',
      label: 'Switch to claude-opus-4-5',
      description: 'Most capable model',
      group: 'Model',
      action: () => {},
    },
  ]
}
