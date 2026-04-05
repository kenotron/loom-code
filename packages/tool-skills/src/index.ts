/**
 * @loom-code/tool-skills
 *
 * Skills runner LoomPackage implementing the agentskills.io specification.
 *
 * Usage:
 *   import { createSkillsPackage } from '@loom-code/tool-skills'
 *
 *   const pkg = createSkillsPackage({ skillsDirs: ['.loom/skills'] })
 *   // pkg.tools → [list_skills, load_skill, run_skill]
 *   // pkg.context → system prompt injection telling LLM about skills
 */

import type { LoomPackage } from '@loom-code/core'
import type { SkillsOptions } from './types'
import { createListSkillsTool } from './tools/list'
import { createLoadSkillTool } from './tools/load'
import { createRunSkillTool } from './tools/run'

export type { SkillMeta, Skill, SkillsOptions } from './types'
export { parseSkillFile, extractBody } from './parser'
export { scanDir, loadSkill, discoverSkills } from './discovery'

/** Default skill directories (tilde expansion handled in discovery.ts). */
const DEFAULT_SKILL_DIRS = ['.loom/skills', '~/.loom/skills']

/**
 * System prompt context injected so the LLM knows how to invoke skills.
 * Matches the agentskills.io recommended phrasing.
 */
const CONTEXT_TEXT =
  'You have access to skills via the list_skills and load_skill tools. ' +
  "Use load_skill to read a skill's full instructions before following them."

/**
 * Create a LoomPackage containing the three skills runner tools.
 *
 * @param options  Optional configuration. If `skillsDirs` is omitted,
 *                 defaults to ['.loom/skills', '~/.loom/skills'].
 *
 * @returns A LoomPackage with tools [list_skills, load_skill, run_skill]
 *          and context text for system prompt injection.
 */
export function createSkillsPackage(options?: SkillsOptions): LoomPackage {
  const opts: SkillsOptions = {
    skillsDirs: options?.skillsDirs ?? DEFAULT_SKILL_DIRS,
  }

  return {
    tools: [
      createListSkillsTool(opts),
      createLoadSkillTool(opts),
      createRunSkillTool(opts),
    ],
    context: { text: CONTEXT_TEXT },
  }
}
