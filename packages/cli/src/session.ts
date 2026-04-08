import { LoomSession } from '@loom-code/core'
import { createAnthropicProvider } from '@loom-code/provider-anthropic'
import { createFsPackage, createFsVfs, createLocalBackend, createInMemoryBackend } from '@loom-code/tool-fs'
import { createShellPackage } from '@loom-code/tool-shell'
import { createTasksPackage } from '@loom-code/tool-tasks'
import { createSkillsPackage } from '@loom-code/tool-skills'
import * as os from 'os'
import * as path from 'path'

/**
 * Build the system prompt for a session.
 *
 * Tells Claude:
 *  - Its role as a terminal coding assistant
 *  - The VFS layout (/workspace = cwd, /scratch = in-memory)
 *  - The shell cwd and platform
 *  - Tool capabilities (so it reaches for them correctly)
 *  - Behavioral guidelines (concise, action-oriented)
 */
function buildSystemPrompt(cwd: string): string {
  const platform = os.platform()
  const home = os.homedir()
  // Show ~ for home-relative paths to keep the prompt readable
  const displayCwd = cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd
  const projectName = path.basename(cwd)

  return `You are loom-code, an AI coding assistant running in the terminal.

ENVIRONMENT
  Project : ${projectName}
  CWD     : ${displayCwd}
  Platform: ${platform}

FILESYSTEM
  ${cwd}/     real project path  (use this — matches paths in errors, git, shell output)
  /workspace/ alias for the same directory
  /scratch/   in-memory scratch space for temporary files

  Tools:
    read_file(path, offset?, limit?)   – read a file; slice with offset/limit
    write_file(path, content)          – create or overwrite (parents auto-created)
    edit_file(path, old_string, new_string, replace_all?) – exact-string patch
    list_directory(path)               – list directory entries
    file_info(path)                    – check existence, type, size
    glob(pattern, base?)               – find files matching a glob

  Use real absolute paths (e.g. ${cwd}/src/foo.ts) — they work directly.
  /workspace/ is available as a convenience alias if you prefer short paths.
  /scratch/ for ephemeral files you won't need after the conversation.

SHELL
  run_command(command, cwd?, timeout?)
    Executes via sh -c in ${displayCwd} (default cwd). 30 s timeout by default.
    Use for: building, testing, git, package managers, anything not covered by VFS.

TASKS
  add_task / list_tasks / update_task / complete_task
    Lightweight in-session task list. Use to track multi-step work.

SKILLS
  load_skill(name?, search?, list?)
    Discover and load domain-knowledge packages from .amplifier/skills/.

GUIDELINES
  - Prefer VFS tools for file I/O; use run_command for build/test/git operations.
  - Be concise and action-oriented. Do the work, explain briefly.
  - When editing files, use edit_file for targeted changes; write_file only for new files or full rewrites.
  - Relative paths are resolved from ${cwd} (the project root).
  - When uncertain about project structure, list or glob before reading.`
}

/**
 * Create a LoomSession configured from environment variables.
 *
 * Requires ANTHROPIC_API_KEY. Reads MODEL for the model (default: claude-sonnet-4-5).
 */
export function createSession(): LoomSession {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Export it before running loom-code.')
  }
  const model = process.env.MODEL ?? 'claude-sonnet-4-6'
  const provider = createAnthropicProvider({ model, apiKey })

  const cwd = process.cwd()

  // VFS mounts:
  //   cwd          → real-path passthrough  (real absolute paths work — from shell output, errors, etc.)
  //   /workspace   → same cwd              (alias; keeps backward compat)
  //   /scratch     → in-memory             (ephemeral scratch space)
  //
  // Longest-prefix-match means the real absolute path always wins when both could match.
  const vfs = createFsVfs()
  vfs.mount(cwd, createLocalBackend(cwd))
  vfs.mount('/workspace', createLocalBackend(cwd))
  vfs.mount('/scratch', createInMemoryBackend())

  return new LoomSession({
    provider,
    systemPrompt: buildSystemPrompt(cwd),
    packages: [
      createFsPackage(vfs),
      createShellPackage({ cwd }),
      createTasksPackage(),
      createSkillsPackage(),
    ],
  })
}
