# Phase 2C: ui-command-palette + CLI Assembly — Implementation Plan

> **Execution:** Use the subagent-driven-development workflow to implement this plan.

**Goal:** Deliver the first runnable loom-code TUI — assembles all 6 UI packages, wires the LoomSession hook bridge, and renders a working terminal chat interface.

**Architecture:** All UI packages (status-bar, attention-panel, chat-history, input-bar, command-palette) assembled in a root `App.tsx`. Session wiring via `session.ts` creates a `LoomSession` and connects the `onToken`/`onToolStart`/`onToolEnd` streaming callbacks to React state updaters. Entry point creates the `@opentui/core` `CliRenderer` and passes it to `@opentui/react`'s `createRoot()`.

**Tech Stack:** Bun workspaces, TypeScript ESNext, `@opentui/react@0.1.96`, `@opentui/core@0.1.96`, `@kenotron-ms/amplifier-core@1.3.4` (via npm alias `amplifier-core`), `bun:test` for smoke tests.

---

## Verified API Surface (from codebase exploration)

These are the **actual** APIs discovered by reading the source. The plan code uses these exactly.

### LoomSession (`packages/core/src/session.ts`)

```typescript
class LoomSession {
  readonly sessionId: string
  constructor(config: LoomConfig, opts?: SessionOptions)

  async runTurn(
    prompt: string,
    callbacks?: {
      onToken?: (delta: string) => void
      onToolStart?: (name: string) => void
      onToolEnd?: (name: string, success: boolean, output: string) => void
    }
  ): Promise<string>   // returns final assistant text

  cancel(): void
  cancelImmediate(): void
  async cleanup(): Promise<void>
}
```

### LoomConfig (`packages/core/src/types.ts`)

```typescript
interface LoomConfig {
  provider: LoomProvider
  packages: LoomPackage[]
  systemPrompt?: string
}
```

### createAnthropicProvider (`packages/provider-anthropic/`)

```typescript
createAnthropicProvider({ model: string, apiKey?: string, maxTokens?: number }): LoomProvider
// apiKey defaults to process.env.ANTHROPIC_API_KEY
```

### UI Component Props (verified)

| Package | Props type | Key fields |
|---------|-----------|------------|
| `ui-status-bar` | `StatusBarProps` | `{ state: StatusBarState }` where `StatusBarState = { model, tokenCount, sessionId }` |
| `ui-attention-panel` | `AttentionPanelProps` | `{ state: AttentionState, onResolve? }` |
| `ui-chat-history` | `ChatHistoryProps` | `{ state: ChatHistoryState, onToggleGroup?, onToggleThinking? }` |
| `ui-input-bar` | `InputBarProps` | `{ initialState: InputBarState, callbacks: InputBarCallbacks, placeholder? }` — NOTE: uses `initialState` not `state` |

### InputBarCallbacks

```typescript
interface InputBarCallbacks {
  onSubmit: (text: string) => void
  onValueChange?: (value: string) => void
  onVoiceToggle?: () => void
}
```

### @opentui/react API (verified from node_modules .d.ts)

```typescript
// Renderer creation (from @opentui/core)
async function createCliRenderer(config?: CliRendererConfig): Promise<CliRenderer>
// CliRendererConfig includes: exitOnCtrlC?, testing?, targetFps?, ...

// Root creation (from @opentui/react)
function createRoot(renderer: CliRenderer): Root
// Root = { render(node: ReactNode): void, unmount(): void }

// Keyboard hook (from @opentui/react)
function useKeyboard(handler: (key: KeyEvent) => void, options?: { release?: boolean }): void
// KeyEvent = { name: string, ctrl: boolean, meta: boolean, shift: boolean, ... }

// JSX elements: box, text, input, select, textarea, scrollbox, markdown, code, diff, ...
// Existing components use: <box style={{ flexDirection: 'column' }}>, <text>, <input>
```

### State factory functions (all verified to exist)

- `createInitialInputBarState()` → `{ value: '', micActive: false }`
- `createInitialAttentionState()` → `{ items: [], intent: null }`
- `createInitialChatHistoryState()` → `{ items: [], streamingItemId: null }`
- (NO `createInitialStatusBarState` — construct `StatusBarState` directly as `{ model, tokenCount, sessionId }`)

---

## Task 1: Scaffold both packages + update root tsconfig

**Files:**
- Create: `packages/ui-command-palette/package.json`
- Create: `packages/ui-command-palette/tsconfig.json`
- Create: `packages/ui-command-palette/src/index.ts` (placeholder)
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts` (placeholder)
- Modify: `tsconfig.json` (root — add both references)

**Step 1: Create `packages/ui-command-palette/package.json`**

```json
{
  "name": "@loom-code/ui-command-palette",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "@opentui/react": "*",
    "@opentui/core": "*",
    "react": "*"
  }
}
```

**Step 2: Create `packages/ui-command-palette/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react",
    "lib": ["ESNext", "DOM"]
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/ui-command-palette/src/index.ts`** (placeholder)

```typescript
// @loom-code/ui-command-palette — placeholder
export {}
```

**Step 4: Create `packages/cli/package.json`**

```json
{
  "name": "loom-code",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "loom-code": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch run src/index.ts",
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "@loom-code/core": "*",
    "@loom-code/provider-anthropic": "*",
    "@loom-code/ui-status-bar": "*",
    "@loom-code/ui-attention-panel": "*",
    "@loom-code/ui-chat-history": "*",
    "@loom-code/ui-input-bar": "*",
    "@loom-code/ui-command-palette": "*",
    "@opentui/react": "*",
    "@opentui/core": "*",
    "react": "*"
  }
}
```

**Step 5: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react",
    "lib": ["ESNext", "DOM"]
  },
  "include": ["src"]
}
```

**Step 6: Create `packages/cli/src/index.ts`** (placeholder)

```typescript
// loom-code CLI — placeholder
export {}
```

**Step 7: Update root `tsconfig.json`**

Add both new packages to references. The file currently has 7 references. Add the two new ones at the end:

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/session-store" },
    { "path": "packages/provider-anthropic" },
    { "path": "packages/ui-status-bar" },
    { "path": "packages/ui-input-bar" },
    { "path": "packages/ui-attention-panel" },
    { "path": "packages/ui-chat-history" },
    { "path": "packages/ui-command-palette" },
    { "path": "packages/cli" }
  ]
}
```

**Step 8: Install and verify**

Run: `bun install`
Run: `bun run typecheck`
Expected: clean (no errors)
Run: `bun test`
Expected: 167 pass, 0 fail (baseline unchanged)

**Step 9: Commit**

```bash
git add packages/ui-command-palette packages/cli tsconfig.json bun.lock
git commit -m "chore: scaffold ui-command-palette and cli packages"
```

---

## Task 2: Implement @loom-code/ui-command-palette (full package)

**Files:**
- Create: `packages/ui-command-palette/src/types.ts`
- Create: `packages/ui-command-palette/src/state.ts`
- Create: `packages/ui-command-palette/src/CommandPalette.tsx`
- Modify: `packages/ui-command-palette/src/index.ts` (replace placeholder)
- Create: `packages/ui-command-palette/src/__tests__/palette.test.ts`

**Step 1: Create `packages/ui-command-palette/src/types.ts`**

```typescript
export interface CommandItem {
  id: string
  label: string
  description?: string
  group?: string
  action: () => void | Promise<void>
}

export interface CommandPaletteState {
  open: boolean
  query: string
  items: CommandItem[]
  filteredItems: CommandItem[]
  selectedIndex: number
}

export interface CommandPaletteProps {
  state: CommandPaletteState
  onClose?: () => void
  onExecute?: (item: CommandItem) => void
  onQueryChange?: (query: string) => void
  onSelectionChange?: (index: number) => void
}
```

**Step 2: Create `packages/ui-command-palette/src/state.ts`**

```typescript
import type { CommandItem, CommandPaletteState } from './types'

export function createInitialCommandPaletteState(items: CommandItem[] = []): CommandPaletteState {
  return {
    open: false,
    query: '',
    items,
    filteredItems: items,
    selectedIndex: 0,
  }
}

export function openPalette(state: CommandPaletteState): CommandPaletteState {
  return { ...state, open: true, query: '', filteredItems: state.items, selectedIndex: 0 }
}

export function closePalette(state: CommandPaletteState): CommandPaletteState {
  return { ...state, open: false, query: '', selectedIndex: 0 }
}

export function setQuery(state: CommandPaletteState, query: string): CommandPaletteState {
  const q = query.toLowerCase()
  const filteredItems = q.length === 0
    ? state.items
    : state.items.filter(
        item =>
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false) ||
          (item.group?.toLowerCase().includes(q) ?? false)
      )
  return { ...state, query, filteredItems, selectedIndex: 0 }
}

export function moveSelection(state: CommandPaletteState, direction: 'up' | 'down'): CommandPaletteState {
  const len = state.filteredItems.length
  if (len === 0) return state
  const next =
    direction === 'down'
      ? (state.selectedIndex + 1) % len
      : (state.selectedIndex - 1 + len) % len
  return { ...state, selectedIndex: next }
}

export function selectedItem(state: CommandPaletteState): CommandItem | undefined {
  return state.filteredItems[state.selectedIndex]
}
```

**Step 3: Create `packages/ui-command-palette/src/CommandPalette.tsx`**

Follow the same pattern as the other UI components (thin rendering, logic in state.ts).
JSX elements verified from @opentui/react: `box`, `text`.

```tsx
import type { CommandPaletteProps } from './types'

/**
 * CommandPalette — centered overlay showing fuzzy-searchable command list.
 *
 * Returns null when `state.open` is false (zero height, no render cost).
 * All business logic lives in state.ts (unit-tested).
 * This component is tested via TypeScript compilation — not runtime rendering.
 *
 * Layout when open:
 *   > query text
 *   ▸ Selected item label  description
 *     Other item label  description
 */
export function CommandPalette({ state, onExecute, onQueryChange }: CommandPaletteProps) {
  if (!state.open) return null

  return (
    <box style={{ flexDirection: 'column' }}>
      <text>{`> ${state.query}`}</text>
      {state.filteredItems.map((item, idx) => {
        const marker = idx === state.selectedIndex ? '\u25b8 ' : '  '
        const desc = item.description ? `  ${item.description}` : ''
        return <text key={item.id}>{`${marker}${item.label}${desc}`}</text>
      })}
    </box>
  )
}
```

**Step 4: Replace `packages/ui-command-palette/src/index.ts`**

```typescript
// @loom-code/ui-command-palette — Public API

// Types
export type { CommandItem, CommandPaletteState, CommandPaletteProps } from './types'

// Pure state machine
export {
  createInitialCommandPaletteState,
  openPalette,
  closePalette,
  setQuery,
  moveSelection,
  selectedItem,
} from './state'

// Component
export { CommandPalette } from './CommandPalette'
```

**Step 5: Create `packages/ui-command-palette/src/__tests__/palette.test.ts`**

```typescript
import { describe, it, expect } from 'bun:test'
import {
  createInitialCommandPaletteState,
  openPalette,
  closePalette,
  setQuery,
  moveSelection,
  selectedItem,
} from '../state'
import { CommandPalette } from '../CommandPalette'

const items = [
  { id: 'switch-model', label: 'Switch model', description: 'Change AI model', group: 'session', action: () => {} },
  { id: 'new-session', label: 'New session', description: 'Start fresh', group: 'session', action: () => {} },
  { id: 'settings', label: 'Settings', description: 'Open settings', group: 'app', action: () => {} },
]

describe('@loom-code/ui-command-palette', () => {
  it('exports CommandPalette component', () => {
    expect(typeof CommandPalette).toBe('function')
  })

  it('opens and closes correctly', () => {
    let state = createInitialCommandPaletteState(items)
    expect(state.open).toBe(false)
    state = openPalette(state)
    expect(state.open).toBe(true)
    expect(state.selectedIndex).toBe(0)
    state = closePalette(state)
    expect(state.open).toBe(false)
  })

  it('filters items by query', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    state = setQuery(state, 'session')
    // 'session' matches: switch-model (group=session), new-session (group=session)
    expect(state.filteredItems).toHaveLength(2)
    state = setQuery(state, 'new')
    expect(state.filteredItems).toHaveLength(1)
    expect(state.filteredItems[0].id).toBe('new-session')
  })

  it('empty query shows all items', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    state = setQuery(state, '')
    expect(state.filteredItems).toHaveLength(3)
  })

  it('moveSelection wraps around', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    expect(state.selectedIndex).toBe(0)
    state = moveSelection(state, 'up')
    expect(state.selectedIndex).toBe(2) // wraps to last
    state = moveSelection(state, 'down')
    expect(state.selectedIndex).toBe(0) // wraps to first
  })

  it('selectedItem returns the currently highlighted item', () => {
    let state = createInitialCommandPaletteState(items)
    state = openPalette(state)
    state = moveSelection(state, 'down')
    const item = selectedItem(state)
    expect(item?.id).toBe('new-session')
  })
})
```

**Step 6: Verify**

Run: `bun test packages/ui-command-palette`
Expected: 6 pass, 0 fail

Run: `cd packages/ui-command-palette && bunx tsc --noEmit`
Expected: clean

**Step 7: Commit**

```bash
git add packages/ui-command-palette
git commit -m "feat(@loom-code/ui-command-palette): command palette — fuzzy search state machine + component"
```

---

## Task 3: Implement `packages/cli/src/session.ts`

**Files:**
- Create: `packages/cli/src/session.ts`

This file creates a `LoomSession` and returns it. The `App.tsx` wires the `onToken`/`onToolStart`/`onToolEnd` callbacks at the `runTurn()` call site.

**Key discovery from codebase:** `LoomSession.runTurn()` accepts `{ onToken, onToolStart, onToolEnd }` callbacks directly. There is no separate hook registration step — the callbacks are passed per-turn. So `session.ts` just creates the session and `App.tsx` passes callbacks when calling `runTurn`.

**Step 1: Create `packages/cli/src/session.ts`**

```typescript
import { LoomSession } from '@loom-code/core'
import type { LoomConfig } from '@loom-code/core'
import { createAnthropicProvider } from '@loom-code/provider-anthropic'

export interface CreateSessionOptions {
  /** Override model. Defaults to MODEL env var or 'claude-sonnet-4-20250514'. */
  model?: string
  /** Override API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string
}

/**
 * Create a LoomSession wired to Anthropic.
 *
 * Reads ANTHROPIC_API_KEY and MODEL from environment.
 * Throws immediately if ANTHROPIC_API_KEY is not set.
 *
 * The returned session's `runTurn(prompt, { onToken, onToolStart, onToolEnd })`
 * is called by App.tsx with callbacks that update React state.
 */
export function createSession(options: CreateSessionOptions = {}): LoomSession {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Export it before running loom-code.')
  }

  const model = options.model ?? process.env.MODEL ?? 'claude-sonnet-4-20250514'

  const provider = createAnthropicProvider({ model, apiKey })

  const config: LoomConfig = {
    provider,
    packages: [],
  }

  return new LoomSession(config)
}
```

**Step 2: Verify**

Run: `cd packages/cli && bunx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add packages/cli/src/session.ts
git commit -m "feat(loom-code/cli): add session factory — creates LoomSession with Anthropic provider"
```

---

## Task 4: Implement `packages/cli/src/commands.ts`

**Files:**
- Create: `packages/cli/src/commands.ts`

Static data — default palette commands.

**Step 1: Create `packages/cli/src/commands.ts`**

```typescript
import type { CommandItem } from '@loom-code/ui-command-palette'

export interface CommandCallbacks {
  onNewSession?: () => void
  onClearHistory?: () => void
}

/**
 * Default command palette items.
 *
 * These show up when the user presses Ctrl-P.
 * Model switching is placeholder for now — will be wired
 * when session supports hot-swapping providers.
 */
export function createDefaultCommands(callbacks: CommandCallbacks = {}): CommandItem[] {
  return [
    {
      id: 'new-session',
      label: 'New session',
      description: 'Start a fresh conversation',
      group: 'Session',
      action: callbacks.onNewSession ?? (() => {}),
    },
    {
      id: 'clear-history',
      label: 'Clear history',
      description: 'Clear the conversation display',
      group: 'Session',
      action: callbacks.onClearHistory ?? (() => {}),
    },
    {
      id: 'switch-model-haiku',
      label: 'Switch to claude-haiku-4',
      description: 'Faster, cheaper model',
      group: 'Model',
      action: () => { /* TODO: implement model switching */ },
    },
    {
      id: 'switch-model-sonnet',
      label: 'Switch to claude-sonnet-4',
      description: 'Balanced model',
      group: 'Model',
      action: () => { /* TODO: implement model switching */ },
    },
  ]
}
```

**Step 2: Verify**

Run: `cd packages/cli && bunx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add packages/cli/src/commands.ts
git commit -m "feat(loom-code/cli): add default command palette items"
```

---

## Task 5: Implement `packages/cli/src/App.tsx`

**Files:**
- Create: `packages/cli/src/App.tsx`

This is the root layout component. It wires all 6 UI packages together with React state and the LoomSession.

**Verified facts from codebase (do NOT guess these — they were read from source):**

1. `InputBar` takes `{ initialState: InputBarState, callbacks: InputBarCallbacks, placeholder? }`
2. `StatusBar` takes `{ state: StatusBarState }` — StatusBarState is `{ model, tokenCount, sessionId }`
3. `ChatHistory` takes `{ state: ChatHistoryState, onToggleGroup?, onToggleThinking? }`
4. `AttentionPanel` takes `{ state: AttentionState, onResolve? }` — returns null when empty
5. `CommandPalette` takes `{ state: CommandPaletteState, onClose?, onExecute?, onQueryChange?, onSelectionChange? }`
6. `LoomSession.runTurn(prompt, { onToken, onToolStart, onToolEnd })` returns `Promise<string>`
7. `useKeyboard((key: KeyEvent) => void)` — KeyEvent has `.name`, `.ctrl`, `.meta`
8. No `createInitialStatusBarState` — construct `StatusBarState` directly
9. `createCliRenderer()` from `@opentui/core` is `async` — returns `Promise<CliRenderer>`
10. `createRoot(renderer: CliRenderer)` from `@opentui/react` — returns `{ render, unmount }`

**Step 1: Create `packages/cli/src/App.tsx`**

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useKeyboard } from '@opentui/react'

// State factories
import { createInitialInputBarState } from '@loom-code/ui-input-bar'
import { createInitialAttentionState } from '@loom-code/ui-attention-panel'
import {
  createInitialChatHistoryState,
  appendUserMessage,
  startAssistantStream,
  appendToken,
  finalizeStream,
  addToolCall,
  updateToolCall,
  toggleGroup,
} from '@loom-code/ui-chat-history'
import {
  createInitialCommandPaletteState,
  openPalette,
  closePalette,
  setQuery,
  moveSelection,
  selectedItem,
} from '@loom-code/ui-command-palette'

// State types
import type { StatusBarState } from '@loom-code/ui-status-bar'
import type { ChatHistoryState } from '@loom-code/ui-chat-history'
import type { AttentionState } from '@loom-code/ui-attention-panel'
import type { CommandPaletteState } from '@loom-code/ui-command-palette'

// Components
import { StatusBar } from '@loom-code/ui-status-bar'
import { AttentionPanel } from '@loom-code/ui-attention-panel'
import { ChatHistory } from '@loom-code/ui-chat-history'
import { InputBar } from '@loom-code/ui-input-bar'
import { CommandPalette } from '@loom-code/ui-command-palette'

// Session + commands
import { createSession } from './session'
import { createDefaultCommands } from './commands'

import type { LoomSession } from '@loom-code/core'

let nextMsgId = 0
function msgId(): string {
  return `msg-${++nextMsgId}`
}

/**
 * App — root layout component for the loom-code TUI.
 *
 * Layout (top to bottom):
 *   StatusBar         — 1 line: model, tokens, session ID
 *   AttentionPanel    — 0+ lines: current intent + pending items (hidden when empty)
 *   ChatHistory       — flex: conversation + tool groups
 *   InputBar          — 1 line: text input
 *   CommandPalette    — overlay (hidden when closed)
 */
export function App() {
  // ── State ──────────────────────────────────────────────────
  const [chatHistory, setChatHistory] = useState<ChatHistoryState>(createInitialChatHistoryState)
  const [attention, setAttention] = useState<AttentionState>(createInitialAttentionState)
  const [paletteState, setPaletteState] = useState<CommandPaletteState>(() =>
    createInitialCommandPaletteState(createDefaultCommands({
      onClearHistory: () => setChatHistory(createInitialChatHistoryState()),
    }))
  )
  const [statusBar, setStatusBar] = useState<StatusBarState>({
    model: process.env.MODEL ?? 'claude-sonnet-4-20250514',
    tokenCount: 0,
    sessionId: '',
  })

  // ── Session (created once at mount) ────────────────────────
  const sessionRef = useRef<LoomSession | null>(null)
  const runningRef = useRef(false)

  useEffect(() => {
    try {
      const session = createSession()
      sessionRef.current = session
      setStatusBar(prev => ({ ...prev, sessionId: session.sessionId }))
    } catch (err) {
      // Surface initialization error in attention panel
      setAttention(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            id: 'init-error',
            type: 'info' as const,
            message: `Session init failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      }))
    }
    return () => {
      sessionRef.current?.cleanup()
    }
  }, [])

  // ── Submit handler ─────────────────────────────────────────
  const handleSubmit = useCallback(async (text: string) => {
    const session = sessionRef.current
    if (!session || runningRef.current) return
    runningRef.current = true

    // Add user message to chat history
    const userId = msgId()
    setChatHistory(prev => appendUserMessage(prev, userId, text))

    // Start assistant streaming placeholder
    const assistantId = msgId()
    setChatHistory(prev => startAssistantStream(prev, assistantId))

    try {
      await session.runTurn(text, {
        onToken: (delta: string) => {
          setChatHistory(prev => appendToken(prev, delta))
        },
        onToolStart: (name: string) => {
          const toolId = msgId()
          setChatHistory(prev => addToolCall(prev, toolId, name))
        },
        onToolEnd: (_name: string, success: boolean, output: string) => {
          // Update the most recent running tool call
          setChatHistory(prev => {
            for (let i = prev.items.length - 1; i >= 0; i--) {
              const item = prev.items[i]
              if (item.type === 'tool-group') {
                const runningCall = item.group.calls.find(c => c.status === 'running')
                if (runningCall) {
                  return updateToolCall(
                    prev,
                    runningCall.id,
                    success ? 'success' : 'error',
                    success ? output : undefined,
                    success ? undefined : output,
                  )
                }
              }
            }
            return prev
          })
        },
      })
    } catch (err) {
      // Append error as assistant text
      setChatHistory(prev =>
        appendToken(prev, `\n\nError: ${err instanceof Error ? err.message : String(err)}`)
      )
    } finally {
      setChatHistory(prev => finalizeStream(prev))
      runningRef.current = false
    }
  }, [])

  // ── Keyboard (Ctrl-P for command palette) ──────────────────
  useKeyboard((key) => {
    if (key.ctrl && key.name === 'p') {
      setPaletteState(prev => prev.open ? closePalette(prev) : openPalette(prev))
      return
    }

    // When palette is open, handle navigation
    if (paletteState.open) {
      if (key.name === 'escape') {
        setPaletteState(prev => closePalette(prev))
      } else if (key.name === 'up') {
        setPaletteState(prev => moveSelection(prev, 'up'))
      } else if (key.name === 'down') {
        setPaletteState(prev => moveSelection(prev, 'down'))
      } else if (key.name === 'return') {
        const item = selectedItem(paletteState)
        if (item) {
          item.action()
          setPaletteState(prev => closePalette(prev))
        }
      }
    }
  })

  // ── Layout ─────────────────────────────────────────────────
  return (
    <box style={{ flexDirection: 'column', height: '100%' }}>
      <StatusBar state={statusBar} />
      <AttentionPanel state={attention} />
      <box style={{ flexGrow: 1 }}>
        <ChatHistory
          state={chatHistory}
          onToggleGroup={(groupId) => setChatHistory(prev => toggleGroup(prev, groupId))}
        />
      </box>
      <InputBar
        initialState={createInitialInputBarState()}
        callbacks={{ onSubmit: handleSubmit }}
      />
      <CommandPalette state={paletteState} />
    </box>
  )
}
```

**Step 2: Verify**

Run: `cd packages/cli && bunx tsc --noEmit`
Expected: clean

If there are type errors with `flexGrow: 1` or `height: '100%'`, check the @opentui/react JSX type definitions and adjust accordingly (e.g., the style prop type may use Yoga layout props). Fix any such issues before proceeding.

**Step 3: Commit**

```bash
git add packages/cli/src/App.tsx
git commit -m "feat(loom-code/cli): add App root layout — wires all 6 UI packages with session"
```

---

## Task 6: Implement `packages/cli/src/index.ts` entry point

**Files:**
- Modify: `packages/cli/src/index.ts` (replace placeholder)

**Verified:** `createCliRenderer()` is async (returns `Promise<CliRenderer>`), `createRoot(renderer)` returns `{ render, unmount }`.

**Step 1: Replace `packages/cli/src/index.ts`**

```tsx
#!/usr/bin/env bun
/**
 * loom-code — TUI entry point.
 *
 * Creates the @opentui/core CliRenderer (Zig double-buffered cell grid),
 * passes it to @opentui/react's createRoot, and renders <App />.
 */
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false, // We handle Ctrl-C ourselves for cancellation
  })

  const root = createRoot(renderer)
  root.render(<App />)
}

main().catch((err) => {
  console.error('loom-code failed to start:', err)
  process.exit(1)
})
```

**Step 2: Verify**

Run: `cd packages/cli && bunx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(loom-code/cli): add entry point — createCliRenderer + createRoot + App"
```

---

## Task 7: Add smoke tests + full workspace verification

**Files:**
- Create: `packages/cli/src/__tests__/cli.test.ts`

**Step 1: Create `packages/cli/src/__tests__/cli.test.ts`**

```typescript
import { describe, it, expect } from 'bun:test'
import { createSession } from '../session'
import { createDefaultCommands } from '../commands'

describe('loom-code cli', () => {
  it('createDefaultCommands returns an array of CommandItems', () => {
    const commands = createDefaultCommands({})
    expect(Array.isArray(commands)).toBe(true)
    expect(commands.length).toBeGreaterThan(0)
    expect(typeof commands[0].label).toBe('string')
    expect(typeof commands[0].action).toBe('function')
  })

  it('createSession throws when ANTHROPIC_API_KEY is not set', () => {
    const savedKey = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      expect(() => createSession({ apiKey: undefined })).toThrow('ANTHROPIC_API_KEY')
    } finally {
      if (savedKey) process.env.ANTHROPIC_API_KEY = savedKey
    }
  })
})
```

**Step 2: Run package tests**

Run: `bun test packages/cli`
Expected: 2 pass, 0 fail

**Step 3: Run full workspace tests**

Run: `bun test`
Expected: **175 pass, 0 fail** (167 baseline + 6 command-palette + 2 cli)

Run: `bun run typecheck`
Expected: clean

**Step 4: Commit and push**

```bash
git add packages/cli/src/__tests__
git commit -m "feat(loom-code/cli): add smoke tests — 175 total pass"
git push origin main
```

---

## Task 8: Real CLI smoke test

This is the real verification — run the actual TUI in a terminal.

**Step 1: Run the CLI**

```bash
cd /Users/ken/workspace/ms/loom-code
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY bun run packages/cli/src/index.ts
```

**Expected:** The terminal switches to the alternate screen and renders the loom-code TUI:

```
claude-sonnet-4-20250514  0 tokens  #<sessionid>
▸ _
```

**Step 2: Test interaction**

Type a simple message (e.g., "say hello") and press Enter. Expected:
- The user message appears: `You   say hello`
- An assistant streaming indicator appears
- Tokens stream in one by one: `AI    Hello!...`
- The stream finalizes (cursor block disappears)

**Step 3: Test Ctrl-P**

Press Ctrl-P. Expected: command palette overlay appears with the 4 default items.
Press Escape. Expected: palette closes.

**Step 4: Report results**

Report what actually renders and whether the TUI works end-to-end. If there are rendering issues (style props, layout), note them for a quick follow-up fix. The TypeScript compilation was the primary check — runtime rendering may need minor @opentui style adjustments.

---

## Summary

| Task | What | Tests added | Running total |
|------|------|-------------|---------------|
| 1 | Scaffold packages + root tsconfig | 0 | 167 |
| 2 | ui-command-palette (full package) | 6 | 173 |
| 3 | cli/session.ts | 0 | 173 |
| 4 | cli/commands.ts | 0 | 173 |
| 5 | cli/App.tsx | 0 | 173 |
| 6 | cli/index.ts entry point | 0 | 173 |
| 7 | Smoke tests + full verification | 2 | **175** |
| 8 | Real CLI smoke test | 0 | 175 |
