#!/usr/bin/env bun
/**
 * scripts/chat.ts — loom-code text REPL
 *
 * Quick end-to-end test: stdin → LoomSession → Anthropic SDK → stdout
 * No TUI yet — just proves the plumbing works.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... bun run scripts/chat.ts
 *   ANTHROPIC_API_KEY=sk-ant-... MODEL=claude-haiku-4-5 bun run scripts/chat.ts
 */

import { createInterface } from 'readline'
import { LoomSession } from '@loom-code/core'
import { createAnthropicProvider } from '@loom-code/provider-anthropic'

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('loom-code: ANTHROPIC_API_KEY is not set')
  console.error('  export ANTHROPIC_API_KEY=sk-ant-...')
  process.exit(1)
}

const model = process.env.MODEL ?? 'claude-opus-4-5'
const provider = createAnthropicProvider({ model, apiKey })
const session = new LoomSession({ provider, packages: [] })

console.log(`loom-code chat  [${model}  session:${session.sessionId.slice(0, 8)}]`)
console.log('ctrl+c to exit\n')

const rl = createInterface({ input: process.stdin, terminal: false })

async function runLoop() {
  for await (const line of rl) {
    const input = line.trim()
    if (!input) continue

    process.stdout.write('\n')
    try {
      await session.runTurn(input, {
        onToken: (delta) => process.stdout.write(delta),
      })
    } catch (err) {
      console.error('\n[error]', err instanceof Error ? err.message : String(err))
    }
    process.stdout.write('\n\n> ')
  }
}

process.stdout.write('> ')
runLoop().then(async () => {
  await session.cleanup()
  process.exit(0)
}).catch(async (err) => {
  console.error('[fatal]', err instanceof Error ? err.message : err)
  await session.cleanup()
  process.exit(1)
})
