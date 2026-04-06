import { Box, Text } from 'ink'
import { BrightText, ColorText } from '@loom-code/ui-primitives'
import type { ChatHistoryProps, DisplayItem } from './types'

// ── helpers ──────────────────────────────────────────────────────────────────

function renderItem(item: DisplayItem, onToggleGroup?: (id: string) => void) {
  switch (item.type) {
    case 'user-message':
      return (
        <Box key={item.id} flexDirection="row">
          <Text>{'  '}</Text>
          <BrightText bold>{item.message.content}</BrightText>
          <Text>{'  '}</Text>
        </Box>
      )
    case 'assistant-text':
      return (
        <Box key={item.id} flexDirection="column">
          <Text>{' '}</Text>
          <BrightText>{item.content + (item.streaming ? '▌' : '')}</BrightText>
        </Box>
      )
    case 'tool-group': {
      const { group } = item
      const hasError = group.calls.some(c => c.status === 'error')
      const anyRunning = group.calls.some(c => c.status === 'running')
      const iconColor = anyRunning
        ? 'status.running'
        : hasError
          ? 'status.error'
          : 'status.success'
      const icon = anyRunning ? '⠋' : hasError ? '✗' : '✓'
      const arrow = group.collapsed ? '▶' : '▼'
      return (
        <Box key={item.id} flexDirection="column">
          <Box flexDirection="row">
            <Text>{'  '}</Text>
            <ColorText token={iconColor}>{icon + ' '}</ColorText>
            <ColorText token="text.muted">
              {group.toolName +
                '  ' +
                group.calls.length +
                ' ' +
                (group.calls.length === 1 ? 'call' : 'calls') +
                '  '}
            </ColorText>
            <ColorText token="text.dim">{arrow}</ColorText>
          </Box>
          {!group.collapsed &&
            group.calls.map(call => {
              const cIcon =
                call.status === 'running' ? '⠋' : call.status === 'error' ? '✗' : '✓'
              const cColor =
                call.status === 'running'
                  ? 'status.running'
                  : call.status === 'error'
                    ? 'status.error'
                    : 'status.success'
              return (
                <Box key={call.id} flexDirection="row">
                  <Text>{'    '}</Text>
                  <ColorText token={cColor}>{cIcon + ' '}</ColorText>
                  <ColorText token="text.muted">
                    {call.toolName + (call.error ? '  ' + call.error : '')}
                  </ColorText>
                </Box>
              )
            })}
        </Box>
      )
    }
    case 'thinking': {
      const secs = Math.round(item.durationMs / 1000)
      const arrow = item.collapsed ? '▶' : '▼'
      return (
        <Box key={item.id} flexDirection="row">
          <Text>{'  '}</Text>
          <ColorText token="text.dim">{'◎ thought for ' + secs + 's  ' + arrow}</ColorText>
        </Box>
      )
    }
  }
}

// ── component ─────────────────────────────────────────────────────────────────

/**
 * ChatHistory — thin display component for the conversation history.
 *
 * Renders each DisplayItem as colored boxes inside a vertical container.
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 */
export function ChatHistory({ state, onToggleGroup }: ChatHistoryProps) {
  if (state.items.length === 0) {
    return (
      <Box flexDirection="column">
        <ColorText token="text.dimmer">
          {'  Type a message · Ctrl-P for commands · Esc cancels'}
        </ColorText>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {state.items.map(item => renderItem(item, onToggleGroup))}
    </Box>
  )
}
