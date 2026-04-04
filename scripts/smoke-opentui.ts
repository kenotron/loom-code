// Verify @opentui/react and @opentui/core are importable and configured correctly.
// This is an IMPORT-ONLY test — we cannot render to terminal in CI/scripts.

// Step 1: Verify @opentui/core importable
const opentuiCore = await import('@opentui/core')
const coreExports = Object.keys(opentuiCore)
console.log('✓ @opentui/core importable')
console.log('  exports:', coreExports.join(', '))

// Step 2: Verify @opentui/react importable
const opentuiReact = await import('@opentui/react')
const reactExports = Object.keys(opentuiReact)
console.log('✓ @opentui/react importable')
console.log('  exports:', reactExports.join(', '))

// Step 3: Verify react importable
const react = await import('react')
console.log('✓ react importable, version:', react.version)

// Step 4: Verify @anthropic-ai/sdk importable
const anthropicModule = await import('@anthropic-ai/sdk')
const AnthropicClient = anthropicModule.default
console.log('✓ @anthropic-ai/sdk importable, Anthropic:', typeof AnthropicClient)

console.log('\n✓ All Phase 2A dependencies verified')
