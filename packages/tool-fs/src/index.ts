/**
 * @loom-code/tool-fs
 *
 * Virtual filesystem LoomPackage — exposes 6 file-operation tools backed
 * by a POSIX-style VFS with pluggable backends.
 *
 * Quick start:
 *   const vfs = createFsVfs()
 *   vfs.mount('/workspace', createLocalBackend(process.cwd()))
 *   vfs.mount('/scratch',   createInMemoryBackend())
 *   session.addPackage(createFsPackage(vfs))
 */

export { FsError } from './types'
export type { FsBackend, FileStat, DirEntry } from './types'
export { FsVfs } from './vfs'
export type { ResolveResult } from './vfs'
export { LocalBackend } from './backends/local'
export { InMemoryBackend } from './backends/memory'

import type { LoomPackage } from '@loom-code/core'
import { FsVfs } from './vfs'
import { LocalBackend } from './backends/local'
import { InMemoryBackend } from './backends/memory'
import { makeReadTool } from './tools/read'
import { makeWriteTool } from './tools/write'
import { makeEditTool } from './tools/edit'
import { makeListTool } from './tools/list'
import { makeStatTool } from './tools/stat'
import { makeGlobTool } from './tools/glob'

/** Create a new, empty VFS (no mounts). */
export function createFsVfs(): FsVfs {
  return new FsVfs()
}

/** Create a LocalBackend rooted at `rootDir`. */
export function createLocalBackend(rootDir: string): LocalBackend {
  return new LocalBackend(rootDir)
}

/** Create an InMemoryBackend (empty Map). */
export function createInMemoryBackend(): InMemoryBackend {
  return new InMemoryBackend()
}

/**
 * Build a LoomPackage containing all 6 filesystem tools wired to `vfs`.
 *
 * @param vfs - A configured FsVfs instance with at least one mount point.
 */
export function createFsPackage(vfs: FsVfs): LoomPackage {
  return {
    tools: [
      makeReadTool(vfs),
      makeWriteTool(vfs),
      makeEditTool(vfs),
      makeListTool(vfs),
      makeStatTool(vfs),
      makeGlobTool(vfs),
    ],
  }
}
