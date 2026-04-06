import { describe, it, expect } from 'bun:test'
import { isDangerous, BLOCKED_PATTERNS } from '../src/safety'
import { safetyHook } from '../src/hooks/safety-hook'

describe('BLOCKED_PATTERNS', () => {
  it('exports a non-empty array of patterns', () => {
    expect(Array.isArray(BLOCKED_PATTERNS)).toBe(true)
    expect(BLOCKED_PATTERNS.length).toBeGreaterThan(0)
  })
})

describe('isDangerous()', () => {
  // --- BLOCKED ---
  it('blocks rm -rf /', () => {
    expect(isDangerous('rm -rf /')).toBe(true)
  })

  it('blocks rm -rf / with trailing slash variations', () => {
    expect(isDangerous('rm -rf  /  ')).toBe(true)
    expect(isDangerous('rm -rf /   ')).toBe(true)
  })

  it('blocks the fork bomb', () => {
    expect(isDangerous(':(){ :|:& };:')).toBe(true)
  })

  it('blocks dd if=/dev/zero', () => {
    expect(isDangerous('dd if=/dev/zero of=/dev/sda')).toBe(true)
    expect(isDangerous('dd if=/dev/zero of=/dev/nvme0n1')).toBe(true)
  })

  it('blocks mkfs commands', () => {
    expect(isDangerous('mkfs.ext4 /dev/sda1')).toBe(true)
    expect(isDangerous('mkfs /dev/sda')).toBe(true)
  })

  it('blocks commands with leading whitespace', () => {
    expect(isDangerous('  rm -rf /')).toBe(true)
  })

  // --- ALLOWED ---
  it('allows rm -rf ./dist', () => {
    expect(isDangerous('rm -rf ./dist')).toBe(false)
  })

  it('allows rm -rf /tmp/myproject', () => {
    expect(isDangerous('rm -rf /tmp/myproject')).toBe(false)
  })

  it('allows normal echo command', () => {
    expect(isDangerous('echo hello world')).toBe(false)
  })

  it('allows ls -la', () => {
    expect(isDangerous('ls -la')).toBe(false)
  })

  it('allows pwd', () => {
    expect(isDangerous('pwd')).toBe(false)
  })

  it('allows git status', () => {
    expect(isDangerous('git status')).toBe(false)
  })

  it('allows npm install', () => {
    expect(isDangerous('npm install')).toBe(false)
  })

  it('allows bun test', () => {
    expect(isDangerous('bun test')).toBe(false)
  })
})

/**
 * Tests for the safety hook handler return format.
 *
 * REGRESSION GUARD: The Rust kernel's HookAction has
 * `#[serde(rename_all = "snake_case")]`. Handlers MUST return snake_case
 * action values ('continue', 'deny') or the kernel fails closed with
 * "Hook handler returned invalid response" — blocking every tool call.
 */
describe('safetyHook handler — kernel contract', () => {
  function call(toolName: string, input: Record<string, unknown>): { action: string; reason?: string } {
    const raw = safetyHook.handler('tool:pre', JSON.stringify({ tool_name: toolName, input }))
    return JSON.parse(raw as string) as { action: string; reason?: string }
  }

  it('returns snake_case "continue" for filesystem tools (not "Continue")', () => {
    expect(call('list', { path: '/' }).action).toBe('continue')
    expect(call('read_file', { path: '/foo' }).action).toBe('continue')
    expect(call('glob', { pattern: '**/*.ts' }).action).toBe('continue')
  })

  it('returns snake_case "continue" for safe shell commands', () => {
    expect(call('run_command', { command: 'ls -la' }).action).toBe('continue')
    expect(call('run_command', { command: 'git status' }).action).toBe('continue')
    expect(call('run_command', { command: 'bun test' }).action).toBe('continue')
  })

  it('returns snake_case "deny" for dangerous shell commands (not "Deny")', () => {
    expect(call('run_command', { command: 'rm -rf /' }).action).toBe('deny')
    expect(call('run_command', { command: ':(){ :|:& };:' }).action).toBe('deny')
  })

  it('return values are valid JSON strings (not plain objects)', () => {
    const raw = safetyHook.handler('tool:pre', JSON.stringify({ tool_name: 'list', input: {} }))
    expect(typeof raw).toBe('string')
    expect(() => JSON.parse(raw as string)).not.toThrow()
  })
})
