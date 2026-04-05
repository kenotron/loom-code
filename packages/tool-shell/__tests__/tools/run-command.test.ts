import { describe, it, expect } from 'bun:test'
import { createRunCommandTool } from '../../src/tools/run-command'

describe('createRunCommandTool()', () => {
  it('returns a tool with the correct name and description', () => {
    const tool = createRunCommandTool({})
    expect(tool.name).toBe('run_command')
    expect(typeof tool.description).toBe('string')
    expect(tool.description.length).toBeGreaterThan(0)
  })

  it('has a JSON schema with command as required string', () => {
    const tool = createRunCommandTool({})
    const schema = tool.schema as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(schema.type).toBe('object')
    expect(schema.required).toContain('command')
    expect(schema.properties.command).toBeDefined()
  })

  it('execute() runs echo and returns success JSON', async () => {
    const tool = createRunCommandTool({})
    const result = JSON.parse(await tool.execute(JSON.stringify({ command: 'echo hello' })))
    expect(result.success).toBe(true)
    expect(result.output).toContain('stdout:')
    expect(result.output).toContain('hello')
    expect(result.output).toContain('exit_code: 0')
  })

  it('execute() includes stderr in output', async () => {
    const tool = createRunCommandTool({})
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ command: 'echo err-message >&2' })),
    )
    expect(result.success).toBe(true)
    expect(result.output).toContain('stderr:')
    expect(result.output).toContain('err-message')
  })

  it('execute() returns success=false for failing command and includes exit code', async () => {
    const tool = createRunCommandTool({})
    const result = JSON.parse(await tool.execute(JSON.stringify({ command: 'exit 1' })))
    expect(result.success).toBe(false)
    expect(result.output).toContain('exit_code: 1')
  })

  it('execute() times out and returns success=false with timeout message', async () => {
    const tool = createRunCommandTool({ timeout: 200 })
    const result = JSON.parse(await tool.execute(JSON.stringify({ command: 'sleep 10' })))
    expect(result.success).toBe(false)
    expect(result.output).toContain('timed out')
    expect(result.output).toContain('200ms')
  }, 3000)

  it('execute() per-call timeout overrides factory timeout', async () => {
    const tool = createRunCommandTool({ timeout: 10_000 })
    // Override to a short timeout at call site
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ command: 'sleep 10', timeout: 300 })),
    )
    expect(result.success).toBe(false)
    expect(result.output).toContain('timed out')
  }, 3000)

  it('execute() respects per-call cwd override', async () => {
    const tool = createRunCommandTool({})
    const result = JSON.parse(
      await tool.execute(JSON.stringify({ command: 'pwd', cwd: '/tmp' })),
    )
    expect(result.success).toBe(true)
    expect(result.output).toMatch(/\/tmp/)
  })

  it('execute() never throws — returns JSON on malformed input', async () => {
    const tool = createRunCommandTool({})
    const result = JSON.parse(await tool.execute('not-valid-json'))
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.output).toBe('string')
  })

  it('execute() never throws — returns JSON when command is missing', async () => {
    const tool = createRunCommandTool({})
    const result = JSON.parse(await tool.execute('{}'))
    expect(result.success).toBe(false)
    expect(result.output).toContain('Error')
  })
})
