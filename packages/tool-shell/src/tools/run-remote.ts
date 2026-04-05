import type { LoomTool } from '@loom-code/core'
import type { ShellOptions } from '../types'
import type { RemoteRunOpts } from '../runner'
import { runRemote } from '../runner'

/** Factory options forwarded from createShellPackage. */
export interface RunRemoteToolOpts {
  env?: Record<string, string>
  timeout?: number
}

interface RunRemoteInput {
  command: string
  timeout?: number
}

/** Format stdout/stderr/exit_code into a standard output string. */
function formatOutput(stdout: string, stderr: string, exitCode: number | null): string {
  return `stdout:\n${stdout}\nstderr:\n${stderr}\nexit_code: ${exitCode ?? 'null'}`
}

/**
 * Create the `run_remote_command` LoomTool.
 * If `remoteConfig` is undefined the tool still exists but always returns
 * "Error: remote not configured" — the caller (createShellPackage) should
 * only include this tool when remote opts are present.
 */
export function createRunRemoteTool(
  remoteConfig: ShellOptions['remote'] | undefined,
  factoryOpts: RunRemoteToolOpts,
): LoomTool {
  return {
    name: 'run_remote_command',

    description:
      'Execute a shell command on a remote host via SSH. ' +
      'Returns combined stdout, stderr, and exit code. ' +
      'The remote host must be configured when creating the shell package.',

    schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to run on the remote host.',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Overrides the factory default.',
        },
      },
      required: ['command'],
    },

    async execute(inputJson: string): Promise<string> {
      // Guard: tool created without remote config
      if (!remoteConfig) {
        return JSON.stringify({
          success: false,
          output: 'Error: remote not configured',
        })
      }

      let input: RunRemoteInput

      try {
        input = JSON.parse(inputJson) as RunRemoteInput
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

      const runOpts: RemoteRunOpts = {
        remote: remoteConfig,
        env: factoryOpts.env,
        timeout: input.timeout ?? factoryOpts.timeout ?? 30_000,
      }

      try {
        const result = await runRemote(input.command, runOpts)

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
