import type { LoomTool } from '@loom-code/core'
import type { LocalRunOpts } from '../runner'
import { runLocal } from '../runner'

/** Factory options forwarded from createShellPackage. */
export interface RunCommandToolOpts {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
}

interface RunCommandInput {
  command: string
  cwd?: string
  timeout?: number
}

/** Format a CommandResult into the standard tool output string. */
function formatOutput(stdout: string, stderr: string, exitCode: number | null): string {
  return `stdout:\n${stdout}\nstderr:\n${stderr}\nexit_code: ${exitCode ?? 'null'}`
}

/**
 * Create the `run_command` LoomTool.
 * Factory opts set defaults; per-call input can override cwd and timeout.
 */
export function createRunCommandTool(factoryOpts: RunCommandToolOpts): LoomTool {
  return {
    name: 'run_command',

    description:
      'Execute a shell command locally. ' +
      'Returns combined stdout, stderr, and exit code. ' +
      'Use for file system operations, running scripts, or any local shell task.',

    schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (run via sh -c).',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command. Overrides the factory default.',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Overrides the factory default.',
        },
      },
      required: ['command'],
    },

    async execute(inputJson: string): Promise<string> {
      let input: RunCommandInput

      try {
        input = JSON.parse(inputJson) as RunCommandInput
      } catch {
        return JSON.stringify({
          success: false,
          output: 'Error: invalid JSON input',
        })
      }

      if (!input.command || typeof input.command !== 'string') {
        return JSON.stringify({
          success: false,
          output: 'Error: "command" is required and must be a string',
        })
      }

      const runOpts: LocalRunOpts = {
        cwd: input.cwd ?? factoryOpts.cwd,
        env: factoryOpts.env,
        timeout: input.timeout ?? factoryOpts.timeout ?? 30_000,
      }

      try {
        const result = await runLocal(input.command, runOpts)

        if (result.timedOut) {
          return JSON.stringify({
            success: false,
            output: `Error: command timed out after ${runOpts.timeout}ms`,
          })
        }

        return JSON.stringify({
          success: result.success,
          output: formatOutput(result.stdout, result.stderr, result.exitCode),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return JSON.stringify({ success: false, output: `Error: ${message}` })
      }
    },
  }
}
