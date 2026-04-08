/**
 * @loom-code/ui-markdown
 *
 * ESM fork of ink-markdown (https://github.com/cameronhunter/ink-markdown),
 * updated to work with ink@6 (ESM-only) and with streaming-safe rendering
 * inspired by Vercel's streamdown (https://github.com/vercel/streamdown).
 *
 * ink-markdown@1.0.4 was CJS and called require('ink'), which breaks with
 * ink@6's async ESM module. This package is pure ESM and imports ink normally.
 *
 * Streaming safety: before rendering, any unclosed code fence is automatically
 * closed so partial markdown never shows raw fence delimiters. Technique from
 * streamdown's hasIncompleteCodeFence() / block-incomplete-context.
 */

import { useMemo } from 'react'
import { Text } from 'ink'
import { marked, setOptions } from 'marked'
import TerminalRenderer from 'marked-terminal'

// Configure marked with the terminal renderer once at module load time.
// Using setOptions on the global instance is fine here — we have one renderer.
setOptions({ renderer: new TerminalRenderer() })

// ── Streaming-safe completion ─────────────────────────────────────────────────
// From streamdown: detect unclosed code fences and close them before rendering
// so partial markdown never shows raw ``` delimiters mid-stream.

const CODE_FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})/

function completeMarkdown(text: string): string {
  const lines = text.split('\n')
  let openChar: string | null = null
  let openLen = 0

  for (const line of lines) {
    const m = CODE_FENCE_RE.exec(line)
    if (!openChar) {
      if (m) { openChar = m[1][0]; openLen = m[1].length }
    } else if (m && m[1][0] === openChar && m[1].length >= openLen) {
      openChar = null; openLen = 0
    }
  }

  // Unclosed fence — append a closing fence so the renderer sees valid markdown
  if (openChar) return text + '\n' + openChar.repeat(openLen) + '\n'
  return text
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface MarkdownProps {
  children: string
  /** Show a cursor character at the end (for streaming live zone). */
  cursor?: boolean
}

export default function Markdown({ children, cursor = false }: MarkdownProps) {
  const rendered = useMemo(() => {
    const safe = completeMarkdown(children)
    const result = marked(safe)
    const text = (typeof result === 'string' ? result : '').trim()
    return cursor ? text + '▌' : text
  }, [children, cursor])

  return <Text>{rendered}</Text>
}
