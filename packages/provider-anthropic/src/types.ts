/**
 * Configuration for the Anthropic provider.
 * Wraps the Anthropic SDK into a LoomProvider compatible interface.
 */
export interface AnthropicProviderConfig {
  /** Anthropic model identifier, e.g. 'claude-opus-4', 'claude-haiku-4' */
  model: string
  /** API key — defaults to ANTHROPIC_API_KEY environment variable if omitted */
  apiKey?: string
  /**
   * Maximum tokens per response — defaults to 8096 if omitted.
   * Note: this field is passed through on the returned LoomProvider but
   * requires the consuming LoomSession to forward it to the agentic loop.
   * Currently used directly by the loop via provider.maxTokens if present.
   */
  maxTokens?: number
}
