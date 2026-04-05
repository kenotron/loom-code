import { describe, it, expect, beforeEach } from 'bun:test'
import { FsVfs } from '../../src/vfs'
import { InMemoryBackend } from '../../src/backends/memory'
import { makeWriteTool } from '../../src/tools/write'

describe('write_file tool', () => {
  let vfs: FsVfs
  let backend: InMemoryBackend

  beforeEach(() => {
    vfs = new FsVfs()
    backend = new InMemoryBackend()
    vfs.mount('/scratch', backend)
  })

  it('has correct name', () => {
    expect(makeWriteTool(vfs).name).toBe('write_file')
  })

  it('writes a file and returns byte count', async () => {
    const t = makeWriteTool(vfs)
    const content = 'Hello, World!'
    const result = JSON.parse(
      await t.execute(JSON.stringify({ path: '/scratch/test.txt', content }))
    )
    expect(result.success).toBe(true)
    expect(result.output).toMatch(/Written \d+ bytes to \/scratch\/test\.txt/)
    expect(await backend.read('test.txt')).toBe(content)
  })

  it('reports correct byte count', async () => {
    const t = makeWriteTool(vfs)
    const content = 'abc'
    const result = JSON.parse(
      await t.execute(JSON.stringify({ path: '/scratch/a.txt', content }))
    )
    // 'abc' is 3 bytes in UTF-8
    expect(result.output).toContain('3 bytes')
  })

  it('returns success:false for unrouted path', async () => {
    const t = makeWriteTool(vfs)
    const result = JSON.parse(
      await t.execute(JSON.stringify({ path: '/nope/file.txt', content: 'x' }))
    )
    expect(result.success).toBe(false)
  })

  it('returns success:false for invalid JSON', async () => {
    const t = makeWriteTool(vfs)
    const result = JSON.parse(await t.execute('bad'))
    expect(result.success).toBe(false)
  })
})
