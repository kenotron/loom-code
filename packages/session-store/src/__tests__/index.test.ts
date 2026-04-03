import { describe, it, expect } from 'bun:test'

describe('@loom-code/session-store barrel exports', () => {
  it('exports JsonlStore', async () => {
    const { JsonlStore } = await import('../index')
    expect(typeof JsonlStore).toBe('function')
  })

  it('exports buildCheckpointEntry', async () => {
    const { buildCheckpointEntry } = await import('../index')
    expect(typeof buildCheckpointEntry).toBe('function')
  })

  it('exports reconstruct', async () => {
    const { reconstruct } = await import('../index')
    expect(typeof reconstruct).toBe('function')
  })

  it('exports SNAPSHOT_INTERVAL as 20', async () => {
    const { SNAPSHOT_INTERVAL } = await import('../index')
    expect(SNAPSHOT_INTERVAL).toBe(20)
  })
})
