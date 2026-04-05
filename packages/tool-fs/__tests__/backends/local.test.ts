import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { LocalBackend } from '../../src/backends/local'
import { FsError } from '../../src/types'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'loom-tool-fs-test-'))
}

describe('LocalBackend', () => {
  let tmpDir: string
  let backend: LocalBackend

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
    backend = new LocalBackend(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  // ── read / write ──────────────────────────────────────────────────────────

  describe('read / write', () => {
    it('writes and reads a file', async () => {
      await backend.write('hello.txt', 'hello world')
      expect(await backend.read('hello.txt')).toBe('hello world')
    })

    it('creates parent directories on write', async () => {
      await backend.write('deep/nested/file.txt', 'content')
      expect(await backend.read('deep/nested/file.txt')).toBe('content')
    })

    it('throws FsError ENOENT reading a missing file', async () => {
      await expect(backend.read('nope.txt')).rejects.toBeInstanceOf(FsError)
      try {
        await backend.read('nope.txt')
      } catch (e) {
        expect((e as FsError).code).toBe('ENOENT')
      }
    })
  })

  describe('read with range', () => {
    beforeEach(async () => {
      await backend.write('lines.txt', 'line0\nline1\nline2\nline3\nline4')
    })

    it('reads from offset with limit', async () => {
      const result = await backend.read('lines.txt', { offset: 1, limit: 2 })
      expect(result).toBe('line1\nline2')
    })

    it('reads from offset to end when limit is large', async () => {
      const result = await backend.read('lines.txt', { offset: 3, limit: 100 })
      expect(result).toBe('line3\nline4')
    })
  })

  // ── edit ─────────────────────────────────────────────────────────────────

  describe('edit', () => {
    it('replaces first occurrence', async () => {
      await backend.write('f.txt', 'foo bar foo')
      const { replaced } = await backend.edit('f.txt', 'foo', 'baz')
      expect(replaced).toBe(1)
      const content = await backend.read('f.txt')
      expect(content).toBe('baz bar foo')
    })

    it('replaces all occurrences when replaceAll=true', async () => {
      await backend.write('f.txt', 'foo bar foo baz foo')
      const { replaced } = await backend.edit('f.txt', 'foo', 'X', true)
      expect(replaced).toBe(3)
      expect(await backend.read('f.txt')).toBe('X bar X baz X')
    })

    it('throws FsError ENOTFOUND when string not found', async () => {
      await backend.write('f.txt', 'hello')
      await expect(backend.edit('f.txt', 'MISSING', 'x')).rejects.toBeInstanceOf(FsError)
      try {
        await backend.edit('f.txt', 'MISSING', 'x')
      } catch (e) {
        expect((e as FsError).code).toBe('ENOTFOUND')
      }
    })
  })

  // ── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    beforeEach(async () => {
      await backend.write('readme.md', '# hello')
      await backend.write('src/index.ts', 'export {}')
      await backend.write('src/utils.ts', '')
    })

    it('lists root directory', async () => {
      const entries = await backend.list('')
      const names = entries.map(e => e.name).sort()
      expect(names).toContain('readme.md')
      expect(names).toContain('src')
    })

    it('marks files correctly', async () => {
      const entries = await backend.list('')
      const file = entries.find(e => e.name === 'readme.md')
      expect(file?.type).toBe('file')
    })

    it('marks directories correctly', async () => {
      const entries = await backend.list('')
      const dir = entries.find(e => e.name === 'src')
      expect(dir?.type).toBe('directory')
    })

    it('lists sub-directory', async () => {
      const entries = await backend.list('src')
      const names = entries.map(e => e.name).sort()
      expect(names).toContain('index.ts')
      expect(names).toContain('utils.ts')
    })
  })

  // ── stat ─────────────────────────────────────────────────────────────────

  describe('stat', () => {
    it('returns FileStat for existing file', async () => {
      await backend.write('data.txt', 'hello')
      const stat = await backend.stat('data.txt')
      expect(stat.exists).toBe(true)
      expect(stat.type).toBe('file')
      expect(stat.size).toBe(5)
      expect(stat.modified).not.toBe('')
    })

    it('returns exists=false for missing path', async () => {
      const stat = await backend.stat('not-here.txt')
      expect(stat.exists).toBe(false)
      expect(stat.size).toBe(0)
      expect(stat.modified).toBe('')
    })

    it('returns type=directory for a directory', async () => {
      await backend.write('subdir/file.txt', 'x')
      const stat = await backend.stat('subdir')
      expect(stat.exists).toBe(true)
      expect(stat.type).toBe('directory')
    })
  })

  // ── glob ─────────────────────────────────────────────────────────────────

  describe('glob', () => {
    beforeEach(async () => {
      await backend.write('src/app.ts', '')
      await backend.write('src/utils.ts', '')
      await backend.write('src/index.js', '')
      await backend.write('README.md', '')
    })

    it('matches files by glob pattern', async () => {
      const results = await backend.glob('**/*.ts')
      expect(results).toContain('src/app.ts')
      expect(results).toContain('src/utils.ts')
      expect(results).not.toContain('src/index.js')
    })

    it('returns empty array for no matches', async () => {
      const results = await backend.glob('**/*.png')
      expect(results).toEqual([])
    })
  })
})
