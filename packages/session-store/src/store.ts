import { appendFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'

/**
 * Append-only JSONL file store.
 *
 * Each entry is stored as a single JSON-serialized line followed by a newline.
 * Concurrent appends are serialized via a promise chain to prevent interleaving.
 *
 * This is the foundation for the session store — messages and checkpoints both
 * use this pattern for corruption-resistant append-only writes.
 */
export class JsonlStore {
  private readonly _path: string
  /** Promise chain used as a write lock — serializes concurrent appends. */
  private _writeLock: Promise<void> = Promise.resolve()

  constructor(path: string) {
    this._path = path
  }

  /**
   * Append a single entry to the store.
   * Serialized via promise chain — safe to call concurrently.
   */
  append(entry: unknown): Promise<void> {
    this._writeLock = this._writeLock.then(async () => {
      await appendFile(this._path, JSON.stringify(entry) + '\n', 'utf8')
    })
    return this._writeLock
  }

  /**
   * Read all entries from the store.
   * Returns an empty array if the file does not exist.
   * Never throws on a missing file.
   */
  async readAll<T = unknown>(): Promise<T[]> {
    if (!existsSync(this._path)) return []
    const content = await readFile(this._path, 'utf8')
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as T)
  }
}
