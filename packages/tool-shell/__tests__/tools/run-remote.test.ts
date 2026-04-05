import { describe, it, expect } from 'bun:test'
import { createRunRemoteTool } from '../../src/tools/run-remote'

describe('createRunRemoteTool()', () => {
  it('returns a tool with the correct name', () => {
    const tool = createRunRemoteTool(undefined, {})
    expect(tool.name).toBe('run_remote_command')
  })

  it('has a description string', () => {
    const tool = createRunRemoteTool(undefined, {})
    expect(typeof tool.description).toBe('string')
    expect(tool.description.length).toBeGreaterThan(0)
  })

  it('has a JSON schema with command as required', () => {
    const tool = createRunRemoteTool(undefined, {})
    const schema = tool.schema as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(schema.type).toBe('object')
    expect(schema.required).toContain('command')
  })

  it('execute() returns success=false with "remote not configured" when no remote', async () => {
    const tool = createRunRemoteTool(undefined, {})
    const result = JSON.parse(await tool.execute(JSON.stringify({ command: 'echo hi' })))
    expect(result.success).toBe(false)
    expect(result.output).toContain('remote not configured')
  })

  it('execute() never throws on malformed input', async () => {
    const tool = createRunRemoteTool(undefined, {})
    const result = JSON.parse(await tool.execute('not-json'))
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.output).toBe('string')
  })

  it('execute() returns error when command missing', async () => {
    const tool = createRunRemoteTool(undefined, {})
    const result = JSON.parse(await tool.execute('{}'))
    expect(result.success).toBe(false)
    expect(result.output).toContain('Error')
  })

  it('creates a tool even when remote config IS provided (structural check)', () => {
    const remote = { host: 'example.com', user: 'ubuntu', port: 22 }
    const tool = createRunRemoteTool(remote, { timeout: 5000 })
    expect(tool.name).toBe('run_remote_command')
    // We don't connect — just confirm tool object structure
    const schema = tool.schema as { required: string[] }
    expect(schema.required).toContain('command')
  })
})
