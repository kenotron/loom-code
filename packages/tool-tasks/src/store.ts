import { appendFile, readFile } from 'fs/promises'
import { Task } from './types'

/**
 * Minimal append-only JSONL store for tasks.
 *
 * Concurrency model: each append is a single write(2) syscall on a small buffer
 * (well under PIPE_BUF / 4 KiB), which POSIX guarantees to be atomic.
 *
 * On read, duplicate IDs are resolved by last-write-wins: the final record for
 * a given ID is the canonical state.
 */
export class TaskStore {
  constructor(private readonly storePath: string) {}

  /** Append one task record as a JSON line. */
  async append(task: Task): Promise<void> {
    const line = JSON.stringify(task) + '\n'
    await appendFile(this.storePath, line, 'utf8')
  }

  /**
   * Read all task records, deduplicating by id (last write wins).
   * Returns tasks in insertion order of their *last* occurrence.
   */
  async readAll(): Promise<Task[]> {
    let raw: string
    try {
      raw = await readFile(this.storePath, 'utf8')
    } catch {
      // File does not exist yet — empty store
      return []
    }

    const map = new Map<string, Task>()
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const task = JSON.parse(trimmed) as Task
        map.set(task.id, task)
      } catch {
        // Skip malformed lines
      }
    }

    return Array.from(map.values())
  }

  /** Return current canonical state as a Map<id, Task>. */
  async current(): Promise<Map<string, Task>> {
    const tasks = await this.readAll()
    const map = new Map<string, Task>()
    for (const t of tasks) {
      map.set(t.id, t)
    }
    return map
  }
}
