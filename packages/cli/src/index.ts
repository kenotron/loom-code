import { createElement } from 'react'
import { render } from 'ink'
import { App } from './App'

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set.')
    process.exit(1)
  }
  render(createElement(App))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
