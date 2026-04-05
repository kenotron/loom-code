import { describe, it, expect } from 'bun:test'
import { generateId } from '../src/id'

describe('generateId', () => {
  it('returns an 8-character string', () => {
    const id = generateId()
    expect(id).toHaveLength(8)
  })

  it('returns only alphanumeric characters (hex subset from UUID)', () => {
    const id = generateId()
    expect(id).toMatch(/^[a-f0-9]+$/)
  })

  it('returns unique values on each call', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateId()))
    expect(ids.size).toBe(20)
  })
})
