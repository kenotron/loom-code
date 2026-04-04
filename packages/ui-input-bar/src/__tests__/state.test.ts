import { describe, it, expect } from 'bun:test'
import {
  createInitialInputBarState,
  updateValue,
  submitValue,
  toggleMic,
} from '../state'

describe('createInitialInputBarState', () => {
  it('returns empty value and micActive false', () => {
    const state = createInitialInputBarState()
    expect(state.value).toBe('')
    expect(state.micActive).toBe(false)
  })
})

describe('updateValue', () => {
  it('returns new state with updated value', () => {
    const state = createInitialInputBarState()
    const next = updateValue(state, 'hello world')
    expect(next.value).toBe('hello world')
    expect(next.micActive).toBe(false)
  })

  it('does not mutate the original state', () => {
    const state = createInitialInputBarState()
    updateValue(state, 'changed')
    expect(state.value).toBe('')
  })
})

describe('submitValue', () => {
  it('returns { newState, submitted } — submitted is the trimmed text', () => {
    const state = { value: 'add authentication', micActive: false }
    const { newState, submitted } = submitValue(state)
    expect(submitted).toBe('add authentication')
    expect(newState.value).toBe('')
  })

  it('trims whitespace from submitted text', () => {
    const state = { value: '  hello  ', micActive: false }
    const { submitted } = submitValue(state)
    expect(submitted).toBe('hello')
  })

  it('returns submitted: null for empty or whitespace-only input', () => {
    const state = { value: '   ', micActive: false }
    const { submitted } = submitValue(state)
    expect(submitted).toBeNull()
  })

  it('clears the value after submission', () => {
    const state = { value: 'some text', micActive: false }
    const { newState } = submitValue(state)
    expect(newState.value).toBe('')
  })

  it('does not mutate the original state', () => {
    const state = { value: 'original', micActive: false }
    submitValue(state)
    expect(state.value).toBe('original')
  })
})

describe('toggleMic', () => {
  it('activates mic when inactive', () => {
    const state = { value: '', micActive: false }
    const next = toggleMic(state)
    expect(next.micActive).toBe(true)
  })

  it('deactivates mic when active', () => {
    const state = { value: '', micActive: true }
    const next = toggleMic(state)
    expect(next.micActive).toBe(false)
  })

  it('does not mutate the original state', () => {
    const state = { value: '', micActive: false }
    toggleMic(state)
    expect(state.micActive).toBe(false)
  })
})
