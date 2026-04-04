import type { DisplayItem } from './types'

/**
 * groupConsecutiveToolCalls — merges consecutive DisplayItems for the same
 * tool into a single tool-group. This pure function is available for
 * reconstructing display from raw messages (addToolCall in state.ts handles
 * this inline during live updates).
 */
export function groupConsecutiveToolCalls(items: DisplayItem[]): DisplayItem[] {
  const result: DisplayItem[] = []
  for (const item of items) {
    if (item.type !== 'tool-group') {
      result.push(item)
      continue
    }
    const last = result[result.length - 1]
    if (last?.type === 'tool-group' && last.group.toolName === item.group.toolName) {
      result[result.length - 1] = {
        ...last,
        group: {
          ...last.group,
          calls: [...last.group.calls, ...item.group.calls],
        },
      }
    } else {
      result.push(item)
    }
  }
  return result
}
