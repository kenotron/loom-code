import { FsError, type FsBackend, type FileStat, type DirEntry } from '../types'

/**
 * InMemoryBackend — backed by a `Map<string, string>`.
 *
 * - Keys are normalised relative paths (no leading slash), e.g. "src/app.ts"
 * - Directories are synthesised from key prefixes — no explicit directory nodes
 * - Entire state is a plain Map, trivially snapshottable for tests
 */
export class InMemoryBackend implements FsBackend {
  private files = new Map<string, string>()

  // Expose the backing store for testing / snapshots
  get store(): ReadonlyMap<string, string> {
    return this.files
  }

  // ── read ──────────────────────────────────────────────────────────────

  async read(path: string, range?: { offset: number; limit: number }): Promise<string> {
    const key = normalise(path)
    if (!this.files.has(key)) {
      throw new FsError('ENOENT', path)
    }
    const content = this.files.get(key)!
    if (!range) return content
    const lines = content.split('\n')
    return lines.slice(range.offset, range.offset + range.limit).join('\n')
  }

  // ── write ─────────────────────────────────────────────────────────────

  async write(path: string, content: string): Promise<void> {
    this.files.set(normalise(path), content)
  }

  // ── edit ──────────────────────────────────────────────────────────────

  async edit(
    path: string,
    oldStr: string,
    newStr: string,
    replaceAll = false,
  ): Promise<{ replaced: number }> {
    const content = await this.read(path) // throws ENOENT if missing
    const count = countOccurrences(content, oldStr)
    if (count === 0) {
      throw new FsError('ENOTFOUND', path, `ENOTFOUND: string not found in ${path}`)
    }
    const [newContent, replaced] = replaceAll
      ? [content.split(oldStr).join(newStr), count]
      : [replaceFirst(content, oldStr, newStr), 1]

    await this.write(path, newContent)
    return { replaced }
  }

  // ── list ──────────────────────────────────────────────────────────────

  async list(path: string): Promise<DirEntry[]> {
    const prefix = normalise(path) === '' ? '' : normalise(path) + '/'
    const seen = new Map<string, 'file' | 'directory'>()
    const sizeMap = new Map<string, number>()

    for (const [key, content] of this.files) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      const slash = rest.indexOf('/')
      if (slash === -1) {
        // Direct file entry
        seen.set(rest, 'file')
        sizeMap.set(rest, content.length)
      } else {
        // Sub-directory
        const dirName = rest.slice(0, slash)
        if (!seen.has(dirName)) {
          seen.set(dirName, 'directory')
        }
      }
    }

    const entries: DirEntry[] = []
    for (const [name, type] of seen) {
      entries.push({
        name,
        type,
        size: type === 'file' ? (sizeMap.get(name) ?? 0) : 0,
      })
    }
    return entries
  }

  // ── stat ──────────────────────────────────────────────────────────────

  async stat(path: string): Promise<FileStat> {
    const key = normalise(path)

    if (this.files.has(key)) {
      const content = this.files.get(key)!
      return {
        exists: true,
        type: 'file',
        size: content.length,
        modified: new Date().toISOString(),
      }
    }

    // Check for a synthesised directory
    const dirPrefix = key === '' ? '' : key + '/'
    for (const k of this.files.keys()) {
      if (k.startsWith(dirPrefix) && dirPrefix !== '') {
        return {
          exists: true,
          type: 'directory',
          size: 0,
          modified: new Date().toISOString(),
        }
      }
    }

    return { exists: false, type: 'file', size: 0, modified: '' }
  }

  // ── glob ──────────────────────────────────────────────────────────────

  async glob(pattern: string): Promise<string[]> {
    const g = new Bun.Glob(pattern)
    const results: string[] = []
    for (const key of this.files.keys()) {
      if (g.match(key)) {
        results.push(key)
      }
    }
    return results.sort()
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

/** Strip leading/trailing slashes and collapse double slashes */
function normalise(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/')
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
