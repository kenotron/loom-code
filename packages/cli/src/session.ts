import { LoomSession } from '@loom-code/core'
import { createAnthropicProvider } from '@loom-code/provider-anthropic'

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
  return new LoomSession({ provider, packages: [] })
}
