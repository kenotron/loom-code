import * as fs from 'fs/promises'
import * as path from 'path'
import { FsError, type FsBackend, type FileStat, type DirEntry } from '../types'

/**
 * LocalBackend — thin wrapper around `fs/promises` and Bun primitives.
 *
 * All paths received by this backend are relative to `rootDir`.
 */
export class LocalBackend implements FsBackend {
  constructor(private readonly rootDir: string) {}

  private abs(relativePath: string): string {
    return relativePath === '' ? this.rootDir : path.join(this.rootDir, relativePath)
  }

  // ── read ──────────────────────────────────────────────────────────────

  async read(relativePath: string, range?: { offset: number; limit: number }): Promise<string> {
    const absPath = this.abs(relativePath)
    try {
      const content = await Bun.file(absPath).text()
      if (!range) return content
      const lines = content.split('\n')
      return lines.slice(range.offset, range.offset + range.limit).join('\n')
    } catch (err: unknown) {
      if (isEnoent(err)) throw new FsError('ENOENT', relativePath)
      throw err
    }
  }

  // ── write ─────────────────────────────────────────────────────────────

  async write(relativePath: string, content: string): Promise<void> {
    const absPath = this.abs(relativePath)
    // Ensure parent directories exist
    await fs.mkdir(path.dirname(absPath), { recursive: true })
    await Bun.write(absPath, content)
  }

  // ── edit ──────────────────────────────────────────────────────────────

  async edit(
    relativePath: string,
    oldStr: string,
    newStr: string,
    replaceAll = false,
  ): Promise<{ replaced: number }> {
    const content = await this.read(relativePath) // throws ENOENT if missing
    const count = countOccurrences(content, oldStr)
    if (count === 0) {
      throw new FsError('ENOTFOUND', relativePath, `ENOTFOUND: string not found in ${relativePath}`)
    }
    const [newContent, replaced] = replaceAll
      ? [content.split(oldStr).join(newStr), count]
      : [replaceFirst(content, oldStr, newStr), 1]

    await this.write(relativePath, newContent)
    return { replaced }
  }

  // ── list ──────────────────────────────────────────────────────────────

  async list(relativePath: string): Promise<DirEntry[]> {
    const absPath = this.abs(relativePath)
    const rawEntries = await fs.readdir(absPath, { withFileTypes: true })
    const entries: DirEntry[] = []
    for (const dirent of rawEntries) {
      const entryAbs = path.join(absPath, dirent.name)
      let type: DirEntry['type']
      let size = 0
      if (dirent.isSymbolicLink()) {
        type = 'symlink'
      } else if (dirent.isDirectory()) {
        type = 'directory'
      } else {
        type = 'file'
        try {
          const st = await fs.stat(entryAbs)
          size = st.size
        } catch {
          // best-effort
        }
      }
      entries.push({ name: dirent.name, type, size })
    }
    return entries
  }

  // ── stat ──────────────────────────────────────────────────────────────

  async stat(relativePath: string): Promise<FileStat> {
    const absPath = this.abs(relativePath)
    try {
      const st = await fs.stat(absPath)
      let type: FileStat['type']
      if (st.isSymbolicLink()) type = 'symlink'
      else if (st.isDirectory()) type = 'directory'
      else type = 'file'
      return {
        exists: true,
        type,
        size: st.isDirectory() ? 0 : st.size,
        modified: st.mtime.toISOString(),
      }
    } catch (err: unknown) {
      if (isEnoent(err)) {
        return { exists: false, type: 'file', size: 0, modified: '' }
      }
      throw err
    }
  }

  // ── glob ──────────────────────────────────────────────────────────────

  async glob(pattern: string): Promise<string[]> {
    const g = new Bun.Glob(pattern)
    const results: string[] = []
    for await (const p of g.scan({ cwd: this.rootDir, dot: true, onlyFiles: true })) {
      results.push(p)
    }
    return results.sort()
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  )
}

function countOccurrences(text: string, search: string): number {
  if (!search) return 0
  let count = 0
  let pos = 0
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++
    pos += search.length
  }
  return count
}

function replaceFirst(text: string, search: string, replacement: string): string {
  const idx = text.indexOf(search)
  if (idx === -1) return text
  return text.slice(0, idx) + replacement + text.slice(idx + search.length)
}
