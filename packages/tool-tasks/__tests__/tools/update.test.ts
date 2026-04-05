import { describe, it, expect, afterEach } from 'bun:test'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { makeUpdateTask } from '../../src/tools/update'
import { TaskStore } from '../../src/store'
import type { Task } from '../../src/types'

function tempPath(): string {
  return `${tmpdir()}/tasks-update-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  return {
    id: `up000001`,
    title: 'Original title',
    status: 'pending',
    created: now,
    updated: now,
    ...overrides,
  }
}

describe('update_task tool', () => {
  const paths: string[] = []

  afterEach(async () => {
    for (const p of paths) {
      await unlink(p).catch(() => {})
    }
    paths.length = 0
  })

  function setup() {
    const path = tempPath()
    paths.push(path)
    const store = new TaskStore(path)
    const tool = makeUpdateTask(store)
    return { store, tool }
  }

  it('has correct name and description', () => {
    const { tool } = setup()
    expect(tool.name).toBe('update_task')
    expect(tool.description).toBeTruthy()
  })

  it('updates status on an existing task', async () => {
    const { store, tool } = setup()
    const task = makeTask({ id: 'upd00001' })
    await store.append(task)

    const result = JSON.parse(
      await tool.execute(JSON.stringify({ id: 'upd00001', status: 'done' }))
    )
    expect(result.success).toBe(true)
    const updated: Task = JSON.parse(result.output)
    expect(updated.id).toBe('upd00001')
    expect(updated.status).toBe('done')
    expect(updated.title).toBe('Original title') // unchanged

    // Must be persisted
    const map = await store.current()
    expect(map.get('upd00001')?.status).toBe('done')
  })

  it('updates notes on an existing task', async () => {
    const { store, tool } = setup()
    await store.append(makeTask({ id: 'upd00002' }))

    const result = JSON.parse(
      await tool.execute(JSON.stringify({ id: 'upd00002', notes: 'new notes' }))
    )
    expect(result.success).toBe(true)
    const updated: Task = JSON.parse(result.output)
    expect(updated.notes).toBe('new notes')
  })

  it('updates agentId on an existing task', async () => {
    const { store, tool } = setup()
    await store.append(makeTask({ id: 'upd00003' }))

    const result = JSON.parse(
      await tool.execute(JSON.stringify({ id: 'upd00003', agent_id: 'agent-42' }))
    )
    expect(result.success).toBe(true)
    const updated: Task = JSON.parse(result.output)
    expect(updated.agentId).toBe('agent-42')
  })

  it('updates the updated timestamp', async () => {
    const { store, tool } = setup()
    const old = '2024-01-01T00:00:00.000Z'
    await store.append(makeTask({ id: 'upd00004', updated: old }))

    const before = Date.now()
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ id: 'upd00004', status: 'in_progress' }))
    )
    const after = Date.now()

    const updated: Task = JSON.parse(result.output)
    const updatedMs = new Date(updated.updated).getTime()
    expect(updatedMs).toBeGreaterThanOrEqual(before)
    expect(updatedMs).toBeLessThanOrEqual(after)
  })

  it('returns success:false when id not found', async () => {
    const { tool } = setup()
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ id: 'no-such-id', status: 'done' }))
    )
    expect(result.success).toBe(false)
    expect(result.output).toContain('no-such-id')
  })

  it('returns success:false on missing id field', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute(JSON.stringify({ status: 'done' })))
    expect(result.success).toBe(false)
  })

  it('never throws — returns JSON on garbage input', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute('not json'))
    expect(result.success).toBe(false)
    expect(typeof result.output).toBe('string')
  })
})
