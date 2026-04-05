/**
 * Core type interfaces for @loom-code/tool-skills.
 * Implements the agentskills.io skill format specification.
 */

/** Skill metadata extracted from YAML frontmatter (no content). */
export interface SkillMeta {
  name: string
  description: string
  version?: string
  license?: string
  userInvocable?: boolean
  filePath: string
}

/** Full skill: metadata plus the markdown body (frontmatter stripped). */
export interface Skill extends SkillMeta {
  content: string
}

/** Options for createSkillsPackage factory. */
export interface SkillsOptions {
  /** Directories to scan for skill .md files. Supports ~ expansion.
   *  Defaults to ['.loom/skills', '~/.loom/skills'] */
  skillsDirs?: string[]
}
