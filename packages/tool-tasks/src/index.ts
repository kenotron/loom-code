import { homedir } from 'os'
import { join } from 'path'
import type { LoomPackage } from '@loom-code/core'
import { TaskStore } from './store'
import { TaskStoreOptions } from './types'
import { makeAddTask } from './tools/add'
import { makeListTasks } from './tools/list'
import { makeUpdateTask } from './tools/update'
import { makeCompleteTask } from './tools/complete'

export type { Task, TaskStatus, TaskStoreOptions } from './types'
export { TaskStore } from './store'
export { generateId } from './id'

/**
 * Create a LoomPackage that provides 4 cross-agent task-tracking tools:
 *   add_task, list_tasks, update_task, complete_task
 *
 * All tools share a single JSONL-backed TaskStore at `storePath`
 * (default: ~/.loom/tasks.jsonl).
 */
export function createTasksPackage(options?: TaskStoreOptions): LoomPackage {
  const storePath = options?.storePath ?? join(homedir(), '.loom', 'tasks.jsonl')
  const store = new TaskStore(storePath)

  return {
    tools: [
      makeAddTask(store),
      makeListTasks(store),
      makeUpdateTask(store),
      makeCompleteTask(store),
    ],
  }
}
