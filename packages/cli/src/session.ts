import { LoomSession } from '@loom-code/core'
import { createAnthropicProvider } from '@loom-code/provider-anthropic'
import { createFsPackage, createFsVfs, createLocalBackend, createInMemoryBackend } from '@loom-code/tool-fs'
import { createShellPackage } from '@loom-code/tool-shell'
import { createTasksPackage } from '@loom-code/tool-tasks'
import { createSkillsPackage } from '@loom-code/tool-skills'

/**
 * Create a LoomSession configured from environment variables.
 *
 * Requires ANTHROPIC_API_KEY. Reads MODEL for the model (default: claude-opus-4-5).
 */
export function createSession(): LoomSession {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Export it before running loom-code.')
  }
  const model = process.env.MODEL ?? 'claude-opus-4-5'
  const provider = createAnthropicProvider({ model, apiKey })

  // VFS: /workspace → cwd (local), /scratch → in-memory
  const vfs = createFsVfs()
  vfs.mount('/workspace', createLocalBackend(process.cwd()))
  vfs.mount('/scratch', createInMemoryBackend())

  return new LoomSession({
    provider,
    packages: [
      createFsPackage(vfs),
      createShellPackage({ cwd: process.cwd() }),
      createTasksPackage(),
      createSkillsPackage(),
    ],
  })
}
