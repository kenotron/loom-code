export type AttentionItemType = 'approval' | 'clarification' | 'info'

export interface AttentionItem {
  id: string
  type: AttentionItemType
  message: string
  resolvedAt?: number
}

export interface AttentionState {
  items: AttentionItem[]
  intent: string | null  // last thing the user requested
}

export interface AttentionPanelProps {
  state: AttentionState
  onResolve?: (id: string) => void
}
