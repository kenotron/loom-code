import { describe, it, expect } from 'bun:test'
import type { StatusBarState, StatusBarProps } from '../types'

describe('StatusBarState', () => {
  it('has model, tokenCount, and sessionId fields', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 2100,
      sessionId: '05476974-dc35-4db2-a612-a9b3655a6566',
    }
    expect(state.model).toBe('claude-opus-4')
    expect(state.tokenCount).toBe(2100)
    expect(state.sessionId).toHaveLength(36)
  })

  it('tokenCount can be zero for a fresh session', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 0,
      sessionId: 'abc123',
    }
    expect(state.tokenCount).toBe(0)
  })
})

describe('StatusBarProps', () => {
  it('takes a StatusBarState', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 1234,
      sessionId: 'abc',
    }
    const props: StatusBarProps = { state }
    expect(props.state.model).toBe('claude-opus-4')
  })
})
