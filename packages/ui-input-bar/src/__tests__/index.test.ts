import { describe, it, expect } from 'bun:test'
import { createInitialInputBarState, submitValue, toggleMic, InputBar } from '../index'

describe('@loom-code/ui-input-bar barrel exports', () => {
  it('exports InputBar component', () => {
    expect(typeof InputBar).toBe('function')
  })

  it('exports createInitialInputBarState', () => {
    const state = createInitialInputBarState()
    expect(state.value).toBe('')
    expect(state.micActive).toBe(false)
  })

  it('exports submitValue with correct behavior', () => {
    const state = createInitialInputBarState()
    const withText = { ...state, value: 'hello' }
    const { submitted, newState } = submitValue(withText)
    expect(submitted).toBe('hello')
    expect(newState.value).toBe('')
  })

  it('exports toggleMic', () => {
    const state = createInitialInputBarState()
    const toggled = toggleMic(state)
    expect(toggled.micActive).toBe(true)
  })
})