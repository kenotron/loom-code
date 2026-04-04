import { describe, it, expect } from 'bun:test'

describe('@loom-code/provider-anthropic barrel exports', () => {
  it('exports createAnthropicProvider', async () => {
    const { createAnthropicProvider } = await import('../index')
    expect(typeof createAnthropicProvider).toBe('function')
  })

  it('createAnthropicProvider returns a provider with expected shape', async () => {
    const { createAnthropicProvider } = await import('../index')
    process.env.ANTHROPIC_API_KEY = 'sk-ant-smoke'
    const provider = createAnthropicProvider({ model: 'claude-opus-4' })
    expect(provider.model).toBe('claude-opus-4')
    expect(typeof provider.createClient).toBe('function')
    expect(provider.maxTokens).toBe(8096)
  })
})
