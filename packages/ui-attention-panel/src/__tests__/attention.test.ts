import { describe, it, expect } from 'bun:test'
import {
  createInitialAttentionState,
  addItem,
  resolveItem,
  dismissItem,
  updateIntent,
  pendingItems,
  isEmpty,
} from '../state'
import { AttentionPanel } from '../AttentionPanel'

describe('@loom-code/ui-attention-panel', () => {
  it('exports AttentionPanel component', () => {
    expect(typeof AttentionPanel).toBe('function')
  })

  it('full state flow: add → resolve → isEmpty', () => {
    let state = createInitialAttentionState()
    expect(isEmpty(state)).toBe(true)

    state = addItem(state, { id: 'a1', type: 'approval', message: 'Review changes?' })
    expect(isEmpty(state)).toBe(false)
    expect(pendingItems(state)).toHaveLength(1)

    state = resolveItem(state, 'a1')
    expect(isEmpty(state)).toBe(true)
    expect(pendingItems(state)).toHaveLength(0)
  })

  it('updateIntent sets the current intent string', () => {
    let state = createInitialAttentionState()
    state = updateIntent(state, 'Refactor login flow')
    expect(state.intent).toBe('Refactor login flow')
  })

  it('dismissItem removes item entirely', () => {
    let state = createInitialAttentionState()
    state = addItem(state, { id: 'b1', type: 'info', message: 'FYI' })
    state = dismissItem(state, 'b1')
    expect(state.items).toHaveLength(0)
  })
})
