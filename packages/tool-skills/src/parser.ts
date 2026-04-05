/**
 * YAML frontmatter parser for agentskills.io skill files.
 *
 * Skill format:
 *   ---
 *   name: skill-name
 *   description: What this skill does
 *   version: 1.0.0       # optional
 *   license: MIT          # optional
 *   user_invocable: true  # optional
 *   ---
 *   # Markdown body...
 */

import yaml from 'js-yaml'
import type { SkillMeta } from './types'

/**
 * Matches YAML frontmatter blocks.
 *
 * Groups:
 *   [1] — raw YAML string between the two `---` delimiters
 *   [2] — markdown body after closing `---`
 */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/

interface FrontmatterData {
  name?: unknown
  description?: unknown
  version?: unknown
  license?: unknown
  user_invocable?: unknown
}

/**
 * Parse a skill markdown file.
 *
 * Returns `SkillMeta` if the file has valid frontmatter with `name` + `description`.
 * Returns `null` (and silently skips) if frontmatter is absent, malformed, or incomplete.
 */
export function parseSkillFile(filePath: string, content: string): SkillMeta | null {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null

  const [, frontmatterStr] = match

  let data: FrontmatterData
  try {
    data = yaml.load(frontmatterStr) as FrontmatterData
  } catch (err) {
    console.warn(`[tool-skills] Failed to parse YAML frontmatter in ${filePath}:`, err)
    return null
  }

  if (!data || typeof data.name !== 'string' || typeof data.description !== 'string') {
    return null
  }

  return {
    name: data.name,
    description: data.description,
    version: typeof data.version === 'string' ? data.version : undefined,
    license: typeof data.license === 'string' ? data.license : undefined,
    userInvocable: typeof data.user_invocable === 'boolean' ? data.user_invocable : undefined,
    filePath,
  }
}

/**
 * Extract the markdown body from a skill file, stripping the YAML frontmatter block.
 * If no frontmatter is found, returns the content unchanged.
 */
export function extractBody(content: string): string {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return content
  return match[2]
}
