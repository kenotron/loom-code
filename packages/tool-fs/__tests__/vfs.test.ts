import { describe, it, expect, beforeEach } from 'bun:test'
import { FsVfs } from '../src/vfs'
import { FsError } from '../src/types'
import type { FsBackend, FileStat, DirEntry } from '../src/types'

/** Minimal stub backend for routing tests */
function makeStub(id: string): FsBackend {
  return {
    read: async () => id,
    write: async () => {},
    edit: async () => ({ replaced: 0 }),
    list: async () => [],
    stat: async () => ({ exists: false, type: 'file', size: 0, modified: '' } as FileStat),
    glob: async () => [],
  }
}

describe('FsVfs', () => {
  let vfs: FsVfs

  beforeEach(() => {
    vfs = new FsVfs()
  })

  describe('mount / resolve — basic routing', () => {
    it('resolves a file under a mounted prefix', () => {
      const backend = makeStub('ws')
      vfs.mount('/workspace', backend)
      const result = vfs.resolve('/workspace/src/app.ts')
      expect(result.backend).toBe(backend)
      expect(result.relativePath).toBe('src/app.ts')
      expect(result.mountPoint).toBe('/workspace')
    })

    it('resolves a path equal to the mount point (dir itself)', () => {
      const backend = makeStub('ws')
      vfs.mount('/workspace', backend)
      const result = vfs.resolve('/workspace')
      expect(result.backend).toBe(backend)
      expect(result.relativePath).toBe('')
    })

    it('routes to the longest-prefix mount', () => {
      const short = makeStub('short')
      const long = makeStub('long')
      vfs.mount('/ws', short)
      vfs.mount('/ws/deep', long)
      const result = vfs.resolve('/ws/deep/file.txt')
      expect(result.backend).toBe(long)
      expect(result.relativePath).toBe('file.txt')
    })

    it('falls back to shorter prefix when longer does not match', () => {
      const short = makeStub('short')
      const long = makeStub('long')
      vfs.mount('/ws', short)
      vfs.mount('/ws/deep', long)
      const result = vfs.resolve('/ws/other/file.txt')
      expect(result.backend).toBe(short)
      expect(result.relativePath).toBe('other/file.txt')
    })

    it('throws FsError ENOMOUNT for unrouted paths', () => {
      vfs.mount('/workspace', makeStub('ws'))
      expect(() => vfs.resolve('/etc/passwd')).toThrow(FsError)
      try {
        vfs.resolve('/etc/passwd')
      } catch (e) {
        expect(e).toBeInstanceOf(FsError)
        expect((e as FsError).code).toBe('ENOMOUNT')
        expect((e as FsError).path).toBe('/etc/passwd')
      }
    })

    it('supports a root / catch-all mount', () => {
      const root = makeStub('root')
      vfs.mount('/', root)
      const result = vfs.resolve('/any/path/here.txt')
      expect(result.backend).toBe(root)
      expect(result.relativePath).toBe('any/path/here.txt')
    })

    it('prefers specific mount over root catch-all', () => {
      const root = makeStub('root')
      const specific = makeStub('specific')
      vfs.mount('/', root)
      vfs.mount('/workspace', specific)
      const result = vfs.resolve('/workspace/file.ts')
      expect(result.backend).toBe(specific)
    })
  })

  describe('unmount', () => {
    it('removes a mount so paths are no longer routed', () => {
      vfs.mount('/tmp', makeStub('tmp'))
      vfs.unmount('/tmp')
      expect(() => vfs.resolve('/tmp/file.txt')).toThrow(FsError)
    })

    it('does not affect other mounts when one is removed', () => {
      const a = makeStub('a')
      const b = makeStub('b')
      vfs.mount('/a', a)
      vfs.mount('/b', b)
      vfs.unmount('/a')
      const result = vfs.resolve('/b/file.txt')
      expect(result.backend).toBe(b)
    })
  })

  describe('defaultMount', () => {
    it('returns null when no mounts', () => {
      expect(vfs.defaultMount()).toBeNull()
    })

    it('returns the longest-prefix mount', () => {
      const short = makeStub('short')
      const long = makeStub('long')
      vfs.mount('/ws', short)
      vfs.mount('/ws/deep', long)
      const dm = vfs.defaultMount()
      expect(dm).not.toBeNull()
      expect(dm!.mountPoint).toBe('/ws/deep')
      expect(dm!.backend).toBe(long)
    })
  })
})
