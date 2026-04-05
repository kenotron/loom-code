import { createElement } from 'react'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'

async function main() {
  const renderer = await createCliRenderer()
  const root = createRoot(renderer)
  root.render(createElement(App))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
