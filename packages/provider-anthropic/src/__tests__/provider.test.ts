import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createAnthropicProvider } from '../provider'

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

  it('createClient returns an object with a messages property', () => {
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

  it('apiKey is undefined when not provided in config', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(provider.apiKey).toBeUndefined()
  })

  it('maxTokens defaults to 8096 when not configured', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect((provider as any).maxTokens).toBe(8096)
  })

  it('maxTokens uses configured value when provided', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4', maxTokens: 4096 })
    expect((provider as any).maxTokens).toBe(4096)
  })

  it('does not throw when apiKey comes from env var', () => {
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(() => provider.createClient()).not.toThrow()
  })
})
