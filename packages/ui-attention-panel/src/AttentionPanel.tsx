import { BrightText } from '@loom-code/ui-primitives'
import { pendingItems, isEmpty } from './state'
import type { AttentionPanelProps, AttentionItem, AttentionItemType } from './types'

function iconFor(type: AttentionItemType): string {
  if (type === 'approval') return '⏳'
  return 'ℹ'
}

/**
 * AttentionPanel — shows pending attention items and the current intent.
 *
 * Returns null when there are no pending items.
 * All business logic lives in state.ts (fully unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 *
 * Layout:
 *   ▸ Refactor login flow
 *   ⏳ Review changes?
 *   ℹ FYI notice
 */
export function AttentionPanel({ state, textFg }: AttentionPanelProps) {
  if (isEmpty(state)) return null

  const pending = pendingItems(state)

  return (
    <box style={{ flexDirection: 'column' }}>
      {state.intent !== null && (
        <text fg={textFg}>▸ {state.intent}</text>
      )}
      {pending.map((item: AttentionItem) => (
        <text key={item.id} fg={textFg}>{iconFor(item.type)} {item.message}</text>
      ))}
    </box>
  )
}
