import { describe, it, expect } from 'bun:test'
import {
  createInitialChatHistoryState,
  appendUserMessage,
  startAssistantStream,
  appendToken,
  finalizeStream,
  addToolCall,
  updateToolCall,
  toggleGroup,
} from '../state'
import { groupConsecutiveToolCalls } from '../group'
import { ChatHistory } from '../ChatHistory'

describe('@loom-code/ui-chat-history', () => {
  it('exports ChatHistory component', () => {
    expect(typeof ChatHistory).toBe('function')
  })

  it('full conversation flow: user → stream → tool → complete', () => {
    let state = createInitialChatHistoryState()
    expect(state.items).toHaveLength(0)

    state = appendUserMessage(state, 'u1', 'refactor the login flow')
    expect(state.items).toHaveLength(1)
    expect(state.items[0].type).toBe('user-message')

    state = startAssistantStream(state, 'a1')
    expect(state.streamingItemId).toBe('a1')
    state = appendToken(state, "I'll ")
    state = appendToken(state, 'start by reading...')
    const streamItem = state.items.find(i => i.id === 'a1')!
    expect(streamItem.type).toBe('assistant-text')
    if (streamItem.type === 'assistant-text') {
      expect(streamItem.content).toBe("I'll start by reading...")
      expect(streamItem.streaming).toBe(true)
    }

    state = addToolCall(state, 't1', 'read_file')
    state = addToolCall(state, 't2', 'read_file')
    const groups = state.items.filter(i => i.type === 'tool-group')
    expect(groups).toHaveLength(1)
    if (groups[0].type === 'tool-group') {
      expect(groups[0].group.calls).toHaveLength(2)
    }

    state = updateToolCall(state, 't1', 'success', 'file content')
    state = updateToolCall(state, 't2', 'success', 'other file')

    state = finalizeStream(state)
    expect(state.streamingItemId).toBeNull()
    const finalItem = state.items.find(i => i.id === 'a1')!
    if (finalItem.type === 'assistant-text') {
      expect(finalItem.streaming).toBe(false)
    }
  })

  it('consecutive same-tool calls merge into one group', () => {
    let state = createInitialChatHistoryState()
    state = addToolCall(state, 't1', 'bash')
    state = addToolCall(state, 't2', 'bash')
    state = addToolCall(state, 't3', 'bash')
    const groups = state.items.filter(i => i.type === 'tool-group')
    expect(groups).toHaveLength(1)
    if (groups[0].type === 'tool-group') {
      expect(groups[0].group.calls).toHaveLength(3)
    }
  })

  it('different tools create separate groups', () => {
    let state = createInitialChatHistoryState()
    state = addToolCall(state, 't1', 'read_file')
    state = addToolCall(state, 't2', 'bash')
    const groups = state.items.filter(i => i.type === 'tool-group')
    expect(groups).toHaveLength(2)
  })

  it('toggleGroup collapses and expands', () => {
    let state = createInitialChatHistoryState()
    state = addToolCall(state, 't1', 'bash')
    const groupItem = state.items.find(i => i.type === 'tool-group')!
    const groupId = groupItem.type === 'tool-group' ? groupItem.group.id : ''
    state = toggleGroup(state, groupId)
    const collapsed = state.items.find(i => i.type === 'tool-group')
    expect(collapsed?.type === 'tool-group' && collapsed.group.collapsed).toBe(true)
    state = toggleGroup(state, groupId)
    const expanded = state.items.find(i => i.type === 'tool-group')
    expect(expanded?.type === 'tool-group' && expanded.group.collapsed).toBe(false)
  })

  it('groupConsecutiveToolCalls merges same-tool items', () => {
    const item1: import('../types').DisplayItem = {
      type: 'tool-group', id: 'g1',
      group: { id: 'g1', toolName: 'bash', calls: [
        { id: 't1', toolName: 'bash', status: 'success', startedAt: 0 }
      ], collapsed: false }
    }
    const item2: import('../types').DisplayItem = {
      type: 'tool-group', id: 'g2',
      group: { id: 'g2', toolName: 'bash', calls: [
        { id: 't2', toolName: 'bash', status: 'success', startedAt: 0 }
      ], collapsed: false }
    }
    const result = groupConsecutiveToolCalls([item1, item2])
    expect(result).toHaveLength(1)
    if (result[0].type === 'tool-group') {
      expect(result[0].group.calls).toHaveLength(2)
    }
  })
})
