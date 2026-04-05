import type { CommandResult, ShellOptions } from './types'

/** Options for runLocal — subset of ShellOptions (no remote). */
export interface LocalRunOpts {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
}

/** Options for runRemote. */
export interface RemoteRunOpts {
  remote: NonNullable<ShellOptions['remote']>
  env?: Record<string, string>
  timeout?: number
}

/** Merge process.env (filtering undefineds) with caller-supplied vars. */
function buildEnv(extra?: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) merged[k] = v
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      merged[k] = v
    }
  }
  return merged
}

/**
 * Run a shell command locally via `sh -c`.
 * Streams stdout/stderr to buffers, enforces timeout (kills process if exceeded).
 */
export async function runLocal(
  command: string,
  opts: LocalRunOpts,
): Promise<CommandResult> {
  const { cwd, env, timeout = 30_000 } = opts

  const proc = Bun.spawn(['sh', '-c', command], {
    cwd,
    env: buildEnv(env),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Collect output concurrently while the process runs
  const stdoutPromise = new Response(proc.stdout).text()
  const stderrPromise = new Response(proc.stderr).text()

  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<number>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve(-1)
    }, timeout)
  })

  const exitCode = await Promise.race([proc.exited, timeoutPromise])
  clearTimeout(timer)

  // After process exits (or is killed), the streams close and these resolve
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])

  if (timedOut) {
    return { success: false, stdout, stderr, exitCode: null, timedOut: true }
  }

  return {
    success: exitCode === 0,
    stdout,
    stderr,
    exitCode: exitCode as number,
    timedOut: false,
  }
}

/**
 * Run a command on a remote host via SSH.
 * Same output semantics as runLocal.
 */
export async function runRemote(
  command: string,
  opts: RemoteRunOpts,
): Promise<CommandResult> {
  const { remote, env, timeout = 30_000 } = opts
  const { host, user, keyPath, port = 22 } = remote

  const sshArgs = [
    'ssh',
    '-o',
    'StrictHostKeyChecking=no',
    '-p',
    String(port),
    ...(keyPath ? ['-i', keyPath] : []),
    `${user}@${host}`,
    command,
  ]

  const proc = Bun.spawn(sshArgs, {
    env: buildEnv(env),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdoutPromise = new Response(proc.stdout).text()
  const stderrPromise = new Response(proc.stderr).text()

  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<number>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve(-1)
    }, timeout)
  })

  const exitCode = await Promise.race([proc.exited, timeoutPromise])
  clearTimeout(timer)

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])

  if (timedOut) {
    return { success: false, stdout, stderr, exitCode: null, timedOut: true }
  }

  return {
    success: exitCode === 0,
    stdout,
    stderr,
    exitCode: exitCode as number,
    timedOut: false,
  }
}
