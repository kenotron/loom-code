import { describe, it, expect, afterEach } from 'bun:test'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { makeAddTask } from '../../src/tools/add'
import { TaskStore } from '../../src/store'
import type { Task } from '../../src/types'

function tempPath(): string {
  return `${tmpdir()}/tasks-add-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
}

describe('add_task tool', () => {
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
    const tool = makeAddTask(store)
    return { store, tool }
  }

  it('has correct name and description', () => {
    const { tool } = setup()
    expect(tool.name).toBe('add_task')
    expect(tool.description).toBeTruthy()
  })

  it('creates a task with pending status and persists it', async () => {
    const { store, tool } = setup()
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ title: 'Write tests' }))
    )
    expect(result.success).toBe(true)

    const task: Task = JSON.parse(result.output)
    expect(task.title).toBe('Write tests')
    expect(task.status).toBe('pending')
    expect(task.id).toHaveLength(8)
    expect(task.created).toBeTruthy()
    expect(task.updated).toBeTruthy()

    // Must be persisted
    const all = await store.readAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(task.id)
  })

  it('stores optional notes and agentId', async () => {
    const { tool } = setup()
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ title: 'With notes', notes: 'some note', agent_id: 'agent-007' }))
    )
    const task: Task = JSON.parse(result.output)
    expect(task.notes).toBe('some note')
    expect(task.agentId).toBe('agent-007')
  })

  it('returns success:false on missing title', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute(JSON.stringify({})))
    expect(result.success).toBe(false)
    expect(result.output).toContain('title')
  })

  it('never throws — returns JSON even on garbage input', async () => {
    const { tool } = setup()
    const result = JSON.parse(await tool.execute('not-json'))
    expect(result.success).toBe(false)
    expect(typeof result.output).toBe('string')
  })
})
