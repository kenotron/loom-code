import type { LoomTool } from '@loom-code/core'
import { TaskStore } from '../store'
import type { Task, TaskStatus } from '../types'

interface ListTasksInput {
  status?: TaskStatus
  limit?: number
}

/** Factory: bind a TaskStore and return the list_tasks LoomTool. */
export function makeListTasks(store: TaskStore): LoomTool {
  return {
    name: 'list_tasks',
    description:
      'List tasks, optionally filtered by status. Returns tasks sorted most-recently-updated first.',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'done', 'cancelled'],
          description: 'Only return tasks with this status',
        },
        limit: { type: 'number', description: 'Maximum number of tasks to return' },
      },
    },
    async execute(inputJson: string): Promise<string> {
      try {
        let input: ListTasksInput
        try {
          input = JSON.parse(inputJson) as ListTasksInput
        } catch {
          return JSON.stringify({ success: false, output: 'Error: invalid JSON input' })
        }

        let tasks: Task[] = Array.from((await store.current()).values())

        // Filter by status
        if (input.status) {
          tasks = tasks.filter(t => t.status === input.status)
        }

        // Sort most-recently-updated first
        tasks.sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))

        // Apply limit
        if (typeof input.limit === 'number' && input.limit > 0) {
          tasks = tasks.slice(0, input.limit)
        }

        return JSON.stringify({ success: true, output: JSON.stringify(tasks) })
      } catch (err) {
        return JSON.stringify({ success: false, output: `Error: ${String(err)}` })
      }
    },
  }
}
