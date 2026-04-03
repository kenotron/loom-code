import type { ToolMap } from './tools'
import { deriveToolSpecs } from './tools'

/** Shape of a streaming client compatible with Anthropic SDK's messages.stream() */
export interface StreamingClient {
  messages: {
    stream(params: {
      model: string
      max_tokens: number
      system?: string
      tools: unknown[]
      messages: unknown[]
    }): Promise<{
      [Symbol.asyncIterator](): AsyncIterator<{
        type: string
        delta?: { type: string; text?: string }
      }>
      finalMessage(): Promise<{
        stop_reason: string
        content: Array<{
          type: string
          text?: string
          id?: string
          name?: string
          input?: unknown
        }>
      }>
    }>
  }
}

/** Shape of the amplifier-core hook registry (subset we use). */
export interface HookRegistry {
  emit(event: string, dataJson: string): Promise<{ action: string; reason?: string }>
}

export interface LoopOptions {
  prompt: string
  messages: unknown[]
  toolMap: ToolMap
  client: StreamingClient
  model: string
  systemPrompt?: string
  hooks: HookRegistry
  onToken: (delta: string) => void
  onToolStart: (name: string) => void
  onToolEnd: (name: string, success: boolean, output: string) => void
}

/**
 * Run one user turn through the agentic loop.
 *
 * Owns the while(true) loop: LLM call → stream tokens → dispatch tools → repeat until end_turn.
 * This function is the heart of loom-code — it owns all LLM API calls and tool dispatch.
 *
 * NOTE: There is no execute() on JsAmplifierSession. This function IS the execution loop.
 */
export async function runTurn(opts: LoopOptions): Promise<string> {
  const {
    prompt,
    messages,
    toolMap,
    client,
    model,
    systemPrompt,
    hooks,
    onToken,
    onToolStart,
    onToolEnd,
  } = opts

  messages.push({ role: 'user', content: prompt })
  await hooks.emit('prompt:submit', JSON.stringify({ prompt }))

  while (true) {
    // Derive tool specs fresh each iteration so dynamic tool additions are picked up
    let toolSpecs: ReturnType<typeof deriveToolSpecs>
    try {
      toolSpecs = deriveToolSpecs(toolMap)
    } catch (err) {
      // Malformed tool spec — log and continue with empty tool list
      console.error('[loom-code/core] deriveToolSpecs failed:', err)
      toolSpecs = []
    }

    const stream = await client.messages.stream({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      tools: toolSpecs,
      messages,
    })

    // Stream text tokens to caller
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta' &&
        event.delta.text
      ) {
        onToken(event.delta.text)
      }
    }

    const response = await stream.finalMessage()
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
      await hooks.emit('prompt:complete', JSON.stringify({ response: text }))
      return text
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: unknown[] = []

      for (const block of response.content.filter((b) => b.type === 'tool_use')) {
        const toolName = block.name ?? 'unknown'
        onToolStart(toolName)

        // Pre-flight hook — can deny tool execution
        const pre = await hooks.emit(
          'tool:pre',
          JSON.stringify({ tool_name: toolName, tool_call_id: block.id, input: block.input })
        )

        let output: { success: boolean; output: string }

        if (pre.action === 'Deny') {
          output = { success: false, output: `blocked: ${pre.reason ?? 'policy'}` }
        } else {
          const bridge = toolMap.get(toolName)
          if (!bridge) {
            output = { success: false, output: `unknown tool: ${toolName}` }
          } else {
            try {
              const resultJson = await bridge.execute(JSON.stringify(block.input))
              output = JSON.parse(resultJson) as { success: boolean; output: string }
            } catch (err) {
              output = {
                success: false,
                output: err instanceof Error ? err.message : String(err),
              }
            }
          }
        }

        // Post hook — observability only
        await hooks.emit(
          'tool:post',
          JSON.stringify({
            tool_name: toolName,
            tool_call_id: block.id,
            success: output.success,
            output: output.output,
          })
        )

        onToolEnd(toolName, output.success, output.output)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: output.output,
        })
      }

      messages.push({ role: 'user', content: toolResults })
      // Continue loop — send tool results back to LLM
    } else {
      // Any other stop_reason: return empty string and let caller handle it
      return ''
    }
  }
}
