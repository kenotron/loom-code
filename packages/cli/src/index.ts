import { createElement } from 'react'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'

async function main() {
  // split-footer: renders only into the bottom N rows of the terminal,
  // leaving the main buffer (shell history, previous output) visible above.
  // footerHeight grows from compact start up to 60% of terminal, capped at 30.
  const footerHeight = Math.min(Math.floor((process.stdout.rows ?? 24) * 0.6), 30)
  const renderer = await createCliRenderer({ screenMode: 'split-footer', footerHeight })
  const root = createRoot(renderer)
  root.render(createElement(App))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
