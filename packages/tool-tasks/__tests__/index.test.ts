import { describe, it, expect, afterEach } from 'bun:test'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { createTasksPackage } from '../src/index'

function tempPath(): string {
  return `${tmpdir()}/tasks-index-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
}

describe('createTasksPackage', () => {
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
    return createTasksPackage({ storePath: path })
  }

  it('returns a LoomPackage with a tools array', () => {
    const pkg = setup()
    expect(Array.isArray(pkg.tools)).toBe(true)
  })

  it('exposes exactly 4 tools', () => {
    const pkg = setup()
    expect(pkg.tools).toHaveLength(4)
  })

  it('has add_task, list_tasks, update_task, complete_task tools', () => {
    const pkg = setup()
    const names = pkg.tools.map(t => t.name)
    expect(names).toContain('add_task')
    expect(names).toContain('list_tasks')
    expect(names).toContain('update_task')
    expect(names).toContain('complete_task')
  })

  it('all tools have execute functions', () => {
    const pkg = setup()
    for (const tool of pkg.tools) {
      expect(typeof tool.execute).toBe('function')
    }
  })

  it('all tools share the same backing store (end-to-end)', async () => {
    const pkg = setup()
    const add = pkg.tools.find(t => t.name === 'add_task')!
    const list = pkg.tools.find(t => t.name === 'list_tasks')!
    const complete = pkg.tools.find(t => t.name === 'complete_task')!

    // Add a task
    const addResult = JSON.parse(await add.execute(JSON.stringify({ title: 'E2E task' })))
    expect(addResult.success).toBe(true)
    const task = JSON.parse(addResult.output)

    // List should see it
    const listResult = JSON.parse(await list.execute(JSON.stringify({ status: 'pending' })))
    const tasks = JSON.parse(listResult.output)
    expect(tasks.some((t: { id: string }) => t.id === task.id)).toBe(true)

    // Complete it
    const completeResult = JSON.parse(await complete.execute(JSON.stringify({ id: task.id })))
    expect(completeResult.success).toBe(true)

    // Listing pending should not include it now
    const listAfter = JSON.parse(await list.execute(JSON.stringify({ status: 'pending' })))
    const tasksAfter = JSON.parse(listAfter.output)
    expect(tasksAfter.some((t: { id: string }) => t.id === task.id)).toBe(false)
  })
})
