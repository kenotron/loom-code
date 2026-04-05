import { describe, it, expect, beforeEach } from 'bun:test'
import { FsVfs } from '../../src/vfs'
import { InMemoryBackend } from '../../src/backends/memory'
import { makeGlobTool } from '../../src/tools/glob'

describe('glob tool', () => {
  let vfs: FsVfs
  let backend: InMemoryBackend
  let backend2: InMemoryBackend

  beforeEach(async () => {
    vfs = new FsVfs()
    backend = new InMemoryBackend()
    backend2 = new InMemoryBackend()
    vfs.mount('/scratch', backend)
    vfs.mount('/docs', backend2)

    await backend.write('src/app.ts', '')
    await backend.write('src/utils.ts', '')
    await backend.write('src/index.js', '')
    await backend.write('README.md', '')

    await backend2.write('guide.md', '')
    await backend2.write('api.md', '')
  })

  it('has correct name', () => {
    expect(makeGlobTool(vfs).name).toBe('glob')
  })

  it('globs with explicit base and returns absolute VFS paths', async () => {
    const t = makeGlobTool(vfs)
    const result = JSON.parse(
      await t.execute(JSON.stringify({ pattern: '**/*.ts', base: '/scratch' }))
    )
    expect(result.success).toBe(true)
    const paths = JSON.parse(result.output)
    expect(paths).toContain('/scratch/src/app.ts')
    expect(paths).toContain('/scratch/src/utils.ts')
    expect(paths).not.toContain('/scratch/src/index.js')
  })

  it('uses defaultMount when no base provided', async () => {
    const t = makeGlobTool(vfs)
    // defaultMount is the longest prefix; both /scratch and /docs are length 8
    // result should be from one of them — just verify the paths start with a VFS prefix
    const result = JSON.parse(await t.execute(JSON.stringify({ pattern: '**/*.md' })))
    expect(result.success).toBe(true)
    const paths = JSON.parse(result.output)
    expect(Array.isArray(paths)).toBe(true)
    // Each returned path must start with a mounted prefix
    for (const p of paths as string[]) {
      expect(p.startsWith('/scratch') || p.startsWith('/docs')).toBe(true)
    }
  })

  it('returns success:false for unrouted base', async () => {
    const t = makeGlobTool(vfs)
    const result = JSON.parse(
      await t.execute(JSON.stringify({ pattern: '**/*.ts', base: '/nowhere' }))
    )
    expect(result.success).toBe(false)
  })

  it('returns empty array when pattern matches nothing', async () => {
    const t = makeGlobTool(vfs)
    const result = JSON.parse(
      await t.execute(JSON.stringify({ pattern: '**/*.png', base: '/scratch' }))
    )
    expect(result.success).toBe(true)
    const paths = JSON.parse(result.output)
    expect(paths).toEqual([])
  })

  it('returns success:false when no mounts exist and no base', async () => {
    const emptyVfs = new FsVfs()
    const t = makeGlobTool(emptyVfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ pattern: '**/*.ts' })))
    expect(result.success).toBe(false)
  })

  it('returns success:false for invalid JSON', async () => {
    const t = makeGlobTool(vfs)
    const result = JSON.parse(await t.execute('bad'))
    expect(result.success).toBe(false)
  })
})
