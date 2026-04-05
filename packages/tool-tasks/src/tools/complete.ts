import type { LoomTool } from '@loom-code/core'
import { TaskStore } from '../store'
import { applyUpdate } from './update'

interface CompleteTaskInput {
  id: string
}

/** Factory: bind a TaskStore and return the complete_task LoomTool. */
export function makeCompleteTask(store: TaskStore): LoomTool {
  return {
    name: 'complete_task',
    description:
      'Mark a task as done by id. Shorthand for update_task with status="done".',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID to mark as done' },
      },
      required: ['id'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        let input: CompleteTaskInput
        try {
          input = JSON.parse(inputJson) as CompleteTaskInput
        } catch {
          return JSON.stringify({ success: false, output: 'Error: invalid JSON input' })
        }

        if (typeof input.id !== 'string' || !input.id.trim()) {
          return JSON.stringify({ success: false, output: 'Error: id is required' })
        }

        const result = await applyUpdate(store, { id: input.id, status: 'done' })
        if (!result.ok) {
          return JSON.stringify({ success: false, output: result.error })
        }
        return JSON.stringify({
          success: true,
          output: `Task ${input.id} marked done`,
        })
      } catch (err) {
        return JSON.stringify({ success: false, output: `Error: ${String(err)}` })
      }
    },
  }
}
