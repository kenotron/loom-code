/**
 * @loom-code/tool-shell — Shell/bash execution LoomPackage.
 *
 * Usage:
 *   import { createShellPackage } from '@loom-code/tool-shell'
 *
 *   const pkg = createShellPackage({ timeout: 60_000 })
 *   const remoteShell = createShellPackage({
 *     remote: { host: 'prod.example.com', user: 'ubuntu' },
 *   })
 */
import type { LoomPackage } from '@loom-code/core'
import type { ShellOptions } from './types'
import { createRunCommandTool } from './tools/run-command'
import { createRunRemoteTool } from './tools/run-remote'
import { safetyHook } from './hooks/safety-hook'

export type { ShellOptions } from './types'
export type { CommandResult } from './types'
export { isDangerous, BLOCKED_PATTERNS } from './safety'
export { runLocal, runRemote } from './runner'
export { createRunCommandTool } from './tools/run-command'
export { createRunRemoteTool } from './tools/run-remote'
export { safetyHook } from './hooks/safety-hook'

/**
 * Create a shell LoomPackage.
 *
 * Always includes:
 *  - `run_command` tool
 *  - `tool:pre` safety hook (blocks rm -rf /, fork bomb, dd, mkfs)
 *
 * Includes `run_remote_command` only when `options.remote` is provided.
 */
export function createShellPackage(options?: ShellOptions): LoomPackage {
  const { cwd, env, timeout, remote } = options ?? {}

  const runCommandTool = createRunCommandTool({ cwd, env, timeout })

  const tools = [runCommandTool]

  if (remote) {
    tools.push(createRunRemoteTool(remote, { env, timeout }))
  }

  return {
    tools,
    hooks: [safetyHook],
  }
}
