import { useState, useCallback } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { resolveToken, ColorText } from '@loom-code/ui-primitives'
import type { InputBarProps } from './types'

const SEPARATOR_CHAR = '─'

/**
 * InputBar — pure chat input using ink primitives.
 *
 * Simplified for the ink migration: state is managed locally with a plain
 * string value rather than the full InputBarState machine.  The state-machine
 * helpers (updateValue / submitValue / toggleMic) are still exported from
 * state.ts for consumers that need them directly.
 *
 * Renders as a 3-line box:
 *   Line 1: ───────────────────── (separator, full width, text.dimmer color)
 *   Line 2: ▸ [input or ⠋ thinking]
 *   Line 3: (empty padding line)
 */
export function InputBar({
  initialState,
  callbacks,
  focused,
  termWidth,
  isThinking,
}: InputBarProps) {
  const [value, setValue] = useState(initialState.value)

  const handleChange = useCallback(
    (val: string) => {
      setValue(val)
      callbacks.onValueChange?.(val)
    },
    [callbacks],
  )

  const handleSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      if (trimmed) {
        setValue('')
        callbacks.onSubmit(trimmed)
      }
    },
    [callbacks],
  )

  const width = termWidth ?? 80
  const separator = SEPARATOR_CHAR.repeat(width)
  const promptColor = resolveToken('accent.prompt')
  const thinkingColor = resolveToken('status.running')

  return (
    <Box flexDirection="column">
      {/* Line 1: separator */}
      <ColorText token="text.dimmer">{separator}</ColorText>
      {/* Line 2: prompt + input */}
      <Box flexDirection="row">
        {isThinking ? (
          <Text color={thinkingColor.fg}>{'⠋ '}</Text>
        ) : (
          <Text color={promptColor.fg}>{'▸ '}</Text>
        )}
        <TextInput
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          focus={focused !== false && !isThinking}
          placeholder={isThinking ? 'generating… Esc to cancel' : ''}
        />
      </Box>
      {/* Line 3: padding */}
      <Text>{' '}</Text>
    </Box>
  )
}
