import { describe, it, expect, beforeEach } from 'bun:test'
import { FsVfs } from '../../src/vfs'
import { InMemoryBackend } from '../../src/backends/memory'
import { makeEditTool } from '../../src/tools/edit'

describe('edit_file tool', () => {
  let vfs: FsVfs
  let backend: InMemoryBackend

  beforeEach(async () => {
    vfs = new FsVfs()
    backend = new InMemoryBackend()
    vfs.mount('/scratch', backend)
    await backend.write('app.ts', 'const foo = 1\nconst foo2 = 2\nconst bar = foo')
  })

  it('has correct name', () => {
    expect(makeEditTool(vfs).name).toBe('edit_file')
  })

  it('replaces first occurrence by default', async () => {
    const t = makeEditTool(vfs)
    const result = JSON.parse(
      await t.execute(
        JSON.stringify({ path: '/scratch/app.ts', old_string: 'foo', new_string: 'baz' })
      )
    )
    expect(result.success).toBe(true)
    expect(result.output).toMatch(/Replaced 1 occurrence/)
    const content = await backend.read('app.ts')
    expect(content).toContain('const baz = 1')
    // second foo unchanged
    expect(content).toContain('const foo2 = 2')
  })

  it('replaces all occurrences when replace_all=true', async () => {
    const t = makeEditTool(vfs)
    const result = JSON.parse(
      await t.execute(
        JSON.stringify({
          path: '/scratch/app.ts',
          old_string: 'foo',
          new_string: 'baz',
          replace_all: true,
        })
      )
    )
    expect(result.success).toBe(true)
    expect(result.output).toMatch(/Replaced \d+ occurrence/)
    const content = await backend.read('app.ts')
    expect(content).not.toContain('foo')
  })

  it('returns success:false when old_string not found (0 occurrences)', async () => {
    const t = makeEditTool(vfs)
    const result = JSON.parse(
      await t.execute(
        JSON.stringify({ path: '/scratch/app.ts', old_string: 'MISSING', new_string: 'x' })
      )
    )
    expect(result.success).toBe(false)
    expect(result.output).toMatch(/Error/i)
  })

  it('returns success:false for unrouted path', async () => {
    const t = makeEditTool(vfs)
    const result = JSON.parse(
      await t.execute(
        JSON.stringify({ path: '/etc/hosts', old_string: 'x', new_string: 'y' })
      )
    )
    expect(result.success).toBe(false)
  })

  it('returns success:false for invalid JSON', async () => {
    const t = makeEditTool(vfs)
    const result = JSON.parse(await t.execute('oops'))
    expect(result.success).toBe(false)
  })
})
