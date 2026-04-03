import { describe, it, expect } from 'bun:test'
import type { LoomTool, LoomPackage, LoomProvider, LoomConfig } from '../types'

describe('LoomTool', () => {
  it('has required name, description, schema, and execute fields', () => {
    const tool: LoomTool = {
      name: 'bash',
      description: 'Run shell commands',
      schema: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Shell command' } },
        required: ['command'],
      },
      execute: async (inputJson) => JSON.stringify({ success: true, output: 'ok' }),
    }
    expect(tool.name).toBe('bash')
    expect(tool.description).toBe('Run shell commands')
    expect(typeof tool.execute).toBe('function')
  })

  it('execute returns JSON string with success and output', async () => {
    const tool: LoomTool = {
      name: 'echo',
      description: 'Echo input',
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      execute: async (inputJson) => {
        const { text } = JSON.parse(inputJson)
        return JSON.stringify({ success: true, output: text })
      },
    }
    const result = JSON.parse(await tool.execute(JSON.stringify({ text: 'hello' })))
    expect(result.success).toBe(true)
    expect(result.output).toBe('hello')
  })
})

describe('LoomPackage', () => {
  it('has tools array as required field', () => {
    const pkg: LoomPackage = { tools: [] }
    expect(Array.isArray(pkg.tools)).toBe(true)
  })

  it('hooks and context are optional', () => {
    const minimalPkg: LoomPackage = { tools: [] }
    expect(minimalPkg.hooks).toBeUndefined()
    expect(minimalPkg.context).toBeUndefined()
  })

  it('can contain multiple tools with hooks and context', () => {
    const tool: LoomTool = {
      name: 't',
      description: 'd',
      schema: {},
      execute: async () => '{}',
    }
    const pkg: LoomPackage = {
      tools: [tool],
      hooks: [{ event: 'tool:pre', handler: async (e, d) => JSON.stringify({ action: 'continue' }), priority: 0, name: 'test-hook' }],
      context: { files: ['./AGENTS.md'], text: 'Some context' },
    }
    expect(pkg.tools).toHaveLength(1)
    expect(pkg.hooks).toHaveLength(1)
    expect(pkg.context?.files).toContain('./AGENTS.md')
  })
})

describe('LoomProvider', () => {
  it('has model and createClient fields', () => {
    const provider: LoomProvider = {
      model: 'claude-opus-4',
      createClient: () => ({}),
    }
    expect(provider.model).toBe('claude-opus-4')
    expect(typeof provider.createClient).toBe('function')
  })

  it('apiKey is optional', () => {
    const provider: LoomProvider = {
      model: 'gpt-4',
      createClient: () => ({}),
    }
    expect(provider.apiKey).toBeUndefined()
  })
})

describe('LoomConfig', () => {
  it('has provider and packages as required fields', () => {
    const config: LoomConfig = {
      provider: { model: 'claude-opus-4', createClient: () => ({}) },
      packages: [],
    }
    expect(config.provider.model).toBe('claude-opus-4')
    expect(Array.isArray(config.packages)).toBe(true)
  })

  it('systemPrompt is optional', () => {
    const config: LoomConfig = {
      provider: { model: 'claude-opus-4', createClient: () => ({}) },
      packages: [],
    }
    expect(config.systemPrompt).toBeUndefined()
  })

  it('can configure provider with apiKey and multiple packages', () => {
    const pkg: LoomPackage = { tools: [] }
    const config: LoomConfig = {
      provider: { model: 'claude-opus-4', createClient: () => ({}), apiKey: 'sk-test' },
      packages: [pkg],
      systemPrompt: './AGENTS.md',
    }
    expect(config.provider.apiKey).toBe('sk-test')
    expect(config.packages).toHaveLength(1)
    expect(config.systemPrompt).toBe('./AGENTS.md')
  })
})
