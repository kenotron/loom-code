import { describe, it, expect, afterEach } from 'bun:test'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { makeListTasks } from '../../src/tools/list'
import { TaskStore } from '../../src/store'
import type { Task } from '../../src/types'

function tempPath(): string {
  return `${tmpdir()}/tasks-list-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  return {
    id: `t${Math.random().toString(36).slice(2, 9)}`,
    title: 'Test task',
    status: 'pending',
    created: now,
    updated: now,
    ...overrides,
  }
}

describe('list_tasks tool', () => {
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
    const tool = makeListTasks(store)
    return { store, tool }
  }

  it('has correct name and description', () => {
    const { tool } = setup()
    expect(tool.name).toBe('list_tasks')
    expect(tool.description).toBeTruthy()
  })

  it('returns empty array when store is empty', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute(JSON.stringify({})))
    expect(result.success).toBe(true)
    expect(JSON.parse(result.output)).toEqual([])
  })

  it('returns all tasks when no filter is provided', async () => {
    const { store, tool } = setup()
    await store.append(makeTask({ id: 'aaa00001', status: 'pending' }))
    await store.append(makeTask({ id: 'bbb00002', status: 'done' }))
    await store.append(makeTask({ id: 'ccc00003', status: 'in_progress' }))

    const result = JSON.parse(await tool.execute(JSON.stringify({})))
    const tasks: Task[] = JSON.parse(result.output)
    expect(tasks).toHaveLength(3)
  })

  it('filters by status', async () => {
    const { store, tool } = setup()
    await store.append(makeTask({ id: 'pnd00001', status: 'pending' }))
    await store.append(makeTask({ id: 'pnd00002', status: 'pending' }))
    await store.append(makeTask({ id: 'don00001', status: 'done' }))

    const result = JSON.parse(await tool.execute(JSON.stringify({ status: 'pending' })))
    const tasks: Task[] = JSON.parse(result.output)
    expect(tasks).toHaveLength(2)
    expect(tasks.every(t => t.status === 'pending')).toBe(true)
  })

  it('applies limit and returns most-recently-updated first', async () => {
    const { store, tool } = setup()
    // Create tasks with distinct updated timestamps
    const t1 = makeTask({ id: 'lim00001', updated: '2024-01-01T00:00:00.000Z' })
    const t2 = makeTask({ id: 'lim00002', updated: '2024-01-03T00:00:00.000Z' })
    const t3 = makeTask({ id: 'lim00003', updated: '2024-01-02T00:00:00.000Z' })
    await store.append(t1)
    await store.append(t2)
    await store.append(t3)

    const result = JSON.parse(await tool.execute(JSON.stringify({ limit: 2 })))
    const tasks: Task[] = JSON.parse(result.output)
    expect(tasks).toHaveLength(2)
    // Most recent first
    expect(tasks[0].id).toBe('lim00002')
    expect(tasks[1].id).toBe('lim00003')
  })

  it('combines status filter and limit', async () => {
    const { store, tool } = setup()
    for (let i = 1; i <= 5; i++) {
      await store.append(
        makeTask({ id: `pn0000${i}`, status: 'pending', updated: `2024-01-0${i}T00:00:00.000Z` })
      )
    }
    await store.append(makeTask({ id: 'don0001', status: 'done' }))

    const result = JSON.parse(await tool.execute(JSON.stringify({ status: 'pending', limit: 3 })))
    const tasks: Task[] = JSON.parse(result.output)
    expect(tasks).toHaveLength(3)
    expect(tasks.every(t => t.status === 'pending')).toBe(true)
  })

  it('never throws — returns JSON on garbage input', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute('bad json'))
    expect(result.success).toBe(false)
    expect(typeof result.output).toBe('string')
  })
})
