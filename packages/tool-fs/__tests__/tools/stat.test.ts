import { describe, it, expect, beforeEach } from 'bun:test'
import { FsVfs } from '../../src/vfs'
import { InMemoryBackend } from '../../src/backends/memory'
import { makeStatTool } from '../../src/tools/stat'

describe('file_info tool', () => {
  let vfs: FsVfs
  let backend: InMemoryBackend

  beforeEach(async () => {
    vfs = new FsVfs()
    backend = new InMemoryBackend()
    vfs.mount('/scratch', backend)
    await backend.write('data.json', '{"x":1}')
    await backend.write('dir/sub.txt', 'hello')
  })

  it('has correct name', () => {
    expect(makeStatTool(vfs).name).toBe('file_info')
  })

  it('returns FileStat JSON for existing file', async () => {
    const t = makeStatTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/scratch/data.json' })))
    expect(result.success).toBe(true)
    const stat = JSON.parse(result.output)
    expect(stat.exists).toBe(true)
    expect(stat.type).toBe('file')
    expect(stat.size).toBe(7)
  })

  it('returns { exists: false, type: file, size: 0, modified: "" } for missing path', async () => {
    const t = makeStatTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/scratch/missing.txt' })))
    expect(result.success).toBe(true)
    const stat = JSON.parse(result.output)
    expect(stat.exists).toBe(false)
    expect(stat.type).toBe('file')
    expect(stat.size).toBe(0)
    expect(stat.modified).toBe('')
  })

  it('returns type=directory for a synthesized directory', async () => {
    const t = makeStatTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/scratch/dir' })))
    expect(result.success).toBe(true)
    const stat = JSON.parse(result.output)
    expect(stat.exists).toBe(true)
    expect(stat.type).toBe('directory')
  })

  it('returns success:false for unrouted path', async () => {
    const t = makeStatTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/etc/passwd' })))
    expect(result.success).toBe(false)
  })

  it('returns success:false for invalid JSON', async () => {
    const t = makeStatTool(vfs)
    const result = JSON.parse(await t.execute('oops'))
    expect(result.success).toBe(false)
  })
})
