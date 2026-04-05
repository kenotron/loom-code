/**
 * load_skill — load a skill's full markdown content by exact name.
 */

import type { LoomTool } from '@loom-code/core'
import type { SkillsOptions } from '../types'
import { discoverSkills, loadSkill } from '../discovery'

/**
 * Creates the `load_skill` LoomTool.
 *
 * Input:  `{ name: string }` — exact skill name (case-sensitive)
 * Output: `{ success: true, output: <markdown body> }`
 *         `{ success: false, output: "Error: skill '<name>' not found" }` if not found
 */
export function createLoadSkillTool(options?: SkillsOptions): LoomTool {
  return {
    name: 'load_skill',
    description:
      "Load a skill's full instructions by exact name. " +
      'Returns the markdown body with YAML frontmatter stripped. ' +
      'Use list_skills first to discover available skill names.',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Exact name of the skill to load (use list_skills to find names).',
        },
      },
      required: ['name'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const input = JSON.parse(inputJson) as { name: string }
        const skills = await discoverSkills(options)
        const meta = skills.find(s => s.name === input.name)

        if (!meta) {
          return JSON.stringify({
            success: false,
            output: `Error: skill '${input.name}' not found`,
          })
        }

        const skill = await loadSkill(meta)
        return JSON.stringify({ success: true, output: skill.content })
      } catch (err) {
        return JSON.stringify({
          success: false,
          output: err instanceof Error ? err.message : String(err),
        })
      }
    },
  }
}
