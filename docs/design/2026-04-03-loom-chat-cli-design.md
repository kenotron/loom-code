# loom-chat-cli Design

> **Status**: In progress. The architecture (Section 1) has been validated. Detailed component
> sections are still being designed through brainstorming sessions. This document is structured
> so the design conversation can be resumed on any machine — pick up from the
> [Open Questions](#open-questions) section.

## Goal

Build a coding-assistant CLI with Claude Code-level TUI polish, on a stack we fully control —
amplifier-core's Rust kernel for the agent runtime, OpenTUI for flicker-free streaming terminal
rendering, composed entirely through npm and TypeScript.

## Background

Existing coding-assistant CLIs (Claude Code in particular) suffer from terminal rendering bugs
rooted in Ink's architecture. Ink repaints the entire view on every React state change using a
cursor-up-and-erase strategy. With streaming AI tokens, this produces 4,000-6,700 scroll
events per second. Claude Code maintains a custom Ink fork with a differential renderer, virtual
scroll, and frame debouncing — and still only achieves flicker-free rendering in roughly one
third of sessions after years of engineering. The root cause is architectural: terminals are
append-only streams with no compositor.

loom-chat-cli replaces the rendering layer with OpenTUI (Zig-native double-buffered cell grids)
and replaces the Python orchestration layer (amplifier-foundation) with TypeScript, while keeping
the battle-tested Rust kernel (amplifier-core) for the agent runtime via napi-rs bindings.

## Technology Decisions

### OpenTUI over Ink

**Problem with Ink.** Ink uses a cursor-up-and-erase repaint strategy. Every React state change
triggers a full terminal rewrite. During streaming AI output this means thousands of scroll
events per second. Claude Code's custom Ink fork adds differential rendering, virtual scroll, and
frame debouncing — yet only ~1/3 of sessions are flicker-free. The root cause is architectural:
terminals are append-only byte streams, not compositable framebuffers.

**OpenTUI's approach.** `@opentui/react` wraps a Zig-native core that maintains double-buffered
cell grids. Only changed cells emit ANSI sequences (cell-level diffing). It uses the alternate
screen buffer by default and coalesces frames at 30fps — 100 state updates in 33ms produce a
single render. OpenTUI powers OpenCode in production (~10k GitHub stars). The React component
model is preserved via `@opentui/react`.

**Caveat.** OpenTUI is v0.x. The API is not yet stable.

### napi-rs Bindings to amplifier-core

amplifier-core is a Rust kernel with both PyO3 (Python) and napi-rs (Node.js) bindings. The
napi-rs bindings (`bindings/node`, v1.0.10) are production-grade: 10+ test files, full session
lifecycle support, `JsAmplifierSession`, `JsCoordinator`, `JsHookRegistry`,
`JsCancellationToken`, `JsToolBridge`, and `resolveModule()`.

`resolveModule()` supports Python transport — existing Python modules (provider-anthropic,
tool-bash, etc.) load through the Rust kernel unchanged.

No IPC overhead. No two-process model. Node.js calls Rust directly.

### npm as the Composition Model

amplifier-foundation's bundle system (YAML config, custom path resolution, `git+https` sources)
is not used. npm replaces it entirely:

- `package.json` is the mount plan.
- `npm install @loom/tool-bash` adds a tool.
- Semver and dependency management are free.
- Configuration is a TypeScript object — no YAML, no custom resolution chain.

New tools are npm packages implementing `JsToolBridge`. Existing Python modules still load via
`resolveModule()`.

### No amplifier-foundation Dependency

The Python amplifier-foundation layer (bundle loading, config resolution, module path walking)
is not used. It is replaced entirely by TypeScript imports and npm.

## Architecture

*Validated — approved by user.*

Four-layer vertical stack:

```
┌─────────────────────────────────────────────┐
│  UI Layer                                   │
│  @opentui/react — ChatView, ToolPanel,      │
│  InputBar, StatusBar                        │
│  Zig double-buffer → terminal               │
└──────────────────┬──────────────────────────┘
                   │ React state / events
┌──────────────────▼──────────────────────────┐
│  Session Orchestration (TypeScript)         │
│  LoomSession — wraps napi-rs kernel         │
│  Streaming adapter — hooks → React state    │
│  SessionStore — persist / resume            │
└──────────────────┬──────────────────────────┘
                   │ JsAmplifierSession API
┌──────────────────▼──────────────────────────┐
│  amplifier-core Rust Kernel (napi-rs)       │
│  JsAmplifierSession, JsCoordinator          │
│  JsHookRegistry, JsCancellationToken        │
└──────────────────┬──────────────────────────┘
                   │ JsToolBridge + resolveModule()
┌──────────────────▼──────────────────────────┐
│  Module Layer                               │
│  npm: @loom/tool-bash, @loom/tool-fs        │
│  Python (via resolveModule): provider-*     │
└─────────────────────────────────────────────┘
```

**Key insight.** The Session Orchestration layer occupies the space where amplifier-foundation
used to live. It is now plain TypeScript: `LoomSession` wraps `JsAmplifierSession`, registers
hooks that translate kernel events into React state updates, handles cancellation
(`Ctrl-C` -> `JsCancellationToken`), and manages session persistence.

## Components

### UI Components

> **TBD** — not yet designed.
>
> Needs to cover: the OpenTUI component tree, layout strategy, and the specific structure of
> `ChatView` (scrollback buffer), `ToolPanel` (collapsible tool call panels), `InputBar`
> (sticky at bottom), and `StatusBar`.
>
> See [Open Question 1](#open-questions).

### Session Orchestration

> **TBD** — not yet designed.
>
> Needs to cover: `LoomSession` public API, the streaming adapter pattern (how kernel hooks
> bridge to React state), the hook-to-state bridge, and cancellation flow.
>
> See [Open Question 2](#open-questions).

### Module / Tool System

> **TBD** — not yet designed.
>
> Needs to cover: how npm packages implement `JsToolBridge`, how providers are wired, and
> how `resolveModule()` loads existing Python modules.
>
> See [Open Question 5](#open-questions).

### Configuration (`loom.config.ts`)

> **TBD** — not yet designed.
>
> Needs to cover: the TypeScript configuration object that replaces bundle YAML, what it
> controls (providers, tools, model selection, session storage path), and how it is loaded.
>
> See [Open Question 4](#open-questions).

## Data Flow

> **TBD** — not yet designed.
>
> Needs to trace the full path: user input in `InputBar` -> `LoomSession.execute()` ->
> amplifier-core streaming tokens -> `JsHookRegistry` events -> React state updates ->
> OpenTUI cell-diff render.
>
> See [Open Question 2](#open-questions).

## Error Handling

> **TBD** — not yet designed.
>
> Needs to cover: LLM errors (rate limits, context overflow, API failures), tool execution
> errors, cancellation semantics (`Ctrl-C` at various points in the pipeline), and how errors
> surface in the UI.

## Testing Strategy

> **TBD** — not yet designed.
>
> Needs to cover: unit testing approach (components, session logic), integration testing
> (napi-rs bindings, tool execution), and end-to-end testing (full CLI interaction).

## Session Persistence

> **TBD** — not yet designed.
>
> Needs to decide: same pattern as amplifier-app-cli (`~/.loom/sessions/`) or a different
> model. What is serialized, when, and how sessions are resumed.
>
> See [Open Question 3](#open-questions).

## Open Questions

These are the active threads for the next brainstorming session:

1. **OpenTUI component tree** — What does the component hierarchy look like? `ChatView` with
   scrollback, collapsible tool call panels in `ToolPanel`, sticky `InputBar`, `StatusBar` for
   token count / model / session info. How do these compose in `@opentui/react`?

2. **Streaming token delivery** — How do streaming tokens flow from the kernel to the UI? Which
   `JsHookRegistry` events carry tokens? Is the bridge a simple event emitter, an async iterator,
   or something else? How does frame coalescing interact with token batching?

3. **Session persistence model** — Follow `amplifier-app-cli`'s `~/.loom/sessions/` pattern or
   diverge? What state needs to survive across restarts? Conversation history only, or also
   tool state and pending operations?

4. **Configuration shape** — What does `loom.config.ts` look like? A default export of a typed
   object? What keys does it have? How is it discovered and loaded at startup?

5. **Initial tool set for v1** — Which tools ship in the first version? `@loom/tool-bash` and
   `@loom/tool-fs` are mentioned in the architecture. What else? File editing? Web search?
   Code analysis?
