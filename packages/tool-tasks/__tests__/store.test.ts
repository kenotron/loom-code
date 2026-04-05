import { describe, it, expect, afterEach } from 'bun:test'
import { TaskStore } from '../src/store'
import { Task } from '../src/types'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'

function tempPath(): string {
  return `${tmpdir()}/tasks-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  return {
    id: `test${Math.random().toString(36).slice(2, 6)}`,
    title: 'Test task',
    status: 'pending',
    created: now,
    updated: now,
    ...overrides,
  }
}

describe('TaskStore', () => {
  const paths: string[] = []

  afterEach(async () => {
    for (const p of paths) {
      await unlink(p).catch(() => {/* ignore if file does not exist */})
    }
    paths.length = 0
  })

  function store(): { s: TaskStore; path: string } {
    const path = tempPath()
    paths.push(path)
    return { s: new TaskStore(path), path }
  }

  describe('append + readAll', () => {
    it('reads an empty store as an empty array', async () => {
      const { s } = store()
      const tasks = await s.readAll()
      expect(tasks).toEqual([])
    })

    it('appends a task and reads it back', async () => {
      const { s } = store()
      const task = makeTask({ title: 'Hello' })
      await s.append(task)
      const tasks = await s.readAll()
      expect(tasks).toHaveLength(1)
      expect(tasks[0]).toEqual(task)
    })

    it('deduplicates by id — last write wins', async () => {
      const { s } = store()
      const id = 'abc12345'
      const first = makeTask({ id, title: 'First', status: 'pending' })
      const second = makeTask({ id, title: 'Second', status: 'done' })
      await s.append(first)
      await s.append(second)
      const tasks = await s.readAll()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Second')
      expect(tasks[0].status).toBe('done')
    })

    it('preserves multiple distinct tasks', async () => {
      const { s } = store()
      const t1 = makeTask({ id: 'aaa00001', title: 'Task 1' })
      const t2 = makeTask({ id: 'bbb00002', title: 'Task 2' })
      await s.append(t1)
      await s.append(t2)
      const tasks = await s.readAll()
      expect(tasks).toHaveLength(2)
    })
  })

  describe('current()', () => {
    it('returns a Map keyed by task id', async () => {
      const { s } = store()
      const task = makeTask({ id: 'mapkey01' })
      await s.append(task)
      const map = await s.current()
      expect(map.size).toBe(1)
      expect(map.get('mapkey01')).toEqual(task)
    })

    it('reflects last-write-wins for duplicate ids', async () => {
      const { s } = store()
      const id = 'dup00001'
      await s.append(makeTask({ id, status: 'pending' }))
      await s.append(makeTask({ id, status: 'done' }))
      const map = await s.current()
      expect(map.get(id)?.status).toBe('done')
    })
  })

  describe('concurrent appends', () => {
    it('all 3 simultaneous appends appear in readAll()', async () => {
      const { s } = store()
      const tasks = [
        makeTask({ id: 'con00001', title: 'Concurrent 1' }),
        makeTask({ id: 'con00002', title: 'Concurrent 2' }),
        makeTask({ id: 'con00003', title: 'Concurrent 3' }),
      ]
      // Fire all three at the same time
      await Promise.all(tasks.map(t => s.append(t)))
      const all = await s.readAll()
      expect(all).toHaveLength(3)
      const ids = new Set(all.map(t => t.id))
      expect(ids).toContain('con00001')
      expect(ids).toContain('con00002')
      expect(ids).toContain('con00003')
    })
  })
})
