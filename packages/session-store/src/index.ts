// @loom-code/session-store — Public API

// Type interfaces
export type {
  MessageRecord,
  SessionCheckpoint,
  CheckpointSnapshot,
  CheckpointEntry,
  SessionMetadata,
} from './types'

// JSONL store
export { JsonlStore } from './store'

// Checkpoint delta model
export type { CheckpointInput } from './checkpoints'
export { SNAPSHOT_INTERVAL, buildCheckpointEntry } from './checkpoints'

// Reconstruction pipeline
export type { ReconstructionResult, ValidationResult, ReconstructedSession } from './reconstruction'
export {
  reconstructAt,
  validateMessages,
  repairMessages,
  reconstruct,
} from './reconstruction'
