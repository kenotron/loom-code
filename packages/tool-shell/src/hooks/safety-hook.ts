import type { LoomHookHandler } from '@loom-code/core'
import { isDangerous } from '../safety'

/**
 * tool:pre hook that blocks dangerous shell commands before execution.
 *
 * Intercepts any tool whose input contains a "command" field and checks it
 * against the blocked patterns. Returns a Deny result with an explanation if
 * the command is dangerous.
 *
 * ## Kernel contract
 *
 * The amplifier-core Rust kernel calls registered handlers with two string
 * arguments: `(event: string, dataJson: string)`. The handler MUST return a
 * JSON-serialised string matching the `JsHookResult` shape, e.g.
 * `'{"action":"Continue"}'`. Returning a plain object causes a napi-rs type
 * conversion panic ("failed to convert js value Object … to Rust string").
 * Action values are PascalCase: `'Continue'` (allow) or `'Deny'` (block).
 */
export const safetyHook: LoomHookHandler = {
  event: 'tool:pre',
  name: 'shell-safety-guard',
  priority: 100,

  handler(_event: unknown, dataJson: unknown): string {
    // dataJson is passed as a string by the Rust kernel; guard defensively.
    let d: { tool_name?: string; input?: unknown } = {}
    if (typeof dataJson === 'string') {
      try {
        d = JSON.parse(dataJson) as typeof d
      } catch {
        // Malformed payload — fail open so non-shell tools are never blocked
        return JSON.stringify({ action: 'Continue' })
      }
    }

    // Only inspect shell tools
    if (
      d.tool_name !== 'run_command' &&
      d.tool_name !== 'run_remote_command'
    ) {
      return JSON.stringify({ action: 'Continue' })
    }

    // Extract command from input (input may be a string or parsed object)
    let command: string | undefined

    if (typeof d.input === 'string') {
      try {
        const parsed = JSON.parse(d.input) as Record<string, unknown>
        command = typeof parsed.command === 'string' ? parsed.command : undefined
      } catch {
        // Malformed input — let the tool handle it
      }
    } else if (d.input && typeof d.input === 'object') {
      const input = d.input as Record<string, unknown>
      command = typeof input.command === 'string' ? input.command : undefined
    }

    if (command !== undefined && isDangerous(command)) {
      return JSON.stringify({
        action: 'Deny',
        reason: `Command blocked by safety guard: "${command}" matches a dangerous pattern (e.g. rm -rf /, fork bomb, dd if=/dev/zero, mkfs).`,
      })
    }

    return JSON.stringify({ action: 'Continue' })
  },
}
