import type { LoomHookHandler } from '@loom-code/core'
import { isDangerous } from '../safety'

/**
 * tool:pre hook that blocks dangerous shell commands before execution.
 *
 * Intercepts any tool whose input contains a "command" field and checks it
 * against the blocked patterns. Returns a Deny result with an explanation if
 * the command is dangerous.
 */
export const safetyHook: LoomHookHandler = {
  event: 'tool:pre',
  name: 'shell-safety-guard',
  priority: 100,

  handler(data: unknown): { action: 'allow' | 'deny'; reason?: string } {
    const d = data as { toolName?: string; input?: unknown }

    // Only inspect shell tools
    if (
      d.toolName !== 'run_command' &&
      d.toolName !== 'run_remote_command'
    ) {
      return { action: 'allow' }
    }

    // Extract command from input (input may be a string or object)
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
      return {
        action: 'deny',
        reason: `Command blocked by safety guard: "${command}" matches a dangerous pattern (e.g. rm -rf /, fork bomb, dd if=/dev/zero, mkfs).`,
      }
    }

    return { action: 'allow' }
  },
}
