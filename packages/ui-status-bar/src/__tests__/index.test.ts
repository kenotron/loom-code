import { describe, it, expect } from 'bun:test'

describe('@loom-code/ui-status-bar barrel exports', () => {
  it('exports StatusBar component', async () => {
    const { StatusBar } = await import('../index')
    expect(typeof StatusBar).toBe('function')
  })

  it('exports formatStatusLine utility', async () => {
    const { formatStatusLine } = await import('../index')
    expect(typeof formatStatusLine).toBe('function')
  })

  it('exports formatTokenCount utility', async () => {
    const { formatTokenCount } = await import('../index')
    expect(formatTokenCount(2100)).toBe('2.1k')
  })
})
