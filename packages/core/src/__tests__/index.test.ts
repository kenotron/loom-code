import { describe, it, expect } from 'bun:test'

describe('@loom-code/core barrel exports', () => {
  it('exports LoomSession', async () => {
    const { LoomSession } = await import('../index')
    expect(typeof LoomSession).toBe('function')
  })

  it('exports createToolMap', async () => {
    const { createToolMap } = await import('../index')
    const map = createToolMap()
    expect(map instanceof Map).toBe(true)
  })

  it('exports runTurn', async () => {
    const { runTurn } = await import('../index')
    expect(typeof runTurn).toBe('function')
  })
})
