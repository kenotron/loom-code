/** Task lifecycle status */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'

/** A single tracked task */
export interface Task {
  /** nanoid-style 8-char id */
  id: string
  title: string
  status: TaskStatus
  notes?: string
  /** Which agent created / owns this task */
  agentId?: string
  /** ISO 8601 creation timestamp */
  created: string
  /** ISO 8601 last-update timestamp */
  updated: string
}

/** Options for the TaskStore */
export interface TaskStoreOptions {
  /** Absolute path to the JSONL file. Default: ~/.loom/tasks.jsonl */
  storePath?: string
}
