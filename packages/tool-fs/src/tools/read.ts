import type { LoomTool } from '@loom-code/core'
import type { FsVfs } from '../vfs'

export function makeReadTool(vfs: FsVfs): LoomTool {
  return {
    name: 'read_file',
    description: 'Read a file from the virtual filesystem. Supports optional line-range slicing via offset (0-based line index) and limit (max lines).',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute VFS path to the file to read.',
        },
        offset: {
          type: 'number',
          description: 'Zero-based line offset to start reading from (default: 0).',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to return.',
        },
      },
      required: ['path'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const { path, offset, limit } = JSON.parse(inputJson) as {
          path: string
          offset?: number
          limit?: number
        }
        const { backend, relativePath } = vfs.resolve(path)
        const range =
          offset !== undefined || limit !== undefined
            ? { offset: offset ?? 0, limit: limit ?? Number.MAX_SAFE_INTEGER }
            : undefined
        const content = await backend.read(relativePath, range)
        return JSON.stringify({ success: true, output: content })
      } catch (err: unknown) {
        return JSON.stringify({
          success: false,
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
  }
}
