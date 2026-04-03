/**
 * Core type interfaces for loom-code.
 *
 * A LoomPackage is the unit of composition — it replaces what amplifier
 * called a "behavior bundle". Tools must live inside packages, not standalone.
 */

/** A single tool capability. execute() receives JSON input, returns JSON output. */
export interface LoomTool {
  name: string
  description: string
  schema: Record<string, unknown>
  execute: (inputJson: string) => Promise<string>
}

/** Handler registered with the amplifier-core hook registry. */
export interface LoomHookHandler {
  event: string
  handler: (...args: unknown[]) => unknown
  priority?: number
  name?: string
}

/** Optional context to inject into sessions. */
export interface LoomContext {
  /** File paths whose contents are injected as system context. */
  files?: string[]
  /** Raw text to inject as system context. */
  text?: string
}

/**
 * A package is the unit of distribution and composition.
 * Contains tools, hooks, and context that work together.
 * Replaces the amplifier "behavior bundle" concept.
 */
export interface LoomPackage {
  tools: LoomTool[]
  hooks?: LoomHookHandler[]
  context?: LoomContext
}

/** A provider wraps an LLM SDK client factory. */
export interface LoomProvider {
  model: string
  createClient: () => unknown
  apiKey?: string
}

/** Root configuration for a LoomSession. */
export interface LoomConfig {
  provider: LoomProvider
  packages: LoomPackage[]
  /** Path to system prompt file (e.g. './AGENTS.md'). */
  systemPrompt?: string
}
