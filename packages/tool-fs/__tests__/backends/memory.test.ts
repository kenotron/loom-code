import { describe, it, expect, beforeEach } from 'bun:test'
import { InMemoryBackend } from '../../src/backends/memory'
import { FsError } from '../../src/types'

describe('InMemoryBackend', () => {
  let backend: InMemoryBackend

  beforeEach(() => {
    backend = new InMemoryBackend()
  })

  // ── read / write ──────────────────────────────────────────────────────────

  describe('read / write', () => {
    it('reads back a written file', async () => {
      await backend.write('hello.txt', 'hello world')
      expect(await backend.read('hello.txt')).toBe('hello world')
    })

    it('throws FsError ENOENT for missing file', async () => {
      await expect(backend.read('missing.txt')).rejects.toBeInstanceOf(FsError)
      try {
        await backend.read('missing.txt')
      } catch (e) {
        expect((e as FsError).code).toBe('ENOENT')
      }
    })

    it('supports nested paths', async () => {
      await backend.write('src/app.ts', 'const x = 1')
      expect(await backend.read('src/app.ts')).toBe('const x = 1')
    })

    it('overwrites existing content', async () => {
      await backend.write('a.txt', 'original')
      await backend.write('a.txt', 'updated')
      expect(await backend.read('a.txt')).toBe('updated')
    })
  })

  describe('read with range', () => {
    const content = 'line0\nline1\nline2\nline3\nline4'

    beforeEach(async () => {
      await backend.write('lines.txt', content)
    })

    it('returns all lines when no range', async () => {
      expect(await backend.read('lines.txt')).toBe(content)
    })

    it('slices by offset', async () => {
      const result = await backend.read('lines.txt', { offset: 2, limit: 10 })
      expect(result).toBe('line2\nline3\nline4')
    })

    it('slices by offset and limit', async () => {
      const result = await backend.read('lines.txt', { offset: 1, limit: 2 })
      expect(result).toBe('line1\nline2')
    })

    it('offset at 0 with limit returns first N lines', async () => {
      const result = await backend.read('lines.txt', { offset: 0, limit: 2 })
      expect(result).toBe('line0\nline1')
    })
  })

  // ── edit ─────────────────────────────────────────────────────────────────

  describe('edit', () => {
    it('replaces first occurrence by default', async () => {
      await backend.write('f.txt', 'aaa bbb aaa')
      const { replaced } = await backend.edit('f.txt', 'aaa', 'zzz')
      expect(replaced).toBe(1)
      expect(await backend.read('f.txt')).toBe('zzz bbb aaa')
    })

    it('replaces all occurrences when replaceAll=true', async () => {
      await backend.write('f.txt', 'aaa bbb aaa ccc aaa')
      const { replaced } = await backend.edit('f.txt', 'aaa', 'zzz', true)
      expect(replaced).toBe(3)
      expect(await backend.read('f.txt')).toBe('zzz bbb zzz ccc zzz')
    })

    it('throws FsError when old_string not found (0 occurrences)', async () => {
      await backend.write('f.txt', 'hello world')
      await expect(backend.edit('f.txt', 'MISSING', 'x')).rejects.toBeInstanceOf(FsError)
      try {
        await backend.edit('f.txt', 'MISSING', 'x')
      } catch (e) {
        expect((e as FsError).code).toBe('ENOTFOUND')
      }
    })

    it('throws ENOENT when file does not exist', async () => {
      await expect(backend.edit('nope.txt', 'a', 'b')).rejects.toBeInstanceOf(FsError)
    })
  })

  // ── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    beforeEach(async () => {
      await backend.write('readme.txt', 'hi')
      await backend.write('src/app.ts', 'app')
      await backend.write('src/utils.ts', 'utils')
      await backend.write('src/components/Button.tsx', 'btn')
    })

    it('lists top-level entries', async () => {
      const entries = await backend.list('')
      const names = entries.map(e => e.name).sort()
      expect(names).toContain('readme.txt')
      expect(names).toContain('src')
    })

    it('marks files with type=file', async () => {
      const entries = await backend.list('')
      const file = entries.find(e => e.name === 'readme.txt')
      expect(file?.type).toBe('file')
      expect(file?.size).toBe(2) // 'hi'.length
    })

    it('marks sub-dirs with type=directory', async () => {
      const entries = await backend.list('')
      const dir = entries.find(e => e.name === 'src')
      expect(dir?.type).toBe('directory')
    })

    it('lists contents of a sub-directory', async () => {
      const entries = await backend.list('src')
      const names = entries.map(e => e.name).sort()
      expect(names).toContain('app.ts')
      expect(names).toContain('utils.ts')
      expect(names).toContain('components')
    })

    it('does not include entries from sibling directories', async () => {
      const entries = await backend.list('src')
      expect(entries.every(e => e.name !== 'readme.txt')).toBe(true)
    })
  })

  // ── stat ─────────────────────────────────────────────────────────────────

  describe('stat', () => {
    it('returns FileStat for an existing file', async () => {
      await backend.write('data.json', '{"x":1}')
      const stat = await backend.stat('data.json')
      expect(stat.exists).toBe(true)
      expect(stat.type).toBe('file')
      expect(stat.size).toBe(7)
      expect(stat.modified).not.toBe('')
    })

    it('returns exists=false for nonexistent path', async () => {
      const stat = await backend.stat('missing.txt')
      expect(stat.exists).toBe(false)
      expect(stat.type).toBe('file')
      expect(stat.size).toBe(0)
      expect(stat.modified).toBe('')
    })

    it('returns type=directory for a synthesized directory', async () => {
      await backend.write('dir/file.txt', 'content')
      const stat = await backend.stat('dir')
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

    it('matches files by extension', async () => {
      const results = await backend.glob('**/*.ts')
      expect(results).toContain('src/app.ts')
      expect(results).toContain('src/utils.ts')
      expect(results).not.toContain('src/index.js')
      expect(results).not.toContain('README.md')
    })

    it('matches root files', async () => {
      const results = await backend.glob('*.md')
      expect(results).toContain('README.md')
    })

    it('returns empty array when no matches', async () => {
      const results = await backend.glob('**/*.png')
      expect(results).toEqual([])
    })
  })
})
