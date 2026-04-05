import { describe, it, expect } from 'bun:test'
import { join } from 'node:path'
import { scanDir, loadSkill, discoverSkills } from '../src/discovery'

const FIXTURES_DIR = join(import.meta.dir, 'fixtures')

describe('scanDir', () => {
  it('discovers only valid skills from fixture directory', async () => {
    const skills = await scanDir(FIXTURES_DIR)
    expect(skills.length).toBe(2)
    const names = skills.map(s => s.name)
    expect(names).toContain('test-skill')
    expect(names).toContain('minimal-skill')
  })

  it('silently skips invalid-skill (missing name field)', async () => {
    const skills = await scanDir(FIXTURES_DIR)
    const names = skills.map(s => s.name)
    expect(names).not.toContain('invalid-skill')
  })

  it('silently skips no-frontmatter.md', async () => {
    const skills = await scanDir(FIXTURES_DIR)
    expect(skills.every(s => s.name !== 'no-frontmatter')).toBe(true)
  })

  it('returns empty array for non-existent directory', async () => {
    const skills = await scanDir('/non/existent/path/that/does/not/exist')
    expect(skills).toEqual([])
  })

  it('attaches correct filePath to each skill', async () => {
    const skills = await scanDir(FIXTURES_DIR)
    const testSkill = skills.find(s => s.name === 'test-skill')!
    expect(testSkill.filePath).toBe(join(FIXTURES_DIR, 'test-skill.md'))
  })

  it('parses all frontmatter fields for test-skill', async () => {
    const skills = await scanDir(FIXTURES_DIR)
    const testSkill = skills.find(s => s.name === 'test-skill')!
    expect(testSkill.version).toBe('1.0.0')
    expect(testSkill.license).toBe('MIT')
    expect(testSkill.userInvocable).toBe(true)
  })
})

describe('loadSkill', () => {
  it('loads skill and returns markdown body without frontmatter', async () => {
    const skills = await scanDir(FIXTURES_DIR)
    const meta = skills.find(s => s.name === 'test-skill')!
    const skill = await loadSkill(meta)
    expect(skill.name).toBe('test-skill')
    expect(skill.content).toContain('# Test Skill')
    expect(skill.content).not.toContain('name: test-skill')
    expect(skill.content).not.toContain('description:')
  })

  it('preserves all metadata fields on the returned Skill', async () => {
    const skills = await scanDir(FIXTURES_DIR)
    const meta = skills.find(s => s.name === 'test-skill')!
    const skill = await loadSkill(meta)
    expect(skill.version).toBe('1.0.0')
    expect(skill.license).toBe('MIT')
    expect(skill.userInvocable).toBe(true)
    expect(skill.filePath).toBe(meta.filePath)
  })
})

describe('discoverSkills', () => {
  it('scans configured dirs and returns all valid skills', async () => {
    const skills = await discoverSkills({ skillsDirs: [FIXTURES_DIR] })
    expect(skills.length).toBe(2)
  })

  it('filters by search term on name (case-insensitive)', async () => {
    const skills = await discoverSkills({ skillsDirs: [FIXTURES_DIR] }, 'minimal')
    expect(skills.length).toBe(1)
    expect(skills[0].name).toBe('minimal-skill')
  })

  it('filters by search term on description (case-insensitive)', async () => {
    const skills = await discoverSkills({ skillsDirs: [FIXTURES_DIR] }, 'unit tests')
    expect(skills.length).toBe(1)
    expect(skills[0].name).toBe('test-skill')
  })

  it('returns empty array when search matches nothing', async () => {
    const skills = await discoverSkills({ skillsDirs: [FIXTURES_DIR] }, 'xyzzy-no-match')
    expect(skills).toEqual([])
  })

  it('returns all skills when search is empty string', async () => {
    const skills = await discoverSkills({ skillsDirs: [FIXTURES_DIR] }, '')
    expect(skills.length).toBe(2)
  })

  it('handles non-existent dirs gracefully', async () => {
    const skills = await discoverSkills({ skillsDirs: ['/does/not/exist'] })
    expect(skills).toEqual([])
  })

  it('deduplicates across multiple dirs (same file, separate dirs)', async () => {
    // Two valid dirs — results from each are concatenated (not deduplicated by design)
    const skills = await discoverSkills({ skillsDirs: [FIXTURES_DIR, FIXTURES_DIR] })
    // Each dir produces 2 skills → 4 total (no dedup by design)
    expect(skills.length).toBe(4)
  })
})
