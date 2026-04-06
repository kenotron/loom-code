import { createElement } from 'react'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'

async function main() {
  // split-footer: renders only into the bottom N rows of the terminal,
  // leaving the main buffer (shell history, previous output) visible above.
  // Start at 4 rows (input bar + status bar); the App grows it dynamically
  // as conversation fills via renderer.footerHeight setter.
  const renderer = await createCliRenderer({ screenMode: 'split-footer', footerHeight: 4 })
  const root = createRoot(renderer)
  root.render(createElement(App))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
