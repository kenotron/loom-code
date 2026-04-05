import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseSkillFile, extractBody } from '../src/parser'

const FIXTURES = join(import.meta.dir, 'fixtures')

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

describe('parseSkillFile', () => {
  it('parses valid skill with all frontmatter fields', () => {
    const filePath = join(FIXTURES, 'test-skill.md')
    const meta = parseSkillFile(filePath, fixture('test-skill.md'))
    expect(meta).not.toBeNull()
    expect(meta!.name).toBe('test-skill')
    expect(meta!.description).toBe('A test skill for unit tests')
    expect(meta!.version).toBe('1.0.0')
    expect(meta!.license).toBe('MIT')
    expect(meta!.userInvocable).toBe(true)
    expect(meta!.filePath).toBe(filePath)
  })

  it('parses minimal skill with only name and description', () => {
    const filePath = join(FIXTURES, 'minimal-skill.md')
    const meta = parseSkillFile(filePath, fixture('minimal-skill.md'))
    expect(meta).not.toBeNull()
    expect(meta!.name).toBe('minimal-skill')
    expect(meta!.description).toBe('A minimal skill with only required fields')
    expect(meta!.version).toBeUndefined()
    expect(meta!.license).toBeUndefined()
    expect(meta!.userInvocable).toBeUndefined()
    expect(meta!.filePath).toBe(filePath)
  })

  it('returns null for skill missing name field', () => {
    const meta = parseSkillFile(join(FIXTURES, 'invalid-skill.md'), fixture('invalid-skill.md'))
    expect(meta).toBeNull()
  })

  it('returns null for file with no frontmatter', () => {
    const meta = parseSkillFile(join(FIXTURES, 'no-frontmatter.md'), fixture('no-frontmatter.md'))
    expect(meta).toBeNull()
  })

  it('returns null for malformed YAML frontmatter', () => {
    const content = '---\nname: [unclosed bracket\ndescription: test\n---\n# content'
    const meta = parseSkillFile('/fake/path.md', content)
    expect(meta).toBeNull()
  })

  it('returns null when description is missing', () => {
    const content = '---\nname: my-skill\n---\n# content'
    const meta = parseSkillFile('/fake/path.md', content)
    expect(meta).toBeNull()
  })

  it('returns null when frontmatter has no closing delimiter', () => {
    const content = '---\nname: my-skill\ndescription: test\n# content'
    const meta = parseSkillFile('/fake/path.md', content)
    expect(meta).toBeNull()
  })
})

describe('extractBody', () => {
  it('returns markdown body after frontmatter — no frontmatter fields', () => {
    const body = extractBody(fixture('test-skill.md'))
    expect(body).toContain('# Test Skill')
    expect(body).not.toContain('name: test-skill')
    expect(body).not.toContain('description:')
  })

  it('returns full content unchanged when no frontmatter present', () => {
    const content = fixture('no-frontmatter.md')
    const body = extractBody(content)
    expect(body).toBe(content)
  })

  it('body starts with the markdown content, not the YAML block', () => {
    const body = extractBody(fixture('minimal-skill.md'))
    expect(body).toContain('# Minimal Skill')
    expect(body).not.toContain('name: minimal-skill')
  })
})
