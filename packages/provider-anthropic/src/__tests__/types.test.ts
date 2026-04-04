import { describe, it, expect } from 'bun:test'
import type { AnthropicProviderConfig } from '../types'

describe('AnthropicProviderConfig', () => {
  it('has required model field', () => {
    const config: AnthropicProviderConfig = { model: 'claude-opus-4' }
    expect(config.model).toBe('claude-opus-4')
  })

  it('apiKey is optional', () => {
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
