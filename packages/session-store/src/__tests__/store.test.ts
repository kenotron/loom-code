import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { JsonlStore } from '../store'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let tmpDir: string
let store: JsonlStore

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'loom-store-test-'))
  store = new JsonlStore(join(tmpDir, 'test.jsonl'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('JsonlStore', () => {
  it('returns empty array when file does not exist', async () => {
    const entries = await store.readAll()
    expect(entries).toEqual([])
  })

  it('appends a single entry and reads it back', async () => {
    await store.append({ id: '1', value: 'hello' })
    const entries = await store.readAll<{ id: string; value: string }>()
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('1')
    expect(entries[0].value).toBe('hello')
  })

  it('appends multiple entries and reads them back in order', async () => {
    await store.append({ id: '1' })
    await store.append({ id: '2' })
    await store.append({ id: '3' })
    const entries = await store.readAll<{ id: string }>()
    expect(entries).toHaveLength(3)
    expect(entries[0].id).toBe('1')
    expect(entries[1].id).toBe('2')
    expect(entries[2].id).toBe('3')
  })

  it('serializes complex objects correctly', async () => {
    const entry = {
      id: 'cp_001',
      type: 'delta',
      newMessageIds: ['m_001', 'm_002'],
      intent: 'test intent',
    }
    await store.append(entry)
    const entries = await store.readAll<typeof entry>()
    expect(entries[0]).toEqual(entry)
  })

  it('each entry occupies exactly one line (JSONL format)', async () => {
    await store.append({ a: 1 })
    await store.append({ b: 2 })
    // Read raw file to verify JSONL format
    const { readFileSync } = await import('fs')
    const raw = readFileSync(join(tmpDir, 'test.jsonl'), 'utf8')
    const lines = raw.split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({ a: 1 })
    expect(JSON.parse(lines[1])).toEqual({ b: 2 })
  })

  it('handles concurrent appends without interleaving', async () => {
    // Dispatch 5 concurrent appends
    await Promise.all([
      store.append({ id: 'a' }),
      store.append({ id: 'b' }),
      store.append({ id: 'c' }),
      store.append({ id: 'd' }),
      store.append({ id: 'e' }),
    ])
    const entries = await store.readAll<{ id: string }>()
    expect(entries).toHaveLength(5)
    // Every entry should be valid (no interleaved/corrupted JSON)
    const ids = new Set(entries.map(e => e.id))
    expect(ids.size).toBe(5)
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(true)
    expect(ids.has('c')).toBe(true)
  })

  it('appends to an existing file without overwriting', async () => {
    await store.append({ id: '1' })
    // Create a new store pointing to the same file
    const store2 = new JsonlStore(join(tmpDir, 'test.jsonl'))
    await store2.append({ id: '2' })
    const entries = await store.readAll<{ id: string }>()
    expect(entries).toHaveLength(2)
  })
})
