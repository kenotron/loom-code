# Phase 2A: OpenTUI Setup + Provider + UI Foundation

> **Execution:** Use the subagent-driven-development workflow to implement this plan.

**Goal:** Install OpenTUI and Anthropic SDK workspace-wide, implement `@loom-code/provider-anthropic` wrapping the Anthropic SDK as a `LoomProvider`, and scaffold the first two UI packages (`@loom-code/ui-status-bar` and `@loom-code/ui-input-bar`) using `@opentui/react`.

**Architecture:** Pure TypeScript packages following Phase 1 patterns. UI components use `@opentui/react` for terminal rendering with Zig double-buffered cell grids. UI packages are tested via pure state/format functions extracted from components — no terminal rendering in tests. The provider wraps the Anthropic SDK into the `LoomProvider` interface from `@loom-code/core`.

**Tech Stack:** Bun 1.3+ workspaces, TypeScript ESNext, `@opentui/react` (JSX + `react-jsx` + Zig renderer), `@anthropic-ai/sdk`, `bun:test`

---

## Prerequisites

1. **Phase 1 complete** — 103 tests passing, `bun run typecheck` exits 0
2. **Workspace:** `/Users/ken/workspace/ms/loom-code` on branch `main` at commit `148ed2c`
3. `node_modules/` does **not** exist yet — `bun install` has never been run from root
4. Existing packages: `packages/core/` (`@loom-code/core`) and `packages/session-store/` (`@loom-code/session-store`)

## Key API Facts (verified from exploration)

### LoomProvider interface (from `packages/core/src/types.ts`)
```typescript
export interface LoomProvider {
  model: string
  createClient: () => unknown
  apiKey?: string
}
```

### @opentui/react API (from official docs at opentui.com)
- **Imports:** `createRoot` from `@opentui/react`, `createCliRenderer` from `@opentui/core`
- **React hooks:** `useState`, `useCallback`, `useEffect` come from `react` — NOT from `@opentui/react`
- **OpenTUI hooks:** `useRenderer`, `useKeyboard`, `useOnResize`, `useTerminalDimensions` from `@opentui/react`
- **JSX intrinsic elements:** `<text>`, `<box>`, `<input>`, `<scrollbox>`, `<select>`, `<textarea>`, `<code>`, `<diff>`, `<markdown>`
- **`<input>` props:** `placeholder`, `onInput`, `onSubmit`, `focused` — no `value` prop (uncontrolled)
- **tsconfig:** `"jsx": "react-jsx"`, `"jsxImportSource": "@opentui/react"`, `"lib": ["ESNext", "DOM"]`

### Root config
- `bunfig.toml`: `exact = true` — all versions pinned exactly
- `tsconfig.base.json`: `types: ["bun-types"]`, `moduleResolution: "bundler"`
- Root `tsconfig.json`: `references` array must be updated for each new package

---

## Group A: Workspace Setup (Tasks 1-2)

### Task 1: Install workspace dependencies

**Files:**
- Modify: `package.json` (bun updates this automatically)
- Create: `bun.lock` (updated), `node_modules/` (created)

**Step 1: Install all Phase 2A dependencies at workspace root**

```bash
cd /Users/ken/workspace/ms/loom-code
bun add @anthropic-ai/sdk @opentui/react @opentui/core react
bun add -d @types/react
```

**Step 2: Verify Phase 1 tests still pass after install**

```bash
bun test
```
Expected: `103 pass, 0 fail`

**Step 3: Verify new packages are importable**

```bash
bun run -e "import('@opentui/react').then(() => console.log('opentui/react ok')).catch(e => { console.error('FAIL:', e.message); process.exit(1) })"
bun run -e "import('@opentui/core').then(() => console.log('opentui/core ok')).catch(e => { console.error('FAIL:', e.message); process.exit(1) })"
bun run -e "import('@anthropic-ai/sdk').then(() => console.log('anthropic sdk ok')).catch(e => { console.error('FAIL:', e.message); process.exit(1) })"
```
Expected: all three print `ok`

**Step 4: Commit**
```bash
git add package.json bun.lock
git commit -m "chore: install OpenTUI and Anthropic SDK workspace dependencies"
```

---

### Task 2: OpenTUI smoke test

**Files:**
- Create: `scripts/smoke-opentui.ts`

**Step 1: Create smoke test file**

Create `scripts/smoke-opentui.ts`:
```typescript
/**
 * Smoke test: verify @opentui/react and @opentui/core are importable
 * and key exports exist.
 *
 * This is an IMPORT-ONLY test — no rendering to terminal.
 * JSX compilation is verified later when UI packages are typechecked.
 */

// Verify core is importable
const opentuiCore = await import('@opentui/core')
console.log('✓ @opentui/core importable, exports:', Object.keys(opentuiCore).join(', '))

// Verify react bridge is importable
const opentuiReact = await import('@opentui/react')
console.log('✓ @opentui/react importable, exports:', Object.keys(opentuiReact).join(', '))

// Verify react itself resolves (hooks come from react, not @opentui/react)
const react = await import('react')
console.log('✓ react importable, useState:', typeof react.useState)

// Verify Anthropic SDK
const anthropicSdk = await import('@anthropic-ai/sdk')
console.log('✓ @anthropic-ai/sdk importable, default:', typeof anthropicSdk.default)

console.log('\nOpenTUI + Anthropic SDK smoke test: PASS ✓')
```

**Step 2: Run the smoke test**

```bash
cd /Users/ken/workspace/ms/loom-code
bun run scripts/smoke-opentui.ts
```
Expected: prints `OpenTUI + Anthropic SDK smoke test: PASS ✓`

**Step 3: Commit**
```bash
git add scripts/smoke-opentui.ts
git commit -m "chore: add OpenTUI + Anthropic SDK smoke test"
```

---

## Group B: @loom-code/provider-anthropic (Tasks 3-6)

### Task 3: Scaffold @loom-code/provider-anthropic

**Files:**
- Create: `packages/provider-anthropic/package.json`
- Create: `packages/provider-anthropic/tsconfig.json`
- Create: `packages/provider-anthropic/src/index.ts`
- Create: `packages/provider-anthropic/src/types.ts`
- Create: `packages/provider-anthropic/src/provider.ts`
- Create: `packages/provider-anthropic/src/__tests__/.gitkeep`
- Modify: `tsconfig.json` (root — add project reference)

**Step 1: Create directory structure**

```bash
cd /Users/ken/workspace/ms/loom-code
mkdir -p packages/provider-anthropic/src/__tests__
touch packages/provider-anthropic/src/__tests__/.gitkeep
```

**Step 2: Create `packages/provider-anthropic/package.json`**

```json
{
  "name": "@loom-code/provider-anthropic",
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
    "@anthropic-ai/sdk": "*",
    "@loom-code/core": "*"
  }
}
```

**Step 3: Create `packages/provider-anthropic/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src"]
}
```

**Step 4: Create `packages/provider-anthropic/src/index.ts`** (placeholder)

```typescript
export {}
```

**Step 5: Create empty source files**

Create `packages/provider-anthropic/src/types.ts`:
```typescript
export {}
```

Create `packages/provider-anthropic/src/provider.ts`:
```typescript
export {}
```

**Step 6: Update root `tsconfig.json`** — add provider-anthropic to references

Replace the entire contents of `tsconfig.json` (root) with:
```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/session-store" },
    { "path": "packages/provider-anthropic" }
  ]
}
```

**Step 7: Install and verify**

```bash
cd /Users/ken/workspace/ms/loom-code
bun install
```
Expected: exit 0, `bun.lock` updated to link the new workspace package

**Step 8: Commit**
```bash
git add packages/provider-anthropic/ tsconfig.json bun.lock
git commit -m "chore: scaffold @loom-code/provider-anthropic package"
```

---

### Task 4: TDD types.ts — AnthropicProviderConfig

**Files:**
- Create: `packages/provider-anthropic/src/__tests__/types.test.ts`
- Implement: `packages/provider-anthropic/src/types.ts`

**Step 1: Write failing test**

Create `packages/provider-anthropic/src/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'
import type { AnthropicProviderConfig } from '../types'

describe('AnthropicProviderConfig', () => {
  it('has required model field', () => {
    const config: AnthropicProviderConfig = { model: 'claude-opus-4' }
    expect(config.model).toBe('claude-opus-4')
  })

  it('apiKey is optional — defaults to ANTHROPIC_API_KEY env var', () => {
    const config: AnthropicProviderConfig = { model: 'claude-haiku-4' }
    expect(config.apiKey).toBeUndefined()
  })

  it('apiKey can be provided explicitly', () => {
    const config: AnthropicProviderConfig = {
      model: 'claude-opus-4',
      apiKey: 'sk-ant-test',
    }
    expect(config.apiKey).toBe('sk-ant-test')
  })

  it('maxTokens is optional', () => {
    const config: AnthropicProviderConfig = { model: 'claude-opus-4' }
    expect(config.maxTokens).toBeUndefined()
  })

  it('maxTokens can be overridden', () => {
    const config: AnthropicProviderConfig = { model: 'claude-opus-4', maxTokens: 4096 }
    expect(config.maxTokens).toBe(4096)
  })
})
```

**Step 2: Run — expect FAIL**
```bash
bun test packages/provider-anthropic/src/__tests__/types.test.ts
```
Expected: FAIL — cannot resolve types from `../types`

**Step 3: Implement `packages/provider-anthropic/src/types.ts`**

```typescript
/**
 * Configuration for the Anthropic provider.
 * Wraps the Anthropic SDK into a LoomProvider-compatible interface.
 */
export interface AnthropicProviderConfig {
  /** Anthropic model identifier, e.g. 'claude-opus-4', 'claude-haiku-4' */
  model: string
  /** API key — defaults to ANTHROPIC_API_KEY environment variable if omitted */
  apiKey?: string
  /** Maximum tokens per response — defaults to 8096 if omitted */
  maxTokens?: number
}
```

**Step 4: Run — expect PASS**
```bash
bun test packages/provider-anthropic/src/__tests__/types.test.ts
```
Expected: `5 pass, 0 fail`

**Step 5: Commit**
```bash
git add packages/provider-anthropic/src/types.ts packages/provider-anthropic/src/__tests__/types.test.ts
git commit -m "feat(@loom-code/provider-anthropic): add AnthropicProviderConfig type interface"
```

---

### Task 5: TDD provider.ts — createAnthropicProvider factory

**Files:**
- Create: `packages/provider-anthropic/src/__tests__/provider.test.ts`
- Implement: `packages/provider-anthropic/src/provider.ts`

**Step 1: Write failing test**

Create `packages/provider-anthropic/src/__tests__/provider.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createAnthropicProvider } from '../provider'

// Store and restore env to avoid test pollution
let savedApiKey: string | undefined

beforeEach(() => {
  savedApiKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-env'
})

afterEach(() => {
  if (savedApiKey !== undefined) {
    process.env.ANTHROPIC_API_KEY = savedApiKey
  } else {
    delete process.env.ANTHROPIC_API_KEY
  }
})

describe('createAnthropicProvider', () => {
  it('returns an object with the configured model', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(provider.model).toBe('claude-opus-4')
  })

  it('createClient is a function', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(typeof provider.createClient).toBe('function')
  })

  it('createClient returns an Anthropic client with messages property', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    const client = provider.createClient() as any
    expect(client).toBeDefined()
    expect(client.messages).toBeDefined()
  })

  it('exposes apiKey when provided in config', () => {
    const provider = createAnthropicProvider({
      model: 'claude-opus-4',
      apiKey: 'sk-ant-custom',
    })
    expect(provider.apiKey).toBe('sk-ant-custom')
  })

  it('apiKey is undefined on provider when not in config', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(provider.apiKey).toBeUndefined()
  })

  it('maxTokens defaults to 8096 when not configured', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(provider.maxTokens).toBe(8096)
  })

  it('maxTokens uses configured value when provided', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4', maxTokens: 4096 })
    expect(provider.maxTokens).toBe(4096)
  })

  it('does not throw when creating client with env var API key', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(() => provider.createClient()).not.toThrow()
  })
})
```

**Step 2: Run — expect FAIL**
```bash
bun test packages/provider-anthropic/src/__tests__/provider.test.ts
```
Expected: FAIL — cannot import `createAnthropicProvider` from `../provider`

**Step 3: Implement `packages/provider-anthropic/src/provider.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { LoomProvider } from '@loom-code/core'
import type { AnthropicProviderConfig } from './types'

const DEFAULT_MAX_TOKENS = 8096

/**
 * Create a LoomProvider that wraps the Anthropic SDK.
 *
 * The returned provider implements the LoomProvider interface from @loom-code/core.
 * Pass it as `config.provider` when constructing a LoomSession.
 *
 * API calls are made by the agentic loop in `@loom-code/core/loop.ts`
 * via `provider.createClient()` which returns an Anthropic SDK instance.
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
      }),
  }
}
```

**Step 4: Run — expect PASS**
```bash
bun test packages/provider-anthropic/src/__tests__/provider.test.ts
```
Expected: `8 pass, 0 fail`

Then verify the full package:
```bash
bun test packages/provider-anthropic
```
Expected: `13 pass, 0 fail` (5 types + 8 provider)

**Step 5: Commit**
```bash
git add packages/provider-anthropic/src/provider.ts packages/provider-anthropic/src/__tests__/provider.test.ts
git commit -m "feat(@loom-code/provider-anthropic): add createAnthropicProvider factory"
```

---

### Task 6: Wire @loom-code/provider-anthropic index.ts barrel

**Files:**
- Implement: `packages/provider-anthropic/src/index.ts`
- Create: `packages/provider-anthropic/src/__tests__/index.test.ts`

**Step 1: Replace placeholder with barrel exports**

Replace `packages/provider-anthropic/src/index.ts` with:
```typescript
// @loom-code/provider-anthropic — Public API

// Configuration types
export type { AnthropicProviderConfig } from './types'

// Provider factory
export { createAnthropicProvider } from './provider'
```

**Step 2: Write barrel smoke test**

Create `packages/provider-anthropic/src/__tests__/index.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'

describe('@loom-code/provider-anthropic barrel exports', () => {
  it('exports createAnthropicProvider', async () => {
    const { createAnthropicProvider } = await import('../index')
    expect(typeof createAnthropicProvider).toBe('function')
  })
})
```

**Step 3: Run all provider-anthropic tests**
```bash
bun test packages/provider-anthropic
```
Expected: `14 pass, 0 fail`

**Step 4: Verify TypeScript**
```bash
cd /Users/ken/workspace/ms/loom-code/packages/provider-anthropic && bunx tsc --noEmit
```
Expected: exit 0

**Step 5: Commit**
```bash
cd /Users/ken/workspace/ms/loom-code
git add packages/provider-anthropic/src/index.ts packages/provider-anthropic/src/__tests__/index.test.ts
git commit -m "feat(@loom-code/provider-anthropic): wire public API barrel — createAnthropicProvider"
```

---

## Group C: @loom-code/ui-status-bar (Tasks 7-10)

### Task 7: Scaffold @loom-code/ui-status-bar

**Files:**
- Create: `packages/ui-status-bar/package.json`
- Create: `packages/ui-status-bar/tsconfig.json` (with JSX support)
- Create: `packages/ui-status-bar/src/index.ts`
- Create: `packages/ui-status-bar/src/types.ts`
- Create: `packages/ui-status-bar/src/format.ts`
- Create: `packages/ui-status-bar/src/StatusBar.tsx`
- Create: `packages/ui-status-bar/src/__tests__/.gitkeep`
- Modify: `tsconfig.json` (root — add project reference)

**Step 1: Create directory structure**

```bash
cd /Users/ken/workspace/ms/loom-code
mkdir -p packages/ui-status-bar/src/__tests__
touch packages/ui-status-bar/src/__tests__/.gitkeep
```

**Step 2: Create `packages/ui-status-bar/package.json`**

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

**Step 3: Create `packages/ui-status-bar/tsconfig.json`** (with JSX + OpenTUI)

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

**Step 4: Create placeholder source files**

Create `packages/ui-status-bar/src/index.ts`:
```typescript
export {}
```

Create `packages/ui-status-bar/src/types.ts`:
```typescript
export {}
```

Create `packages/ui-status-bar/src/format.ts`:
```typescript
export {}
```

Create `packages/ui-status-bar/src/StatusBar.tsx`:
```typescript
export {}
```

**Step 5: Update root `tsconfig.json`** — add ui-status-bar

Replace the entire contents of `tsconfig.json` (root) with:
```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/session-store" },
    { "path": "packages/provider-anthropic" },
    { "path": "packages/ui-status-bar" }
  ]
}
```

**Step 6: Install and verify**

```bash
cd /Users/ken/workspace/ms/loom-code
bun install
```
Expected: exit 0

**Step 7: Commit**
```bash
git add packages/ui-status-bar/ tsconfig.json bun.lock
git commit -m "chore: scaffold @loom-code/ui-status-bar package with JSX support"
```

---

### Task 8: TDD types.ts — StatusBarState, StatusBarProps

**Files:**
- Create: `packages/ui-status-bar/src/__tests__/types.test.ts`
- Implement: `packages/ui-status-bar/src/types.ts`

**Step 1: Write failing test**

Create `packages/ui-status-bar/src/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'
import type { StatusBarState, StatusBarProps } from '../types'

describe('StatusBarState', () => {
  it('has model, tokenCount, and sessionId', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 2100,
      sessionId: '05476974-dc35-4db2-a612-a9b3655a6566',
    }
    expect(state.model).toBe('claude-opus-4')
    expect(state.tokenCount).toBe(2100)
    expect(state.sessionId).toHaveLength(36)
  })

  it('tokenCount can be zero for a fresh session', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 0,
      sessionId: 'abc123',
    }
    expect(state.tokenCount).toBe(0)
  })
})

describe('StatusBarProps', () => {
  it('takes a StatusBarState', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 1234,
      sessionId: 'abc',
    }
    const props: StatusBarProps = { state }
    expect(props.state.model).toBe('claude-opus-4')
  })
})
```

**Step 2: Run — expect FAIL**
```bash
bun test packages/ui-status-bar/src/__tests__/types.test.ts
```
Expected: FAIL — cannot resolve types from `../types`

**Step 3: Implement `packages/ui-status-bar/src/types.ts`**

```typescript
/**
 * State for the status bar — updated by LoomSession on each turn.
 */
export interface StatusBarState {
  /** LLM model identifier, e.g. 'claude-opus-4' */
  model: string
  /** Running token count for this session */
  tokenCount: number
  /** Full session UUID */
  sessionId: string
}

/**
 * Props for the StatusBar component.
 */
export interface StatusBarProps {
  state: StatusBarState
}
```

**Step 4: Run — expect PASS**
```bash
bun test packages/ui-status-bar/src/__tests__/types.test.ts
```
Expected: `3 pass, 0 fail`

**Step 5: Commit**
```bash
git add packages/ui-status-bar/src/types.ts packages/ui-status-bar/src/__tests__/types.test.ts
git commit -m "feat(@loom-code/ui-status-bar): add StatusBarState and StatusBarProps types"
```

---

### Task 9: TDD format.ts — pure formatting functions + StatusBar.tsx component

**Files:**
- Create: `packages/ui-status-bar/src/__tests__/format.test.ts`
- Implement: `packages/ui-status-bar/src/format.ts`
- Implement: `packages/ui-status-bar/src/StatusBar.tsx`

**Step 1: Write failing test for format.ts**

Create `packages/ui-status-bar/src/__tests__/format.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'
import { formatTokenCount, truncateSessionId, formatStatusLine } from '../format'
import type { StatusBarState } from '../types'

describe('formatTokenCount', () => {
  it('formats small numbers as-is', () => {
    expect(formatTokenCount(500)).toBe('500')
  })

  it('formats thousands with k suffix', () => {
    expect(formatTokenCount(2100)).toBe('2.1k')
  })

  it('formats larger numbers with k suffix', () => {
    expect(formatTokenCount(10500)).toBe('10.5k')
  })

  it('handles zero', () => {
    expect(formatTokenCount(0)).toBe('0')
  })

  it('rounds to 1 decimal', () => {
    expect(formatTokenCount(1567)).toBe('1.6k')
  })
})

describe('truncateSessionId', () => {
  it('takes first 8 characters', () => {
    expect(truncateSessionId('05476974-dc35-4db2-a612-a9b3655a6566')).toBe('05476974')
  })

  it('handles short IDs gracefully', () => {
    expect(truncateSessionId('abc')).toBe('abc')
  })
})

describe('formatStatusLine', () => {
  it('formats state into a readable status string', () => {
    const state: StatusBarState = {
      model: 'claude-opus-4',
      tokenCount: 2100,
      sessionId: '05476974-dc35-4db2',
    }
    const line = formatStatusLine(state)
    expect(line).toContain('claude-opus-4')
    expect(line).toContain('2.1k')
    expect(line).toContain('05476974')
  })

  it('shows zero tokens on fresh session', () => {
    const state: StatusBarState = {
      model: 'claude-haiku-4',
      tokenCount: 0,
      sessionId: 'abc123def',
    }
    const line = formatStatusLine(state)
    expect(line).toContain('0')
    expect(line).toContain('claude-haiku-4')
  })
})
```

**Step 2: Run — expect FAIL**
```bash
bun test packages/ui-status-bar/src/__tests__/format.test.ts
```
Expected: FAIL — cannot import from `../format`

**Step 3: Implement `packages/ui-status-bar/src/format.ts`**

```typescript
import type { StatusBarState } from './types'

/**
 * Format a token count for display. Uses 'k' suffix for >= 1000.
 * Examples: 500 -> "500", 2100 -> "2.1k", 10500 -> "10.5k"
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return String(count)
  return `${Math.round(count / 100) / 10}k`
}

/**
 * Shorten a session UUID to its first 8 characters for display.
 * Example: "05476974-dc35-..." -> "05476974"
 */
export function truncateSessionId(sessionId: string): string {
  return sessionId.slice(0, 8)
}

/**
 * Format the full status bar line from session state.
 * Layout: "claude-opus-4  2.1k tokens  #05476974"
 */
export function formatStatusLine(state: StatusBarState): string {
  return `${state.model}  ${formatTokenCount(state.tokenCount)} tokens  #${truncateSessionId(state.sessionId)}`
}
```

**Step 4: Run format tests — expect PASS**
```bash
bun test packages/ui-status-bar/src/__tests__/format.test.ts
```
Expected: `9 pass, 0 fail`

**Step 5: Implement `packages/ui-status-bar/src/StatusBar.tsx`**

The StatusBar component is intentionally thin — all formatting logic lives in `format.ts`.
Testing: pure functions in format.ts. The component is verified via TypeScript compilation only.

```tsx
import { formatStatusLine } from './format'
import type { StatusBarProps } from './types'

/**
 * StatusBar — a single-line status display.
 *
 * Layout: | claude-opus-4  2.1k tokens  #05476974 |
 *
 * Renders using @opentui/react terminal primitives.
 * All logic is in format.ts (pure, tested). This component is a thin shell.
 */
export function StatusBar({ state }: StatusBarProps) {
  return <text>{formatStatusLine(state)}</text>
}
```

**Step 6: Verify TypeScript compiles the JSX component**
```bash
cd /Users/ken/workspace/ms/loom-code/packages/ui-status-bar && bunx tsc --noEmit
```
Expected: exit 0

If `tsc` fails with JSX-related errors, check that `@opentui/react` provides the JSX runtime types. The `jsxImportSource: "@opentui/react"` in tsconfig handles automatic JSX import. No explicit `import React from 'react'` is needed.

**Step 7: Run full package tests**
```bash
cd /Users/ken/workspace/ms/loom-code
bun test packages/ui-status-bar
```
Expected: `12 pass, 0 fail` (3 types + 9 format)

**Step 8: Commit**
```bash
git add packages/ui-status-bar/src/format.ts packages/ui-status-bar/src/StatusBar.tsx packages/ui-status-bar/src/__tests__/format.test.ts
git commit -m "feat(@loom-code/ui-status-bar): add StatusBar component and format utilities"
```

---

### Task 10: Wire @loom-code/ui-status-bar index.ts barrel

**Files:**
- Implement: `packages/ui-status-bar/src/index.ts`
- Create: `packages/ui-status-bar/src/__tests__/index.test.ts`

**Step 1: Replace placeholder with barrel exports**

Replace `packages/ui-status-bar/src/index.ts` with:
```typescript
// @loom-code/ui-status-bar — Public API

// Types
export type { StatusBarState, StatusBarProps } from './types'

// Pure formatting utilities
export { formatTokenCount, truncateSessionId, formatStatusLine } from './format'

// Component
export { StatusBar } from './StatusBar'
```

**Step 2: Write smoke test**

Create `packages/ui-status-bar/src/__tests__/index.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'

describe('@loom-code/ui-status-bar barrel exports', () => {
  it('exports StatusBar component', async () => {
    const { StatusBar } = await import('../index')
    expect(typeof StatusBar).toBe('function')
  })

  it('exports formatStatusLine utility', async () => {
    const { formatStatusLine } = await import('../index')
    expect(typeof formatStatusLine).toBe('function')
  })

  it('exports formatTokenCount utility', async () => {
    const { formatTokenCount } = await import('../index')
    expect(formatTokenCount(2100)).toBe('2.1k')
  })
})
```

**Step 3: Run all tests**
```bash
bun test packages/ui-status-bar
```
Expected: `15 pass, 0 fail`

**Step 4: Commit**
```bash
git add packages/ui-status-bar/src/index.ts packages/ui-status-bar/src/__tests__/index.test.ts
git commit -m "feat(@loom-code/ui-status-bar): wire public API barrel"
```

---

## Group D: @loom-code/ui-input-bar (Tasks 11-14)

### Task 11: Scaffold @loom-code/ui-input-bar

**Files:**
- Create: `packages/ui-input-bar/package.json`
- Create: `packages/ui-input-bar/tsconfig.json` (with JSX support)
- Create: `packages/ui-input-bar/src/index.ts`
- Create: `packages/ui-input-bar/src/types.ts`
- Create: `packages/ui-input-bar/src/state.ts`
- Create: `packages/ui-input-bar/src/InputBar.tsx`
- Create: `packages/ui-input-bar/src/__tests__/.gitkeep`
- Modify: `tsconfig.json` (root — add project reference)

**Step 1: Create directory structure**

```bash
cd /Users/ken/workspace/ms/loom-code
mkdir -p packages/ui-input-bar/src/__tests__
touch packages/ui-input-bar/src/__tests__/.gitkeep
```

**Step 2: Create `packages/ui-input-bar/package.json`**

```json
{
  "name": "@loom-code/ui-input-bar",
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

**Step 3: Create `packages/ui-input-bar/tsconfig.json`** (with JSX + OpenTUI)

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

**Step 4: Create placeholder source files**

Create `packages/ui-input-bar/src/index.ts`:
```typescript
export {}
```

Create `packages/ui-input-bar/src/types.ts`:
```typescript
export {}
```

Create `packages/ui-input-bar/src/state.ts`:
```typescript
export {}
```

Create `packages/ui-input-bar/src/InputBar.tsx`:
```typescript
export {}
```

**Step 5: Update root `tsconfig.json`** — add all Phase 2A packages

Replace the entire contents of `tsconfig.json` (root) with:
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

**Step 6: Install and verify**

```bash
cd /Users/ken/workspace/ms/loom-code
bun install
```
Expected: exit 0

**Step 7: Commit**
```bash
git add packages/ui-input-bar/ tsconfig.json bun.lock
git commit -m "chore: scaffold @loom-code/ui-input-bar package with JSX support"
```

---

### Task 12: TDD types.ts — InputBarState, InputBarProps, InputBarCallbacks

**Files:**
- Create: `packages/ui-input-bar/src/__tests__/types.test.ts`
- Implement: `packages/ui-input-bar/src/types.ts`

**Step 1: Write failing test**

Create `packages/ui-input-bar/src/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'
import type { InputBarState, InputBarProps, InputBarCallbacks } from '../types'

describe('InputBarState', () => {
  it('has value and micActive fields', () => {
    const state: InputBarState = { value: '', micActive: false }
    expect(state.value).toBe('')
    expect(state.micActive).toBe(false)
  })

  it('value can hold in-progress text', () => {
    const state: InputBarState = { value: 'refactor login', micActive: false }
    expect(state.value).toBe('refactor login')
  })

  it('micActive can be true during voice recording', () => {
    const state: InputBarState = { value: '', micActive: true }
    expect(state.micActive).toBe(true)
  })
})

describe('InputBarCallbacks', () => {
  it('onSubmit is a required function', () => {
    const callbacks: InputBarCallbacks = {
      onSubmit: (_text) => {},
    }
    expect(typeof callbacks.onSubmit).toBe('function')
  })

  it('onVoiceToggle is optional', () => {
    const callbacks: InputBarCallbacks = {
      onSubmit: (_text) => {},
    }
    expect(callbacks.onVoiceToggle).toBeUndefined()
  })

  it('onValueChange is optional', () => {
    const callbacks: InputBarCallbacks = {
      onSubmit: (_text) => {},
    }
    expect(callbacks.onValueChange).toBeUndefined()
  })
})

describe('InputBarProps', () => {
  it('takes state, callbacks, and optional placeholder', () => {
    const props: InputBarProps = {
      state: { value: '', micActive: false },
      callbacks: { onSubmit: (_t) => {} },
      placeholder: 'Ask anything...',
    }
    expect(props.placeholder).toBe('Ask anything...')
  })

  it('placeholder is optional', () => {
    const props: InputBarProps = {
      state: { value: '', micActive: false },
      callbacks: { onSubmit: (_t) => {} },
    }
    expect(props.placeholder).toBeUndefined()
  })
})
```

**Step 2: Run — expect FAIL**
```bash
bun test packages/ui-input-bar/src/__tests__/types.test.ts
```
Expected: FAIL — cannot resolve types from `../types`

**Step 3: Implement `packages/ui-input-bar/src/types.ts`**

```typescript
/**
 * State for the input bar — managed externally by the CLI controller.
 */
export interface InputBarState {
  /** Current text value of the input field */
  value: string
  /** True when voice capture is active */
  micActive: boolean
}

/**
 * Callbacks for the input bar — wired to session control logic.
 */
export interface InputBarCallbacks {
  /** Called when the user submits (Enter). Receives the trimmed text. */
  onSubmit: (text: string) => void
  /** Called when the text value changes (optional — for controlled input) */
  onValueChange?: (value: string) => void
  /** Called when the mic button is toggled (optional — for voice support) */
  onVoiceToggle?: () => void
}

/**
 * Props for the InputBar component.
 */
export interface InputBarProps {
  state: InputBarState
  callbacks: InputBarCallbacks
  /** Placeholder text shown when input is empty. Default: '▸' */
  placeholder?: string
}
```

**Step 4: Run — expect PASS**
```bash
bun test packages/ui-input-bar/src/__tests__/types.test.ts
```
Expected: `8 pass, 0 fail`

**Step 5: Commit**
```bash
git add packages/ui-input-bar/src/types.ts packages/ui-input-bar/src/__tests__/types.test.ts
git commit -m "feat(@loom-code/ui-input-bar): add InputBarState, InputBarProps, InputBarCallbacks types"
```

---

### Task 13: TDD state.ts — pure state machine + InputBar.tsx component

**Files:**
- Create: `packages/ui-input-bar/src/__tests__/state.test.ts`
- Implement: `packages/ui-input-bar/src/state.ts`
- Implement: `packages/ui-input-bar/src/InputBar.tsx`

**Step 1: Write failing test**

Create `packages/ui-input-bar/src/__tests__/state.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'
import {
  createInitialInputBarState,
  updateValue,
  submitValue,
  toggleMic,
} from '../state'

describe('createInitialInputBarState', () => {
  it('returns empty value and micActive false', () => {
    const state = createInitialInputBarState()
    expect(state.value).toBe('')
    expect(state.micActive).toBe(false)
  })
})

describe('updateValue', () => {
  it('returns new state with updated value', () => {
    const state = createInitialInputBarState()
    const next = updateValue(state, 'hello world')
    expect(next.value).toBe('hello world')
    expect(next.micActive).toBe(false)
  })

  it('does not mutate original state', () => {
    const state = createInitialInputBarState()
    updateValue(state, 'changed')
    expect(state.value).toBe('')
  })
})

describe('submitValue', () => {
  it('returns newState with value cleared', () => {
    const state = { value: 'refactor login', micActive: false }
    const { newState } = submitValue(state)
    expect(newState.value).toBe('')
  })

  it('trims whitespace from the submitted text', () => {
    const state = { value: '  hello  ', micActive: false }
    const { submitted } = submitValue(state)
    expect(submitted).toBe('hello')
  })

  it('returns the submitted text alongside new state', () => {
    const state = { value: 'add authentication', micActive: false }
    const { newState, submitted } = submitValue(state)
    expect(submitted).toBe('add authentication')
    expect(newState.value).toBe('')
  })

  it('returns null for empty or whitespace-only input', () => {
    const state = { value: '   ', micActive: false }
    const { submitted } = submitValue(state)
    expect(submitted).toBeNull()
  })
})

describe('toggleMic', () => {
  it('activates mic when inactive', () => {
    const state = { value: '', micActive: false }
    const next = toggleMic(state)
    expect(next.micActive).toBe(true)
  })

  it('deactivates mic when active', () => {
    const state = { value: '', micActive: true }
    const next = toggleMic(state)
    expect(next.micActive).toBe(false)
  })
})
```

**Step 2: Run — expect FAIL**
```bash
bun test packages/ui-input-bar/src/__tests__/state.test.ts
```
Expected: FAIL — cannot import from `../state`

**Step 3: Implement `packages/ui-input-bar/src/state.ts`**

```typescript
import type { InputBarState } from './types'

/**
 * Create the initial empty state for an input bar.
 */
export function createInitialInputBarState(): InputBarState {
  return { value: '', micActive: false }
}

/**
 * Update the text value — returns new state, does not mutate.
 */
export function updateValue(state: InputBarState, value: string): InputBarState {
  return { ...state, value }
}

/**
 * Submit the current value.
 * Returns { newState (value cleared), submitted (trimmed text or null if empty) }.
 */
export function submitValue(state: InputBarState): {
  newState: InputBarState
  submitted: string | null
} {
  const trimmed = state.value.trim()
  return {
    newState: { ...state, value: '' },
    submitted: trimmed.length > 0 ? trimmed : null,
  }
}

/**
 * Toggle microphone active/inactive.
 */
export function toggleMic(state: InputBarState): InputBarState {
  return { ...state, micActive: !state.micActive }
}
```

**Step 4: Run state tests — expect PASS**
```bash
bun test packages/ui-input-bar/src/__tests__/state.test.ts
```
Expected: `9 pass, 0 fail`

**Step 5: Implement `packages/ui-input-bar/src/InputBar.tsx`**

The InputBar component is intentionally thin — all business logic lives in `state.ts`.
React hooks come from `react`, OpenTUI-specific hooks come from `@opentui/react`.
Testing: pure functions in state.ts. The component is verified via TypeScript compilation only.

```tsx
import type { InputBarProps } from './types'

/**
 * InputBar — pure chat input, no slash commands.
 *
 * Design: The input bar is the sole channel for conversation text.
 * App-layer concerns (settings, tools, session management) live in the
 * Cmd-P command palette, not here.
 *
 * The component is tested via TypeScript compilation only.
 * State logic is tested via state.ts pure functions.
 */
export function InputBar({ state, callbacks, placeholder = '▸' }: InputBarProps) {
  return (
    <box style={{ flexDirection: 'row' }}>
      <input
        placeholder={`${placeholder} `}
        onInput={(value: string) => callbacks.onValueChange?.(value)}
        onSubmit={() => {
          const trimmed = state.value.trim()
          if (trimmed) callbacks.onSubmit(trimmed)
        }}
        focused
      />
    </box>
  )
}
```

**Step 6: Verify TypeScript compilation**
```bash
cd /Users/ken/workspace/ms/loom-code/packages/ui-input-bar && bunx tsc --noEmit
```
Expected: exit 0

If there are TypeScript errors in `InputBar.tsx` related to JSX intrinsic types (e.g., `<input>` or `<box>` props not matching), adjust the JSX to match what `@opentui/react` actually declares. The `state.ts` pure function tests are unaffected by any JSX type issues.

**Step 7: Run all input-bar tests**
```bash
cd /Users/ken/workspace/ms/loom-code
bun test packages/ui-input-bar
```
Expected: `17 pass, 0 fail` (8 types + 9 state)

**Step 8: Commit**
```bash
git add packages/ui-input-bar/src/state.ts packages/ui-input-bar/src/InputBar.tsx packages/ui-input-bar/src/__tests__/state.test.ts
git commit -m "feat(@loom-code/ui-input-bar): add InputBar component and state machine"
```

---

### Task 14: Wire @loom-code/ui-input-bar index.ts barrel

**Files:**
- Implement: `packages/ui-input-bar/src/index.ts`
- Create: `packages/ui-input-bar/src/__tests__/index.test.ts`

**Step 1: Replace placeholder with barrel exports**

Replace `packages/ui-input-bar/src/index.ts` with:
```typescript
// @loom-code/ui-input-bar — Public API

// Types
export type { InputBarState, InputBarProps, InputBarCallbacks } from './types'

// State machine
export {
  createInitialInputBarState,
  updateValue,
  submitValue,
  toggleMic,
} from './state'

// Component
export { InputBar } from './InputBar'
```

**Step 2: Write smoke test**

Create `packages/ui-input-bar/src/__tests__/index.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'

describe('@loom-code/ui-input-bar barrel exports', () => {
  it('exports InputBar component', async () => {
    const { InputBar } = await import('../index')
    expect(typeof InputBar).toBe('function')
  })

  it('exports createInitialInputBarState', async () => {
    const { createInitialInputBarState } = await import('../index')
    const state = createInitialInputBarState()
    expect(state.value).toBe('')
    expect(state.micActive).toBe(false)
  })

  it('exports submitValue', async () => {
    const { submitValue } = await import('../index')
    expect(typeof submitValue).toBe('function')
  })
})
```

**Step 3: Run all tests**
```bash
bun test packages/ui-input-bar
```
Expected: `20 pass, 0 fail`

**Step 4: Commit**
```bash
git add packages/ui-input-bar/src/index.ts packages/ui-input-bar/src/__tests__/index.test.ts
git commit -m "feat(@loom-code/ui-input-bar): wire public API barrel"
```

---

## Final: Task 15 — Full workspace verification

**Step 1: Run full workspace test suite**
```bash
cd /Users/ken/workspace/ms/loom-code
bun test
```
Expected: **~152 tests pass, 0 fail** (103 Phase 1 + 14 provider-anthropic + 15 ui-status-bar + 20 ui-input-bar)

**Step 2: Run workspace typecheck**
```bash
bun run typecheck
```
Expected: exit 0

**Step 3: Verify each new package individually**
```bash
bun test packages/provider-anthropic   # 14 pass
bun test packages/ui-status-bar        # 15 pass
bun test packages/ui-input-bar         # 20 pass
```

**Step 4: Final commit**
```bash
git add -A
git commit -m "chore: Phase 2A complete — provider-anthropic + ui-status-bar + ui-input-bar

Phase 2A deliverables:
- Installed @opentui/react, @opentui/core, react, @anthropic-ai/sdk workspace-wide
- @loom-code/provider-anthropic: createAnthropicProvider wrapping Anthropic SDK
- @loom-code/ui-status-bar: StatusBar component + format utilities (pure fn tested)
- @loom-code/ui-input-bar: InputBar component + state machine (pure fn tested)
- All tests passing, TypeScript clean across workspace"
```
