import { describe, it, expect, beforeEach } from 'bun:test'
import { FsVfs } from '../../src/vfs'
import { InMemoryBackend } from '../../src/backends/memory'
import { makeReadTool } from '../../src/tools/read'

describe('read_file tool', () => {
  let vfs: FsVfs
  let backend: InMemoryBackend

  beforeEach(async () => {
    vfs = new FsVfs()
    backend = new InMemoryBackend()
    vfs.mount('/scratch', backend)
    await backend.write('hello.txt', 'Hello, World!')
    await backend.write('lines.txt', 'line0\nline1\nline2\nline3\nline4')
  })

  const tool = () => makeReadTool(new Proxy({}, {}) as FsVfs)

  it('has correct name and schema', () => {
    const vfs2 = new FsVfs()
    const t = makeReadTool(vfs2)
    expect(t.name).toBe('read_file')
    expect(t.schema).toMatchObject({ type: 'object', required: ['path'] })
  })

  it('reads a file successfully', async () => {
    const t = makeReadTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/scratch/hello.txt' })))
    expect(result.success).toBe(true)
    expect(result.output).toBe('Hello, World!')
  })

  it('reads with offset and limit', async () => {
    const t = makeReadTool(vfs)
    const result = JSON.parse(
      await t.execute(JSON.stringify({ path: '/scratch/lines.txt', offset: 1, limit: 2 }))
    )
    expect(result.success).toBe(true)
    expect(result.output).toBe('line1\nline2')
  })

  it('returns success:false for missing file', async () => {
    const t = makeReadTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/scratch/missing.txt' })))
    expect(result.success).toBe(false)
    expect(result.output).toMatch(/Error/i)
  })

  it('returns success:false for unrouted path', async () => {
    const t = makeReadTool(vfs)
    const result = JSON.parse(await t.execute(JSON.stringify({ path: '/etc/passwd' })))
    expect(result.success).toBe(false)
    expect(result.output).toMatch(/Error/i)
  })

  it('returns success:false for invalid JSON input', async () => {
    const t = makeReadTool(vfs)
    const result = JSON.parse(await t.execute('not-json'))
    expect(result.success).toBe(false)
  })
})
