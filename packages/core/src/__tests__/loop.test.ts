import { describe, it, expect, mock } from 'bun:test'
import { runTurn } from '../loop'
import { createToolMap, registerPackageTools } from '../tools'
import type { LoomTool } from '../types'

// Helper to create a mock streaming client
function makeMockClient(scenario: 'text-only' | 'tool-use' | 'tool-denied' | 'tool-error') {
  const callCount = { n: 0 }

  return {
    messages: {
      stream: mock(async (_params: unknown) => {
        callCount.n++
        const call = callCount.n

        if (scenario === 'text-only') {
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } }
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world.' } }
            },
            finalMessage: async () => ({
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: 'Hello world.' }],
            }),
          }
        }

        if (scenario === 'tool-use') {
          if (call === 1) {
            // First call: LLM requests a tool
            return {
              [Symbol.asyncIterator]: async function* () {},
              finalMessage: async () => ({
                stop_reason: 'tool_use',
                content: [
                  { type: 'tool_use', id: 'tu_001', name: 'echo', input: { text: 'ping' } },
                ],
              }),
            }
          }
          // Second call: LLM returns final text after tool result
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Done: ping' } }
            },
            finalMessage: async () => ({
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: 'Done: ping' }],
            }),
          }
        }

        if (scenario === 'tool-denied') {
          if (call === 1) {
            return {
              [Symbol.asyncIterator]: async function* () {},
              finalMessage: async () => ({
                stop_reason: 'tool_use',
                content: [
                  { type: 'tool_use', id: 'tu_002', name: 'echo', input: { text: 'blocked' } },
                ],
              }),
            }
          }
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Understood.' } }
            },
            finalMessage: async () => ({
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: 'Understood.' }],
            }),
          }
        }

        if (scenario === 'tool-error') {
          if (call === 1) {
            return {
              [Symbol.asyncIterator]: async function* () {},
              finalMessage: async () => ({
                stop_reason: 'tool_use',
                content: [
                  { type: 'tool_use', id: 'tu_003', name: 'echo', input: { text: 'boom' } },
                ],
              }),
            }
          }
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Noted error.' } }
            },
            finalMessage: async () => ({
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: 'Noted error.' }],
            }),
          }
        }

        throw new Error(`Unknown scenario: ${scenario}`)
      }),
    },
  }
}

// Mock hooks that always continue
function makeMockHooks(policy: 'allow' | 'deny-tool' = 'allow') {
  return {
    emit: mock(async (event: string, _dataJson: string) => {
      if (policy === 'deny-tool' && event === 'tool:pre') {
        return { action: 'Deny', reason: 'policy: blocked in test' }
      }
      return { action: 'Continue' }
    }),
  }
}

const echoTool: LoomTool = {
  name: 'echo',
  description: 'Echo text back',
  schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  execute: async (inputJson) => {
    const { text } = JSON.parse(inputJson)
    return JSON.stringify({ success: true, output: text })
  },
}

const errorTool: LoomTool = {
  name: 'echo', // intentionally same name — will throw
  description: 'Echo that throws',
  schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  execute: async () => {
    throw new Error('tool exploded')
  },
}

describe('runTurn — text-only response', () => {
  it('returns text content on end_turn with no tools', async () => {
    const messages: unknown[] = []
    const toolMap = createToolMap()
    const hooks = makeMockHooks()
    const client = makeMockClient('text-only')

    const result = await runTurn({
      prompt: 'Hello',
      messages,
      toolMap,
      client,
      model: 'claude-opus-4',
      hooks,
      onToken: () => {},
      onToolStart: () => {},
      onToolEnd: () => {},
    })

    expect(result).toBe('Hello world.')
    expect(messages).toHaveLength(2) // user + assistant
    expect((messages[0] as any).role).toBe('user')
    expect((messages[1] as any).role).toBe('assistant')
  })

  it('calls onToken for each streamed delta', async () => {
    const tokens: string[] = []
    const toolMap = createToolMap()
    const hooks = makeMockHooks()
    const client = makeMockClient('text-only')

    await runTurn({
      prompt: 'Stream test',
      messages: [],
      toolMap,
      client,
      model: 'claude-opus-4',
      hooks,
      onToken: (delta) => tokens.push(delta),
      onToolStart: () => {},
      onToolEnd: () => {},
    })

    expect(tokens).toEqual(['Hello ', 'world.'])
  })

  it('emits prompt:submit and prompt:complete hooks', async () => {
    const hooks = makeMockHooks()
    const client = makeMockClient('text-only')
    const emittedEvents: string[] = []
    const trackingHooks = {
      emit: mock(async (event: string, dataJson: string) => {
        emittedEvents.push(event)
        return hooks.emit(event, dataJson)
      }),
    }

    await runTurn({
      prompt: 'Hook test',
      messages: [],
      toolMap: createToolMap(),
      client,
      model: 'claude-opus-4',
      hooks: trackingHooks,
      onToken: () => {},
      onToolStart: () => {},
      onToolEnd: () => {},
    })

    expect(emittedEvents).toContain('prompt:submit')
    expect(emittedEvents).toContain('prompt:complete')
    expect(emittedEvents.indexOf('prompt:submit')).toBeLessThan(emittedEvents.indexOf('prompt:complete'))
  })
})

describe('runTurn — tool use', () => {
  it('dispatches tool and continues loop until end_turn', async () => {
    const messages: unknown[] = []
    const toolMap = createToolMap()
    registerPackageTools(toolMap, { tools: [echoTool] })
    const hooks = makeMockHooks()
    const client = makeMockClient('tool-use')

    const toolsStarted: string[] = []
    const toolsEnded: string[] = []

    const result = await runTurn({
      prompt: 'Use echo tool',
      messages,
      toolMap,
      client,
      model: 'claude-opus-4',
      hooks,
      onToken: () => {},
      onToolStart: (name) => toolsStarted.push(name),
      onToolEnd: (name, success) => toolsEnded.push(`${name}:${success}`),
    })

    expect(result).toBe('Done: ping')
    expect(toolsStarted).toContain('echo')
    expect(toolsEnded).toContain('echo:true')
  })

  it('emits tool:pre and tool:post hooks', async () => {
    const emittedEvents: string[] = []
    const trackingHooks = {
      emit: mock(async (event: string, _dataJson: string) => {
        emittedEvents.push(event)
        return { action: 'Continue' }
      }),
    }
    const toolMap = createToolMap()
    registerPackageTools(toolMap, { tools: [echoTool] })
    const client = makeMockClient('tool-use')

    await runTurn({
      prompt: 'Tool hooks test',
      messages: [],
      toolMap,
      client,
      model: 'claude-opus-4',
      hooks: trackingHooks,
      onToken: () => {},
      onToolStart: () => {},
      onToolEnd: () => {},
    })

    expect(emittedEvents).toContain('tool:pre')
    expect(emittedEvents).toContain('tool:post')
    expect(emittedEvents.indexOf('tool:pre')).toBeLessThan(emittedEvents.indexOf('tool:post'))
  })

  it('blocks tool execution when hook returns Deny', async () => {
    const toolMap = createToolMap()
    registerPackageTools(toolMap, { tools: [echoTool] })
    const hooks = makeMockHooks('deny-tool')
    const client = makeMockClient('tool-denied')

    const toolsEnded: string[] = []

    const result = await runTurn({
      prompt: 'Deny test',
      messages: [],
      toolMap,
      client,
      model: 'claude-opus-4',
      hooks,
      onToken: () => {},
      onToolStart: () => {},
      onToolEnd: (_name, success) => toolsEnded.push(`${success}`),
    })

    // Denied tool still returns a result (blocked) and loop continues
    expect(toolsEnded).toContain('false') // blocked = success:false
    expect(result).toBe('Understood.')
  })

  it('captures tool execution errors in result without throwing', async () => {
    const toolMap = createToolMap()
    registerPackageTools(toolMap, { tools: [errorTool] })
    const hooks = makeMockHooks()
    const client = makeMockClient('tool-error')

    const toolsEnded: string[] = []

    // Should NOT throw even though the tool throws internally
    const result = await runTurn({
      prompt: 'Error test',
      messages: [],
      toolMap,
      client,
      model: 'claude-opus-4',
      hooks,
      onToken: () => {},
      onToolStart: () => {},
      onToolEnd: (_name, success) => toolsEnded.push(`${success}`),
    })

    expect(toolsEnded).toContain('false') // error = success:false
    expect(result).toBe('Noted error.')
  })

  it('handles unknown tool name gracefully', async () => {
    const toolMap = createToolMap() // empty — no tools registered
    const hooks = makeMockHooks()
    const client = makeMockClient('tool-use') // will request 'echo' tool

    const toolsEnded: string[] = []

    const result = await runTurn({
      prompt: 'Unknown tool test',
      messages: [],
      toolMap,
      client,
      model: 'claude-opus-4',
      hooks,
      onToken: () => {},
      onToolStart: () => {},
      onToolEnd: (_name, success) => toolsEnded.push(`${success}`),
    })

    expect(toolsEnded).toContain('false') // unknown = success:false
    expect(result).toBe('Done: ping')
  })
})
