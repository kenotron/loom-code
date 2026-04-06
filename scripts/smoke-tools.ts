/**
 * Smoke test for tool-fs list_directory and the hook mechanism.
 * Run: bun run scripts/smoke-tools.ts
 */
import { createFsPackage, createFsVfs, createLocalBackend, createInMemoryBackend } from '../packages/tool-fs/src/index'
import { createShellPackage } from '../packages/tool-shell/src/index'

const cwd = process.cwd()

// ── 1. Test list_directory directly ─────────────────────────────────────────
console.log('\n=== list_directory smoke test ===')
const vfs = createFsVfs()
vfs.mount(cwd, createLocalBackend(cwd))
vfs.mount('/workspace', createLocalBackend(cwd))
vfs.mount('/scratch', createInMemoryBackend())

const fsPkg = createFsPackage(vfs)
const listTool = fsPkg.tools.find(t => t.name === 'list_directory')
const readTool  = fsPkg.tools.find(t => t.name === 'read_file')
const statTool  = fsPkg.tools.find(t => t.name === 'file_info')
const globTool  = fsPkg.tools.find(t => t.name === 'glob')

console.log('Tools registered:', fsPkg.tools.map(t => t.name).join(', '))

// Test via cwd absolute path
const result1 = await listTool!.execute(JSON.stringify({ path: cwd }))
const r1 = JSON.parse(result1)
console.log(`list_directory(cwd): success=${r1.success}`)
if (!r1.success) console.error('  ERROR:', r1.output)
else console.log('  first 3 entries:', JSON.parse(r1.output).slice(0,3).map((e: any) => e.name).join(', '))

// Test via /workspace alias
const result2 = await listTool!.execute(JSON.stringify({ path: '/workspace' }))
const r2 = JSON.parse(result2)
console.log(`list_directory(/workspace): success=${r2.success}`)
if (!r2.success) console.error('  ERROR:', r2.output)
else console.log('  first 3 entries:', JSON.parse(r2.output).slice(0,3).map((e: any) => e.name).join(', '))

// ── 2. Test hook action casing ───────────────────────────────────────────────
console.log('\n=== safety hook action casing ===')
const shellPkg = createShellPackage({ cwd })
const hook = shellPkg.hooks?.[0]
if (!hook) {
  console.error('No hooks registered in shell package!')
} else {
  console.log('Hook event:', hook.event)
  // Simulate kernel calling handler for a non-shell tool (should allow)
  const nonShellPayload = JSON.stringify({ tool_name: 'list_directory', input: { path: cwd } })
  const nonShellResult = (hook.handler as Function)('tool:pre', nonShellPayload)
  const nonShellParsed = JSON.parse(nonShellResult)
  console.log(`non-shell tool → action: "${nonShellParsed.action}" (want: 'continue')`, nonShellParsed.action === 'continue' ? '✓' : '✗ WRONG')

  // Simulate dangerous shell command (should deny)
  const dangerPayload = JSON.stringify({ tool_name: 'run_command', input: { command: 'rm -rf /' } })
  const dangerResult = (hook.handler as Function)('tool:pre', dangerPayload)
  const dangerParsed = JSON.parse(dangerResult)
  console.log(`dangerous command  → action: "${dangerParsed.action}" (want: 'deny')`, dangerParsed.action === 'deny' ? '✓' : '✗ WRONG')

  // Simulate safe shell command (should allow)
  const safePayload = JSON.stringify({ tool_name: 'run_command', input: { command: 'ls .' } })
  const safeResult = (hook.handler as Function)('tool:pre', safePayload)
  const safeParsed = JSON.parse(safeResult)
  console.log(`safe command       → action: "${safeParsed.action}" (want: 'continue')`, safeParsed.action === 'continue' ? '✓' : '✗ WRONG')
}

// ── 3. Test run_command directly ─────────────────────────────────────────────
console.log('\n=== run_command smoke test ===')
const shellTool = shellPkg.tools.find(t => t.name === 'run_command')
const cmdResult = await shellTool!.execute(JSON.stringify({ command: 'ls packages/ | head -5' }))
const cr = JSON.parse(cmdResult)
console.log(`run_command(ls): success=${cr.success}`)
if (!cr.success) console.error('  ERROR:', cr.output)
else console.log('  output:', cr.output.split('\n').slice(0,3).join(', '))

// ── 4. Check system prompt tool names ────────────────────────────────────────
console.log('\n=== tool name audit ===')
const allTools = [...fsPkg.tools, ...shellPkg.tools]
console.log('Actual tool names:', allTools.map(t => t.name).join(', '))
console.log('System prompt mentions: list, stat  (WRONG — should be list_directory, file_info)')

console.log('\n=== done ===')
