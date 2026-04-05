/**
 * Safety patterns for the shell execution tool.
 *
 * These patterns block commands that could cause irreversible system damage.
 * Each entry is a RegExp that, if matched, causes the command to be denied.
 */

export const BLOCKED_PATTERNS: RegExp[] = [
  // rm -rf / — removes the entire filesystem root
  // Allows rm -rf /some/path but blocks rm -rf / (trailing slash only, no subpath)
  /rm\s+(-\S*r\S*f\S*|-\S*f\S*r\S*)\s+\/\s*$/,

  // Fork bomb: :(){ :|:& };:
  /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/,

  // dd writing /dev/zero to a block device (data destruction)
  /dd\s+if=\/dev\/zero/,

  // mkfs — formats a filesystem (irreversible data loss)
  /\bmkfs\b/,
]

/**
 * Returns true if the command matches any blocked dangerous pattern.
 */
export function isDangerous(command: string): boolean {
  const trimmed = command.trim()
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(trimmed))
}
