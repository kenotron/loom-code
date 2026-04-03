import { describe, it, expect } from 'bun:test'
import type {
  MessageRecord,
  SessionCheckpoint,
  CheckpointSnapshot,
  CheckpointEntry,
  SessionMetadata,
} from '../types'

describe('MessageRecord', () => {
  it('has required id, role, and content fields', () => {
    const msg: MessageRecord = {
      id: 'm_001',
      role: 'user',
      content: 'Hello world',
    }
    expect(msg.id).toBe('m_001')
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('Hello world')
  })

  it('timestamp is optional', () => {
    const msg: MessageRecord = { id: 'm_002', role: 'assistant', content: 'Hi' }
    expect(msg.timestamp).toBeUndefined()
  })

  it('content can be any shape (string, array, object)', () => {
    const arrayContent: MessageRecord = {
      id: 'm_003',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello' }],
    }
    expect(Array.isArray(arrayContent.content)).toBe(true)
  })
})

describe('SessionCheckpoint (delta)', () => {
  it('has required id, turnIndex, newMessageIds, intent', () => {
    const cp: SessionCheckpoint = {
      id: 'cp_0001',
      turnIndex: 1,
      newMessageIds: ['m_001', 'm_002'],
      intent: 'first turn',
    }
    expect(cp.id).toBe('cp_0001')
    expect(cp.turnIndex).toBe(1)
    expect(cp.newMessageIds).toEqual(['m_001', 'm_002'])
    expect(cp.intent).toBe('first turn')
  })

  it('toolSet is optional — omitted when unchanged since last checkpoint', () => {
    const cp: SessionCheckpoint = {
      id: 'cp_0002',
      turnIndex: 2,
      newMessageIds: ['m_003', 'm_004'],
      intent: 'second turn',
    }
    expect(cp.toolSet).toBeUndefined()
  })

  it('toolSet is present when packages changed this turn', () => {
    const cp: SessionCheckpoint = {
      id: 'cp_0003',
      turnIndex: 3,
      newMessageIds: ['m_005'],
      toolSet: ['@loom-code/shell@1.0.0'],
      intent: 'added shell package',
    }
    expect(cp.toolSet).toContain('@loom-code/shell@1.0.0')
  })

  it('config is optional — omitted when unchanged', () => {
    const cp: SessionCheckpoint = {
      id: 'cp_0004',
      turnIndex: 4,
      newMessageIds: ['m_006'],
      intent: 'no config change',
    }
    expect(cp.config).toBeUndefined()
  })
})

describe('CheckpointSnapshot (full, every 20 turns)', () => {
  it('has allMessageIds (full list, not just new ones)', () => {
    const snap: CheckpointSnapshot = {
      id: 'cp_0020',
      turnIndex: 20,
      allMessageIds: ['m_001', 'm_002', 'm_003'],
      toolSet: ['@loom-code/shell@1.0.0'],
      intent: 'full snapshot at turn 20',
    }
    expect(snap.allMessageIds).toHaveLength(3)
    expect(snap.toolSet).toBeDefined()  // toolSet is required in snapshots
  })

  it('config is optional in snapshots too', () => {
    const snap: CheckpointSnapshot = {
      id: 'cp_0020',
      turnIndex: 20,
      allMessageIds: [],
      toolSet: [],
      intent: 'empty snapshot',
    }
    expect(snap.config).toBeUndefined()
  })
})

describe('CheckpointEntry (discriminated union)', () => {
  it('delta entry has type "delta"', () => {
    const entry: CheckpointEntry = {
      type: 'delta',
      id: 'cp_0001',
      turnIndex: 1,
      newMessageIds: ['m_001'],
      intent: 'turn 1',
    }
    expect(entry.type).toBe('delta')
    if (entry.type === 'delta') {
      expect(entry.newMessageIds).toBeDefined()
    }
  })

  it('snapshot entry has type "snapshot"', () => {
    const entry: CheckpointEntry = {
      type: 'snapshot',
      id: 'cp_0020',
      turnIndex: 20,
      allMessageIds: ['m_001', 'm_002'],
      toolSet: [],
      intent: 'snapshot',
    }
    expect(entry.type).toBe('snapshot')
    if (entry.type === 'snapshot') {
      expect(entry.allMessageIds).toBeDefined()
    }
  })
})

describe('SessionMetadata', () => {
  it('has sessionId, created, lastActive, model, intent, turnCount', () => {
    const meta: SessionMetadata = {
      sessionId: 'abc123',
      created: '2026-04-03T10:00:00Z',
      lastActive: '2026-04-03T11:00:00Z',
      model: 'claude-opus-4',
      intent: 'refactoring auth',
      turnCount: 15,
    }
    expect(meta.sessionId).toBe('abc123')
    expect(meta.turnCount).toBe(15)
    expect(meta.intent).toBe('refactoring auth')
  })
})
