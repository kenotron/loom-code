import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { JsonlStore } from '../store'
import { buildCheckpointEntry } from '../checkpoints'
import { reconstruct, validateMessages } from '../reconstruction'
import type { MessageRecord, CheckpointEntry } from '../types'

let tmpDir: string
let messageStore: JsonlStore
let checkpointStore: JsonlStore

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'loom-integration-'))
  messageStore = new JsonlStore(join(tmpDir, 'messages.jsonl'))
  checkpointStore = new JsonlStore(join(tmpDir, 'checkpoints.jsonl'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

// Helper: simulate one session turn
async function simulateTurn(
  turnIndex: number,
  userText: string,
  assistantText: string,
  toolName?: string
): Promise<string[]> {
  const newIds: string[] = []

  const userId = `m_${String(turnIndex * 10 + 1).padStart(4, '0')}`
  const assistantId = `m_${String(turnIndex * 10 + 2).padStart(4, '0')}`
  newIds.push(userId, assistantId)

  await messageStore.append({ id: userId, role: 'user', content: userText })

  if (toolName) {
    const toolUseId = `tu_${turnIndex}`
    const resultId = `m_${String(turnIndex * 10 + 3).padStart(4, '0')}`
    newIds.push(resultId)

    // Assistant with tool_use
    await messageStore.append({
      id: assistantId,
      role: 'assistant',
      content: [{ type: 'tool_use', id: toolUseId, name: toolName, input: { command: 'ls' } }],
    })

    // User with tool_result
    await messageStore.append({
      id: resultId,
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: 'file1.ts file2.ts' }],
    })

    // Final assistant text
    const finalId = `m_${String(turnIndex * 10 + 4).padStart(4, '0')}`
    newIds.push(finalId)
    await messageStore.append({ id: finalId, role: 'assistant', content: assistantText })
  } else {
    await messageStore.append({ id: assistantId, role: 'assistant', content: assistantText })
  }

  return newIds
}

describe('Full checkpoint lifecycle integration', () => {
  it('writes and reconstructs a multi-turn session correctly', async () => {
    const allMessageIds: string[] = []
    let prevToolSet: string[] = []

    // Simulate 3 turns
    const turn1Ids = await simulateTurn(1, 'Hello', 'Hi there')
    const turn2Ids = await simulateTurn(2, 'List files', 'Here are the files', 'bash')
    const turn3Ids = await simulateTurn(3, 'Thanks', 'You are welcome')

    // Build and write checkpoints
    allMessageIds.push(...turn1Ids)
    const cp1 = buildCheckpointEntry({
      turnIndex: 1, newMessageIds: turn1Ids, allMessageIds: [...allMessageIds],
      toolSet: prevToolSet, prevToolSet, intent: 'greeting',
    })
    await checkpointStore.append(cp1)

    allMessageIds.push(...turn2Ids)
    const cp2 = buildCheckpointEntry({
      turnIndex: 2, newMessageIds: turn2Ids, allMessageIds: [...allMessageIds],
      toolSet: prevToolSet, prevToolSet, intent: 'listed files',
    })
    await checkpointStore.append(cp2)

    allMessageIds.push(...turn3Ids)
    const cp3 = buildCheckpointEntry({
      turnIndex: 3, newMessageIds: turn3Ids, allMessageIds: [...allMessageIds],
      toolSet: prevToolSet, prevToolSet, intent: 'concluded',
    })
    await checkpointStore.append(cp3)

    // Reconstruct full session
    const messages = await messageStore.readAll<MessageRecord>()
    const checkpoints = await checkpointStore.readAll<CheckpointEntry>()
    const messageMap = new Map(messages.map(m => [m.id, m]))

    const result = await reconstruct(checkpoints, messageMap, 3)
    expect(validateMessages(result.messages).valid).toBe(true)
    expect(result.messages.length).toBeGreaterThan(0)
    expect(result.meta.intent).toBe('concluded')
  })

  it('reconstructs at an earlier turn (point-in-time recovery)', async () => {
    const allMessageIds: string[] = []
    const prevToolSet: string[] = []

    const turn1Ids = await simulateTurn(1, 'Hello', 'Hi')
    allMessageIds.push(...turn1Ids)
    await checkpointStore.append(buildCheckpointEntry({
      turnIndex: 1, newMessageIds: turn1Ids, allMessageIds: [...allMessageIds],
      toolSet: prevToolSet, prevToolSet, intent: 'turn 1',
    }))

    const turn2Ids = await simulateTurn(2, 'Refactor auth', 'Done')
    allMessageIds.push(...turn2Ids)
    await checkpointStore.append(buildCheckpointEntry({
      turnIndex: 2, newMessageIds: turn2Ids, allMessageIds: [...allMessageIds],
      toolSet: prevToolSet, prevToolSet, intent: 'turn 2',
    }))

    const messages = await messageStore.readAll<MessageRecord>()
    const checkpoints = await checkpointStore.readAll<CheckpointEntry>()
    const messageMap = new Map(messages.map(m => [m.id, m]))

    // Reconstruct at turn 1 only — should not include turn 2 messages
    const result = await reconstruct(checkpoints, messageMap, 1)
    expect(result.messages).toHaveLength(turn1Ids.length)
    expect(validateMessages(result.messages).valid).toBe(true)
    expect(result.meta.intent).toBe('turn 1')
  })

  it('dynamic toolSet captured in checkpoint when package added mid-session', async () => {
    const allMessageIds: string[] = []
    let toolSet: string[] = []
    let prevToolSet: string[] = []

    const turn1Ids = await simulateTurn(1, 'Hello', 'Hi')
    allMessageIds.push(...turn1Ids)
    await checkpointStore.append(buildCheckpointEntry({
      turnIndex: 1, newMessageIds: turn1Ids, allMessageIds: [...allMessageIds],
      toolSet, prevToolSet, intent: 'before install',
    }))

    // Simulate mid-session package install
    prevToolSet = toolSet
    toolSet = ['@loom-code/shell@1.0.0']

    const turn2Ids = await simulateTurn(2, 'List files', 'Here', 'bash')
    allMessageIds.push(...turn2Ids)
    await checkpointStore.append(buildCheckpointEntry({
      turnIndex: 2, newMessageIds: turn2Ids, allMessageIds: [...allMessageIds],
      toolSet, prevToolSet, intent: 'after install',
    }))

    const checkpoints = await checkpointStore.readAll<CheckpointEntry>()
    const cp2 = checkpoints.find(cp => cp.turnIndex === 2)!

    // Turn 2 checkpoint should have captured the toolSet change
    expect(cp2.type).toBe('delta')
    if (cp2.type === 'delta') {
      expect(cp2.toolSet).toEqual(['@loom-code/shell@1.0.0'])
    }

    // Turn 1 checkpoint should NOT have toolSet (unchanged from empty)
    const cp1 = checkpoints.find(cp => cp.turnIndex === 1)!
    expect(cp1.type).toBe('delta')
    if (cp1.type === 'delta') {
      expect(cp1.toolSet).toBeUndefined()
    }
  })

  it('reconstruct recovers from a corrupted turn via repair', async () => {
    const allMessageIds: string[] = []
    const prevToolSet: string[] = []

    // Clean turn 1
    const turn1Ids = await simulateTurn(1, 'Hello', 'Hi')
    allMessageIds.push(...turn1Ids)
    await checkpointStore.append(buildCheckpointEntry({
      turnIndex: 1, newMessageIds: turn1Ids, allMessageIds: [...allMessageIds],
      toolSet: prevToolSet, prevToolSet, intent: 'clean turn',
    }))

    // Corrupt turn 2: write orphaned tool_use (no matching tool_result)
    const corruptId = 'm_0020'
    await messageStore.append({
      id: corruptId,
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tu_corrupt', name: 'bash', input: {} }],
      // No matching tool_result will follow
    })
    allMessageIds.push(corruptId)
    await checkpointStore.append(buildCheckpointEntry({
      turnIndex: 2, newMessageIds: [corruptId], allMessageIds: [...allMessageIds],
      toolSet: prevToolSet, prevToolSet, intent: 'corrupt turn',
    }))

    const messages = await messageStore.readAll<MessageRecord>()
    const checkpoints = await checkpointStore.readAll<CheckpointEntry>()
    const messageMap = new Map(messages.map(m => [m.id, m]))

    // reconstruct should recover (repair strips orphaned tool_use OR fallback to turn 1)
    const result = await reconstruct(checkpoints, messageMap, 2)
    expect(validateMessages(result.messages).valid).toBe(true)
    expect(result.messages.length).toBe(turn1Ids.length)
  })

  it('full cycle: write 20 turns and verify snapshot is created at turn 20', async () => {
    const allMessageIds: string[] = []
    const prevToolSet: string[] = []
    let lastToolSet = prevToolSet

    for (let turn = 1; turn <= 20; turn++) {
      const ids = await simulateTurn(turn, `message ${turn}`, `reply ${turn}`)
      allMessageIds.push(...ids)
      const cp = buildCheckpointEntry({
        turnIndex: turn,
        newMessageIds: ids,
        allMessageIds: [...allMessageIds],
        toolSet: lastToolSet,
        prevToolSet: turn === 1 ? [] : lastToolSet,
        intent: `turn ${turn}`,
      })
      await checkpointStore.append(cp)
    }

    const checkpoints = await checkpointStore.readAll<CheckpointEntry>()

    // Turn 20 should be a snapshot (not a delta)
    const cp20 = checkpoints.find(cp => cp.turnIndex === 20)!
    expect(cp20.type).toBe('snapshot')
    if (cp20.type === 'snapshot') {
      expect(cp20.allMessageIds.length).toBe(allMessageIds.length)
    }

    // Reconstruct at turn 20 using snapshot
    const messages = await messageStore.readAll<MessageRecord>()
    const messageMap = new Map(messages.map(m => [m.id, m]))
    const result = await reconstruct(checkpoints, messageMap, 20)
    expect(validateMessages(result.messages).valid).toBe(true)
    expect(result.messages.length).toBe(allMessageIds.length)
  })
})
