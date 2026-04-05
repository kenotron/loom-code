/**
 * list_skills — enumerate available skills with optional search filter.
 */

import type { LoomTool } from '@loom-code/core'
import type { SkillsOptions } from '../types'
import { discoverSkills } from '../discovery'

/**
 * Creates the `list_skills` LoomTool.
 *
 * Input:  `{ search?: string }` — optional case-insensitive filter on name/description
 * Output: `{ success: true, output: JSON.stringify(SkillMeta[]) }`
 */
export function createListSkillsTool(options?: SkillsOptions): LoomTool {
  return {
    name: 'list_skills',
    description:
      'List available skills. Returns skill metadata (name, description, version, license). ' +
      'Optionally filter by a case-insensitive substring match on name or description.',
    schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description:
            'Optional filter: case-insensitive substring match on skill name or description.',
        },
      },
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const input = JSON.parse(inputJson) as { search?: string }
        const skills = await discoverSkills(options, input.search)
        return JSON.stringify({ success: true, output: JSON.stringify(skills) })
      } catch (err) {
        return JSON.stringify({
          success: false,
          output: err instanceof Error ? err.message : String(err),
        })
      }
    },
  }
}
