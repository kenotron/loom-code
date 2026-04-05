import type { LoomTool } from '@loom-code/core'
import { generateId } from '../id'
import { TaskStore } from '../store'
import type { Task } from '../types'

interface AddTaskInput {
  title: string
  notes?: string
  agent_id?: string
}

/** Factory: bind a TaskStore and return the add_task LoomTool. */
export function makeAddTask(store: TaskStore): LoomTool {
  return {
    name: 'add_task',
    description:
      'Create a new task with status "pending". Returns the created task as JSON.',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the task' },
        notes: { type: 'string', description: 'Optional extended notes' },
        agent_id: { type: 'string', description: 'ID of the agent owning this task' },
      },
      required: ['title'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        let input: AddTaskInput
        try {
          input = JSON.parse(inputJson) as AddTaskInput
        } catch {
          return JSON.stringify({ success: false, output: 'Error: invalid JSON input' })
        }

        if (typeof input.title !== 'string' || !input.title.trim()) {
          return JSON.stringify({ success: false, output: 'Error: title is required' })
        }

        const now = new Date().toISOString()
        const task: Task = {
          id: generateId(),
          title: input.title.trim(),
          status: 'pending',
          created: now,
          updated: now,
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.agent_id !== undefined && { agentId: input.agent_id }),
        }

        await store.append(task)
        return JSON.stringify({ success: true, output: JSON.stringify(task) })
      } catch (err) {
        return JSON.stringify({ success: false, output: `Error: ${String(err)}` })
      }
    },
  }
}
