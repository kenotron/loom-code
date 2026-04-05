import { BrightText, ColorText } from '@loom-code/ui-primitives'
import type { ChatHistoryProps, DisplayItem } from './types'

// ── helpers ──────────────────────────────────────────────────────────────────

function renderItem(item: DisplayItem, onToggleGroup?: (id: string) => void) {
  switch (item.type) {
    case 'user-message':
      return (
        <box key={item.id} bg="#1e1e1e" style={{ flexDirection: 'row' }}>
          <text>{'  '}</text>
          <BrightText attributes={1}>{item.message.content}</BrightText>
          <text>{'  '}</text>
        </box>
      )
    case 'assistant-text':
      return (
        <box key={item.id} style={{ flexDirection: 'column' }}>
          <text>{' '}</text>
          <BrightText>{item.content + (item.streaming ? '▌' : '')}</BrightText>
        </box>
      )
    case 'tool-group': {
      const { group } = item
      const hasError = group.calls.some(c => c.status === 'error')
      const anyRunning = group.calls.some(c => c.status === 'running')
      const iconColor = anyRunning ? 'status.running' : hasError ? 'status.error' : 'status.success'
      const icon = anyRunning ? '⠋' : hasError ? '✗' : '✓'
      const arrow = group.collapsed ? '▶' : '▼'
      return (
        <box key={item.id} style={{ flexDirection: 'column' }}>
          <box style={{ flexDirection: 'row' }}>
            <text>{'  '}</text>
            <ColorText token={iconColor}>{icon + ' '}</ColorText>
            <ColorText token="text.muted">{group.toolName + '  ' + group.calls.length + ' ' + (group.calls.length === 1 ? 'call' : 'calls') + '  '}</ColorText>
            <ColorText token="text.dim">{arrow}</ColorText>
          </box>
          {!group.collapsed && group.calls.map(call => {
            const cIcon = call.status === 'running' ? '⠋' : call.status === 'error' ? '✗' : '✓'
            const cColor = call.status === 'running' ? 'status.running' : call.status === 'error' ? 'status.error' : 'status.success'
            return (
              <box key={call.id} style={{ flexDirection: 'row' }}>
                <text>{'    '}</text>
                <ColorText token={cColor}>{cIcon + ' '}</ColorText>
                <ColorText token="text.muted">{call.toolName + (call.error ? '  ' + call.error : '')}</ColorText>
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
          <text>{'  '}</text>
          <ColorText token="text.dim">{'◎ thought for ' + secs + 's  ' + arrow}</ColorText>
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
export function ChatHistory({ state, onToggleGroup, onToggleThinking }: ChatHistoryProps) {
  if (state.items.length === 0) {
    return (
      <scrollbox style={{ flexDirection: 'column' }} stickyScroll={true} stickyStart="bottom">
        <ColorText token="text.dimmer">{'  Type a message · Ctrl-P for commands · Esc cancels'}</ColorText>
      </scrollbox>
    )
  }

  return (
    <scrollbox style={{ flexDirection: 'column' }} stickyScroll={true} stickyStart="bottom">
      {state.items.map(item => renderItem(item, onToggleGroup))}
    </scrollbox>
  )
}
