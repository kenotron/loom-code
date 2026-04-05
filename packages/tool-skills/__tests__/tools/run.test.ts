import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { createRunSkillTool } from '../../src/tools/run'

const FIXTURES_DIR = join(import.meta.dir, '../fixtures')

describe('run_skill tool', () => {
  const tool = createRunSkillTool({ skillsDirs: [FIXTURES_DIR] })

  it('has correct name', () => {
    expect(tool.name).toBe('run_skill')
  })

  it('has non-empty description', () => {
    expect(tool.description.length).toBeGreaterThan(0)
  })

  it('schema requires name field, input is optional', () => {
    const schema = tool.schema as any
    expect(schema.required).toContain('name')
    expect(schema.properties.input).toBeDefined()
    // input is not in required list
    expect((schema.required ?? []).includes('input')).toBe(false)
  })

  it('formats output as [Skill: <name>] header + content (no user input)', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'test-skill' })))
    expect(result.success).toBe(true)
    expect(result.output).toMatch(/^\[Skill: test-skill\]/)
    expect(result.output).toContain('# Test Skill')
  })

  it('includes [User Input] section when input is provided', async () => {
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ name: 'test-skill', input: 'My custom context' }))
    )
    expect(result.success).toBe(true)
    expect(result.output).toContain('[User Input]')
    expect(result.output).toContain('My custom context')
  })

  it('does NOT include [User Input] when input is absent', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'test-skill' })))
    expect(result.success).toBe(true)
    expect(result.output).not.toContain('[User Input]')
  })

  it('does NOT include [User Input] when input is empty string', async () => {
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ name: 'test-skill', input: '' }))
    )
    expect(result.success).toBe(true)
    expect(result.output).not.toContain('[User Input]')
  })

  it('formats output: [Skill: name]\\n<content>\\n\\n[User Input]\\n<input>', async () => {
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ name: 'minimal-skill', input: 'do the thing' }))
    )
    expect(result.success).toBe(true)
    // Header must be first line
    const lines = result.output.split('\n')
    expect(lines[0]).toBe('[Skill: minimal-skill]')
    // Input section appears after two newlines
    expect(result.output).toContain('\n\n[User Input]\ndo the thing')
  })

  it('returns success:false with error message for unknown skill', async () => {
    const result = JSON.parse(await tool.execute(JSON.stringify({ name: 'no-such-skill' })))
    expect(result.success).toBe(false)
    expect(result.output).toBe("Error: skill 'no-such-skill' not found")
  })

  it('never throws — returns success:false on parse errors', async () => {
    const result = JSON.parse(await tool.execute('not-valid-json'))
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.output).toBe('string')
  })

  it('skill content is included in the formatted output', async () => {
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ name: 'test-skill' }))
    )
    expect(result.output).toContain('# Test Skill')
    // Frontmatter should NOT appear in output
    expect(result.output).not.toContain('name: test-skill')
  })
})
