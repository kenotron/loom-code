import { describe, it, expect, beforeEach } from 'bun:test'
import { FsVfs } from '../../src/vfs'
import { InMemoryBackend } from '../../src/backends/memory'
import { makeListTool } from '../../src/tools/list'

describe('list_directory tool', () => {
  let vfs: FsVfs
  let backend: InMemoryBackend

  beforeEach(async () => {
    vfs = new FsVfs()
    backend = new InMemoryBackend()
    vfs.mount('/scratch', backend)
    await backend.write('readme.txt', 'hi')
    await backend.write('src/app.ts', 'app')
    await backend.write('src/utils.ts', 'utils')
  })

  it('has correct name', () => {
    expect(makeListTool(vfs).name).toBe('list_directory')
  })

  it('lists a directory and returns JSON DirEntry array', async () => {
    const t = makeListTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/scratch' })))
    expect(result.success).toBe(true)
    const entries = JSON.parse(result.output)
    expect(Array.isArray(entries)).toBe(true)
    const names = entries.map((e: { name: string }) => e.name).sort()
    expect(names).toContain('readme.txt')
    expect(names).toContain('src')
  })

  it('lists a sub-directory', async () => {
    const t = makeListTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/scratch/src' })))
    expect(result.success).toBe(true)
    const entries = JSON.parse(result.output)
    const names = entries.map((e: { name: string }) => e.name).sort()
    expect(names).toContain('app.ts')
    expect(names).toContain('utils.ts')
  })

  it('returns success:false for unrouted path', async () => {
    const t = makeListTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/nowhere' })))
    expect(result.success).toBe(false)
  })

  it('returns success:false for invalid JSON', async () => {
    const t = makeListTool(vfs)
    const result = JSON.parse(await t.execute('bad input'))
    expect(result.success).toBe(false)
  })
})
