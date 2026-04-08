import Anthropic from '@anthropic-ai/sdk'
import type { LoomProvider } from '@loom-code/core'
import type { AnthropicProviderConfig } from './types'

const DEFAULT_MAX_TOKENS = 8096

/**
 * Create a LoomProvider that wraps the Anthropic SDK.
 *
 * Pass the returned provider to LoomSession as `config.provider`.
 * The agentic loop in @loom-code/core calls `provider.createClient()`
 * on each turn to get a streaming client.
 */
export function createAnthropicProvider(
  config: AnthropicProviderConfig
): LoomProvider & { maxTokens: number } {
  return {
    model: config.model,
    apiKey: config.apiKey,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    createClient: () =>
      new Anthropic({
        apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
        // Required for extended thinking (interleaved thinking blocks + tool use).
        // Safe to include always — has no effect when thinking is not requested.
        defaultHeaders: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      }),
  }
}
