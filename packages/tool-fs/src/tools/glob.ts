import type { LoomTool } from '@loom-code/core'
import { FsError } from '../types'
import type { FsVfs } from '../vfs'

export function makeGlobTool(vfs: FsVfs): LoomTool {
  return {
    name: 'glob',
    description:
      'Find files matching a glob pattern in the virtual filesystem. ' +
      'Returns a JSON array of absolute VFS paths. ' +
      '`base` is a VFS path used to select which backend to search (defaults to the longest-prefix mount).',
    schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match (e.g. "**/*.ts", "src/*.{ts,tsx}").',
        },
        base: {
          type: 'string',
          description:
            'Absolute VFS path to determine which backend to search. Defaults to the longest-prefix mount.',
        },
      },
      required: ['pattern'],
    },
    async execute(inputJson: string): Promise<string> {
      try {
        const { pattern, base } = JSON.parse(inputJson) as {
          pattern: string
          base?: string
        }

        let mountPoint: string
        let backend: import('../types').FsBackend

        if (base !== undefined) {
          const resolved = vfs.resolve(base)
          mountPoint = resolved.mountPoint
          backend = resolved.backend
        } else {
          const dm = vfs.defaultMount()
          if (!dm) {
            throw new FsError('ENOMOUNT', '', 'ENOMOUNT: no backends mounted')
          }
          mountPoint = dm.mountPoint
          backend = dm.backend
        }

        const relativePaths = await backend.glob(pattern)

        // Convert relative paths back to absolute VFS paths
        const absPaths = relativePaths.map(p => {
          if (mountPoint === '/') return '/' + p
          return `${mountPoint}/${p}`
        })

        return JSON.stringify({ success: true, output: JSON.stringify(absPaths) })
      } catch (err: unknown) {
        return JSON.stringify({
          success: false,
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
  }
}
