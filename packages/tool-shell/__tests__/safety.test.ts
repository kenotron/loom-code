import { describe, it, expect } from 'bun:test'
import { isDangerous, BLOCKED_PATTERNS } from '../src/safety'

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
