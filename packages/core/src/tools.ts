import { createRequire } from 'module'
import type { LoomPackage } from './types'

const _require = createRequire(import.meta.url)

// Lazy-load amplifier-core — the napi-rs binding is CommonJS
function getAmp() {
  return _require('amplifier-core') as {
    JsToolBridge: new (
      name: string,
      description: string,
      parametersJson: string,
      executeFn: (inputJson: string) => Promise<string>
    ) => ToolBridge
  }
}

/**
 * Clean interface for a registered tool bridge.
 * Wraps JsToolBridge without exposing napi-rs internals to callers.
 */
export interface ToolBridge {
  execute(inputJson: string): Promise<string>
  getSpec(): string
}

/** JS-side tool registry. Shared with the agentic loop — not stored in Rust coordinator. */
export type ToolMap = Map<string, ToolBridge>

/** Create an empty tool registry Map. */
export function createToolMap(): ToolMap {
  return new Map()
}

/**
 * Register all tools from a LoomPackage into the tool map.
 * Creates a JsToolBridge for each tool to bridge TypeScript → Rust kernel.
 * Overwrites existing tool if name conflicts.
 */
export function registerPackageTools(map: ToolMap, pkg: LoomPackage): void {
  const amp = getAmp()
  for (const tool of pkg.tools) {
    const bridge = new amp.JsToolBridge(
      tool.name,
      tool.description,
      JSON.stringify(tool.schema),
      tool.execute
    )
    map.set(tool.name, bridge)
  }
}

/**
 * Derive tool spec array for LLM API calls.
 * Maps JsToolBridge.getSpec() → { name, description, input_schema } per tool.
 * Called fresh on every LLM turn so dynamic tool additions are picked up automatically.
 */
export function deriveToolSpecs(map: ToolMap): Array<{
  name: string
  description: string
  input_schema: unknown
}> {
  return [...map.values()].map(bridge => {
    const spec = JSON.parse(bridge.getSpec()) as {
      name: string
      description: string
      parameters: unknown
    }
    return {
      name: spec.name,
      description: spec.description,
      input_schema: spec.parameters,
    }
  })
}
