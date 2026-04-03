/**
 * Smoke test: does the amplifier-core napi-rs binary load under Bun?
 *
 * This must pass before any @loom-code/core work begins.
 * If it fails, use Node.js as runtime instead of Bun.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Resolve relative to this script — amplifier-node is a sibling of the project root
// Note: in worktree at .worktrees/feat-phase-1-foundation/scripts/, need 4 levels up to reach /ms/
const amp = require("../../../../amplifier-node/amplifier-core/bindings/node/index.js");

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
