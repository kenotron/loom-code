import { describe, it, expect } from 'bun:test'
import { createToolMap, registerPackageTools, deriveToolSpecs } from '../tools'
import type { LoomTool, LoomPackage } from '../types'

const echoTool: LoomTool = {
  name: 'echo',
  description: 'Echo input back',
  schema: {
    type: 'object',
    properties: { text: { type: 'string', description: 'Text to echo' } },
    required: ['text'],
  },
  execute: async (inputJson) => {
    const { text } = JSON.parse(inputJson)
    return JSON.stringify({ success: true, output: text })
  },
}

const calcTool: LoomTool = {
  name: 'calc',
  description: 'Simple calculator',
  schema: {
    type: 'object',
    properties: { expression: { type: 'string', description: 'Math expression' } },
    required: ['expression'],
  },
  execute: async (inputJson) => {
    const { expression } = JSON.parse(inputJson)
    try {
      const result = Function('"use strict"; return (' + expression + ')')()
      return JSON.stringify({ success: true, output: String(result) })
    } catch {
      return JSON.stringify({ success: false, output: 'Invalid expression' })
    }
  },
}

describe('createToolMap', () => {
  it('returns an empty Map', () => {
    const map = createToolMap()
    expect(map instanceof Map).toBe(true)
    expect(map.size).toBe(0)
  })
})

describe('registerPackageTools', () => {
  it('adds tools from a LoomPackage to the map', () => {
    const map = createToolMap()
    const pkg: LoomPackage = { tools: [echoTool, calcTool] }
    registerPackageTools(map, pkg)
    expect(map.size).toBe(2)
    expect(map.has('echo')).toBe(true)
    expect(map.has('calc')).toBe(true)
  })

  it('handles empty tools array gracefully', () => {
    const map = createToolMap()
    registerPackageTools(map, { tools: [] })
    expect(map.size).toBe(0)
  })

  it('overwrites existing tool with same name', () => {
    const map = createToolMap()
    registerPackageTools(map, { tools: [echoTool] })
    const updatedEcho: LoomTool = { ...echoTool, description: 'Updated echo' }
    registerPackageTools(map, { tools: [updatedEcho] })
    expect(map.size).toBe(1)
    // The map should have the updated version
    const specs = deriveToolSpecs(map)
    expect(specs[0].description).toBe('Updated echo')
  })
})

describe('deriveToolSpecs', () => {
  it('returns empty array for empty map', () => {
    const map = createToolMap()
    expect(deriveToolSpecs(map)).toEqual([])
  })

  it('returns spec objects with name, description, input_schema', () => {
    const map = createToolMap()
    registerPackageTools(map, { tools: [echoTool] })
    const specs = deriveToolSpecs(map)
    expect(specs).toHaveLength(1)
    expect(specs[0].name).toBe('echo')
    expect(specs[0].description).toBe('Echo input back')
    expect(specs[0].input_schema).toBeDefined()
    expect((specs[0].input_schema as any).type).toBe('object')
  })

  it('includes all tools from map in specs', () => {
    const map = createToolMap()
    registerPackageTools(map, { tools: [echoTool, calcTool] })
    const specs = deriveToolSpecs(map)
    expect(specs).toHaveLength(2)
    const names = specs.map(s => s.name)
    expect(names).toContain('echo')
    expect(names).toContain('calc')
  })
})

describe('ToolBridge execute', () => {
  it('tool in map can be executed with JSON input', async () => {
    const map = createToolMap()
    registerPackageTools(map, { tools: [echoTool] })
    const bridge = map.get('echo')!
    const result = await bridge.execute(JSON.stringify({ text: 'hello world' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.output).toBe('hello world')
  })

  it('tool execution failure is captured in result', async () => {
    const failTool: LoomTool = {
      name: 'fail',
      description: 'Always fails',
      schema: {},
      execute: async () => JSON.stringify({ success: false, output: 'intentional failure' }),
    }
    const map = createToolMap()
    registerPackageTools(map, { tools: [failTool] })
    const bridge = map.get('fail')!
    const result = JSON.parse(await bridge.execute('{}'))
    expect(result.success).toBe(false)
    expect(result.output).toBe('intentional failure')
  })
})
