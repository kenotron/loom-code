import { describe, it, expect } from 'bun:test'
import { LoomSession } from '../session'
import type { LoomConfig, LoomTool, LoomPackage } from '../types'

// Minimal mock provider — won't make real API calls in these tests
const mockConfig: LoomConfig = {
  provider: {
    model: 'claude-opus-4',
    createClient: () => ({
      messages: {
        stream: async () => ({
          [Symbol.asyncIterator]: async function* () {},
          finalMessage: async () => ({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'mock response' }],
          }),
        }),
      },
    }),
  },
  packages: [],
}

describe('LoomSession — construction', () => {
  it('creates a session with a unique sessionId string', async () => {
    const session = new LoomSession(mockConfig)
    expect(typeof session.sessionId).toBe('string')
    expect(session.sessionId.length).toBeGreaterThan(0)
    await session.cleanup()
  })

  it('two sessions have different sessionIds', async () => {
    const a = new LoomSession(mockConfig)
    const b = new LoomSession(mockConfig)
    expect(a.sessionId).not.toBe(b.sessionId)
    await a.cleanup()
    await b.cleanup()
  })

  it('creates child session with parentId pointing to parent', async () => {
    const parent = new LoomSession(mockConfig)
    const child = new LoomSession(mockConfig, { parentId: parent.sessionId })
    expect(child.parentId).toBe(parent.sessionId)
    await parent.cleanup()
    await child.cleanup()
  })

  it('parentId is undefined when not specified', async () => {
    const session = new LoomSession(mockConfig)
    expect(session.parentId).toBeUndefined()
    await session.cleanup()
  })
})

describe('LoomSession — cancellation', () => {
  it('isCancelled is false initially', async () => {
    const session = new LoomSession(mockConfig)
    expect(session.isCancelled).toBe(false)
    await session.cleanup()
  })

  it('cancel() sets isCancelled to true', async () => {
    const session = new LoomSession(mockConfig)
    session.cancel()
    expect(session.isCancelled).toBe(true)
    await session.cleanup()
  })

  it('cancelImmediate() also sets isCancelled to true', async () => {
    const session = new LoomSession(mockConfig)
    session.cancelImmediate()
    expect(session.isCancelled).toBe(true)
    await session.cleanup()
  })
})

describe('LoomSession — package management', () => {
  const echoTool: LoomTool = {
    name: 'echo',
    description: 'Echo text',
    schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: async (inputJson) => {
      const { text } = JSON.parse(inputJson)
      return JSON.stringify({ success: true, output: text })
    },
  }

  it('registers tools from packages at construction', async () => {
    const pkg: LoomPackage = { tools: [echoTool] }
    const config: LoomConfig = { ...mockConfig, packages: [pkg] }
    const session = new LoomSession(config)
    // Verify tool is accessible (will be used by runTurn)
    expect(session.hasToolNamed('echo')).toBe(true)
    await session.cleanup()
  })

  it('addPackage() registers new tools mid-session', async () => {
    const session = new LoomSession(mockConfig)
    expect(session.hasToolNamed('echo')).toBe(false)

    const pkg: LoomPackage = { tools: [echoTool] }
    session.addPackage(pkg)

    expect(session.hasToolNamed('echo')).toBe(true)
    await session.cleanup()
  })

  it('addPackage() called multiple times accumulates tools', async () => {
    const calcTool: LoomTool = {
      name: 'calc',
      description: 'Calc',
      schema: {},
      execute: async () => JSON.stringify({ success: true, output: '4' }),
    }
    const session = new LoomSession(mockConfig)
    session.addPackage({ tools: [echoTool] })
    session.addPackage({ tools: [calcTool] })
    expect(session.hasToolNamed('echo')).toBe(true)
    expect(session.hasToolNamed('calc')).toBe(true)
    await session.cleanup()
  })
})

describe('LoomSession — cleanup', () => {
  it('cleanup() resolves without throwing', async () => {
    const session = new LoomSession(mockConfig)
    await expect(session.cleanup()).resolves.toBeUndefined()
  })

  it('cleanup() is idempotent (can call multiple times)', async () => {
    const session = new LoomSession(mockConfig)
    await session.cleanup()
    // Second cleanup should not throw
    await expect(session.cleanup()).resolves.toBeUndefined()
  })
})
