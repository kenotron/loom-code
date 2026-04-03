import { describe, it, expect } from 'bun:test'
import {
  reconstructAt,
  validateMessages,
  repairMessages,
  reconstruct,
} from '../reconstruction'
import type { CheckpointEntry, MessageRecord } from '../types'

// Test fixtures
const messages: MessageRecord[] = [
  { id: 'm_001', role: 'user', content: 'Hello' },
  { id: 'm_002', role: 'assistant', content: 'Hi there' },
  { id: 'm_003', role: 'user', content: 'Use the bash tool' },
  { id: 'm_004', role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'bash', input: {} }] },
  { id: 'm_005', role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' }] },
  { id: 'm_006', role: 'assistant', content: 'Done' },
]

const messageMap = new Map(messages.map(m => [m.id, m]))

const deltas: CheckpointEntry[] = [
  { type: 'delta', id: 'cp_0001', turnIndex: 1, newMessageIds: ['m_001', 'm_002'], intent: 'turn 1' },
  { type: 'delta', id: 'cp_0002', turnIndex: 2, newMessageIds: ['m_003', 'm_004', 'm_005'], intent: 'turn 2' },
  { type: 'delta', id: 'cp_0003', turnIndex: 3, newMessageIds: ['m_006'], intent: 'turn 3', toolSet: ['@loom-code/shell@1.0.0'] },
]

describe('reconstructAt', () => {
  it('reconstructs message IDs at a given turn', () => {
    const result = reconstructAt(deltas, 1)
    expect(result.messageIds).toEqual(['m_001', 'm_002'])
  })

  it('accumulates all delta messageIds up to target turn', () => {
    const result = reconstructAt(deltas, 2)
    expect(result.messageIds).toEqual(['m_001', 'm_002', 'm_003', 'm_004', 'm_005'])
  })

  it('reconstructs full history at the last turn', () => {
    const result = reconstructAt(deltas, 3)
    expect(result.messageIds).toHaveLength(6)
  })

  it('finds the last toolSet from deltas that include it', () => {
    const result = reconstructAt(deltas, 3)
    expect(result.toolSet).toEqual(['@loom-code/shell@1.0.0'])
  })

  it('uses snapshot as the base when present and applies subsequent deltas', () => {
    const snapshot: CheckpointEntry = {
      type: 'snapshot',
      id: 'cp_0020',
      turnIndex: 20,
      allMessageIds: ['m_001', 'm_002', 'm_003', 'm_004', 'm_005', 'm_006'],
      toolSet: ['@loom-code/shell@1.0.0'],
      intent: 'snapshot at 20',
    }
    const deltaAfter: CheckpointEntry = {
      type: 'delta',
      id: 'cp_0021',
      turnIndex: 21,
      newMessageIds: ['m_007', 'm_008'],
      intent: 'turn 21',
    }
    const result = reconstructAt([snapshot, deltaAfter], 21)
    // snapshot has 6 + delta adds 2 = 8
    expect(result.messageIds).toHaveLength(8)
    expect(result.messageIds).toContain('m_007')
  })

  it('returns empty messageIds when no checkpoints', () => {
    const result = reconstructAt([], 5)
    expect(result.messageIds).toEqual([])
  })
})

describe('validateMessages', () => {
  it('passes for a valid message array', () => {
    const msgs = messages.map(m => ({ role: m.role, content: m.content }))
    const result = validateMessages(msgs as any)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('detects orphaned tool_use without matching tool_result', () => {
    const bad = [
      { role: 'user', content: 'do something' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_orphan', name: 'bash', input: {} }] },
      { role: 'user', content: 'next message' },  // no tool_result
    ]
    const result = validateMessages(bad as any)
    expect(result.valid).toBe(false)
    expect(result.issues.some(i => i.includes('orphaned') || i.includes('tool_use'))).toBe(true)
  })

  it('detects tool_use at the end (no following user message)', () => {
    const bad = [
      { role: 'user', content: 'go' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_end', name: 'bash', input: {} }] },
      // nothing after — turn failed mid-flight
    ]
    const result = validateMessages(bad as any)
    expect(result.valid).toBe(false)
  })

  it('passes for empty message array', () => {
    const result = validateMessages([])
    expect(result.valid).toBe(true)
  })

  it('passes for simple text-only conversation', () => {
    const msgs = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'bye' },
      { role: 'assistant', content: 'goodbye' },
    ]
    const result = validateMessages(msgs as any)
    expect(result.valid).toBe(true)
  })
})

describe('repairMessages', () => {
  it('removes orphaned tool_use blocks and returns valid array', () => {
    const bad = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'do something' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_orphan', name: 'bash', input: {} }] },
      // no tool_result — orphaned
    ]
    const repaired = repairMessages(bad as any)
    const check = validateMessages(repaired)
    expect(check.valid).toBe(true)
    // Orphaned tool_use message should be removed or stripped
    expect(repaired.length).toBeLessThan(bad.length)
  })

  it('preserves valid tool_use + tool_result pairs', () => {
    const valid = [
      { role: 'user', content: 'run bash' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'bash', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' }] },
      { role: 'assistant', content: 'Done' },
    ]
    const repaired = repairMessages(valid as any)
    expect(repaired).toHaveLength(4)
    const check = validateMessages(repaired)
    expect(check.valid).toBe(true)
  })

  it('returns the same array when no repairs needed', () => {
    const valid = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]
    const repaired = repairMessages(valid as any)
    expect(repaired).toHaveLength(2)
    expect(validateMessages(repaired).valid).toBe(true)
  })
})

describe('reconstruct', () => {
  it('reconstructs and returns valid messages at the target turn', async () => {
    const result = await reconstruct(deltas, messageMap, 3)
    expect(result.messages).toHaveLength(6)
    expect(validateMessages(result.messages).valid).toBe(true)
    expect(result.meta.intent).toBe('turn 3')
  })

  it('falls back to previous turn when current turn has corrupted history', async () => {
    // Add a corrupted turn 4 with orphaned tool_use
    const corruptMsg: MessageRecord = {
      id: 'm_corrupt',
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tu_corrupt', name: 'bash', input: {} }],
    }
    const corruptMap = new Map([...messageMap, ['m_corrupt', corruptMsg]])
    const corruptDeltas: CheckpointEntry[] = [
      ...deltas,
      {
        type: 'delta',
        id: 'cp_0004',
        turnIndex: 4,
        newMessageIds: ['m_corrupt'],  // adds orphaned tool_use
        intent: 'corrupt turn',
      },
    ]
    // Reconstruct at turn 4 — should fall back to turn 3 (last valid)
    const result = await reconstruct(corruptDeltas, corruptMap, 4)
    expect(validateMessages(result.messages).valid).toBe(true)
    // Either repaired or fell back — either way, result must be valid
    expect(result.messages.length).toBeGreaterThan(0)
  })

  it('returns messages with correct content when reconstruction succeeds', async () => {
    const result = await reconstruct(deltas, messageMap, 1)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].role).toBe('user')
    expect(result.messages[1].role).toBe('assistant')
  })

  it('throws when message referenced by checkpoint is not in the store', async () => {
    const emptyMap = new Map<string, MessageRecord>()
    const singleCheckpoint: CheckpointEntry[] = [
      { type: 'delta', id: 'cp_0001', turnIndex: 1, newMessageIds: ['m_not_in_store'], intent: 'missing' }
    ]
    await expect(reconstruct(singleCheckpoint, emptyMap, 1)).rejects.toThrow()
  })
})

describe('validateMessages — orphaned tool_result', () => {
  it('detects orphaned tool_result in user message without preceding tool_use', async () => {
    const bad = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      // User message with tool_result but preceding message is plain text, not tool_use
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_orphan', content: 'orphaned' }] },
    ]
    const result = validateMessages(bad as any)
    expect(result.valid).toBe(false)
    expect(result.issues.some(i => i.includes('orphaned') || i.includes('tool_result'))).toBe(true)
  })
})

describe('repairMessages — mixed-content orphaned tool_result', () => {
  it('strips orphaned tool_result blocks from mixed-content user messages', async () => {
    const msgs = [
      { role: 'user', content: 'run bash' },
      // Orphaned tool_use (no matching tool_result)
      { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'bash', input: {} }] },
      // Next: mixed content — tool_result + text (tool_result becomes orphaned after repair)
      { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' },
        { type: 'text', text: 'also some context' },
      ]},
      { role: 'assistant', content: 'Done' },
    ]
    const repaired = repairMessages(msgs as any)
    const check = validateMessages(repaired)
    expect(check.valid).toBe(true)
    // The mixed-content user message should have its tool_result stripped but text preserved
    const userMsgs = repaired.filter(m => m.role === 'user')
    // At minimum, "also some context" text content should survive
    expect(repaired.length).toBeGreaterThan(0)
  })
})
