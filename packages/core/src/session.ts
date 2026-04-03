import { createRequire } from 'module'
import { createToolMap, registerPackageTools } from './tools'
import { runTurn } from './loop'
import type { LoomConfig, LoomPackage } from './types'
import type { ToolMap } from './tools'
import type { LoopOptions } from './loop'

const _require = createRequire(import.meta.url)

// Lazy-load amplifier-core — the napi-rs binding is CommonJS
function getAmp() {
  return _require('amplifier-core') as {
    JsAmplifierSession: new (
      configJson: string,
      sessionId?: string | null,
      parentId?: string | null
    ) => {
      sessionId: string
      parentId: string | null
      coordinator: {
        hooks: {
          register(
            event: string,
            handler: (...args: unknown[]) => unknown,
            priority: number,
            name: string
          ): void
          emit(event: string, dataJson: string): Promise<{ action: string; reason?: string }>
          setDefaultFields(defaultsJson: string): void
        }
        cancellation: {
          isCancelled: boolean
          isGraceful: boolean
          isImmediate: boolean
          requestGraceful(): void
          requestImmediate(): void
          reset(): void
        }
        resetTurn(): void
        cleanup(): Promise<void>
      }
      setInitialized(): void
      cleanup(): Promise<void>
    }
  }
}

/** Amplifier-core always needs these two fields in the session config. */
const AMPLIFIER_KERNEL_CONFIG = JSON.stringify({
  session: { orchestrator: 'loop-basic', context: 'context-simple' },
})

export interface SessionOptions {
  parentId?: string
}

/**
 * LoomSession — the main entry point for a conversation.
 *
 * Wraps the amplifier-core Rust kernel (via napi-rs) and owns:
 * - Tool registration (JS-side ToolMap)
 * - Hook wiring (package hooks registered with the kernel)
 * - Cancellation (JsCancellationToken)
 * - The agentic loop (via loop.ts runTurn)
 *
 * Architecture: there is NO execute() on the kernel. This class drives the loop.
 */
export class LoomSession {
  readonly sessionId: string
  readonly parentId: string | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _session: any
  private readonly _config: LoomConfig
  private readonly _toolMap: ToolMap
  private readonly _messages: unknown[] = []
  private _cleanedUp = false

  constructor(config: LoomConfig, opts: SessionOptions = {}) {
    const amp = getAmp()
    this._config = config

    // Create the kernel session (lifecycle tracking only — no execute())
    const kernelSession = new amp.JsAmplifierSession(
      AMPLIFIER_KERNEL_CONFIG,
      null,
      opts.parentId ?? null
    )
    kernelSession.setInitialized()
    this._session = kernelSession

    this.sessionId = kernelSession.sessionId
    this.parentId = opts.parentId

    // Build tool map from all packages
    this._toolMap = createToolMap()
    for (const pkg of config.packages) {
      this._registerPackage(pkg)
    }

    // Set session_id as default field for all hook emissions
    kernelSession.coordinator.hooks.setDefaultFields(
      JSON.stringify({ session_id: this.sessionId })
    )
  }

  private _registerPackage(pkg: LoomPackage): void {
    registerPackageTools(this._toolMap, pkg)
    const hooks = this._session.coordinator.hooks
    for (const h of pkg.hooks ?? []) {
      hooks.register(h.event, h.handler, h.priority ?? 0, h.name ?? h.event)
    }
  }

  /** True if the session has been cancelled (graceful or immediate). */
  get isCancelled(): boolean {
    return this._session.coordinator.cancellation.isCancelled as boolean
  }

  /** Request graceful cancellation — LLM turn will complete before stopping. */
  cancel(): void {
    this._session.coordinator.cancellation.requestGraceful()
  }

  /** Request immediate cancellation — stops at the next safe checkpoint. */
  cancelImmediate(): void {
    this._session.coordinator.cancellation.requestImmediate()
  }

  /** True if a tool with the given name is registered. */
  hasToolNamed(name: string): boolean {
    return this._toolMap.has(name)
  }

  /**
   * Add a package mid-session. Tools become available on the next runTurn() call.
   * This is the dynamic installation path used by `loom install`.
   */
  addPackage(pkg: LoomPackage): void {
    this._registerPackage(pkg)
  }

  /**
   * Run one user turn through the agentic loop.
   * Delegates to loop.ts runTurn which owns the while(true) and LLM calls.
   */
  async runTurn(
    prompt: string,
    callbacks: {
      onToken?: (delta: string) => void
      onToolStart?: (name: string) => void
      onToolEnd?: (name: string, success: boolean, output: string) => void
    } = {}
  ): Promise<string> {
    this._session.coordinator.resetTurn()

    const client = this._config.provider.createClient()

    return runTurn({
      prompt,
      messages: this._messages,
      toolMap: this._toolMap,
      client: client as LoopOptions['client'],
      model: this._config.provider.model,
      systemPrompt: this._config.systemPrompt,
      hooks: this._session.coordinator.hooks as LoopOptions['hooks'],
      onToken: callbacks.onToken ?? (() => {}),
      onToolStart: callbacks.onToolStart ?? (() => {}),
      onToolEnd: callbacks.onToolEnd ?? (() => {}),
    })
  }

  /**
   * Clean up the session. Safe to call multiple times.
   */
  async cleanup(): Promise<void> {
    if (this._cleanedUp) return
    this._cleanedUp = true
    try {
      await this._session.cleanup()
    } catch {
      // Cleanup errors are non-fatal
    }
  }
}
