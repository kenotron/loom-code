/** Configuration for the shell package factory. */
export interface ShellOptions {
  /** Working directory for command execution. Defaults to process.cwd(). */
  cwd?: string
  /** Environment variables merged with process.env. */
  env?: Record<string, string>
  /** Timeout in milliseconds. Defaults to 30000. */
  timeout?: number
  /** Optional remote SSH configuration. */
  remote?: {
    host: string
    user: string
    /** Path to SSH private key file. */
    keyPath?: string
    /** SSH port. Defaults to 22. */
    port?: number
  }
}

/** Result from running a command (local or remote). */
export interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut?: boolean
}
