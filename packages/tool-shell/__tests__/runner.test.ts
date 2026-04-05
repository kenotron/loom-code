import { describe, it, expect } from 'bun:test'
import { runLocal } from '../src/runner'

describe('runLocal()', () => {
  it('runs echo and captures stdout', async () => {
    const result = await runLocal('echo hello', {})
    expect(result.success).toBe(true)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
  })

  it('runs pwd and returns current directory', async () => {
    const cwd = process.cwd()
    const result = await runLocal('pwd', { cwd })
    expect(result.success).toBe(true)
    expect(result.stdout.trim()).toBe(cwd)
  })

  it('captures stderr for commands that write to stderr', async () => {
    const result = await runLocal('echo error >&2', {})
    expect(result.stderr.trim()).toBe('error')
  })

  it('returns success=false and non-zero exit code for failing commands', async () => {
    const result = await runLocal('exit 1', {})
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  it('returns success=false and exit code 42', async () => {
    const result = await runLocal('exit 42', {})
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(42)
  })

  it('captures both stdout and stderr in the same run', async () => {
    const result = await runLocal('echo out; echo err >&2', {})
    expect(result.stdout.trim()).toBe('out')
    expect(result.stderr.trim()).toBe('err')
  })

  it('respects custom cwd', async () => {
    const result = await runLocal('pwd', { cwd: '/tmp' })
    expect(result.success).toBe(true)
    // /tmp on macOS resolves to /private/tmp
    expect(result.stdout.trim()).toMatch(/\/tmp$/)
  })

  it('merges env variables into the process environment', async () => {
    const result = await runLocal('echo $MY_VAR', { env: { MY_VAR: 'loom-test-value' } })
    expect(result.success).toBe(true)
    expect(result.stdout.trim()).toBe('loom-test-value')
  })

  it('times out and returns success=false when command exceeds timeout', async () => {
    const result = await runLocal('sleep 10', { timeout: 200 })
    expect(result.success).toBe(false)
    expect(result.timedOut).toBe(true)
  }, 3000)

  it('runs ls and returns file listing', async () => {
    const result = await runLocal('ls', { cwd: '/tmp' })
    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
  })
})
