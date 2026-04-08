// @loom-code/core — Public API

// Type interfaces
export type { LoomTool, LoomHookHandler, LoomContext, LoomPackage, LoomProvider, LoomConfig } from './types'

// Tool registration
export type { ToolBridge, ToolMap } from './tools'
export { createToolMap, registerPackageTools, deriveToolSpecs } from './tools'

// Agentic loop
export type { StreamingClient, HookRegistry, LoopOptions, ThinkingConfig } from './loop'
export { runTurn } from './loop'

// Session
export type { SessionOptions } from './session'
export { LoomSession } from './session'
