export type ToolStatus = 'running' | 'success' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ToolCallRow {
  id: string
  toolName: string
  status: ToolStatus
  input?: unknown
  output?: string
  error?: string
  durationMs?: number
  startedAt: number
}

export interface ToolGroup {
  id: string
  toolName: string
  calls: ToolCallRow[]
  collapsed: boolean
}

export type DisplayItem =
  | { type: 'user-message'; id: string; message: ChatMessage }
  | { type: 'assistant-text'; id: string; content: string; streaming: boolean }
  | { type: 'tool-group'; id: string; group: ToolGroup }
  | { type: 'thinking'; id: string; content: string; durationMs: number; collapsed: boolean }

export interface ChatHistoryState {
  items: DisplayItem[]
  streamingItemId: string | null
}

export interface ChatHistoryProps {
  state: ChatHistoryState
  onToggleGroup?: (groupId: string) => void
  onToggleThinking?: (itemId: string) => void
  /** Explicit foreground color for primary text. Omit to use terminal default (safe for non-truecolor terminals). */
  textFg?: string
}
