/**
 * Type interfaces for @loom-code/session-store.
 *
 * The session store uses a normalized, delta-based checkpoint model:
 * - Messages are stored once by ID (never duplicated)
 * - Checkpoints store only what CHANGED since the last turn (delta)
 * - Every SNAPSHOT_INTERVAL turns, a full snapshot enables fast reconstruction
 *
 * This prevents the message history corruption that causes Anthropic API failures.
 */

/** A single message stored in the normalized message store. */
export interface MessageRecord {
  id: string
  role: 'user' | 'assistant'
  /** The full message content — can be a string, array of content blocks, etc. */
  content: unknown
  timestamp?: string
}

/**
 * A delta checkpoint — written after every successful turn.
 * Only stores what CHANGED since the last checkpoint.
 * toolSet and config are omitted when unchanged (sparse storage).
 */
export interface SessionCheckpoint {
  id: string
  turnIndex: number
  /** IDs of messages added THIS turn only (typically 2-5). */
  newMessageIds: string[]
  /** Package identifiers in `name@version` format, e.g. `'@loom-code/shell@1.0.0'`. Written only when packages changed this turn. */
  toolSet?: string[]
  /** Written only when config changed this turn. Otherwise omitted. */
  config?: Record<string, unknown>
  intent: string
}

/**
 * A full snapshot written every SNAPSHOT_INTERVAL turns.
 * Contains the complete message ID list for fast reconstruction
 * without scanning all deltas from the beginning.
 */
export interface CheckpointSnapshot {
  id: string
  turnIndex: number
  /** Complete list of all message IDs up to this turn. */
  allMessageIds: string[]
  /** Package identifiers in `name@version` format, e.g. `'@loom-code/shell@1.0.0'`. Always present in snapshots. */
  toolSet: string[]
  config?: Record<string, unknown>
  intent: string
}

/**
 * Discriminated union of checkpoint entries.
 * The `type` field enables TypeScript narrowing.
 */
export type CheckpointEntry =
  | ({ type: 'delta' } & SessionCheckpoint)
  | ({ type: 'snapshot' } & CheckpointSnapshot)

/** Session metadata stored in metadata.json. */
export interface SessionMetadata {
  sessionId: string
  created: string
  lastActive: string
  model: string
  intent: string
  turnCount: number
}
