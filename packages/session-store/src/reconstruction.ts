import type { CheckpointEntry, MessageRecord } from './types'

export interface ReconstructionResult {
  messageIds: string[]
  toolSet?: string[]
  config?: Record<string, unknown>
  intent: string
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

export interface ReconstructedSession {
  messages: Array<{ role: string; content: unknown }>
  meta: ReconstructionResult
}

/**
 * Fold checkpoint entries up to the target turn to reconstruct message IDs and environment.
 *
 * Uses the nearest snapshot as the base (for O(1) reconstruction performance),
 * then applies subsequent deltas.
 *
 * Does NOT fetch messages from the store — returns IDs only for lazy loading.
 */
export function reconstructAt(
  checkpoints: CheckpointEntry[],
  targetTurn: number,
): ReconstructionResult {
  const relevant = checkpoints.filter(cp => cp.turnIndex <= targetTurn)
  if (relevant.length === 0) {
    return { messageIds: [], intent: '' }
  }

  // Find the last snapshot at or before targetTurn
  const reversed = [...relevant].reverse()
  const lastSnapshotIdx = reversed.findIndex(cp => cp.type === 'snapshot')
  const lastSnapshot = lastSnapshotIdx >= 0 ? reversed[lastSnapshotIdx] : null

  let messageIds: string[]
  if (lastSnapshot && lastSnapshot.type === 'snapshot') {
    // Start from snapshot's complete list, then apply subsequent deltas
    const afterSnapshot = relevant.filter(
      cp => cp.turnIndex > lastSnapshot.turnIndex && cp.type === 'delta',
    )
    messageIds = [
      ...lastSnapshot.allMessageIds,
      ...afterSnapshot.flatMap(cp => (cp.type === 'delta' ? cp.newMessageIds : [])),
    ]
  } else {
    // No snapshot — fold all deltas from the start
    messageIds = relevant.flatMap(cp => (cp.type === 'delta' ? cp.newMessageIds : []))
  }

  // Find toolSet: last checkpoint (scanning backwards) that defines it
  const toolSetEntry = reversed.find(cp => {
    if (cp.type === 'snapshot') return true
    if (cp.type === 'delta') return cp.toolSet !== undefined
    return false
  })
  const toolSet = toolSetEntry?.toolSet

  // Find config: last checkpoint that defines it
  const configEntry = reversed.find(cp => cp.config !== undefined)
  const config = configEntry?.config

  const intent = relevant[relevant.length - 1]?.intent ?? ''

  return { messageIds, toolSet, config, intent }
}

/**
 * Validate a message array against Anthropic API requirements.
 *
 * Catches the corruption patterns that cause API rejections:
 * - Orphaned tool_use blocks (no matching tool_result)
 * - Truncated tool sequences (tool_use at end of array)
 *
 * Note: Does NOT check for role alternation violations — Anthropic's API
 * allows consecutive same-role messages in some contexts (tool_result sequences).
 */
export function validateMessages(
  messages: Array<{ role: string; content: unknown }>,
): ValidationResult {
  const issues: string[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const toolUseBlocks = (msg.content as Array<{ type: string; id: string; name: string }>).filter(
        b => b.type === 'tool_use',
      )

      if (toolUseBlocks.length === 0) continue

      const next = messages[i + 1]

      if (!next) {
        // tool_use at the end of the array — truncated turn
        issues.push(
          `Message ${i}: assistant has tool_use blocks but there is no following message (truncated turn)`,
        )
        continue
      }

      if (next.role !== 'user' || !Array.isArray(next.content)) {
        // Next message is not a tool_result user message
        issues.push(
          `Message ${i}: tool_use blocks followed by non-tool_result message at index ${i + 1}`,
        )
        continue
      }

      const toolResultIds = new Set(
        (next.content as Array<{ type: string; tool_use_id: string }>)
          .filter(b => b.type === 'tool_result')
          .map(b => b.tool_use_id),
      )

      for (const block of toolUseBlocks) {
        if (!toolResultIds.has(block.id)) {
          issues.push(
            `Message ${i}: orphaned tool_use id="${block.id}" name="${block.name}" — no matching tool_result`,
          )
        }
      }
    }
  }

  // Also check user messages for orphaned tool_result blocks
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue

    const toolResultBlocks = (msg.content as any[]).filter(b => b.type === 'tool_result')
    if (toolResultBlocks.length === 0) continue

    const prev = messages[i - 1]
    if (!prev || prev.role !== 'assistant' || !Array.isArray(prev.content)) {
      issues.push(`Message ${i}: user has tool_result blocks but preceding message is not an assistant tool_use message`)
      continue
    }

    const toolUseIds = new Set(
      (prev.content as any[]).filter(b => b.type === 'tool_use').map(b => b.id as string)
    )
    for (const block of toolResultBlocks) {
      if (!toolUseIds.has(block.tool_use_id)) {
        issues.push(`Message ${i}: orphaned tool_result tool_use_id="${block.tool_use_id}" — no matching tool_use`)
      }
    }
  }

  return { valid: issues.length === 0, issues }
}

/**
 * Repair a message array by removing known corruption patterns.
 *
 * Strategy: remove entire assistant messages that contain unmatched tool_use blocks.
 * This is conservative — it may remove more context than strictly necessary,
 * but it guarantees the output array is valid.
 */
export function repairMessages(
  messages: Array<{ role: string; content: unknown }>,
): Array<{ role: string; content: unknown }> {
  const result: typeof messages = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const toolUseBlocks = (msg.content as Array<{ type: string; id: string }>).filter(
        b => b.type === 'tool_use',
      )

      if (toolUseBlocks.length === 0) {
        result.push(msg)
        continue
      }

      const next = messages[i + 1]
      const hasMatchingResults =
        next?.role === 'user' &&
        Array.isArray(next.content) &&
        toolUseBlocks.every(block =>
          (next.content as Array<{ type: string; tool_use_id: string }>).some(
            b => b.type === 'tool_result' && b.tool_use_id === block.id,
          ),
        )

      if (hasMatchingResults) {
        // Valid tool sequence — keep the tool_use message (tool_result follows naturally)
        result.push(msg)
      } else {
        // Orphaned tool_use — drop this message entirely
        const textOnlyContent = (msg.content as Array<{ type: string }>).filter(
          b => b.type !== 'tool_use',
        )
        if (textOnlyContent.length > 0) {
          // Preserve any text content in the message
          result.push({ ...msg, content: textOnlyContent })
        }
        // If the next message has tool_result blocks, they are now orphaned
        // without the tool_use they reference — handle accordingly
        const nextMsg = messages[i + 1]
        if (nextMsg?.role === 'user' && Array.isArray(nextMsg.content)) {
          const contentWithoutResults = (nextMsg.content as any[]).filter(b => b.type !== 'tool_result')
          if (contentWithoutResults.length === 0) {
            i++ // skip user message — it only had tool_results, now empty
          } else if (contentWithoutResults.length < (nextMsg.content as any[]).length) {
            // Mixed content: keep text, strip orphaned tool_results
            result.push({ ...nextMsg, content: contentWithoutResults })
            i++
          }
          // If no tool_results in next message, don't skip it
        }
      }
    } else {
      result.push(msg)
    }
  }

  return result
}

/**
 * Reconstruct a valid message array at the target turn.
 *
 * Pipeline:
 * 1. reconstructAt → get message IDs
 * 2. Fetch messages from store (via messageMap)
 * 3. validate → if valid, return
 * 4. repair → if repaired is valid, return
 * 5. fallback to previous turn (recursive)
 * 6. Throw if no valid history found
 *
 * INVARIANT: Never returns an invalid message array.
 */
export async function reconstruct(
  checkpoints: CheckpointEntry[],
  messageMap: Map<string, MessageRecord>,
  targetTurn: number,
): Promise<ReconstructedSession> {
  if (targetTurn < 0) {
    throw new Error(
      '[loom-code/session-store] Cannot reconstruct: no valid checkpoint found in history',
    )
  }

  const meta = reconstructAt(checkpoints, targetTurn)

  const raw = meta.messageIds.map(id => {
    const msg = messageMap.get(id)
    if (!msg) throw new Error(`[loom-code/session-store] Message ${id} not found in store`)
    return { role: msg.role, content: msg.content }
  })

  // Phase 1: Check if raw reconstruction is valid
  const check = validateMessages(raw)
  if (check.valid) return { messages: raw, meta }

  // Phase 2: Try repair
  const repaired = repairMessages(raw)
  const repairCheck = validateMessages(repaired)
  if (repairCheck.valid) return { messages: repaired, meta }

  // Phase 3: Fallback to previous turn
  const prevCheckpoint = [...checkpoints]
    .filter(cp => cp.turnIndex < targetTurn)
    .sort((a, b) => b.turnIndex - a.turnIndex)[0]

  if (!prevCheckpoint) {
    throw new Error(
      '[loom-code/session-store] Cannot reconstruct: repair failed and no prior checkpoint exists',
    )
  }

  return reconstruct(checkpoints, messageMap, prevCheckpoint.turnIndex)
}
