import type { LoomTool } from '@loom-code/core'
import type { FsVfs } from '../vfs'

export function makeEditTool(vfs: FsVfs): LoomTool {
  return {
    name: 'edit_file',
    description:
      'Replace occurrences of old_string with new_string in an existing file. ' +
      'Returns an error if old_string is not found (prevents silent no-ops). ' +
      'By default only the first occurrence is replaced; set replace_all=true to replace all.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute VFS path to the file to edit.',
        },
        old_string: {
          type: 'string',
          description: 'Exact string to search for.',
        },
        new_string: {
          type: 'string',
          description: 'Replacement string.',
        },
        replace_all: {
          type: 'boolean',
          description: 'If true, replace all occurrences. Defaults to false (first only).',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const {
          path,
          old_string: oldStr,
          new_string: newStr,
          replace_all: replaceAll,
        } = JSON.parse(inputJson) as {
          path: string
          old_string: string
          new_string: string
          replace_all?: boolean
        }
        const { backend, relativePath } = vfs.resolve(path)
        const { replaced } = await backend.edit(relativePath, oldStr, newStr, replaceAll ?? false)
        return JSON.stringify({
          success: true,
          output: `Replaced ${replaced} occurrence${replaced === 1 ? '' : 's'} in ${path}`,
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
