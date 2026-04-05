import type { LoomTool } from '@loom-code/core'
import { TaskStore } from '../store'
import type { Task, TaskStatus } from '../types'

interface UpdateTaskInput {
  id: string
  status?: TaskStatus
  notes?: string
  agent_id?: string
}

/**
 * Core update logic, shared with complete_task.
 * Returns the updated Task or a descriptive error string.
 */
export async function applyUpdate(
  store: TaskStore,
  input: UpdateTaskInput,
): Promise<{ ok: true; task: Task } | { ok: false; error: string }> {
  const map = await store.current()
  const existing = map.get(input.id)
  if (!existing) {
    return { ok: false, error: `Error: task ${input.id} not found` }
  }

  const updated: Task = {
    ...existing,
    updated: new Date().toISOString(),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.agent_id !== undefined && { agentId: input.agent_id }),
  }

  await store.append(updated)
  return { ok: true, task: updated }
}

/** Factory: bind a TaskStore and return the update_task LoomTool. */
export function makeUpdateTask(store: TaskStore): LoomTool {
  return {
    name: 'update_task',
    description:
      'Update a task\'s status, notes, or agent_id by id. Returns the updated task as JSON.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID to update' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'done', 'cancelled'],
          description: 'New status',
        },
        notes: { type: 'string', description: 'New notes' },
        agent_id: { type: 'string', description: 'New agent owner' },
      },
      required: ['id'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        let input: UpdateTaskInput
        try {
          input = JSON.parse(inputJson) as UpdateTaskInput
        } catch {
          return JSON.stringify({ success: false, output: 'Error: invalid JSON input' })
        }

        if (typeof input.id !== 'string' || !input.id.trim()) {
          return JSON.stringify({ success: false, output: 'Error: id is required' })
        }

        const result = await applyUpdate(store, input)
        if (!result.ok) {
          return JSON.stringify({ success: false, output: result.error })
        }
        return JSON.stringify({ success: true, output: JSON.stringify(result.task) })
      } catch (err) {
        return JSON.stringify({ success: false, output: `Error: ${String(err)}` })
      }
    },
  }
}
