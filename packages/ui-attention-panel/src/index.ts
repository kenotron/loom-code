// @loom-code/ui-attention-panel — Public API
export type { AttentionItem, AttentionItemType, AttentionState, AttentionPanelProps } from './types'
export {
  createInitialAttentionState,
  addItem,
  resolveItem,
  dismissItem,
  updateIntent,
  pendingItems,
  isEmpty,
} from './state'
export { AttentionPanel } from './AttentionPanel'
