# Phase 1: Foundation — Bun Monorepo + @loom-code/core + @loom-code/session-store

> **Execution:** Use the subagent-driven-development workflow to implement this plan.

**Goal:** Establish the Bun monorepo, verify napi-rs works under Bun, implement the core agentic loop with session management, and implement the checkpoint store with reconstruction and corruption recovery.

**Architecture:** `LoomSession` wraps `JsAmplifierSession` (Rust kernel via napi-rs) and owns the agentic loop — the `while(true)`, LLM SDK calls, tool dispatch, and hook emissions. Tools are registered via `JsToolBridge` into a JS-side `Map<string, ToolBridge>`. Session state is persisted as append-only JSONL with delta checkpoints and periodic full snapshots every 20 turns.

**Tech Stack:** Bun 1.3+ workspaces, TypeScript (ESNext + bundler resolution), amplifier-core napi-rs v1.0.10, `bun:test`

---

## Prerequisites

1. **Bun** installed (`bun --version` ≥ 1.3)
2. **amplifier-node** repo checked out at `/Users/ken/workspace/ms/amplifier-node/` with the napi-rs `.node` binary pre-built (`amplifier-core.darwin-arm64.node` exists in `amplifier-core/bindings/node/`)
3. Current repo is at `/Users/ken/workspace/ms/loom-chat-cli` (Task 1 renames it)

---

## Group A: Monorepo Setup (Tasks 1–3)

### Task 1: Rename local directory

**Step 1: Rename the directory**

```bash
mv /Users/ken/workspace/ms/loom-chat-cli /Users/ken/workspace/ms/loom-code
cd /Users/ken/workspace/ms/loom-code
```

Run: `pwd`
Expected: `/Users/ken/workspace/ms/loom-code`

Run: `ls docs/design/`
Expected: `2026-04-03-loom-code-design.md`

No commit needed — just a local directory rename.

---

### Task 2: Create Bun workspace root

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `bunfig.toml`
- Create: `.gitignore`

**Step 1: Create `package.json`** (workspace root):

```json
{
  "name": "loom-code",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "bun test --recursive",
    "test:watch": "bun test --watch --recursive",
    "typecheck": "bunx tsc --noEmit"
  }
}
```

**Step 2: Create `tsconfig.base.json`** (shared TypeScript config):

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Step 3: Create `bunfig.toml`**:

```toml
[test]
preload = []

[install]
exact = true
```

**Step 4: Create `.gitignore`**:

```
node_modules/
dist/
*.node
bun.lockb
.DS_Store
```

**Step 5: Run `bun install`**

Run: `bun install`
Expected: lockfile created, no errors. Output includes `done`.

**Step 6: Commit**

```bash
git add -A && git commit -m "chore: initialize Bun monorepo workspace"
```

---

### Task 3: napi-rs Bun smoke test

This is the critical gate. If the napi-rs `.node` binary doesn't load under Bun, the fallback is to use Node.js as runtime (same monorepo structure, just `node` instead of `bun run`).

**Files:**
- Create: `scripts/smoke-napi.ts`

**Step 1: Create the smoke test script**

Create `scripts/smoke-napi.ts`:

```typescript
/**
 * Smoke test: does the amplifier-core napi-rs binary load under Bun?
 *
 * This must pass before any @loom-code/core work begins.
 * If it fails, use Node.js as runtime instead of Bun.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Resolve relative to this script — ../amplifier-node from workspace root
const amp = require("../../amplifier-node/amplifier-core/bindings/node/index.js");

try {
  // 1. Basic binding load
  const greeting = amp.hello();
  console.log(`✓ hello() returned: "${greeting}"`);
  if (greeting !== "Hello from amplifier-core native addon!") {
    throw new Error(`Unexpected hello() result: ${greeting}`);
  }

  // 2. JsAmplifierSession creation
  const config = JSON.stringify({
    session: { orchestrator: "loop-basic", context: "context-simple" },
  });
  const session = new amp.JsAmplifierSession(config);
  console.log(`✓ JsAmplifierSession created: ${session.sessionId}`);

  // 3. Coordinator access
  const coord = session.coordinator;
  console.log(`✓ coordinator.hasOrchestrator: ${coord.hasOrchestrator}`);

  // 4. Hook emission (no handlers — should return Continue)
  const hooks = coord.hooks;
  const result = await hooks.emit("test:event", JSON.stringify({ test: true }));
  console.log(`✓ hooks.emit returned action: ${result.action}`);

  // 5. JsToolBridge round-trip
  const tool = new amp.JsToolBridge(
    "echo",
    "Test tool",
    JSON.stringify({ type: "object", properties: {} }),
    async (inputJson: string) => JSON.stringify({ ok: true, input: inputJson }),
  );
  const toolResult = await tool.execute(JSON.stringify({ msg: "hello" }));
  console.log(`✓ JsToolBridge.execute returned: ${toolResult}`);

  // 6. Cleanup
  await session.cleanup();
  console.log("✓ session.cleanup() OK");

  console.log("\n══════════════════════════════════════");
  console.log("Bun + napi-rs: COMPATIBLE ✓");
  console.log("══════════════════════════════════════");
} catch (e) {
  console.error("✗ napi-rs binding failed under Bun:", e);
  console.error("\nFallback: use Node.js runtime instead of Bun.");
  console.error("The monorepo structure stays the same.");
  process.exit(1);
}
```

**Step 2: Run the smoke test**

Run: `bun run scripts/smoke-napi.ts`

Expected (success):
```
✓ hello() returned: "Hello from amplifier-core native addon!"
✓ JsAmplifierSession created: <some-uuid>
✓ coordinator.hasOrchestrator: true
✓ hooks.emit returned action: Continue
✓ JsToolBridge.execute returned: {"ok":true,"input":"{\"msg\":\"hello\"}"}
✓ session.cleanup() OK

══════════════════════════════════════
Bun + napi-rs: COMPATIBLE ✓
══════════════════════════════════════
```

Expected (failure): prints `✗ napi-rs binding failed under Bun` — document the error, switch all `bun run` / `bun test` commands in this plan to `node --loader ts-node/esm` / `npx vitest`. The monorepo structure is unchanged.

**Step 3: Commit**

```bash
git add -A && git commit -m "chore: add napi-rs Bun compatibility smoke test"
```

---

## Group B: @loom-code/core (Tasks 4–9)

All tests in this group require the napi-rs native binary (verified in Task 3).

### Task 4: Scaffold @loom-code/core package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`

**Step 1: Create directory structure**

```bash
mkdir -p packages/core/src/__tests__
```

**Step 2: Create `packages/core/package.json`**:

```json
{
  "name": "@loom-code/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "amplifier-core": "file:../../../amplifier-node/amplifier-core/bindings/node"
  }
}
```

**Step 3: Create `packages/core/tsconfig.json`**:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 4: Install dependencies**

Run from workspace root: `bun install`
Expected: `amplifier-core` linked into `node_modules`, no errors.

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold @loom-code/core package"
```

---

### Task 5: TDD `types.ts` — core type interfaces

**Files:**
- Create: `packages/core/src/types.ts`
- Test: `packages/core/src/__tests__/types.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import type {
  LoomTool,
  LoomHookHandler,
  LoomPackage,
  LoomProvider,
  LoomConfig,
} from "../types";

describe("types", () => {
  it("LoomTool has required fields", () => {
    const tool: LoomTool = {
      name: "bash",
      description: "Run shell commands",
      schema: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
      execute: async (input) =>
        JSON.stringify({ success: true, output: "ok" }),
    };
    expect(tool.name).toBe("bash");
    expect(typeof tool.execute).toBe("function");
  });

  it("LoomHookHandler has event and handler", () => {
    const hook: LoomHookHandler = {
      event: "tool:pre",
      handler: (_event, _data) =>
        JSON.stringify({ action: "continue" }),
    };
    expect(hook.event).toBe("tool:pre");
    expect(hook.priority).toBeUndefined();
  });

  it("LoomPackage has tools array and optional hooks", () => {
    const pkg: LoomPackage = {
      tools: [],
    };
    expect(Array.isArray(pkg.tools)).toBe(true);
    expect(pkg.hooks).toBeUndefined();
  });

  it("LoomConfig has provider and packages", () => {
    const config: LoomConfig = {
      provider: {
        model: "claude-opus-4",
        createClient: () => ({}) as any,
      },
      packages: [],
      systemPrompt: "./AGENTS.md",
    };
    expect(config.provider.model).toBe("claude-opus-4");
    expect(config.packages).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/__tests__/types.test.ts`
Expected: FAIL — `Cannot find module "../types"`

**Step 3: Write `packages/core/src/types.ts`**

```typescript
export interface LoomTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  execute: (inputJson: string) => Promise<string>;
}

export interface LoomHookHandler {
  event: string;
  handler: (event: string, dataJson: string) => string | Promise<string>;
  priority?: number;
  name?: string;
}

export interface LoomContext {
  files?: string[];
  text?: string;
}

export interface LoomPackage {
  tools: LoomTool[];
  hooks?: LoomHookHandler[];
  context?: LoomContext;
}

export interface LoomProvider {
  model: string;
  createClient: () => unknown;
  apiKey?: string;
}

export interface LoomConfig {
  provider: LoomProvider;
  packages: LoomPackage[];
  systemPrompt?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/core/src/__tests__/types.test.ts`
Expected: PASS — 4 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/core): add core type interfaces"
```

---

### Task 6: TDD `tools.ts` — ToolBridge wrapping and spec derivation

**Files:**
- Create: `packages/core/src/tools.ts`
- Test: `packages/core/src/__tests__/tools.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/tools.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { createToolMap, registerPackageTools, deriveToolSpecs } from "../tools";
import type { LoomTool, LoomPackage } from "../types";

const echoTool: LoomTool = {
  name: "echo",
  description: "Echo input back",
  schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  execute: async (inputJson) => {
    const { text } = JSON.parse(inputJson);
    return JSON.stringify({ success: true, output: text });
  },
};

describe("tools", () => {
  it("createToolMap returns empty Map", () => {
    const map = createToolMap();
    expect(map.size).toBe(0);
  });

  it("registerPackageTools adds tools to map", () => {
    const map = createToolMap();
    const pkg: LoomPackage = { tools: [echoTool] };
    registerPackageTools(map, pkg);
    expect(map.size).toBe(1);
    expect(map.has("echo")).toBe(true);
  });

  it("deriveToolSpecs returns Anthropic-shaped spec array", () => {
    const map = createToolMap();
    registerPackageTools(map, { tools: [echoTool] });
    const specs = deriveToolSpecs(map);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("echo");
    expect(specs[0].description).toBe("Echo input back");
    expect(specs[0].input_schema).toBeDefined();
  });

  it("tool in map can be executed through JsToolBridge", async () => {
    const map = createToolMap();
    registerPackageTools(map, { tools: [echoTool] });
    const bridge = map.get("echo")!;
    const result = await bridge.execute(JSON.stringify({ text: "hello" }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.output).toBe("hello");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/__tests__/tools.test.ts`
Expected: FAIL — `Cannot find module "../tools"`

**Step 3: Write `packages/core/src/tools.ts`**

```typescript
import { createRequire } from "module";
import type { LoomTool, LoomPackage } from "./types";

const require = createRequire(import.meta.url);
const amp = require("amplifier-core");

/**
 * Interface matching the JsToolBridge API surface.
 * Stored in the JS-side tool map (hybrid coordinator pattern).
 */
export interface ToolBridge {
  readonly name: string;
  readonly description: string;
  execute(inputJson: string): Promise<string>;
  getSpec(): string;
}

export type ToolMap = Map<string, ToolBridge>;

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: unknown;
}

export function createToolMap(): ToolMap {
  return new Map();
}

export function registerPackageTools(map: ToolMap, pkg: LoomPackage): void {
  for (const tool of pkg.tools) {
    const bridge = new amp.JsToolBridge(
      tool.name,
      tool.description,
      JSON.stringify(tool.schema),
      tool.execute,
    );
    map.set(tool.name, bridge);
  }
}

export function deriveToolSpecs(map: ToolMap): ToolSpec[] {
  return [...map.values()].map((bridge) => {
    const spec = JSON.parse(bridge.getSpec());
    return {
      name: spec.name,
      description: spec.description,
      input_schema: spec.parameters,
    };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/core/src/__tests__/tools.test.ts`
Expected: PASS — 4 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/core): add tool registration and JsToolBridge wrapping"
```

---

### Task 7: TDD `loop.ts` — agentic loop

**Files:**
- Create: `packages/core/src/loop.ts`
- Test: `packages/core/src/__tests__/loop.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/loop.test.ts`:

```typescript
import { describe, it, expect, mock } from "bun:test";
import { runTurn } from "../loop";
import { createToolMap } from "../tools";

/**
 * Mock LLM client shaped like Anthropic SDK's messages.stream().
 * Returns an object with async iteration (for token deltas) and
 * finalMessage() (for the complete response).
 */
function createMockClient(responseText: string) {
  return {
    messages: {
      stream: mock(() => ({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: responseText },
          };
        },
        finalMessage: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: responseText }],
        }),
      })),
    },
  };
}

/** Mock hooks object — returns Continue for all events. */
const mockHooks = {
  emit: mock(async (_event: string, _dataJson: string) => ({
    action: "Continue" as const,
  })),
};

describe("loop", () => {
  it("runTurn returns text response and appends to messages", async () => {
    const messages: any[] = [];
    const toolMap = createToolMap();
    const tokens: string[] = [];

    const result = await runTurn({
      prompt: "Hello",
      messages,
      toolMap,
      client: createMockClient("Done."),
      model: "claude-opus-4",
      hooks: mockHooks as any,
      onToken: (delta) => tokens.push(delta),
      onToolStart: () => {},
      onToolEnd: () => {},
    });

    expect(result).toBe("Done.");
    expect(messages).toHaveLength(2); // user + assistant
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].role).toBe("assistant");
    expect(tokens).toEqual(["Done."]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/__tests__/loop.test.ts`
Expected: FAIL — `Cannot find module "../loop"`

**Step 3: Write `packages/core/src/loop.ts`**

```typescript
import type { ToolMap, ToolSpec } from "./tools";
import { deriveToolSpecs } from "./tools";

export interface LoopOptions {
  prompt: string;
  messages: any[];
  toolMap: ToolMap;
  client: any;
  model: string;
  systemPrompt?: string;
  hooks: any;
  onToken: (delta: string) => void;
  onToolStart: (name: string) => void;
  onToolEnd: (name: string, success: boolean, output: string) => void;
}

export async function runTurn(opts: LoopOptions): Promise<string> {
  const {
    prompt,
    messages,
    toolMap,
    client,
    model,
    systemPrompt,
    hooks,
    onToken,
    onToolStart,
    onToolEnd,
  } = opts;

  // Push user message
  messages.push({ role: "user", content: prompt });
  await hooks.emit("prompt:submit", JSON.stringify({ prompt }));

  // Derive tool specs from current toolMap (supports dynamic registration)
  const tools = deriveToolSpecs(toolMap);

  // Inner loop: LLM → tool_use? → execute → LLM … until text response
  while (true) {
    const stream = await client.messages.stream({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Stream token deltas
    if (Symbol.asyncIterator in stream) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          onToken(event.delta.text);
        }
      }
    }

    // Get the final complete response
    const response =
      typeof stream.finalMessage === "function"
        ? await stream.finalMessage()
        : stream;

    // Add assistant turn to history
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("");
      await hooks.emit("prompt:complete", JSON.stringify({ response: text }));
      return text;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b: any) => b.type === "tool_use",
      );
      const toolResults: any[] = [];

      for (const block of toolUseBlocks) {
        onToolStart(block.name);

        // Fire hook: tool:pre — may Deny
        const pre = await hooks.emit(
          "tool:pre",
          JSON.stringify({ tool_name: block.name, input: block.input }),
        );

        let output: { success: boolean; output: string };

        if (pre.action === "Deny") {
          output = {
            success: false,
            output: `blocked: ${pre.reason ?? "policy"}`,
          };
        } else {
          const bridge = toolMap.get(block.name);
          if (!bridge) {
            output = { success: false, output: `unknown tool: ${block.name}` };
          } else {
            try {
              const resultJson = await bridge.execute(
                JSON.stringify(block.input),
              );
              output = JSON.parse(resultJson);
            } catch (e: any) {
              output = { success: false, output: e.message };
            }
          }
        }

        // Fire hook: tool:post
        await hooks.emit(
          "tool:post",
          JSON.stringify({
            tool_name: block.name,
            success: output.success,
            output: output.output,
          }),
        );
        onToolEnd(block.name, output.success, output.output);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: output.output,
        });
      }

      // Push tool results as user message and continue the loop
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop_reason — bail
    return `[stopped: ${response.stop_reason}]`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/core/src/__tests__/loop.test.ts`
Expected: PASS — 1 test passes

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/core): add agentic loop with streaming and tool dispatch"
```

---

### Task 8: TDD `session.ts` — LoomSession class

**Files:**
- Create: `packages/core/src/session.ts`
- Test: `packages/core/src/__tests__/session.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/session.test.ts`:

```typescript
import { describe, it, expect, mock } from "bun:test";
import { LoomSession } from "../session";
import type { LoomConfig } from "../types";

const mockConfig: LoomConfig = {
  provider: {
    model: "claude-opus-4",
    createClient: () => ({
      messages: {
        stream: mock(() => ({
          async *[Symbol.asyncIterator]() {},
          finalMessage: async () => ({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Hello back." }],
          }),
        })),
      },
    }),
  },
  packages: [],
};

describe("LoomSession", () => {
  it("creates session with unique ID", () => {
    const s = new LoomSession(mockConfig);
    expect(s.sessionId).toBeTruthy();
    expect(typeof s.sessionId).toBe("string");
    expect(s.sessionId.length).toBeGreaterThan(0);
  });

  it("two sessions have different IDs", () => {
    const s1 = new LoomSession(mockConfig);
    const s2 = new LoomSession(mockConfig);
    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  it("creates child session with parent ID", () => {
    const parent = new LoomSession(mockConfig);
    const child = new LoomSession(mockConfig, {
      parentId: parent.sessionId,
    });
    expect(child.parentId).toBe(parent.sessionId);
  });

  it("cancel sets graceful cancellation", () => {
    const s = new LoomSession(mockConfig);
    expect(s.isCancelled).toBe(false);
    s.cancel();
    expect(s.isCancelled).toBe(true);
  });

  it("cancelImmediate sets immediate cancellation", () => {
    const s = new LoomSession(mockConfig);
    s.cancelImmediate();
    expect(s.isCancelled).toBe(true);
  });

  it("cleanup resolves without error", async () => {
    const s = new LoomSession(mockConfig);
    await expect(s.cleanup()).resolves.toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/__tests__/session.test.ts`
Expected: FAIL — `Cannot find module "../session"`

**Step 3: Write `packages/core/src/session.ts`**

```typescript
import { createRequire } from "module";
import { createToolMap, registerPackageTools } from "./tools";
import { runTurn } from "./loop";
import type { LoomConfig, LoomPackage } from "./types";
import type { ToolMap } from "./tools";

const require = createRequire(import.meta.url);
const amp = require("amplifier-core");

const AMPLIFIER_CONFIG = JSON.stringify({
  session: { orchestrator: "loop-basic", context: "context-simple" },
});

export interface SessionOptions {
  parentId?: string;
}

export class LoomSession {
  readonly sessionId: string;
  readonly parentId?: string;
  private _session: any;
  private _toolMap: ToolMap;
  private _messages: any[] = [];
  private _config: LoomConfig;

  constructor(config: LoomConfig, opts: SessionOptions = {}) {
    this._config = config;

    // Create the Rust kernel session
    this._session = new amp.JsAmplifierSession(
      AMPLIFIER_CONFIG,
      null,
      opts.parentId ?? null,
    );
    this._session.setInitialized();
    this.sessionId = this._session.sessionId;
    this.parentId = opts.parentId;

    // Register all package tools into the JS-side tool map
    this._toolMap = createToolMap();
    for (const pkg of config.packages) {
      registerPackageTools(this._toolMap, pkg);
    }

    // Register package hooks into the Rust hook pipeline
    const hooks = this._session.coordinator.hooks;
    for (const pkg of config.packages) {
      for (const h of pkg.hooks ?? []) {
        hooks.register(h.event, h.handler, h.priority ?? 0, h.name ?? h.event);
      }
    }

    // Tag all hook emissions with this session ID
    hooks.setDefaultFields(
      JSON.stringify({ session_id: this.sessionId }),
    );
  }

  get isCancelled(): boolean {
    return this._session.coordinator.cancellation.isCancelled;
  }

  cancel(): void {
    this._session.coordinator.cancellation.requestGraceful();
  }

  cancelImmediate(): void {
    this._session.coordinator.cancellation.requestImmediate();
  }

  /**
   * Add a package mid-session. Tools become visible on the next turn.
   */
  addPackage(pkg: LoomPackage): void {
    registerPackageTools(this._toolMap, pkg);
    const hooks = this._session.coordinator.hooks;
    for (const h of pkg.hooks ?? []) {
      hooks.register(h.event, h.handler, h.priority ?? 0, h.name ?? h.event);
    }
  }

  async runTurn(
    prompt: string,
    callbacks: {
      onToken?: (delta: string) => void;
      onToolStart?: (name: string) => void;
      onToolEnd?: (name: string, success: boolean, output: string) => void;
    } = {},
  ): Promise<string> {
    this._session.coordinator.resetTurn();
    const client = this._config.provider.createClient();

    return runTurn({
      prompt,
      messages: this._messages,
      toolMap: this._toolMap,
      client,
      model: this._config.provider.model,
      systemPrompt: this._config.systemPrompt,
      hooks: this._session.coordinator.hooks,
      onToken: callbacks.onToken ?? (() => {}),
      onToolStart: callbacks.onToolStart ?? (() => {}),
      onToolEnd: callbacks.onToolEnd ?? (() => {}),
    });
  }

  async cleanup(): Promise<void> {
    await this._session.coordinator.hooks.emit(
      "session:end",
      JSON.stringify({ session_id: this.sessionId }),
    );
    await this._session.cleanup();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/core/src/__tests__/session.test.ts`
Expected: PASS — 6 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/core): add LoomSession with tool registration and cancellation"
```

---

### Task 9: Barrel export and full core test run

**Files:**
- Create: `packages/core/src/index.ts`

**Step 1: Create `packages/core/src/index.ts`**

```typescript
export { LoomSession } from "./session";
export type { SessionOptions } from "./session";
export type {
  LoomTool,
  LoomHookHandler,
  LoomContext,
  LoomPackage,
  LoomProvider,
  LoomConfig,
} from "./types";
export { createToolMap, registerPackageTools, deriveToolSpecs } from "./tools";
export type { ToolMap, ToolBridge, ToolSpec } from "./tools";
export { runTurn } from "./loop";
export type { LoopOptions } from "./loop";
```

**Step 2: Run all core tests**

Run: `bun test packages/core/`
Expected: PASS — all 15 tests across 4 test files pass

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/core): complete — barrel exports and full test pass"
```

---

## Group C: @loom-code/session-store (Tasks 10–16)

All tests in this group are pure unit tests — no napi-rs, no API calls.

### Task 10: Scaffold @loom-code/session-store package

**Files:**
- Create: `packages/session-store/package.json`
- Create: `packages/session-store/tsconfig.json`

**Step 1: Create directory structure**

```bash
mkdir -p packages/session-store/src/__tests__
```

**Step 2: Create `packages/session-store/package.json`**:

```json
{
  "name": "@loom-code/session-store",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  }
}
```

**Step 3: Create `packages/session-store/tsconfig.json`**:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 4: Run `bun install` from workspace root**

Run: `bun install`
Expected: no errors

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold @loom-code/session-store package"
```

---

### Task 11: TDD `types.ts` — checkpoint type interfaces

**Files:**
- Create: `packages/session-store/src/types.ts`
- Test: `packages/session-store/src/__tests__/types.test.ts`

**Step 1: Write the failing test**

Create `packages/session-store/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import type {
  MessageRecord,
  SessionCheckpoint,
  CheckpointSnapshot,
  CheckpointEntry,
  SessionMetadata,
} from "../types";

describe("session-store types", () => {
  it("MessageRecord has id, role, and content", () => {
    const msg: MessageRecord = {
      id: "m_001",
      role: "user",
      content: "hello",
    };
    expect(msg.id).toBe("m_001");
    expect(msg.role).toBe("user");
  });

  it("SessionCheckpoint delta has newMessageIds", () => {
    const cp: SessionCheckpoint = {
      id: "cp_0001",
      turnIndex: 1,
      newMessageIds: ["m_001", "m_002"],
      intent: "test session",
    };
    expect(cp.newMessageIds).toHaveLength(2);
    expect(cp.toolSet).toBeUndefined(); // optional — only on change
  });

  it("CheckpointSnapshot has allMessageIds for full recovery", () => {
    const snap: CheckpointSnapshot = {
      id: "snap_0020",
      turnIndex: 20,
      allMessageIds: ["m_001", "m_002"],
      toolSet: ["@loom-code/shell@1.0.0"],
      intent: "refactoring login",
    };
    expect(snap.allMessageIds).toBeDefined();
    expect(snap.toolSet).toHaveLength(1);
  });

  it("CheckpointEntry discriminated union works", () => {
    const delta: CheckpointEntry = {
      type: "delta",
      id: "cp_0001",
      turnIndex: 1,
      newMessageIds: ["m_001"],
      intent: "first",
    };
    const snapshot: CheckpointEntry = {
      type: "snapshot",
      id: "snap_0020",
      turnIndex: 20,
      allMessageIds: ["m_001"],
      toolSet: [],
      intent: "snapshot",
    };
    expect(delta.type).toBe("delta");
    expect(snapshot.type).toBe("snapshot");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/session-store/src/__tests__/types.test.ts`
Expected: FAIL — `Cannot find module "../types"`

**Step 3: Write `packages/session-store/src/types.ts`**

```typescript
export interface MessageRecord {
  id: string;
  role: "user" | "assistant";
  content: unknown;
  timestamp?: string;
}

export interface SessionCheckpoint {
  id: string;
  turnIndex: number;
  newMessageIds: string[]; // only NEW messages this turn (2-5 typically)
  toolSet?: string[]; // only written when packages change
  config?: Record<string, unknown>; // only written when config changes
  intent: string;
}

export interface CheckpointSnapshot {
  id: string;
  turnIndex: number;
  allMessageIds: string[]; // full snapshot every 20 turns
  toolSet: string[];
  config?: Record<string, unknown>;
  intent: string;
}

export interface SessionMetadata {
  sessionId: string;
  created: string;
  lastActive: string;
  model: string;
  intent: string;
  turnCount: number;
}

export type CheckpointEntry =
  | ({ type: "delta" } & SessionCheckpoint)
  | ({ type: "snapshot" } & CheckpointSnapshot);
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/session-store/src/__tests__/types.test.ts`
Expected: PASS — 4 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/session-store): add checkpoint type interfaces"
```

---

### Task 12: TDD `store.ts` — append-only JSONL I/O

**Files:**
- Create: `packages/session-store/src/store.ts`
- Test: `packages/session-store/src/__tests__/store.test.ts`

**Step 1: Write the failing test**

Create `packages/session-store/src/__tests__/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { JsonlStore } from "../store";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let tmpDir: string;
let store: JsonlStore;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "loom-test-"));
  store = new JsonlStore(join(tmpDir, "test.jsonl"));
});

afterEach(() => rmSync(tmpDir, { recursive: true }));

describe("JsonlStore", () => {
  it("appends and reads back entries", async () => {
    await store.append({ id: "1", value: "hello" });
    await store.append({ id: "2", value: "world" });
    const entries = await store.readAll();
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe("1");
    expect(entries[1].value).toBe("world");
  });

  it("returns empty array for nonexistent file", async () => {
    const entries = await store.readAll();
    expect(entries).toHaveLength(0);
  });

  it("handles concurrent appends safely", async () => {
    await Promise.all([
      store.append({ id: "a" }),
      store.append({ id: "b" }),
      store.append({ id: "c" }),
    ]);
    const entries = await store.readAll();
    expect(entries).toHaveLength(3);
  });

  it("each line is valid JSON", async () => {
    await store.append({ nested: { a: 1, b: [2, 3] } });
    const entries = await store.readAll();
    expect(entries[0].nested.b).toEqual([2, 3]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/session-store/src/__tests__/store.test.ts`
Expected: FAIL — `Cannot find module "../store"`

**Step 3: Write `packages/session-store/src/store.ts`**

```typescript
import { appendFile, readFile } from "fs/promises";
import { existsSync } from "fs";

export class JsonlStore {
  private _path: string;
  private _lock: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this._path = path;
  }

  get path(): string {
    return this._path;
  }

  /** Append a single entry. Serializes concurrent writes to prevent interleaving. */
  async append(entry: unknown): Promise<void> {
    this._lock = this._lock.then(async () => {
      await appendFile(this._path, JSON.stringify(entry) + "\n", "utf8");
    });
    return this._lock;
  }

  /** Read all entries. Returns empty array if file doesn't exist. */
  async readAll<T = any>(): Promise<T[]> {
    if (!existsSync(this._path)) return [];
    const content = await readFile(this._path, "utf8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/session-store/src/__tests__/store.test.ts`
Expected: PASS — 4 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/session-store): add append-only JSONL store"
```

---

### Task 13: TDD `checkpoints.ts` — delta checkpoint model

**Files:**
- Create: `packages/session-store/src/checkpoints.ts`
- Test: `packages/session-store/src/__tests__/checkpoints.test.ts`

**Step 1: Write the failing test**

Create `packages/session-store/src/__tests__/checkpoints.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { buildCheckpointEntry, SNAPSHOT_INTERVAL } from "../checkpoints";

describe("checkpoints", () => {
  it("SNAPSHOT_INTERVAL is 20", () => {
    expect(SNAPSHOT_INTERVAL).toBe(20);
  });

  it("builds delta entry for normal turns", () => {
    const entry = buildCheckpointEntry({
      turnIndex: 5,
      newMessageIds: ["m_010", "m_011"],
      allMessageIds: ["m_001", "m_002", "m_010", "m_011"],
      toolSet: ["@loom-code/shell@1.0.0"],
      intent: "refactoring auth",
      prevToolSet: ["@loom-code/shell@1.0.0"], // unchanged
    });
    expect(entry.type).toBe("delta");
    if (entry.type === "delta") {
      expect(entry.toolSet).toBeUndefined(); // not written — unchanged
      expect(entry.newMessageIds).toEqual(["m_010", "m_011"]);
    }
  });

  it("includes toolSet in delta when packages changed", () => {
    const entry = buildCheckpointEntry({
      turnIndex: 5,
      newMessageIds: ["m_010"],
      allMessageIds: ["m_001", "m_010"],
      toolSet: ["@loom-code/shell@1.0.0", "@loom-code/db@1.0.0"],
      intent: "added db tool",
      prevToolSet: ["@loom-code/shell@1.0.0"], // changed!
    });
    expect(entry.type).toBe("delta");
    if (entry.type === "delta") {
      expect(entry.toolSet).toEqual([
        "@loom-code/shell@1.0.0",
        "@loom-code/db@1.0.0",
      ]);
    }
  });

  it("builds full snapshot at SNAPSHOT_INTERVAL boundary", () => {
    const allIds = Array.from(
      { length: 42 },
      (_, i) => `m_${String(i).padStart(3, "0")}`,
    );
    const entry = buildCheckpointEntry({
      turnIndex: 20,
      newMessageIds: ["m_040", "m_041"],
      allMessageIds: allIds,
      toolSet: ["@loom-code/shell@1.0.0"],
      intent: "20th turn",
      prevToolSet: ["@loom-code/shell@1.0.0"],
    });
    expect(entry.type).toBe("snapshot");
    if (entry.type === "snapshot") {
      expect(entry.allMessageIds).toHaveLength(42);
      expect(entry.toolSet).toEqual(["@loom-code/shell@1.0.0"]);
    }
  });

  it("builds snapshot at turn 40 too", () => {
    const entry = buildCheckpointEntry({
      turnIndex: 40,
      newMessageIds: ["m_080"],
      allMessageIds: Array.from({ length: 80 }, (_, i) => `m_${i}`),
      toolSet: [],
      intent: "turn 40",
      prevToolSet: [],
    });
    expect(entry.type).toBe("snapshot");
  });

  it("turn 0 is a delta, not a snapshot", () => {
    const entry = buildCheckpointEntry({
      turnIndex: 0,
      newMessageIds: ["m_000", "m_001"],
      allMessageIds: ["m_000", "m_001"],
      toolSet: ["@loom-code/shell@1.0.0"],
      intent: "first turn",
      prevToolSet: [],
    });
    // turnIndex 0: 0 % 20 === 0 but guard with turnIndex > 0
    expect(entry.type).toBe("delta");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/session-store/src/__tests__/checkpoints.test.ts`
Expected: FAIL — `Cannot find module "../checkpoints"`

**Step 3: Write `packages/session-store/src/checkpoints.ts`**

```typescript
import type { CheckpointEntry } from "./types";

export const SNAPSHOT_INTERVAL = 20;

export interface CheckpointInput {
  turnIndex: number;
  newMessageIds: string[];
  allMessageIds: string[];
  toolSet: string[];
  intent: string;
  prevToolSet: string[];
  config?: Record<string, unknown>;
  prevConfig?: Record<string, unknown>;
}

export function buildCheckpointEntry(input: CheckpointInput): CheckpointEntry {
  const id = `cp_${String(input.turnIndex).padStart(4, "0")}`;
  const toolSetChanged =
    JSON.stringify(input.toolSet) !== JSON.stringify(input.prevToolSet);
  const configChanged =
    JSON.stringify(input.config) !== JSON.stringify(input.prevConfig);

  // Full snapshot every SNAPSHOT_INTERVAL turns (but not turn 0)
  if (input.turnIndex > 0 && input.turnIndex % SNAPSHOT_INTERVAL === 0) {
    return {
      type: "snapshot",
      id,
      turnIndex: input.turnIndex,
      allMessageIds: input.allMessageIds,
      toolSet: input.toolSet,
      config: input.config,
      intent: input.intent,
    };
  }

  // Delta entry — only what changed
  return {
    type: "delta",
    id,
    turnIndex: input.turnIndex,
    newMessageIds: input.newMessageIds,
    toolSet: toolSetChanged ? input.toolSet : undefined,
    config: configChanged ? input.config : undefined,
    intent: input.intent,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/session-store/src/__tests__/checkpoints.test.ts`
Expected: PASS — 6 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/session-store): add checkpoint delta model with periodic snapshots"
```

---

### Task 14: TDD `reconstruction.ts` — fold, validate, and repair

**Files:**
- Create: `packages/session-store/src/reconstruction.ts`
- Test: `packages/session-store/src/__tests__/reconstruction.test.ts`

**Step 1: Write the failing test**

Create `packages/session-store/src/__tests__/reconstruction.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  reconstructAt,
  validateMessages,
  repairMessages,
} from "../reconstruction";
import type { CheckpointEntry, MessageRecord } from "../types";

// --- fixtures ---

const messages: MessageRecord[] = [
  { id: "m_001", role: "user", content: "hello" },
  { id: "m_002", role: "assistant", content: "hi" },
  { id: "m_003", role: "user", content: "do something" },
  {
    id: "m_004",
    role: "assistant",
    content: [{ type: "tool_use", id: "tu_1", name: "bash", input: {} }],
  },
  {
    id: "m_005",
    role: "user",
    content: [{ type: "tool_result", tool_use_id: "tu_1", content: "ok" }],
  },
];

const messageMap = new Map(messages.map((m) => [m.id, m]));

const checkpoints: CheckpointEntry[] = [
  {
    type: "delta",
    id: "cp_0001",
    turnIndex: 1,
    newMessageIds: ["m_001", "m_002"],
    intent: "first turn",
  },
  {
    type: "delta",
    id: "cp_0002",
    turnIndex: 2,
    newMessageIds: ["m_003", "m_004", "m_005"],
    intent: "second turn",
  },
];

// --- tests ---

describe("reconstructAt", () => {
  it("reconstructs messages at turn 1", () => {
    const result = reconstructAt(checkpoints, messageMap, 1);
    expect(result.messageIds).toEqual(["m_001", "m_002"]);
  });

  it("reconstructs messages up to turn 2", () => {
    const result = reconstructAt(checkpoints, messageMap, 2);
    expect(result.messageIds).toHaveLength(5);
    expect(result.messageIds).toEqual([
      "m_001",
      "m_002",
      "m_003",
      "m_004",
      "m_005",
    ]);
  });

  it("uses snapshot as base when available", () => {
    const withSnapshot: CheckpointEntry[] = [
      {
        type: "delta",
        id: "cp_0001",
        turnIndex: 1,
        newMessageIds: ["m_001", "m_002"],
        intent: "turn 1",
      },
      {
        type: "snapshot",
        id: "snap_0020",
        turnIndex: 20,
        allMessageIds: ["m_001", "m_002", "m_003"],
        toolSet: [],
        intent: "snapshot at 20",
      },
      {
        type: "delta",
        id: "cp_0021",
        turnIndex: 21,
        newMessageIds: ["m_004", "m_005"],
        intent: "turn 21",
      },
    ];
    const result = reconstructAt(withSnapshot, messageMap, 21);
    // Should use snapshot as base (m_001..m_003) + delta (m_004, m_005)
    expect(result.messageIds).toEqual([
      "m_001",
      "m_002",
      "m_003",
      "m_004",
      "m_005",
    ]);
  });
});

describe("validateMessages", () => {
  it("passes for valid message array", () => {
    const msgs = messages.map((m) => ({ role: m.role, content: m.content }));
    const result = validateMessages(msgs);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("catches orphaned tool_use without tool_result", () => {
    const bad = [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu_orphan", name: "bash", input: {} },
        ],
      },
      { role: "user", content: "next message" }, // not a tool_result!
    ];
    const result = validateMessages(bad);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("orphaned"))).toBe(true);
  });

  it("catches tool_use at end of array with no following message", () => {
    const bad = [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu_orphan", name: "bash", input: {} },
        ],
      },
    ];
    const result = validateMessages(bad);
    expect(result.valid).toBe(false);
  });
});

describe("repairMessages", () => {
  it("removes orphaned tool_use blocks", () => {
    const bad = [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu_orphan", name: "bash", input: {} },
        ],
      },
    ];
    const repaired = repairMessages(bad);
    const check = validateMessages(repaired);
    expect(check.valid).toBe(true);
  });

  it("preserves text content alongside orphaned tool_use", () => {
    const bad = [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me try" },
          { type: "tool_use", id: "tu_orphan", name: "bash", input: {} },
        ],
      },
    ];
    const repaired = repairMessages(bad);
    expect(repaired).toHaveLength(2);
    expect((repaired[1].content as any[])[0].text).toBe("Let me try");
  });

  it("does not modify already-valid messages", () => {
    const valid = messages.map((m) => ({ role: m.role, content: m.content }));
    const repaired = repairMessages(valid);
    expect(repaired).toHaveLength(valid.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/session-store/src/__tests__/reconstruction.test.ts`
Expected: FAIL — `Cannot find module "../reconstruction"`

**Step 3: Write `packages/session-store/src/reconstruction.ts`**

```typescript
import type { CheckpointEntry, MessageRecord } from "./types";

export interface ReconstructionResult {
  messageIds: string[];
  toolSet?: string[];
  config?: Record<string, unknown>;
  intent: string;
}

/**
 * Reconstruct the message ID list at a given turn by folding
 * checkpoint deltas, using the nearest snapshot as a base.
 */
export function reconstructAt(
  checkpoints: CheckpointEntry[],
  _messageMap: Map<string, MessageRecord>,
  targetTurn: number,
): ReconstructionResult {
  const relevant = checkpoints.filter((cp) => cp.turnIndex <= targetTurn);

  // Find the last snapshot at or before target turn
  const lastSnapshot = [...relevant]
    .reverse()
    .find((cp) => cp.type === "snapshot");

  let messageIds: string[];

  if (lastSnapshot && lastSnapshot.type === "snapshot") {
    // Start from snapshot, apply subsequent deltas
    const afterSnapshot = relevant.filter(
      (cp) => cp.turnIndex > lastSnapshot.turnIndex && cp.type === "delta",
    );
    messageIds = [
      ...lastSnapshot.allMessageIds,
      ...afterSnapshot.flatMap((cp) =>
        cp.type === "delta" ? cp.newMessageIds : [],
      ),
    ];
  } else {
    // No snapshot — fold all deltas from beginning
    messageIds = relevant.flatMap((cp) =>
      cp.type === "delta" ? cp.newMessageIds : [],
    );
  }

  // Find the latest toolSet (from snapshot or most recent delta that wrote one)
  const withToolSet = [...relevant]
    .reverse()
    .find((cp) =>
      cp.type === "snapshot" ? true : cp.type === "delta" && cp.toolSet != null,
    );

  const intent = relevant[relevant.length - 1]?.intent ?? "";

  return {
    messageIds,
    toolSet: withToolSet?.toolSet,
    intent,
  };
}

// --- Validation ---

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validate a message array against Anthropic's requirements:
 * - Every tool_use block in an assistant message must have a matching
 *   tool_result in the immediately following user message.
 */
export function validateMessages(
  messages: Array<{ role: string; content: unknown }>,
): ValidationResult {
  const issues: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const toolUseBlocks = (msg.content as any[]).filter(
        (b) => b.type === "tool_use",
      );

      if (toolUseBlocks.length > 0) {
        const next = messages[i + 1];

        if (!next || next.role !== "user" || !Array.isArray(next.content)) {
          issues.push(
            `Turn ${i}: orphaned tool_use blocks without matching tool_result`,
          );
        } else {
          const toolResultIds = new Set(
            (next.content as any[])
              .filter((b) => b.type === "tool_result")
              .map((b) => b.tool_use_id),
          );
          const missing = toolUseBlocks.filter(
            (b) => !toolResultIds.has(b.id),
          );
          if (missing.length > 0) {
            issues.push(
              `Turn ${i}: orphaned tool_use without matching tool_result for: ${missing.map((b) => b.id).join(", ")}`,
            );
          }
        }
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

// --- Repair ---

/**
 * Attempt to repair an invalid message array by stripping orphaned
 * tool_use blocks. Preserves any text content in the same message.
 */
export function repairMessages(
  messages: Array<{ role: string; content: unknown }>,
): Array<{ role: string; content: unknown }> {
  const result: Array<{ role: string; content: unknown }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const toolUseBlocks = (msg.content as any[]).filter(
        (b) => b.type === "tool_use",
      );

      if (toolUseBlocks.length > 0) {
        const next = messages[i + 1];
        const hasResults =
          next?.role === "user" &&
          Array.isArray(next.content) &&
          (next.content as any[]).some((b) => b.type === "tool_result");

        if (!hasResults) {
          // Strip tool_use blocks, keep text blocks
          const textOnly = (msg.content as any[]).filter(
            (b) => b.type !== "tool_use",
          );
          if (textOnly.length > 0) {
            result.push({ ...msg, content: textOnly });
          }
          // Skip this message entirely if no text content remains
          continue;
        }
      }
    }

    result.push(msg);
  }

  return result;
}

// --- Full reconstruction with validation + repair + fallback ---

/**
 * Reconstruct a valid message array at the target turn.
 *
 * Fallback chain: validate → repair → try previous turn → error.
 * Invariant: never returns an array that fails validation.
 */
export async function reconstruct(
  checkpoints: CheckpointEntry[],
  messageMap: Map<string, MessageRecord>,
  targetTurn: number,
): Promise<{ messages: any[]; meta: ReconstructionResult }> {
  const meta = reconstructAt(checkpoints, messageMap, targetTurn);
  const raw = meta.messageIds.map((id) => {
    const msg = messageMap.get(id);
    if (!msg) throw new Error(`Message ${id} not found in store`);
    return { role: msg.role, content: msg.content };
  });

  const check = validateMessages(raw);
  if (check.valid) return { messages: raw, meta };

  const repaired = repairMessages(raw);
  const check2 = validateMessages(repaired);
  if (check2.valid) return { messages: repaired, meta };

  // Fallback: try previous turn
  if (targetTurn > 0) {
    return reconstruct(checkpoints, messageMap, targetTurn - 1);
  }

  throw new Error(
    "Cannot reconstruct valid message history from any checkpoint",
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/session-store/src/__tests__/reconstruction.test.ts`
Expected: PASS — 8 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/session-store): add reconstruction with validation, repair, and fallback"
```

---

### Task 15: Integration test — full checkpoint lifecycle

**Files:**
- Create: `packages/session-store/src/__tests__/integration.test.ts`
- Create: `packages/session-store/src/index.ts`

**Step 1: Write the integration test**

Create `packages/session-store/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { JsonlStore } from "../store";
import { buildCheckpointEntry } from "../checkpoints";
import { reconstruct, validateMessages } from "../reconstruction";
import type { MessageRecord, CheckpointEntry } from "../types";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "loom-int-"));
});
afterEach(() => rmSync(tmpDir, { recursive: true }));

describe("checkpoint lifecycle integration", () => {
  it("write turns → reconstruct → validate → correct messages", async () => {
    const msgStore = new JsonlStore(join(tmpDir, "messages.jsonl"));
    const cpStore = new JsonlStore(join(tmpDir, "checkpoints.jsonl"));

    // Simulate 2 turns
    const msgs: MessageRecord[] = [
      { id: "m_001", role: "user", content: "hello" },
      { id: "m_002", role: "assistant", content: "hi there" },
      { id: "m_003", role: "user", content: "do a thing" },
      { id: "m_004", role: "assistant", content: "done" },
    ];
    for (const m of msgs) await msgStore.append(m);

    const allMessages = await msgStore.readAll<MessageRecord>();
    const messageMap = new Map(allMessages.map((m) => [m.id, m]));

    const cp1 = buildCheckpointEntry({
      turnIndex: 1,
      newMessageIds: ["m_001", "m_002"],
      allMessageIds: ["m_001", "m_002"],
      toolSet: [],
      intent: "turn 1",
      prevToolSet: [],
    });
    const cp2 = buildCheckpointEntry({
      turnIndex: 2,
      newMessageIds: ["m_003", "m_004"],
      allMessageIds: ["m_001", "m_002", "m_003", "m_004"],
      toolSet: [],
      intent: "turn 2",
      prevToolSet: [],
    });
    await cpStore.append(cp1);
    await cpStore.append(cp2);

    const checkpoints = await cpStore.readAll<CheckpointEntry>();
    const { messages } = await reconstruct(checkpoints, messageMap, 2);

    expect(messages).toHaveLength(4);
    expect(messages[0].content).toBe("hello");
    expect(messages[3].content).toBe("done");

    const { valid } = validateMessages(messages);
    expect(valid).toBe(true);
  });

  it("corrupt message triggers repair (strip orphaned tool_use)", async () => {
    const msgStore = new JsonlStore(join(tmpDir, "messages.jsonl"));
    const cpStore = new JsonlStore(join(tmpDir, "checkpoints.jsonl"));

    // Turn 1: clean
    await msgStore.append({ id: "m_001", role: "user", content: "hello" });
    await msgStore.append({ id: "m_002", role: "assistant", content: "hi" });
    await cpStore.append(
      buildCheckpointEntry({
        turnIndex: 1,
        newMessageIds: ["m_001", "m_002"],
        allMessageIds: ["m_001", "m_002"],
        toolSet: [],
        intent: "clean",
        prevToolSet: [],
      }),
    );

    // Turn 2: corrupt — orphaned tool_use, NO tool_result
    await msgStore.append({
      id: "m_003",
      role: "user",
      content: "do something",
    });
    await msgStore.append({
      id: "m_004",
      role: "assistant",
      content: [
        { type: "tool_use", id: "tu_1", name: "bash", input: {} },
      ],
    });
    await cpStore.append(
      buildCheckpointEntry({
        turnIndex: 2,
        newMessageIds: ["m_003", "m_004"],
        allMessageIds: ["m_001", "m_002", "m_003", "m_004"],
        toolSet: [],
        intent: "corrupt",
        prevToolSet: [],
      }),
    );

    const allMsgs = await msgStore.readAll<MessageRecord>();
    const messageMap = new Map(allMsgs.map((m) => [m.id, m]));
    const checkpoints = await cpStore.readAll<CheckpointEntry>();

    // reconstruct should repair (strip orphaned tool_use) or fall back
    const { messages } = await reconstruct(checkpoints, messageMap, 2);
    expect(messages.length).toBeGreaterThan(0);

    const { valid } = validateMessages(messages);
    expect(valid).toBe(true);
  });
});
```

**Step 2: Run the integration test**

Run: `bun test packages/session-store/src/__tests__/integration.test.ts`
Expected: PASS — 2 tests pass

**Step 3: Create `packages/session-store/src/index.ts`**

```typescript
export { JsonlStore } from "./store";
export {
  buildCheckpointEntry,
  SNAPSHOT_INTERVAL,
} from "./checkpoints";
export type { CheckpointInput } from "./checkpoints";
export {
  reconstructAt,
  reconstruct,
  validateMessages,
  repairMessages,
} from "./reconstruction";
export type { ReconstructionResult, ValidationResult } from "./reconstruction";
export type {
  MessageRecord,
  SessionCheckpoint,
  CheckpointSnapshot,
  CheckpointEntry,
  SessionMetadata,
} from "./types";
```

**Step 4: Run all session-store tests**

Run: `bun test packages/session-store/`
Expected: PASS — all 22 tests across 5 test files pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(@loom-code/session-store): complete — JSONL store + delta checkpoints + reconstruction + repair"
```

---

### Task 16: Run full workspace test suite

**Step 1: Run all tests across all packages**

Run: `bun test --recursive`
Expected: ALL tests across both packages pass.

**Step 2: Verify file structure**

Run: `find packages -type f -name '*.ts' | sort`
Expected output:
```
packages/core/src/__tests__/loop.test.ts
packages/core/src/__tests__/session.test.ts
packages/core/src/__tests__/tools.test.ts
packages/core/src/__tests__/types.test.ts
packages/core/src/index.ts
packages/core/src/loop.ts
packages/core/src/session.ts
packages/core/src/tools.ts
packages/core/src/types.ts
packages/session-store/src/__tests__/checkpoints.test.ts
packages/session-store/src/__tests__/integration.test.ts
packages/session-store/src/__tests__/reconstruction.test.ts
packages/session-store/src/__tests__/store.test.ts
packages/session-store/src/__tests__/types.test.ts
packages/session-store/src/checkpoints.ts
packages/session-store/src/index.ts
packages/session-store/src/reconstruction.ts
packages/session-store/src/store.ts
packages/session-store/src/types.ts
```

**Step 3: Final commit**

```bash
git add -A && git commit -m "chore: Phase 1 complete — Bun monorepo + @loom-code/core + @loom-code/session-store"
```

---

## What Phase 1 Delivers

| Package | What it does | Tests |
|---|---|---|
| `@loom-code/core` | `LoomSession` wrapping amplifier-core, agentic loop, tool dispatch via `JsToolBridge`, hook emissions, graceful/immediate cancellation, dynamic package addition | ~15 unit/integration tests |
| `@loom-code/session-store` | Append-only JSONL message store, delta checkpoint model with periodic snapshots, reconstruction by folding deltas from nearest snapshot, validation (orphaned tool_use detection), repair (strip orphans), fallback chain | ~22 unit tests |
| Workspace | Bun monorepo with `packages/*` workspaces, shared tsconfig, napi-rs compatibility verified | Smoke test script |

## Phase 2 Preview

Phase 2 will add the UI packages (`@loom-code/ui-*`) and `@loom-code/provider-anthropic` — the rendering layer that connects `LoomSession` events to `@opentui/react` components.