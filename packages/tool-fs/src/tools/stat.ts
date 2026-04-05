import type { LoomTool } from '@loom-code/core'
import type { FsVfs } from '../vfs'

export function makeStatTool(vfs: FsVfs): LoomTool {
  return {
    name: 'file_info',
    description:
      'Get metadata (FileStat) for a path in the virtual filesystem. ' +
      'Returns { exists: false, type: "file", size: 0, modified: "" } for non-existent paths — not an error.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute VFS path to stat.',
        },
      },
      required: ['path'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const { path } = JSON.parse(inputJson) as { path: string }
        const { backend, relativePath } = vfs.resolve(path)
        const stat = await backend.stat(relativePath)
        return JSON.stringify({ success: true, output: JSON.stringify(stat) })
      } catch (err: unknown) {
        return JSON.stringify({
          success: false,
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
  }
}
