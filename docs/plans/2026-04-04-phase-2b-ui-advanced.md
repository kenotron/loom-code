# Phase 2B: ui-attention-panel + ui-chat-history

> **Execution:** Use the subagent-driven-development workflow to implement this plan.

**Goal:** Implement the two remaining UI packages needed before CLI assembly — the attention panel (hook-driven, shows current intent + pending approvals) and the chat history (progressive disclosure, grouped tool calls, streaming token updates).

**Architecture:** Pure state machine functions (fully testable) extracted from thin `@opentui/react` components (TypeScript-compiled only). Verification = TypeScript compilation + one integration test per package exercising the full state flow. No per-function TDD cycle — the type system is the primary correctness check.

**Tech Stack:** Bun workspaces, TypeScript ESNext, `@opentui/react` v0.1.96, `bun:test` for integration tests.

---

## Prerequisites

1. **Phase 1 + 2A complete** — 157 tests passing, `bun run typecheck` exits 0
2. **Workspace:** `/Users/ken/workspace/ms/loom-code` on branch `main` at commit `6b09b5c`
3. Existing packages: `core/`, `session-store/`, `provider-anthropic/`, `ui-status-bar/`, `ui-input-bar/`
4. `@kenotron-ms/amplifier-core@1.3.4` on npm (replaces `file:` dep)

## Verified Patterns (from existing UI packages)

### package.json (copied from `packages/ui-status-bar/package.json`)
```json
{
  "name": "@loom-code/ui-status-bar",
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

### tsconfig.json (copied from `packages/ui-status-bar/tsconfig.json`)
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

### Root tsconfig.json references (must be updated)
Currently has 5 entries. Add both new packages.

### Test conventions
- Use `import { describe, it, expect } from 'bun:test'`
- Tests live in `src/__tests__/`
- Import from barrel `../index` for integration tests

### JSX intrinsic elements available
`<text>`, `<box>`, `<scrollbox>`, `<input>`, `<select>`, `<textarea>`, `<code>`, `<diff>`, `<markdown>`

### Component pattern
Thin JSX wrappers calling pure state functions. React hooks (`useState`, `useCallback`) from `react`, NOT from `@opentui/react`.

---

## Task 1: Scaffold both packages + update root tsconfig

**Files:**
- Create: `packages/ui-attention-panel/package.json`
- Create: `packages/ui-attention-panel/tsconfig.json`
- Create: `packages/ui-attention-panel/src/index.ts` (empty placeholder)
- Create: `packages/ui-attention-panel/src/types.ts` (empty placeholder)
- Create: `packages/ui-attention-panel/src/state.ts` (empty placeholder)
- Create: `packages/ui-attention-panel/src/AttentionPanel.tsx` (empty placeholder)
- Create: `packages/ui-attention-panel/src/__tests__/.gitkeep`
- Create: `packages/ui-chat-history/package.json`
- Create: `packages/ui-chat-history/tsconfig.json`
- Create: `packages/ui-chat-history/src/index.ts` (empty placeholder)
- Create: `packages/ui-chat-history/src/types.ts` (empty placeholder)
- Create: `packages/ui-chat-history/src/state.ts` (empty placeholder)
- Create: `packages/ui-chat-history/src/group.ts` (empty placeholder)
- Create: `packages/ui-chat-history/src/ChatHistory.tsx` (empty placeholder)
- Create: `packages/ui-chat-history/src/__tests__/.gitkeep`
- Modify: `tsconfig.json` (root — add two references)

**Step 1: Create `packages/ui-attention-panel/package.json`**

```json
{
  "name": "@loom-code/ui-attention-panel",
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

**Step 2: Create `packages/ui-attention-panel/tsconfig.json`**

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

**Step 3: Create empty placeholder files for ui-attention-panel**

Create these files with minimal content so TypeScript doesn't error:

`packages/ui-attention-panel/src/types.ts`:
```typescript
// Placeholder — implemented in Task 2
export {}
```

`packages/ui-attention-panel/src/state.ts`:
```typescript
// Placeholder — implemented in Task 2
export {}
```

`packages/ui-attention-panel/src/AttentionPanel.tsx`:
```tsx
// Placeholder — implemented in Task 2
export {}
```

`packages/ui-attention-panel/src/index.ts`:
```typescript
// @loom-code/ui-attention-panel — Placeholder
export {}
```

`packages/ui-attention-panel/src/__tests__/.gitkeep`: (empty file)

**Step 4: Create `packages/ui-chat-history/package.json`**

```json
{
  "name": "@loom-code/ui-chat-history",
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

**Step 5: Create `packages/ui-chat-history/tsconfig.json`**

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

**Step 6: Create empty placeholder files for ui-chat-history**

`packages/ui-chat-history/src/types.ts`:
```typescript
// Placeholder — implemented in Task 3
export {}
```

`packages/ui-chat-history/src/state.ts`:
```typescript
// Placeholder — implemented in Task 3
export {}
```

`packages/ui-chat-history/src/group.ts`:
```typescript
// Placeholder — implemented in Task 4
export {}
```

`packages/ui-chat-history/src/ChatHistory.tsx`:
```tsx
// Placeholder — implemented in Task 4
export {}
```

`packages/ui-chat-history/src/index.ts`:
```typescript
// @loom-code/ui-chat-history — Placeholder
export {}
```

`packages/ui-chat-history/src/__tests__/.gitkeep`: (empty file)

**Step 7: Update root `tsconfig.json` to add both new packages**

The current content of `/Users/ken/workspace/ms/loom-code/tsconfig.json` is:
```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/session-store" },
    { "path": "packages/provider-anthropic" },
    { "path": "packages/ui-status-bar" },
    { "path": "packages/ui-input-bar" }
  ]
}
```

Replace with:
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
    { "path": "packages/ui-chat-history" }
  ]
}
```

**Step 8: Verify scaffold compiles**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code && bun install && bun run typecheck
```
Expected: exit 0, no errors

**Step 9: Verify existing tests still pass**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code && bun test
```
Expected: 157 pass, 0 fail

**Step 10: Commit**

```bash
cd /Users/ken/workspace/ms/loom-code
git add packages/ui-attention-panel packages/ui-chat-history tsconfig.json bun.lock
git commit -m "chore: scaffold ui-attention-panel and ui-chat-history packages"
```

---

## Task 2: Implement @loom-code/ui-attention-panel (all files)

**Files:**
- Modify: `packages/ui-attention-panel/src/types.ts`
- Modify: `packages/ui-attention-panel/src/state.ts`
- Modify: `packages/ui-attention-panel/src/AttentionPanel.tsx`
- Modify: `packages/ui-attention-panel/src/index.ts`
- Create: `packages/ui-attention-panel/src/__tests__/attention.test.ts`

**Step 1: Write `packages/ui-attention-panel/src/types.ts`**

Replace the placeholder with:

```typescript
export type AttentionItemType = 'approval' | 'clarification' | 'info'

export interface AttentionItem {
  id: string
  type: AttentionItemType
  message: string
  resolvedAt?: number
}

export interface AttentionState {
  items: AttentionItem[]
  intent: string | null
}

export interface AttentionPanelProps {
  state: AttentionState
  onResolve?: (id: string) => void
}
```

**Step 2: Write `packages/ui-attention-panel/src/state.ts`**

Replace the placeholder with:

```typescript
import type { AttentionItem, AttentionState } from './types'

export function createInitialAttentionState(): AttentionState {
  return { items: [], intent: null }
}

export function addItem(state: AttentionState, item: AttentionItem): AttentionState {
  return { ...state, items: [...state.items, item] }
}

export function resolveItem(state: AttentionState, id: string): AttentionState {
  return {
    ...state,
    items: state.items.map(item =>
      item.id === id ? { ...item, resolvedAt: Date.now() } : item
    ),
  }
}

export function dismissItem(state: AttentionState, id: string): AttentionState {
  return { ...state, items: state.items.filter(item => item.id !== id) }
}

export function updateIntent(state: AttentionState, intent: string): AttentionState {
  return { ...state, intent }
}

export function pendingItems(state: AttentionState): AttentionItem[] {
  return state.items.filter(item => item.resolvedAt === undefined)
}

export function isEmpty(state: AttentionState): boolean {
  return pendingItems(state).length === 0
}
```

**Step 3: Write `packages/ui-attention-panel/src/AttentionPanel.tsx`**

Replace the placeholder with:

```tsx
import { pendingItems, isEmpty } from './state'
import type { AttentionPanelProps } from './types'

/**
 * AttentionPanel — shows current intent + pending items needing user action.
 * Renders nothing when isEmpty(state) is true.
 * Tested via TypeScript compilation + attention.test.ts integration.
 */
export function AttentionPanel({ state, onResolve }: AttentionPanelProps) {
  if (isEmpty(state)) return null

  return (
    <box style={{ flexDirection: 'column', borderStyle: 'single', padding: 1 }}>
      {state.intent && <text>{state.intent}</text>}
      {pendingItems(state).map(item => (
        <text key={item.id}>
          {item.type === 'approval' ? '\u23f3' : '\u2139'} {item.message}
        </text>
      ))}
    </box>
  )
}
```

**Step 4: Write `packages/ui-attention-panel/src/index.ts`**

Replace the placeholder with:

```typescript
// @loom-code/ui-attention-panel — Public API

// Types
export type { AttentionItem, AttentionItemType, AttentionState, AttentionPanelProps } from './types'

// Pure state functions
export {
  createInitialAttentionState,
  addItem,
  resolveItem,
  dismissItem,
  updateIntent,
  pendingItems,
  isEmpty,
} from './state'

// Component
export { AttentionPanel } from './AttentionPanel'
```

**Step 5: Write `packages/ui-attention-panel/src/__tests__/attention.test.ts`**

```typescript
import { describe, it, expect } from 'bun:test'
import {
  createInitialAttentionState,
  addItem,
  resolveItem,
  dismissItem,
  updateIntent,
  pendingItems,
  isEmpty,
  AttentionPanel,
} from '../index'

describe('@loom-code/ui-attention-panel', () => {
  it('exports AttentionPanel component', () => {
    expect(typeof AttentionPanel).toBe('function')
  })

  it('full state flow: add -> resolve -> isEmpty', () => {
    let state = createInitialAttentionState()
    expect(isEmpty(state)).toBe(true)

    state = addItem(state, { id: 'a1', type: 'approval', message: 'Review changes?' })
    expect(isEmpty(state)).toBe(false)
    expect(pendingItems(state)).toHaveLength(1)

    state = resolveItem(state, 'a1')
    expect(isEmpty(state)).toBe(true)
    expect(pendingItems(state)).toHaveLength(0)
  })

  it('updateIntent sets the current intent string', () => {
    let state = createInitialAttentionState()
    state = updateIntent(state, 'Refactor login flow')
    expect(state.intent).toBe('Refactor login flow')
  })

  it('dismissItem removes item entirely', () => {
    let state = createInitialAttentionState()
    state = addItem(state, { id: 'b1', type: 'info', message: 'FYI' })
    state = dismissItem(state, 'b1')
    expect(state.items).toHaveLength(0)
  })
})
```

**Step 6: Verify TypeScript compilation**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code/packages/ui-attention-panel && bunx tsc --noEmit
```
Expected: exit 0, no errors

**Step 7: Run integration test**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code && bun test packages/ui-attention-panel
```
Expected: 4 pass, 0 fail

**Step 8: Commit**

```bash
cd /Users/ken/workspace/ms/loom-code
git add packages/ui-attention-panel
git commit -m "feat(@loom-code/ui-attention-panel): implement attention panel — state machine + component + barrel"
```

---

## Task 3: Implement ui-chat-history types + state

**Files:**
- Modify: `packages/ui-chat-history/src/types.ts`
- Modify: `packages/ui-chat-history/src/state.ts`

**Step 1: Write `packages/ui-chat-history/src/types.ts`**

Replace the placeholder with:

```typescript
export type ToolStatus = 'running' | 'success' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ToolCallRow {
  id: string
  toolName: string
  status: ToolStatus
  input?: unknown
  output?: string
  error?: string
  durationMs?: number
  startedAt: number
}

export interface ToolGroup {
  id: string
  toolName: string
  calls: ToolCallRow[]
  collapsed: boolean
}

export type DisplayItem =
  | { type: 'user-message'; id: string; message: ChatMessage }
  | { type: 'assistant-text'; id: string; content: string; streaming: boolean }
  | { type: 'tool-group'; id: string; group: ToolGroup }
  | { type: 'thinking'; id: string; content: string; durationMs: number; collapsed: boolean }

export interface ChatHistoryState {
  items: DisplayItem[]
  streamingItemId: string | null
}

export interface ChatHistoryProps {
  state: ChatHistoryState
  onToggleGroup?: (groupId: string) => void
  onToggleThinking?: (itemId: string) => void
}
```

**Step 2: Write `packages/ui-chat-history/src/state.ts`**

Replace the placeholder with:

```typescript
import type { ChatHistoryState, DisplayItem, ToolStatus } from './types'

export function createInitialChatHistoryState(): ChatHistoryState {
  return { items: [], streamingItemId: null }
}

export function appendUserMessage(
  state: ChatHistoryState,
  id: string,
  content: string
): ChatHistoryState {
  const msg: DisplayItem = {
    type: 'user-message',
    id,
    message: { id, role: 'user', content, timestamp: Date.now() },
  }
  return { ...state, items: [...state.items, msg] }
}

export function startAssistantStream(
  state: ChatHistoryState,
  id: string
): ChatHistoryState {
  const item: DisplayItem = {
    type: 'assistant-text',
    id,
    content: '',
    streaming: true,
  }
  return { items: [...state.items, item], streamingItemId: id }
}

export function appendToken(
  state: ChatHistoryState,
  token: string
): ChatHistoryState {
  if (!state.streamingItemId) return state
  return {
    ...state,
    items: state.items.map(item =>
      item.id === state.streamingItemId && item.type === 'assistant-text'
        ? { ...item, content: item.content + token }
        : item
    ),
  }
}

export function finalizeStream(state: ChatHistoryState): ChatHistoryState {
  return {
    items: state.items.map(item =>
      item.id === state.streamingItemId && item.type === 'assistant-text'
        ? { ...item, streaming: false }
        : item
    ),
    streamingItemId: null,
  }
}

export function addToolCall(
  state: ChatHistoryState,
  id: string,
  toolName: string
): ChatHistoryState {
  const row = {
    id,
    toolName,
    status: 'running' as ToolStatus,
    startedAt: Date.now(),
  }
  // Try to append to last tool-group with same toolName
  const items = [...state.items]
  const last = items[items.length - 1]
  if (last?.type === 'tool-group' && last.group.toolName === toolName) {
    items[items.length - 1] = {
      ...last,
      group: { ...last.group, calls: [...last.group.calls, row] },
    }
    return { ...state, items }
  }
  // New group
  const groupItem: DisplayItem = {
    type: 'tool-group',
    id: `group-${id}`,
    group: {
      id: `group-${id}`,
      toolName,
      calls: [row],
      collapsed: false,
    },
  }
  return { ...state, items: [...items, groupItem] }
}

export function updateToolCall(
  state: ChatHistoryState,
  id: string,
  status: ToolStatus,
  output?: string,
  error?: string
): ChatHistoryState {
  return {
    ...state,
    items: state.items.map(item => {
      if (item.type !== 'tool-group') return item
      const calls = item.group.calls.map(call =>
        call.id === id
          ? {
              ...call,
              status,
              output,
              error,
              durationMs: Date.now() - call.startedAt,
            }
          : call
      )
      return { ...item, group: { ...item.group, calls } }
    }),
  }
}

export function toggleGroup(
  state: ChatHistoryState,
  groupId: string
): ChatHistoryState {
  return {
    ...state,
    items: state.items.map(item =>
      item.type === 'tool-group' && item.group.id === groupId
        ? {
            ...item,
            group: { ...item.group, collapsed: !item.group.collapsed },
          }
        : item
    ),
  }
}
```

**Step 3: Verify types + state compile**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code/packages/ui-chat-history && bunx tsc --noEmit
```
Expected: exit 0

**Step 4: Commit**

```bash
cd /Users/ken/workspace/ms/loom-code
git add packages/ui-chat-history/src/types.ts packages/ui-chat-history/src/state.ts
git commit -m "feat(@loom-code/ui-chat-history): add types and state machine"
```

---

## Task 4: Implement group.ts + ChatHistory.tsx + barrel + test

**Files:**
- Modify: `packages/ui-chat-history/src/group.ts`
- Modify: `packages/ui-chat-history/src/ChatHistory.tsx`
- Modify: `packages/ui-chat-history/src/index.ts`
- Create: `packages/ui-chat-history/src/__tests__/chat-history.test.ts`

**Step 1: Write `packages/ui-chat-history/src/group.ts`**

Replace the placeholder with:

```typescript
import type { DisplayItem } from './types'

/**
 * groupConsecutiveToolCalls — merges consecutive DisplayItems for the same
 * tool into a single tool-group. Already handled inline in state.ts addToolCall,
 * but this pure function is available for reconstructing display from raw messages.
 *
 * Input:  array of display items (possibly ungrouped)
 * Output: array where consecutive same-tool items are merged into tool-groups
 */
export function groupConsecutiveToolCalls(items: DisplayItem[]): DisplayItem[] {
  const result: DisplayItem[] = []
  for (const item of items) {
    if (item.type !== 'tool-group') {
      result.push(item)
      continue
    }
    const last = result[result.length - 1]
    if (
      last?.type === 'tool-group' &&
      last.group.toolName === item.group.toolName
    ) {
      // Merge into existing group
      result[result.length - 1] = {
        ...last,
        group: {
          ...last.group,
          calls: [...last.group.calls, ...item.group.calls],
        },
      }
    } else {
      result.push(item)
    }
  }
  return result
}
```

**Step 2: Write `packages/ui-chat-history/src/ChatHistory.tsx`**

Replace the placeholder with:

```tsx
import type { ChatHistoryProps } from './types'

/**
 * ChatHistory — renders the conversation with progressive disclosure.
 *
 * Collapsed tool groups show: "icon tool_name  N calls  arrow"
 * Expanded groups show each call individually.
 * Streaming assistant text updates in-place via OpenTUI cell diffs.
 *
 * Tested via TypeScript compilation + chat-history.test.ts integration.
 */
export function ChatHistory({ state, onToggleGroup }: ChatHistoryProps) {
  return (
    <scrollbox style={{ flexDirection: 'column' }}>
      {state.items.map(item => {
        switch (item.type) {
          case 'user-message':
            return (
              <box key={item.id} style={{ flexDirection: 'row' }}>
                <text>You  </text>
                <text>{item.message.content}</text>
              </box>
            )
          case 'assistant-text':
            return (
              <box key={item.id} style={{ flexDirection: 'row' }}>
                <text>AI   </text>
                <text>
                  {item.content}
                  {item.streaming ? '\u258c' : ''}
                </text>
              </box>
            )
          case 'tool-group': {
            const { group } = item
            const allDone = group.calls.every(c => c.status !== 'running')
            const hasError = group.calls.some(c => c.status === 'error')
            const icon = hasError ? '\u2717' : allDone ? '\u2713' : '\u2847'
            const count = group.calls.length
            const summary = `${icon} ${group.toolName}  ${count} ${count === 1 ? 'call' : 'calls'}`
            return (
              <box key={item.id} style={{ flexDirection: 'column' }}>
                <text>
                  {summary} {group.collapsed ? '\u25b6' : '\u25bc'}
                </text>
                {!group.collapsed &&
                  group.calls.map(call => (
                    <text key={call.id}>
                      {'  '}
                      {call.status === 'running'
                        ? '\u2847'
                        : call.status === 'success'
                          ? '\u2713'
                          : '\u2717'}
                      {' '}
                      {call.toolName}
                      {call.error ? `  ${call.error}` : ''}
                    </text>
                  ))}
              </box>
            )
          }
          case 'thinking':
            return (
              <text key={item.id}>
                \u25ce thought for {(item.durationMs / 1000).toFixed(1)}s{' '}
                {item.collapsed ? '\u25b6' : '\u25bc'}
              </text>
            )
        }
      })}
    </scrollbox>
  )
}
```

**Step 3: Write `packages/ui-chat-history/src/index.ts`**

Replace the placeholder with:

```typescript
// @loom-code/ui-chat-history — Public API

// Types
export type {
  ChatMessage,
  ToolCallRow,
  ToolGroup,
  DisplayItem,
  ChatHistoryState,
  ChatHistoryProps,
  ToolStatus,
} from './types'

// Pure state functions
export {
  createInitialChatHistoryState,
  appendUserMessage,
  startAssistantStream,
  appendToken,
  finalizeStream,
  addToolCall,
  updateToolCall,
  toggleGroup,
} from './state'

// Grouping utility
export { groupConsecutiveToolCalls } from './group'

// Component
export { ChatHistory } from './ChatHistory'
```

**Step 4: Write `packages/ui-chat-history/src/__tests__/chat-history.test.ts`**

```typescript
import { describe, it, expect } from 'bun:test'
import {
  createInitialChatHistoryState,
  appendUserMessage,
  startAssistantStream,
  appendToken,
  finalizeStream,
  addToolCall,
  updateToolCall,
  toggleGroup,
  ChatHistory,
} from '../index'

describe('@loom-code/ui-chat-history', () => {
  it('exports ChatHistory component', () => {
    expect(typeof ChatHistory).toBe('function')
  })

  it('full conversation flow: user -> stream -> tool -> complete', () => {
    let state = createInitialChatHistoryState()
    expect(state.items).toHaveLength(0)

    // User sends message
    state = appendUserMessage(state, 'u1', 'refactor the login flow')
    expect(state.items).toHaveLength(1)
    expect(state.items[0].type).toBe('user-message')

    // AI starts streaming
    state = startAssistantStream(state, 'a1')
    expect(state.streamingItemId).toBe('a1')
    state = appendToken(state, "I'll ")
    state = appendToken(state, 'start by reading...')
    const streamItem = state.items.find(i => i.id === 'a1')!
    expect(streamItem.type).toBe('assistant-text')
    if (streamItem.type === 'assistant-text') {
      expect(streamItem.content).toBe("I'll start by reading...")
      expect(streamItem.streaming).toBe(true)
    }

    // Tool call
    state = addToolCall(state, 't1', 'read_file')
    state = addToolCall(state, 't2', 'read_file') // same tool -> groups
    const toolGroup = state.items.find(i => i.type === 'tool-group')
    expect(toolGroup).toBeDefined()
    if (toolGroup?.type === 'tool-group') {
      expect(toolGroup.group.calls).toHaveLength(2)
      expect(toolGroup.group.toolName).toBe('read_file')
    }

    // Tool resolves
    state = updateToolCall(state, 't1', 'success', 'file content here')
    state = updateToolCall(state, 't2', 'success', 'other file content')

    // AI finalizes stream
    state = finalizeStream(state)
    expect(state.streamingItemId).toBeNull()
    const finalItem = state.items.find(i => i.id === 'a1')!
    if (finalItem.type === 'assistant-text') {
      expect(finalItem.streaming).toBe(false)
    }
  })

  it('consecutive same-tool calls merge into one group', () => {
    let state = createInitialChatHistoryState()
    state = addToolCall(state, 't1', 'bash')
    state = addToolCall(state, 't2', 'bash')
    state = addToolCall(state, 't3', 'bash')

    const groups = state.items.filter(i => i.type === 'tool-group')
    expect(groups).toHaveLength(1)
    if (groups[0].type === 'tool-group') {
      expect(groups[0].group.calls).toHaveLength(3)
    }
  })

  it('different tools create separate groups', () => {
    let state = createInitialChatHistoryState()
    state = addToolCall(state, 't1', 'read_file')
    state = addToolCall(state, 't2', 'bash') // different tool

    const groups = state.items.filter(i => i.type === 'tool-group')
    expect(groups).toHaveLength(2)
  })

  it('toggleGroup collapses and expands a group', () => {
    let state = createInitialChatHistoryState()
    state = addToolCall(state, 't1', 'bash')
    const groupItem = state.items.find(i => i.type === 'tool-group')!
    const groupId =
      groupItem.type === 'tool-group' ? groupItem.group.id : ''

    state = toggleGroup(state, groupId)
    const collapsed = state.items.find(i => i.type === 'tool-group')
    expect(
      collapsed?.type === 'tool-group' && collapsed.group.collapsed
    ).toBe(true)

    state = toggleGroup(state, groupId)
    const expanded = state.items.find(i => i.type === 'tool-group')
    expect(
      expanded?.type === 'tool-group' && expanded.group.collapsed
    ).toBe(false)
  })
})
```

**Step 5: Verify TypeScript compilation**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code/packages/ui-chat-history && bunx tsc --noEmit
```
Expected: exit 0

**Step 6: Run integration test**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code && bun test packages/ui-chat-history
```
Expected: 5 pass, 0 fail

**Step 7: Commit**

```bash
cd /Users/ken/workspace/ms/loom-code
git add packages/ui-chat-history
git commit -m "feat(@loom-code/ui-chat-history): implement chat history — grouping, streaming, component, barrel"
```

---

## Task 5: Full workspace verification + push

**Step 1: Run all tests**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code && bun test
```
Expected: 157 + 4 + 5 = **166 pass, 0 fail**

**Step 2: Run full typecheck**

Run:
```bash
cd /Users/ken/workspace/ms/loom-code && bun run typecheck
```
Expected: exit 0

**Step 3: Commit if anything uncommitted**

```bash
cd /Users/ken/workspace/ms/loom-code
git status
# If anything uncommitted:
git add -A && git commit -m "chore: Phase 2B complete — ui-attention-panel + ui-chat-history"
```

**Step 4: Push**

```bash
cd /Users/ken/workspace/ms/loom-code && git push origin main
```
