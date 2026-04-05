/**
 * run_skill — format a skill as executable instructions for the LLM.
 *
 * Note: run_skill does NOT execute code. It returns the skill content formatted
 * as instructions so the LLM naturally follows them as its next action.
 * This is the agentskills.io model: skill content IS the program.
 */

import type { LoomTool } from '@loom-code/core'
import type { SkillsOptions } from '../types'
import { discoverSkills, loadSkill } from '../discovery'

/**
 * Creates the `run_skill` LoomTool.
 *
 * Input:  `{ name: string, input?: string }`
 * Output: `{ success: true, output: "[Skill: <name>]\n<content>\n\n[User Input]\n<input>" }`
 *
 * The formatted output is designed to be acted on by the LLM immediately upon
 * receipt — the skill's markdown instructions guide the model's next response.
 */
export function createRunSkillTool(options?: SkillsOptions): LoomTool {
  return {
    name: 'run_skill',
    description:
      'Run a skill by name. Returns the skill instructions formatted for immediate LLM execution. ' +
      'The LLM will naturally follow the skill instructions after receiving this tool result. ' +
      'Optionally pass input context the skill should act on.',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Exact name of the skill to run (use list_skills to find names).',
        },
        input: {
          type: 'string',
          description: 'Optional context or parameters for the skill to act on.',
        },
      },
      required: ['name'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const parsed = JSON.parse(inputJson) as { name: string; input?: string }
        const skills = await discoverSkills(options)
        const meta = skills.find(s => s.name === parsed.name)

        if (!meta) {
          return JSON.stringify({
            success: false,
            output: `Error: skill '${parsed.name}' not found`,
          })
        }

        const skill = await loadSkill(meta)

        let formatted = `[Skill: ${parsed.name}]\n${skill.content}`
        if (parsed.input) {
          formatted += `\n\n[User Input]\n${parsed.input}`
        }

        return JSON.stringify({ success: true, output: formatted })
      } catch (err) {
        return JSON.stringify({
          success: false,
          output: err instanceof Error ? err.message : String(err),
        })
      }
    },
  }
}
