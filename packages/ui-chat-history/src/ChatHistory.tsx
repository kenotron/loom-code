import type { ChatHistoryProps, DisplayItem, ToolGroup, ToolCallRow, ToolStatus } from './types'

// ── helpers ──────────────────────────────────────────────────────────────────

function groupStatusIcon(calls: ToolCallRow[]): string {
  if (calls.some(c => c.status === 'running')) return '⠋'
  if (calls.some(c => c.status === 'error')) return '✗'
  return '✓'
}

function callStatusIcon(status: ToolStatus): string {
  if (status === 'running') return '⠋'
  if (status === 'error') return '✗'
  return '✓'
}

function renderToolGroup(group: ToolGroup, onToggle?: () => void): string {
  const icon = groupStatusIcon(group.calls)
  const arrow = group.collapsed ? '▶' : '▼'
  if (group.collapsed) {
    return `${icon} ${group.toolName}  ${group.calls.length} calls  ${arrow}`
  }
  const header = `${icon} ${group.toolName}  ${group.calls.length} calls  ${arrow}`
  const rows = group.calls.map(c => `  ${callStatusIcon(c.status)} ${c.toolName}`).join('\n')
  return `${header}\n${rows}`
}

function renderItem(item: DisplayItem, onToggleGroup?: (id: string) => void): string {
  switch (item.type) {
    case 'user-message':
      return `You   ${item.message.content}`
    case 'assistant-text':
      return `AI    ${item.content}${item.streaming ? '▌' : ''}`
    case 'tool-group':
      return renderToolGroup(item.group, onToggleGroup ? () => onToggleGroup(item.group.id) : undefined)
    case 'thinking': {
      const secs = Math.round(item.durationMs / 1000)
      const arrow = item.collapsed ? '▶' : '▼'
      return `◎ thought for ${secs}s  ${arrow}`
    }
  }
}

/**
 * Returns fg/attributes props for a given item type.
 * - user-message: bold white (attributes=1 = BOLD)
 * - assistant-text: normal white
 * - tool-group / thinking: normal white
 */
function itemStyle(item: DisplayItem): { fg: string; attributes?: number } {
  if (item.type === 'user-message') return { fg: 'white', attributes: 1 }
  return { fg: 'white' }
}

// ── component ─────────────────────────────────────────────────────────────────

/**
 * ChatHistory — thin display component for the conversation history.
 *
 * Renders each DisplayItem as text lines inside a vertical box.
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 *
 * Interaction note: onToggleGroup / onToggleThinking are props for the parent
 * to wire up via keyboard/mouse events at the application layer.
 */
export function ChatHistory({ state, onToggleGroup, onToggleThinking }: ChatHistoryProps) {
  if (state.items.length === 0) {
    return (
      <scrollbox style={{ flexDirection: 'column' }}>
        <text fg="white">  Type a message to start — Ctrl-P for commands</text>
      </scrollbox>
    )
  }

  return (
    <scrollbox style={{ flexDirection: 'column' }} stickyScroll={true} stickyStart="bottom">
      {state.items.map((item: DisplayItem) => {
        const { fg, attributes } = itemStyle(item)
        return (
          <text key={item.id} fg={fg} attributes={attributes}>
            {renderItem(item, onToggleGroup)}
          </text>
        )
      })}
    </scrollbox>
  )
}
