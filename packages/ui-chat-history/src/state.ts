import type { ChatHistoryState, DisplayItem, ToolStatus } from './types'

export function createInitialChatHistoryState(): ChatHistoryState {
  return { items: [], streamingItemId: null }
}

export function appendUserMessage(state: ChatHistoryState, id: string, content: string): ChatHistoryState {
  const msg: DisplayItem = {
    type: 'user-message',
    id,
    message: { id, role: 'user', content, timestamp: Date.now() },
  }
  return { ...state, items: [...state.items, msg] }
}

export function startAssistantStream(state: ChatHistoryState, id: string): ChatHistoryState {
  const item: DisplayItem = { type: 'assistant-text', id, content: '', streaming: true }
  return { items: [...state.items, item], streamingItemId: id }
}

export function appendToken(state: ChatHistoryState, token: string): ChatHistoryState {
  if (!state.streamingItemId) return state
  return {
    ...state,
    items: state.items.map(item =>
      item.id === state.streamingItemId && item.type === 'assistant-text'
        ? { ...item, content: item.content + token }
        : item
    ),
  }
}

export function finalizeStream(state: ChatHistoryState): ChatHistoryState {
  return {
    items: state.items.map(item =>
      item.id === state.streamingItemId && item.type === 'assistant-text'
        ? { ...item, streaming: false }
        : item
    ),
    streamingItemId: null,
  }
}

export function addToolCall(state: ChatHistoryState, id: string, toolName: string): ChatHistoryState {
  const row: import('./types').ToolCallRow = {
    id, toolName, status: 'running', startedAt: Date.now(),
  }
  const items = [...state.items]
  const last = items[items.length - 1]
  if (last?.type === 'tool-group' && last.group.toolName === toolName) {
    items[items.length - 1] = {
      ...last,
      group: { ...last.group, calls: [...last.group.calls, row] },
    }
    return { ...state, items }
  }
  const groupItem: DisplayItem = {
    type: 'tool-group',
    id: `group-${id}`,
    group: { id: `group-${id}`, toolName, calls: [row], collapsed: false },
  }
  return { ...state, items: [...items, groupItem] }
}

export function updateToolCall(
  state: ChatHistoryState,
  id: string,
  status: ToolStatus,
  output?: string,
  error?: string,
): ChatHistoryState {
  return {
    ...state,
    items: state.items.map(item => {
      if (item.type !== 'tool-group') return item
      const calls = item.group.calls.map(call =>
        call.id === id
          ? { ...call, status, output, error, durationMs: Date.now() - call.startedAt }
          : call
      )
      return { ...item, group: { ...item.group, calls } }
    }),
  }
}

export function toggleGroup(state: ChatHistoryState, groupId: string): ChatHistoryState {
  return {
    ...state,
    items: state.items.map(item =>
      item.type === 'tool-group' && item.group.id === groupId
        ? { ...item, group: { ...item.group, collapsed: !item.group.collapsed } }
        : item
    ),
  }
}
