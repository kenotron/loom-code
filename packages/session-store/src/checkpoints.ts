import type { CheckpointEntry } from './types'

/**
 * Number of turns between full snapshots.
 * Full snapshots store ALL message IDs for O(1) reconstruction from any point.
 * Deltas between snapshots store only what changed (newMessageIds + optional toolSet/config).
 */
export const SNAPSHOT_INTERVAL = 20

export interface CheckpointInput {
  turnIndex: number
  /** IDs of messages added this turn. */
  newMessageIds: string[]
  /** Complete list of all message IDs up to and including this turn. */
  allMessageIds: string[]
  toolSet: string[]
  prevToolSet: string[]
  config?: Record<string, unknown>
  prevConfig?: Record<string, unknown>
  intent: string
}

/**
 * Build a checkpoint entry for the given turn.
 *
 * Writes a full snapshot at every SNAPSHOT_INTERVAL turns (except turn 0).
 * Writes a delta otherwise, omitting toolSet and config when unchanged.
 */
export function buildCheckpointEntry(input: CheckpointInput): CheckpointEntry {
  const {
    turnIndex,
    newMessageIds,
    allMessageIds,
    toolSet,
    prevToolSet,
    config,
    prevConfig,
    intent,
  } = input

  const id = `cp_${String(turnIndex).padStart(4, '0')}`

  // Write a full snapshot every SNAPSHOT_INTERVAL turns (not at turn 0)
  if (turnIndex > 0 && turnIndex % SNAPSHOT_INTERVAL === 0) {
    return {
      type: 'snapshot',
      id,
      turnIndex,
      allMessageIds,
      toolSet,  // always present in snapshots
      config,
      intent,
    }
  }

  // Delta: only write toolSet and config when they changed
  const toolSetChanged = JSON.stringify([...toolSet].sort()) !== JSON.stringify([...prevToolSet].sort())
  const configChanged = JSON.stringify(config) !== JSON.stringify(prevConfig)

  return {
    type: 'delta',
    id,
    turnIndex,
    newMessageIds,
    toolSet: toolSetChanged ? toolSet : undefined,
    config: configChanged ? config : undefined,
    intent,
  }
}
