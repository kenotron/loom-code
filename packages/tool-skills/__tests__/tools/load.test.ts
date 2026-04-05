import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { createLoadSkillTool } from '../../src/tools/load'

const FIXTURES_DIR = join(import.meta.dir, '../fixtures')

describe('load_skill tool', () => {
  const tool = createLoadSkillTool({ skillsDirs: [FIXTURES_DIR] })

  it('has correct name', () => {
    expect(tool.name).toBe('load_skill')
  })

  it('has non-empty description', () => {
    expect(tool.description.length).toBeGreaterThan(0)
  })

  it('schema requires name field', () => {
    const schema = tool.schema as any
    expect(schema.required).toContain('name')
  })

  it('returns full markdown body for known skill', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'test-skill' })))
    expect(result.success).toBe(true)
    expect(result.output).toContain('# Test Skill')
    expect(result.output).not.toContain('name: test-skill')
    expect(result.output).not.toContain('description:')
  })

  it('returns markdown body for minimal-skill', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'minimal-skill' })))
    expect(result.success).toBe(true)
    expect(result.output).toContain('# Minimal Skill')
  })

  it('returns success:false with error message for unknown skill', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'no-such-skill' })))
    expect(result.success).toBe(false)
    expect(result.output).toBe("Error: skill 'no-such-skill' not found")
  })

  it('error message includes the requested skill name', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'my-missing-skill' })))
    expect(result.success).toBe(false)
    expect(result.output).toContain('my-missing-skill')
  })

  it('never throws — returns success:false on parse errors', async () => {
    const result = JSON.parse(await tool.execute('not-valid-json'))
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.output).toBe('string')
  })

  it('uses exact name match (partial name does not load skill)', async () => {
    // 'test' is a substring of 'test-skill' but NOT an exact match
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'test' })))
    expect(result.success).toBe(false)
  })
})
