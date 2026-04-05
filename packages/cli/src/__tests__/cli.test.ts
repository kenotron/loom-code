import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createSession } from '../session'
import { createDefaultCommands } from '../commands'

describe('loom-code cli', () => {
  it('createDefaultCommands returns CommandItems with required fields', () => {
    const commands = createDefaultCommands({})
    expect(Array.isArray(commands)).toBe(true)
    expect(commands.length).toBeGreaterThan(0)
    commands.forEach(cmd => {
      expect(typeof cmd.id).toBe('string')
      expect(typeof cmd.label).toBe('string')
      expect(typeof cmd.action).toBe('function')
    })
  })

  it('createDefaultCommands includes expected command ids', () => {
    const commands = createDefaultCommands({})
    const ids = commands.map(c => c.id)
    expect(ids).toContain('new-session')
    expect(ids).toContain('clear-history')
  })

  it('createDefaultCommands wires onNewSession callback', () => {
    let called = false
    const commands = createDefaultCommands({
      onNewSession: () => { called = true },
    })
    const newSessionCmd = commands.find(c => c.id === 'new-session')!
    newSessionCmd.action()
    expect(called).toBe(true)
  })

  it('createDefaultCommands wires onClearHistory callback', () => {
    let called = false
    const commands = createDefaultCommands({
      onClearHistory: () => { called = true },
    })
    const clearCmd = commands.find(c => c.id === 'clear-history')!
    clearCmd.action()
    expect(called).toBe(true)
  })

  describe('createSession', () => {
    let savedKey: string | undefined

    beforeEach(() => { savedKey = process.env.ANTHROPIC_API_KEY })
    afterEach(() => {
      if (savedKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = savedKey
      } else {
        delete process.env.ANTHROPIC_API_KEY
      }
    })

    it('throws when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY
      expect(() => createSession()).toThrow('ANTHROPIC_API_KEY')
    })

    it('returns a LoomSession when key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
      const session = createSession()
      expect(typeof session.sessionId).toBe('string')
      expect(session.sessionId.length).toBeGreaterThan(0)
    })
  })
})
