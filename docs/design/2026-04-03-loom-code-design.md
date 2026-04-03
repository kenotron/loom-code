# loom-code Design

## Goal

loom-code is a coding-assistant CLI with Claude Code-level TUI polish, built on amplifier-core
(Rust kernel) via napi-rs Node.js bindings. Full control over the session layer. No dependency on
amplifier-foundation.

## Background

Existing coding-assistant CLIs (Claude Code in particular) suffer from terminal rendering bugs
rooted in Ink's architecture. Ink repaints the entire view on every React state change using a
cursor-up-and-erase strategy. With streaming AI tokens, this produces 4,000-6,700 scroll
events per second. Claude Code maintains a custom Ink fork with a differential renderer, virtual
scroll, and frame debouncing — and still only achieves flicker-free rendering in roughly one
third of sessions after years of engineering. The root cause is architectural: terminals are
append-only streams with no compositor.

loom-code replaces the rendering layer with OpenTUI (Zig-native double-buffered cell grids)
and replaces the Python orchestration layer (amplifier-foundation) with TypeScript, while keeping
the battle-tested Rust kernel (amplifier-core) for the agent runtime via napi-rs bindings.

## Technology Decisions

### 1. OpenTUI over Ink

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

### 2. napi-rs Bindings to amplifier-core (not Python subprocess)

amplifier-core is a Rust kernel with both PyO3 (Python) and napi-rs (Node.js) bindings. The
napi-rs bindings (`bindings/node`, v1.0.10) are production-grade: 10+ test files, full session
lifecycle support, `JsAmplifierSession`, `JsCoordinator`, `JsHookRegistry`,
`JsCancellationToken`, `JsToolBridge`, and `resolveModule()`.

**Critical: there is no `execute()` on JsAmplifierSession.** The Rust kernel is lifecycle
infrastructure only. LoomSession owns the entire agentic loop — the `while(true)`, the LLM SDK
calls, the tool dispatch, the hook emissions.

**Critical: Python modules cannot be loaded from TypeScript hosts.** `resolveModule()` throws
`"TypeScript hosts cannot load Python modules"`. Providers are TypeScript npm packages calling
LLM SDKs directly (same as the reference implementation in amplifier-node).

No IPC overhead. No two-process model. Node.js calls Rust directly.

### 3. npm as the Composition Model

amplifier-foundation's bundle system (YAML config, custom path resolution, `git+https` sources)
is not used. npm replaces it entirely:

- `package.json` is the mount plan.
- `npm install @loom/shell` adds a package.
- Semver, peer deps, and dependency management are free.
- Configuration is a TypeScript object — no YAML, no custom resolution chain.

### 4. No amplifier-foundation Dependency

The Python amplifier-foundation layer (bundle loading, config resolution, module path walking)
is not used. It is replaced entirely by TypeScript imports and npm.

### 5. No Middleware Abstraction

Hooks throughout. No middleware abstraction anywhere in the stack. YAGNI.

## Architecture

Four-layer vertical stack:

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer                                   │
│  @opentui/react — ChatView, ToolPanel,      │
│  InputBar, StatusBar, AttentionPanel        │
│  Zig double-buffer → terminal               │
└─────────────────────────────┬─────────────────────────────────┘
                   │ React state / events
┌─────────────────────────────▼─────────────────────────────────┐
│  Session Orchestration (TypeScript)         │
│  LoomSession — owns the agentic loop        │
│  Streaming adapter — hooks → React state    │
│  SessionStore — persist / resume            │
└─────────────────────────────┬─────────────────────────────────┘
                   │ JsAmplifierSession API
┌─────────────────────────────▼─────────────────────────────────┐
│  amplifier-core Rust Kernel (napi-rs)       │
│  JsAmplifierSession, JsCoordinator          │
│  JsHookRegistry, JsCancellationToken        │
└─────────────────────────────┬─────────────────────────────────┘
                   │ JsToolBridge + npm packages
┌─────────────────────────────▼─────────────────────────────────┐
│  Module Layer (npm)                         │
│  @loom/provider-anthropic (TS, Anthropic SDK│
│  @loom/shell, @loom/tool-fs, etc.           │
└─────────────────────────────────────────────────────────────┘
```

**Key insight.** The Session Orchestration layer occupies the space where amplifier-foundation
used to live. It is now plain TypeScript: `LoomSession` wraps `JsAmplifierSession`, registers
hooks that translate kernel events into React state updates, handles cancellation
(`Ctrl-C` → `JsCancellationToken`), and manages session persistence.

## Interaction Model & UI Layout

Three screen zones plus a command palette overlay:

```
┌─────────────────────────────────────────────────────────┐
│ claude-opus-4  2.1k tokens  #05476974       │  ← @loom/ui-status-bar (1 line, minimal)
├─────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐ │
│ │ ▸ Refactor login flow                   │ │  ← @loom/ui-attention-panel
│ │   ⏳ Review changes before continuing   │ │     (hidden when nothing pending)
│ └───────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                                             │
│   conversation history + tool panels        │  ← @loom/ui-chat-history
│                                             │
├─────────────────────────────────────────────────────────┤
│ ▸ _                              [mic]      │  ← @loom/ui-input-bar
└─────────────────────────────────────────────────────────┘
```

### Attention Panel (a2ui → TUI)

The agent pushes to this surface via `JsHookRegistry` — specifically `HookAction.AskUser` and
`HookAction.InjectContext` events. It always shows what the user last requested plus what needs
action now (approvals, diffs to review, clarifications). Collapses to zero height when nothing
is pending. This is the only bidirectional channel — everything else flows through the
conversation.

### Command Palette (Cmd-P / Ctrl-P)

Cmd-P on macOS, Ctrl-P everywhere else — detected at startup. Centered fuzzy-search overlay via
OpenTUI compositor (z-indexed layer). ALL app-layer concerns live here: switch model, manage
packages, session history, settings, save/resume. No slash commands for app concerns. No
namespace collisions with user skills or commands.

```
┌──────────────────────────────────────────────┐
│  > _                               │  ← fuzzy search
│  ───────────────────────────────────     │
│  Switch model / provider           │
│  Manage tools (npm install...)     │
│  Session history                   │
│  Settings                          │
│  Save session                      │
└──────────────────────────────────────────────┘
```

The input bar becomes a pure conversation channel. Skills and user-defined commands don't register
into a slash namespace at all — they're invoked through the conversation itself (or a separate,
distinct binding). No namespace collisions possible.

### Voice Input

`@loom/ui-voice-input` — optional module. Mic icon in input bar. See [Section 10](#voice-input-loomui-voice-input).

### Module Boundaries

Each UI zone is a separate `@loom/ui-*` npm package. The CLI composes them. Anyone can swap a
component for a different implementation without touching the rest.

## Conversation History — Progressive Disclosure

The default state is intentionally sparse. The history shows the conversation, not the machinery:

```
You  refactor the login flow to use JWT

AI   I'll start by reading the current implementation.

     ✓ read_file  4 files                    ▶  ← grouped consecutive same-tool calls
     ✓ bash  pytest tests/auth/              ▶
     ◯ thought for 3.2s                      ▶

     Here are the changes...
```

### Expandable Rows

Everything with `▶` is expandable in place — click or Enter on it. Tool calls show name + status
(running / success / error) by default, full input/output on expand. Thinking shows duration
collapsed, full reasoning text on expand. A failed tool shows the error inline on the collapsed
row so it's never hidden.

### Grouped Tool Calls

Consecutive calls to the same tool collapse into a single row. Expand the group to see individual
entries, each expandable again:

```
▼ read_file  4 files
  ✓ auth/login.py                      ▶
  ✓ auth/middleware.py                 ▶
  ✓ auth/utils.py                      ▶
  ✓ auth/tokens.py                     ▶
```

Two levels of disclosure for grouped tool calls, three levels total if you count expanding an
individual file's content. The grouping logic lives in `@loom/ui-chat-history` — consecutive
calls to the same tool name get bucketed automatically. Mixed tool sequences stay separate rows.

### Streaming Behaviour

While a tool is running, the row shows a spinner and the tool name. When it resolves, it flips
to `✓` or `✗` in place. No re-layout, no scroll jump — the row height is stable (collapsed state
is always one line).

As file reads come in one by one, the group row increments its count in place (`reading 1 file...`
→ `reading 2 files...` → `✓ read_file  4 files`) without growing the layout at all.

**OpenTUI advantage.** Because this is a cell-grid renderer, toggling a row from collapsed to
expanded is just a buffer update at that row range — no DOM reflow, no scroll position corruption.

## Session Orchestration

`LoomSession` is a TypeScript class that wraps `JsAmplifierSession`. It owns the entire agentic
loop. The UI knows nothing about napi-rs — it only sees React state.

### Hook-to-State Bridge

```
                    JsHookRegistry
                    ┌────────────────────────────────────────┐
kernel events ─────▶ │ token:stream  → append to message  │
                    │ tool:pre      → add collapsed row   │ ───▶ React state
                    │ tool:post     → update row status   │
                    │ thinking:end  → update duration     │
                    │ approval:req  → push to attention   │
                    └────────────────────────────────────────┘
```

Each hook handler is registered at session startup. They're pure state mutations — no async
complexity, no coordination. The Zig renderer picks up the diff and updates only the cells that
changed.

### The Agentic Loop

```typescript
async runTurn(prompt: string) {
  messages.push({ role: 'user', content: prompt })
  coordinator.resetTurn()
  await hooks.emit('prompt:submit', ...)

  while (true) {
    const stream = await anthropic.messages.stream({
      tools: deriveToolSpecs(),
      messages,
      ...
    })

    for await (const delta of stream) {
      chatState.appendToken(delta)  // → OpenTUI re-renders at 30fps
    }

    const response = await stream.finalMessage()

    if (response.stop_reason === 'tool_use') {
      for (const block of toolBlocks(response)) {
        chatState.addToolRow(block.name, 'running')
        const pre = await hooks.emit('tool:pre', ...)
        const result = pre.action === 'Deny'
          ? { success: false, output: `blocked: ${pre.reason}` }
          : JSON.parse(await toolMap.get(block.name).execute(
              JSON.stringify(block.input)
            ))
        await hooks.emit('tool:post', ...)
        chatState.updateToolRow(block.name, result)
        toolResults.push(result)
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }
    break
  }

  await hooks.emit('prompt:complete', ...)
  attentionState.updateIntent(response)
  sessionStore.appendTurn(prompt, response)
}
```

Tool specs are re-derived from `toolMap` on every turn — dynamic tool registration (see
[Session Lifecycle](#session-lifecycle--dynamic-composition)) is automatic.

### Cancellation

First `Ctrl-C` calls `cancellationToken.requestGraceful()`, second `Ctrl-C` within 2s calls
`requestImmediate()`. The token state is reflected in the status bar.

### Configuration (`loom.config.ts`)

A TypeScript object consumed by LoomSession at startup:

```typescript
import shell from '@loom/shell'
import anthropic from '@loom/provider-anthropic'

export default {
  provider: anthropic({ model: 'claude-opus-4' }),
  packages: [shell()],
  systemPrompt: './AGENTS.md',
}
```

## Session Lifecycle & Dynamic Composition

The key differentiator: sessions are mutable. Packages can be added, removed, or swapped
mid-session — and the LLM sees the changes immediately on the next turn.

### Live Package Installation

```
loom install @loom/tool-database   ← chat input or Cmd-P
     ↓
npm install @loom/tool-database    ← runs in background
     ↓
dynamic import('@loom/tool-database')
     ↓
package.register(coordinator, toolMap)   ← JsToolBridges added to toolMap
     ↓
LLM sees new tools on next turn          ← no restart
```

This works because Node.js makes it possible — `npm install` at runtime, `await import()` for
dynamic loading, `Map.set()` for live registration.

### Session Graph

Sessions aren't linear, they're a tree:

```
session-001
    ├── [added tool: database]
    ├── fork ──→ session-002  (try a different direction)
    ├── rollback to checkpoint
    └── session-001 (current)
```

- **Fork:** new `JsAmplifierSession` with `parent_id` pointing to current — transcript copied
  to the branch point. The `parent_id` mechanism in napi-rs is built for this.
- **Rollback:** rewind the transcript to a prior checkpoint, unregister any tools added since,
  restore config. Conversation state + coordinator state both revert.
- **Retry:** rollback to checkpoint before last turn, re-run from same input — useful when a
  tool fails or the LLM response is unsatisfying.
- **Resume:** replay `transcript.jsonl` through the conversation history renderer.

### Auto-Naming

Session starts as its short ID. After the first user turn, a lightweight inference pass names it
("refactoring login flow"). The attention panel shows the current name + latest inferred intent,
updated each turn. Stored in `metadata.json`.

## Package System

A **package** is the unit of composition — replaces what amplifier calls a "behavior." It's an
npm package that can contain any combination of tools, hooks, context, and agents. Tools never
exist standalone — they live inside packages.

```typescript
// @loom/shell — contains tools + hooks + context
export default function createShellPackage(options = {}): LoomPackage {
  return {
    tools: [createBashTool(options), createFilesystemTool(options)],
    hooks: [createApprovalHook()],
    context: { files: ['./shell-usage.md'] }
  }
}
```

`loom.config.ts` composes packages, not individual tools:

```typescript
import shell from '@loom/shell'
import codeAnalysis from '@loom/code-analysis'

export default {
  provider: anthropic({ model: 'claude-opus-4' }),
  packages: [
    shell(),
    codeAnalysis({ language: 'typescript' }),
  ],
  systemPrompt: './AGENTS.md',
}
```

`loom install @loom/shell` installs the whole package — tools, hooks, context and all. npm's
dependency graph handles transitive deps. Versioning, peer deps, semver constraints — free.

`LoomPackage` interface is the stable contract. Anything implementing it can be composed into a
session. LoomSession wraps tools in `JsToolBridge` internally — package authors never touch
napi-rs.

Tools are stored in a JS-side `Map<name, JsToolBridge>` — the hybrid coordinator pattern from
the reference implementation. `toolMap` is re-read on every LLM call, so dynamic registration
is automatic.

Providers are `@loom/provider-*` TypeScript npm packages wrapping LLM SDKs directly. No Python
modules. No `resolveModule()`. Full TypeScript throughout.

Agents and skills are also npm packages — they export a `LoomAgent` or `LoomSkill` object with
a system prompt, tool set, and optional hook handlers. Same registration pattern, same dynamic
install path.

## Data Flow & Streaming

A single turn flows like this:

```
User input
    │
    ▼
LoomSession.runTurn(prompt)
    │  hooks.emit('prompt:submit')
    │  coordinator.resetTurn()
    │
    ▼
anthropic.messages.stream(...)
    │
    ├─ text delta ──▶ chatState.appendToken(delta)
    │                 └──▶ OpenTUI coalesces at 30fps → only changed cells repaint
    │
    ├─ stop: tool_use
    │   ├─ chatState.addToolRow(name, 'running')   ← ⟳ appears
    │   ├─ hooks.emit('tool:pre')  → Deny? → mark ✗, skip
    │   ├─ toolMap.get(name).execute(input)
    │   ├─ hooks.emit('tool:post')
    │   ├─ chatState.updateToolRow(name, result)   ← ✓ or ✗
    │   └─ push tool_result → continue loop
    │
    └─ stop: end_turn
        │  hooks.emit('prompt:complete')
        │  attentionState.updateIntent(response)
        └─ sessionStore.appendTurn(prompt, response)
```

The OpenTUI advantage is visible here: every `chatState` mutation is a React state update, but
the Zig renderer coalesces them at 30fps. A hundred token deltas arriving in 33ms produce one
cell-level diff and one partial repaint — not a hundred cursor-up-erase cycles. The grouped tool
row increments in place (`reading 2 files...` → `reading 3 files...`) without any layout shift.

The attention panel gets updated at `end_turn` — auto-naming inference runs there, and any
pending `HookAction.AskUser` result surfaces immediately.

## Error Handling

Errors split into two categories based on whether they need user intervention.

### Inline Errors (in conversation history)

Tool failures are normal AI operation. They live where they happened:

```
✗ bash  pytest tests/auth/  exit code 1          ▶
```

Expandable to show stdout/stderr. The LLM sees the failure output and continues — no
interruption, no modal, no noise. Hook denials (`HookAction.Deny`) follow the same pattern:
`✗ bash  blocked by policy` inline.

### Attention Panel Errors (need user action)

Provider failures, rate limits, context length exceeded, and network errors surface in the
attention panel. Shows what failed, why, and the available actions:

```
▸ Provider error — rate limit (429)
  Retry in 32s  |  Switch model  |  Cancel
```

Dynamic install failures also surface here: `✗ loom install @loom/tool-db — package not found`.

### Fatal Errors

Session initialization failures and unrecoverable states are shown full-screen with a clear
message and a single action (restart session, report issue).

### Typed Error Boundary

The napi-rs bindings give typed error codes — `SessionError`, `ToolError`, `ProviderError`,
`HookError` — caught and categorized at the `LoomSession` boundary before anything reaches the
UI layer. The UI never handles raw exceptions; it handles typed error states.

### Cancellation

Not treated as an error — `Ctrl-C` graceful shows a `⊘ cancelled` indicator inline at the
interrupted turn. The session remains resumable.

## Session Integrity & Checkpoints

Prevents and recovers from the class of history corruption that broke amplifier-app-cli. The
root cause of that corruption: a turn can fail mid-flight (tool execution error, network drop,
partial tool result sequence) leaving the message array in a state Anthropic rejects.
amplifier-app-cli tried to patch corrupted arrays after the fact — wrong direction.

loom solves it with immutable checkpoints and a normalized store.

### Normalized Message Store

Messages are stored once by ID. Append-only, never modified:

```
messages.jsonl → { id: "m_042", role: "assistant", content: [...] }
                 { id: "m_043", role: "user",      content: [...] }
```

### Delta Checkpoints

Checkpoints store only what changed since the last checkpoint — most are a handful of bytes:

```typescript
interface SessionCheckpoint {
  id: string
  turnIndex: number
  newMessageIds: string[]          // only NEW messages this turn (2-5 IDs typically)
  toolSet?: string[]               // only written when packages change
  config?: Partial<LoomConfig>     // only written when config changes
  intent: string
}
```

Periodic full `messageIds` snapshots every 20 turns for fast random-access reconstruction.

### Reconstruction

```typescript
function reconstructAt(checkpoints, targetTurn) {
  const relevant = checkpoints.filter(cp => cp.turnIndex <= targetTurn)
  return {
    messageIds: relevant.flatMap(cp => cp.newMessageIds),
    toolSet:    [...relevant].reverse().find(cp => cp.toolSet)?.toolSet,
    config:     [...relevant].reverse().find(cp => cp.config)?.config,
  }
}
```

For random-access: find the nearest full snapshot at or before the target turn, then apply at
most 20 deltas. Bounded O(1) effectively.

### Validation, Repair, and Fallback Chain

Before the reconstructed array ever reaches the LLM, it runs through a validator that catches
everything Anthropic rejects — role alternation violations, orphaned `tool_use` blocks without
matching `tool_result`, empty content arrays:

```typescript
async reconstruct(target): Promise<Message[]> {
  const raw = await fold(snapshots, deltas, target)
  const check = validate(raw)
  if (check.valid) return raw
  const repaired = repair(raw, check)
  if (validate(repaired).valid) return repaired
  return reconstruct(previousCheckpoint(target))  // fallback chain
}
```

**Invariant:** `LoomSession.runTurn()` never receives an array that hasn't passed validation.
Corruption stops at the store boundary, not inside an Anthropic call.

### Session Directory

```
~/.loom/sessions/{id}/
├── messages.jsonl      ← append-only, one message per line, each has an id
├── checkpoints.jsonl   ← append-only, one checkpoint per line
└── metadata.json       ← current intent, model, created, last active
```

Both `.jsonl` files are append-only — no random writes, no corruption risk from partial writes.
Rolling back never deletes anything — you just stop referencing messages beyond the checkpoint.
Forward history stays intact if you want to re-apply it.

## Voice Input (`@loom/ui-voice-input`)

Completely optional module, zero coupling — removing it from `loom.config.ts` makes it disappear
entirely.

### Backend

whisper.cpp — local, no API key, ~200ms latency. Runs via Node.js native bindings.

### Keybind

**Opt+Space** — mirrors SuperWhisper muscle memory. Works cleanly in modern terminal emulators
(iTerm2, Ghostty, Kitty, Terminal.app). Fallback: **Ctrl+\\** for terminals that swallow Alt
sequences. Tap to toggle, hold for push-to-talk (configurable).

### Live ASCII Volume Visualiser

Unicode block elements give 8 levels of height: `▁▂▃▄▅▆▇█`

While recording, a rolling 16-character waveform sits inline in the input bar, updating at 20fps:

```
▸ _              ▁▂▄▆▇▅▃▂▄▆▇▄▂▁▂▃  🎤
```

Each character = RMS volume of a 50ms audio chunk mapped to one of the 8 block levels. The
window scrolls left as new samples arrive — oldest drops off the left, newest appends on the
right. Louder = taller character, silence = `▁`. OpenTUI updates only the ~16 cells that changed
each frame, nothing else repaints.

On stop: waveform disappears, whisper.cpp transcribes, cleanup pass runs, text injects into the
input bar.

### Post-Transcription Cleanup

Strips fillers (`um`, `uh`, `ah`, `er`, `hmm`), fixes capitalisation. Pure string transform,
runs in microseconds. Mirrors SuperWhisper's cleanup behaviour.

### Configuration

```typescript
{
  backend: 'whisper.cpp',
  keybind: 'opt+space',
  keybindFallback: 'ctrl+\\',
  visualiser: { windowSize: 16, fps: 20 },
  cleanup: { fillers: ['um','uh','ah','er','hmm'], fixCapitalisation: true }
}
```

## Testing Strategy

Three tiers, with real API calls at the top.

### Unit — fast, no API, no napi-rs

- Checkpoint delta reconstruction, validation, repair logic
- Progressive disclosure state machine, grouping logic
- RMS → waveform block mapping, filler cleanup pass
- Session auto-naming inference

### Integration — napi-rs bindings, no API

- Hook registration and event round-trips
- `JsCancellationToken` state machine wired to SIGINT
- Dynamic tool registration visible to next turn
- Checkpoint write → rollback → reconstruct produces identical valid array

### Simulation Sessions — real Anthropic API calls, scripted inputs

These are the guarantees. Each scenario runs a complete session against the real API and asserts
invariants at every turn:

| Scenario | Asserts |
|---|---|
| Standard coding session | Message array valid throughout, tool hooks fire, response renders |
| Mid-session `loom install` | Package available in next turn, checkpoint captures new toolSet |
| Checkpoint recovery | Corrupt a message mid-session, reconstruction + repair, LLM continues |
| Long session (30+ turns) | Checkpoint chain correct, snapshots written every 20 turns |
| Graceful cancellation | Ctrl-C mid-turn, session resumes from last clean checkpoint |

Simulation sessions are committed to the repo as reference artifacts — evidence that a real LLM
passed through all machinery. CI runs them on schedule (not every push — they cost tokens). Any
failure is a regression against real LLM behaviour, not a mock.