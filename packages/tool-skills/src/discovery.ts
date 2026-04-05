/**
 * Skill discovery: scan directories for .md skill files and load skill content.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { SkillMeta, Skill, SkillsOptions } from './types'
import { parseSkillFile, extractBody } from './parser'

/** Default skill directories (tilde expanded at runtime). */
const DEFAULT_SKILL_DIRS = ['.loom/skills', '~/.loom/skills']

/** Expand a leading `~/` to the OS home directory. */
function expandTilde(p: string): string {
  if (p.startsWith('~/')) {
    return join(homedir(), p.slice(2))
  }
  return p
}

/**
 * Scan a single directory for valid skill `.md` files.
 *
 * Files without valid frontmatter (missing name or description) are silently skipped.
 * Non-existent or unreadable directories return an empty array.
 */
export async function scanDir(dir: string): Promise<SkillMeta[]> {
  const expanded = expandTilde(dir)

  let entries: string[]
  try {
    entries = await readdir(expanded)
  } catch {
    // Directory doesn't exist or isn't readable — silently skip
    return []
  }

  const mdFiles = entries.filter(f => f.endsWith('.md'))
  const skills: SkillMeta[] = []

  for (const fname of mdFiles) {
    const filePath = join(expanded, fname)
    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      continue
    }
    const meta = parseSkillFile(filePath, content)
    if (meta) skills.push(meta)
  }

  return skills
}

/**
 * Load a skill's full content given its metadata.
 *
 * Reads the file and strips YAML frontmatter, returning the markdown body.
 */
export async function loadSkill(meta: SkillMeta): Promise<Skill> {
  const raw = await readFile(meta.filePath, 'utf-8')
  return {
    ...meta,
    content: extractBody(raw),
  }
}

/**
 * Discover all valid skills across all configured directories.
 *
 * @param options  - SkillsOptions with optional skillsDirs (defaults applied if undefined)
 * @param search   - Optional case-insensitive substring filter on name or description
 */
export async function discoverSkills(
  options?: SkillsOptions,
  search?: string
): Promise<SkillMeta[]> {
  const dirs = options?.skillsDirs ?? DEFAULT_SKILL_DIRS
  const allSkills: SkillMeta[] = []

  for (const dir of dirs) {
    const dirSkills = await scanDir(dir)
    allSkills.push(...dirSkills)
  }

  if (!search) return allSkills

  const lower = search.toLowerCase()
  return allSkills.filter(
    s =>
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower)
  )
}
