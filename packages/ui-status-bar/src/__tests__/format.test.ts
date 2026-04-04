import { describe, it, expect } from 'bun:test'
import { formatTokenCount, truncateSessionId, formatStatusLine } from '../format'
import type { StatusBarState } from '../types'

describe('formatTokenCount', () => {
  it('formats small numbers without suffix', () => {
    expect(formatTokenCount(500)).toBe('500')
  })

  it('formats 1000+ with k suffix', () => {
    expect(formatTokenCount(2100)).toBe('2.1k')
  })

  it('formats larger numbers with k suffix', () => {
    expect(formatTokenCount(10500)).toBe('10.5k')
  })

  it('handles zero', () => {
    expect(formatTokenCount(0)).toBe('0')
  })

  it('rounds to 1 decimal place', () => {
    expect(formatTokenCount(1567)).toBe('1.6k')
  })

  it('handles exactly 1000', () => {
    expect(formatTokenCount(1000)).toBe('1k')
  })
})

describe('truncateSessionId', () => {
  it('takes first 8 characters of a UUID', () => {
    expect(truncateSessionId('05476974-dc35-4db2-a612-a9b3655a6566')).toBe('05476974')
  })

  it('handles IDs shorter than 8 chars gracefully', () => {
    expect(truncateSessionId('abc')).toBe('abc')
  })
})

describe('formatStatusLine', () => {
  it('formats state into a readable status string', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 2100,
      sessionId: '05476974-dc35-4db2',
    }
    const line = formatStatusLine(state)
    expect(line).toContain('claude-opus-4')
    expect(line).toContain('2.1k')
    expect(line).toContain('05476974')
  })

  it('shows zero tokens on fresh session', () => {
    const state: StatusBarState = {
      model: 'claude-haiku-4',
      tokenCount: 0,
      sessionId: 'abc123def',
    }
    const line = formatStatusLine(state)
    expect(line).toContain('0')
    expect(line).toContain('claude-haiku-4')
  })
})
