import { describe, it, expect, afterEach } from 'bun:test'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { makeCompleteTask } from '../../src/tools/complete'
import { TaskStore } from '../../src/store'
import type { Task } from '../../src/types'

function tempPath(): string {
  return `${tmpdir()}/tasks-complete-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  return {
    id: 'cmp00001',
    title: 'A task',
    status: 'pending',
    created: now,
    updated: now,
    ...overrides,
  }
}

describe('complete_task tool', () => {
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
    const tool = makeCompleteTask(store)
    return { store, tool }
  }

  it('has correct name and description', () => {
    const { tool } = setup()
    expect(tool.name).toBe('complete_task')
    expect(tool.description).toBeTruthy()
  })

  it('sets task status to done and persists the change', async () => {
    const { store, tool } = setup()
    await store.append(makeTask({ id: 'cmp00001', status: 'in_progress' }))

    const result = JSON.parse(await tool.execute(JSON.stringify({ id: 'cmp00001' })))
    expect(result.success).toBe(true)
    expect(result.output).toContain('cmp00001')
    expect(result.output).toContain('done')

    // Persisted
    const map = await store.current()
    expect(map.get('cmp00001')?.status).toBe('done')
  })

  it('returns success:false when id not found', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute(JSON.stringify({ id: 'no-such' })))
    expect(result.success).toBe(false)
    expect(result.output).toContain('no-such')
  })

  it('returns success:false on missing id', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute(JSON.stringify({})))
    expect(result.success).toBe(false)
  })

  it('never throws — returns JSON on garbage input', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute('garbage'))
    expect(result.success).toBe(false)
    expect(typeof result.output).toBe('string')
  })
})
