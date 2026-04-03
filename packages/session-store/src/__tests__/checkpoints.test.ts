import { describe, it, expect } from 'bun:test'
import { buildCheckpointEntry, SNAPSHOT_INTERVAL } from '../checkpoints'

describe('SNAPSHOT_INTERVAL', () => {
  it('is 20', () => {
    expect(SNAPSHOT_INTERVAL).toBe(20)
  })
})

describe('buildCheckpointEntry — delta', () => {
  it('creates a delta entry for normal turns', () => {
    const entry = buildCheckpointEntry({
      turnIndex: 5,
      newMessageIds: ['m_010', 'm_011'],
      allMessageIds: ['m_001', 'm_002', 'm_010', 'm_011'],
      toolSet: ['@loom-code/shell@1.0.0'],
      prevToolSet: ['@loom-code/shell@1.0.0'],  // unchanged
      intent: 'turn 5',
    })
    expect(entry.type).toBe('delta')
  })

  it('omits toolSet in delta when unchanged since last checkpoint', () => {
    const entry = buildCheckpointEntry({
      turnIndex: 5,
      newMessageIds: ['m_010'],
      allMessageIds: ['m_001', 'm_010'],
      toolSet: ['@loom-code/shell@1.0.0'],
      prevToolSet: ['@loom-code/shell@1.0.0'],  // same
      intent: 'no toolset change',
    })
    if (entry.type === 'delta') {
      expect(entry.toolSet).toBeUndefined()
    }
  })

  it('includes toolSet in delta when packages changed', () => {
    const entry = buildCheckpointEntry({
      turnIndex: 5,
      newMessageIds: ['m_010'],
      allMessageIds: ['m_001', 'm_010'],
      toolSet: ['@loom-code/shell@1.0.0', '@loom-code/db@1.0.0'],
      prevToolSet: ['@loom-code/shell@1.0.0'],  // different!
      intent: 'added db package',
    })
    if (entry.type === 'delta') {
      expect(entry.toolSet).toEqual(['@loom-code/shell@1.0.0', '@loom-code/db@1.0.0'])
    }
  })

  it('omits config in delta when unchanged', () => {
    const config = { model: 'claude-opus-4' }
    const entry = buildCheckpointEntry({
      turnIndex: 3,
      newMessageIds: ['m_005'],
      allMessageIds: ['m_001', 'm_005'],
      toolSet: [],
      prevToolSet: [],
      config,
      prevConfig: config,  // same reference
      intent: 'no config change',
    })
    if (entry.type === 'delta') {
      expect(entry.config).toBeUndefined()
    }
  })

  it('includes config in delta when changed', () => {
    const entry = buildCheckpointEntry({
      turnIndex: 3,
      newMessageIds: ['m_005'],
      allMessageIds: ['m_001', 'm_005'],
      toolSet: [],
      prevToolSet: [],
      config: { model: 'claude-haiku-4' },
      prevConfig: { model: 'claude-opus-4' },  // different!
      intent: 'switched to haiku',
    })
    if (entry.type === 'delta') {
      expect(entry.config).toEqual({ model: 'claude-haiku-4' })
    }
  })

  it('includes correct newMessageIds in delta', () => {
    const entry = buildCheckpointEntry({
      turnIndex: 2,
      newMessageIds: ['m_003', 'm_004', 'm_005'],
      allMessageIds: ['m_001', 'm_002', 'm_003', 'm_004', 'm_005'],
      toolSet: [],
      prevToolSet: [],
      intent: 'turn with 3 new messages',
    })
    if (entry.type === 'delta') {
      expect(entry.newMessageIds).toEqual(['m_003', 'm_004', 'm_005'])
    }
  })

  it('does NOT create a snapshot at turn 0', () => {
    const entry = buildCheckpointEntry({
      turnIndex: 0,
      newMessageIds: ['m_001', 'm_002'],
      allMessageIds: ['m_001', 'm_002'],
      toolSet: [],
      prevToolSet: [],
      intent: 'first ever turn',
    })
    expect(entry.type).toBe('delta')
  })
})

describe('buildCheckpointEntry — full snapshot', () => {
  it('creates a snapshot at SNAPSHOT_INTERVAL turns', () => {
    const allMessageIds = Array.from({ length: 42 }, (_, i) => `m_${String(i + 1).padStart(3, '0')}`)
    const entry = buildCheckpointEntry({
      turnIndex: 20,
      newMessageIds: ['m_041', 'm_042'],
      allMessageIds,
      toolSet: ['@loom-code/shell@1.0.0'],
      prevToolSet: ['@loom-code/shell@1.0.0'],
      intent: 'snapshot at turn 20',
    })
    expect(entry.type).toBe('snapshot')
  })

  it('snapshot contains all message IDs (not just new ones)', () => {
    const allMessageIds = Array.from({ length: 42 }, (_, i) => `m_${String(i + 1).padStart(3, '0')}`)
    const entry = buildCheckpointEntry({
      turnIndex: 20,
      newMessageIds: ['m_041', 'm_042'],
      allMessageIds,
      toolSet: [],
      prevToolSet: [],
      intent: 'snapshot',
    })
    if (entry.type === 'snapshot') {
      expect(entry.allMessageIds).toHaveLength(42)
      expect(entry.allMessageIds).toContain('m_001')
      expect(entry.allMessageIds).toContain('m_042')
    }
  })

  it('snapshot always includes toolSet', () => {
    const entry = buildCheckpointEntry({
      turnIndex: 20,
      newMessageIds: ['m_041'],
      allMessageIds: ['m_001', 'm_041'],
      toolSet: ['@loom-code/shell@1.0.0'],
      prevToolSet: ['@loom-code/shell@1.0.0'],  // unchanged, but snapshot must include it
      intent: 'snapshot with toolSet',
    })
    if (entry.type === 'snapshot') {
      expect(entry.toolSet).toEqual(['@loom-code/shell@1.0.0'])
    }
  })

  it('creates snapshots at multiples of SNAPSHOT_INTERVAL', () => {
    const make = (turnIndex: number) => buildCheckpointEntry({
      turnIndex,
      newMessageIds: [`m_${turnIndex}`],
      allMessageIds: Array.from({ length: turnIndex }, (_, i) => `m_${i + 1}`),
      toolSet: [],
      prevToolSet: [],
      intent: `turn ${turnIndex}`,
    })
    expect(make(20).type).toBe('snapshot')
    expect(make(40).type).toBe('snapshot')
    expect(make(60).type).toBe('snapshot')
    expect(make(19).type).toBe('delta')
    expect(make(21).type).toBe('delta')
  })
})
