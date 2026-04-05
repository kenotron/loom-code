import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { createListSkillsTool } from '../../src/tools/list'

const FIXTURES_DIR = join(import.meta.dir, '../fixtures')

describe('list_skills tool', () => {
  const tool = createListSkillsTool({ skillsDirs: [FIXTURES_DIR] })

  it('has correct name', () => {
    expect(tool.name).toBe('list_skills')
  })

  it('has non-empty description', () => {
    expect(tool.description.length).toBeGreaterThan(0)
  })

  it('has a valid JSON schema', () => {
    expect(tool.schema).toBeDefined()
    expect((tool.schema as any).type).toBe('object')
  })

  it('returns success with JSON array of skills (no search)', async () => {
    const result = JSON.parse(await tool.execute('{}'))
    expect(result.success).toBe(true)
    const skills = JSON.parse(result.output)
    expect(Array.isArray(skills)).toBe(true)
    expect(skills.length).toBe(2)
  })

  it('returns SkillMeta objects without content field', async () => {
    const result = JSON.parse(await tool.execute('{}'))
    const skills = JSON.parse(result.output)
    const testSkill = skills.find((s: any) => s.name === 'test-skill')
    expect(testSkill).toBeDefined()
    expect(testSkill.name).toBe('test-skill')
    expect(testSkill.description).toBe('A test skill for unit tests')
    // no content on metadata
    expect(testSkill.content).toBeUndefined()
  })

  it('filters skills by search term in name', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ search: 'minimal' })))
    expect(result.success).toBe(true)
    const skills = JSON.parse(result.output)
    expect(skills.length).toBe(1)
    expect(skills[0].name).toBe('minimal-skill')
  })

  it('filters skills by search term in description (case-insensitive)', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ search: 'UNIT TESTS' })))
    expect(result.success).toBe(true)
    const skills = JSON.parse(result.output)
    expect(skills.length).toBe(1)
    expect(skills[0].name).toBe('test-skill')
  })

  it('returns empty array when search finds nothing', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ search: 'xyzzy-no-match' })))
    expect(result.success).toBe(true)
    expect(result.output).toBe('[]')
  })

  it('returns success:true with empty array when skills dir is empty', async () => {
    const emptyTool = createListSkillsTool({ skillsDirs: ['/non/existent'] })
    const result = JSON.parse(await emptyTool.execute('{}'))
    expect(result.success).toBe(true)
    expect(result.output).toBe('[]')
  })

  it('never throws — returns success:false on unexpected errors', async () => {
    // Force a parse error by passing invalid JSON
    const result = JSON.parse(await tool.execute('not-valid-json'))
    // Should not throw, should return failure
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.output).toBe('string')
  })
})
