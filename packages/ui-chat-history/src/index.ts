// @loom-code/ui-chat-history — Public API
export type {
  ChatMessage,
  ToolCallRow,
  ToolGroup,
  DisplayItem,
  ChatHistoryState,
  ChatHistoryProps,
  ToolStatus,
} from './types'
export {
  createInitialChatHistoryState,
  appendUserMessage,
  startAssistantStream,
  appendToken,
  finalizeStream,
  addToolCall,
  updateToolCall,
  toggleGroup,
} from './state'
export { groupConsecutiveToolCalls } from './group'
export { ChatHistory } from './ChatHistory'
