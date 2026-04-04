import type { AttentionItem, AttentionState } from './types'

export function createInitialAttentionState(): AttentionState {
  return { items: [], intent: null }
}

export function addItem(state: AttentionState, item: AttentionItem): AttentionState {
  return { ...state, items: [...state.items, item] }
}

export function resolveItem(state: AttentionState, id: string): AttentionState {
  return {
    ...state,
    items: state.items.map(item =>
      item.id === id ? { ...item, resolvedAt: Date.now() } : item
    ),
  }
}

export function dismissItem(state: AttentionState, id: string): AttentionState {
  return { ...state, items: state.items.filter(item => item.id !== id) }
}

export function updateIntent(state: AttentionState, intent: string): AttentionState {
  return { ...state, intent }
}

export function pendingItems(state: AttentionState): AttentionItem[] {
  return state.items.filter(item => item.resolvedAt === undefined)
}

export function isEmpty(state: AttentionState): boolean {
  return pendingItems(state).length === 0
}
