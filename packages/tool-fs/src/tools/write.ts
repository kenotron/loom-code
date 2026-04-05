import type { LoomTool } from '@loom-code/core'
import type { FsVfs } from '../vfs'

export function makeWriteTool(vfs: FsVfs): LoomTool {
  return {
    name: 'write_file',
    description: 'Write (create or overwrite) a file in the virtual filesystem.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute VFS path to write to.',
        },
        content: {
          type: 'string',
          description: 'File content to write.',
        },
      },
      required: ['path', 'content'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const { path, content } = JSON.parse(inputJson) as {
          path: string
          content: string
        }
        const { backend, relativePath } = vfs.resolve(path)
        await backend.write(relativePath, content)
        const byteCount = Buffer.byteLength(content, 'utf8')
        return JSON.stringify({
          success: true,
          output: `Written ${byteCount} bytes to ${path}`,
        })
      } catch (err: unknown) {
        return JSON.stringify({
          success: false,
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
  }
}
