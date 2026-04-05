import { BrightText } from '@loom-code/ui-primitives'
import type { ChatHistoryProps, DisplayItem } from './types'

// ── helpers ──────────────────────────────────────────────────────────────────

function renderItem(item: DisplayItem, onToggleGroup?: (id: string) => void) {
  switch (item.type) {
    case 'user-message':
      return (
        <box key={item.id} style={{ flexDirection: 'row' }}>
          <text fg="#4fc3f7">{'you   '}</text>
          <BrightText attributes={1}>{item.message.content}</BrightText>
        </box>
      )
    case 'assistant-text':
      return (
        <box key={item.id} style={{ flexDirection: 'row' }}>
          <text fg="#69f0ae">{'ai    '}</text>
          <BrightText>{item.content + (item.streaming ? '▌' : '')}</BrightText>
        </box>
      )
    case 'tool-group': {
      const { group } = item
      const hasError = group.calls.some(c => c.status === 'error')
      const anyRunning = group.calls.some(c => c.status === 'running')
      const iconFg = anyRunning ? '#ffd740' : hasError ? '#ff6b6b' : '#69f0ae'
      const icon = anyRunning ? '⠋' : hasError ? '✗' : '✓'
      const arrow = group.collapsed ? '▶' : '▼'
      return (
        <box key={item.id} style={{ flexDirection: 'column' }}>
          <box style={{ flexDirection: 'row' }}>
            <text>{'        '}</text>
            <text fg={iconFg}>{icon} </text>
            <text fg="#909090">{group.toolName}  {group.calls.length} {group.calls.length === 1 ? 'call' : 'calls'}  </text>
            <text fg="#505050">{arrow}</text>
          </box>
          {!group.collapsed && group.calls.map(call => {
            const cIcon = call.status === 'running' ? '⠋' : call.status === 'error' ? '✗' : '✓'
            const cFg = call.status === 'running' ? '#ffd740' : call.status === 'error' ? '#ff6b6b' : '#69f0ae'
            return (
              <box key={call.id} style={{ flexDirection: 'row' }}>
                <text>{'          '}</text>
                <text fg={cFg}>{cIcon} </text>
                <text fg="#909090">{call.toolName}{call.error ? `  ${call.error}` : ''}</text>
              </box>
            )
          })}
        </box>
      )
    }
    case 'thinking': {
      const secs = Math.round(item.durationMs / 1000)
      const arrow = item.collapsed ? '▶' : '▼'
      return (
        <box key={item.id} style={{ flexDirection: 'row' }}>
          <text>{'        '}</text>
          <text fg="#505050">◎ thought for {secs}s  {arrow}</text>
        </box>
      )
    }
  }
}

// ── component ─────────────────────────────────────────────────────────────────

/**
 * ChatHistory — thin display component for the conversation history.
 *
 * Renders each DisplayItem as colored boxes inside a vertical scrollbox.
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 *
 * Interaction note: onToggleGroup / onToggleThinking are props for the parent
 * to wire up via keyboard/mouse events at the application layer.
 */
export function ChatHistory({ state, onToggleGroup, onToggleThinking, textFg }: ChatHistoryProps) {
  if (state.items.length === 0) {
    return (
      <scrollbox style={{ flexDirection: 'column' }} stickyScroll={true} stickyStart="bottom">
        <text fg="#303030">{'  Type a message · Ctrl-P for commands · Esc cancels'}</text>
      </scrollbox>
    )
  }

  return (
    <scrollbox style={{ flexDirection: 'column' }} stickyScroll={true} stickyStart="bottom">
      {state.items.map(item => renderItem(item, textFg, onToggleGroup))}
    </scrollbox>
  )
}
