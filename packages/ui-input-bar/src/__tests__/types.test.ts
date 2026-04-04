import { describe, it, expect } from 'bun:test'
import type { InputBarState, InputBarProps, InputBarCallbacks } from '../types'

describe('InputBarState', () => {
  it('has value and micActive fields', () => {
    const state: InputBarState = { value: '', micActive: false }
    expect(state.value).toBe('')
    expect(state.micActive).toBe(false)
  })

  it('value can hold in-progress text', () => {
    const state: InputBarState = { value: 'refactor login', micActive: false }
    expect(state.value).toBe('refactor login')
  })

  it('micActive can be true during voice recording', () => {
    const state: InputBarState = { value: '', micActive: true }
    expect(state.micActive).toBe(true)
  })
})

describe('InputBarCallbacks', () => {
  it('onSubmit is a required function', () => {
    const callbacks: InputBarCallbacks = {
      onSubmit: (text) => { /* send to session */ },
    }
    expect(typeof callbacks.onSubmit).toBe('function')
  })

  it('onVoiceToggle is optional', () => {
    const callbacks: InputBarCallbacks = {
      onSubmit: (_text) => {},
    }
    expect(callbacks.onVoiceToggle).toBeUndefined()
  })

  it('onValueChange is optional', () => {
    const callbacks: InputBarCallbacks = {
      onSubmit: (_text) => {},
    }
    expect(callbacks.onValueChange).toBeUndefined()
  })
})

describe('InputBarProps', () => {
  it('takes initialState, callbacks, and optional placeholder', () => {
    const props: InputBarProps = {
      initialState: { value: '', micActive: false },
      callbacks: { onSubmit: (_t) => {} },
      placeholder: 'Ask anything...',
    }
    expect(props.placeholder).toBe('Ask anything...')
  })

  it('placeholder is optional', () => {
    const props: InputBarProps = {
      initialState: { value: '', micActive: false },
      callbacks: { onSubmit: (_t) => {} },
    }
    expect(props.placeholder).toBeUndefined()
  })
})
