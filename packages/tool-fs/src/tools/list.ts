import type { LoomTool } from '@loom-code/core'
import type { FsVfs } from '../vfs'

export function makeListTool(vfs: FsVfs): LoomTool {
  return {
    name: 'list_directory',
    description: 'List the contents of a directory in the virtual filesystem. Returns a JSON array of DirEntry objects.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute VFS path of the directory to list.',
        },
      },
      required: ['path'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const { path } = JSON.parse(inputJson) as { path: string }
        const { backend, relativePath } = vfs.resolve(path)
        const entries = await backend.list(relativePath)
        return JSON.stringify({ success: true, output: JSON.stringify(entries) })
      } catch (err: unknown) {
        return JSON.stringify({
          success: false,
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
  }
}
