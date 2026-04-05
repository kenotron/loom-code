# Design: `@loom-code/tool-fs`

**Date**: 2026-04-04  
**Status**: Approved  
**Package**: `packages/tool-fs/` → `@loom-code/tool-fs`

---

## Overview

A virtual filesystem (VFS) `LoomPackage` that exposes 6 file operation tools to the LLM. Backends (local filesystem, in-memory, and future backends) are mounted at POSIX-style path prefixes; routing is transparent to both the LLM and the consumer.

---

## Architecture

### Core Abstraction: `FsBackend`

```ts
interface FsBackend {
  read(path: string, range?: { offset: number; limit: number }): Promise<string>
  write(path: string, content: string): Promise<void>
  edit(path: string, oldStr: string, newStr: string, replaceAll?: boolean): Promise<{ replaced: number }>
  list(path: string): Promise<DirEntry[]>
  stat(path: string): Promise<FileStat>
  glob(pattern: string): Promise<string[]>
}

interface FileStat {
  exists: boolean
  type: 'file' | 'directory' | 'symlink'  // meaningless if exists=false; returns 'file'
  size: number      // bytes; 0 if exists=false or type=directory
  modified: string  // ISO 8601; empty string if exists=false
}

interface DirEntry {
  name: string
  type: 'file' | 'directory' | 'symlink'
  size: number
}
```

### Mount Registry: `FsVfs`

`FsVfs` maintains a sorted mount table (descending by prefix length). `resolve(path)` walks the table and returns the first matching `{ backend, relativePath }` pair. Unrouted paths throw `FsError('ENOMOUNT', path)`.

```ts
class FsVfs {
  mount(mountPoint: string, backend: FsBackend): void
  unmount(mountPoint: string): void
  resolve(path: string): { backend: FsBackend; relativePath: string }
}
```

A root mount (`/`) is supported as a catch-all fallback.

**Routing example**:
```
Mounts (sorted by prefix length, descending):
  /workspace  →  LocalBackend('/Users/ken/project')
  /scratch    →  InMemoryBackend()

resolve('/scratch/notes.txt')  →  { backend: InMemoryBackend, relativePath: 'notes.txt' }
resolve('/workspace/src/app.ts')  →  { backend: LocalBackend, relativePath: 'src/app.ts' }
resolve('/etc/passwd')  →  throws FsError('ENOMOUNT', '/etc/passwd')
```

---

## Backends (v1)

### `LocalBackend`

Thin wrapper around `fs/promises` and `Bun` primitives:

- **`read`**: `Bun.file(path).text()` with optional line slicing
- **`write`**: `Bun.write(path, content)` — creates parent directories automatically
- **`edit`**: read → find `oldStr` → replace → write back. Returns `{ replaced: N }`.
- **`list`**: `readdir` with `withFileTypes: true` → `DirEntry[]`
- **`stat`**: `fs.stat` → `FileStat`; returns `{ exists: false, ... }` on ENOENT (not an error)
- **`glob`**: `Bun.Glob` — no extra dependency

### `InMemoryBackend`

Backed by a `Map<string, string>` (file path → content). Directory listings and stats are synthesized from the key set.

- **`read`/`write`/`edit`**: direct Map operations
- **`list`**: scan Map keys under the given prefix → synthesize `DirEntry[]`
- **`stat`**: check Map membership → synthesize `FileStat` (`size = content.length`, `modified = now`)
- **`glob`**: filter Map keys against pattern using `Bun.Glob`
- Entire state is a plain Map — trivially snapshottable and serializable for tests

---

## The 6 LoomTools

Each tool's `execute(inputJson)` deserializes input, calls through `FsVfs`, and returns `{ success: boolean; output: string }` JSON. No exceptions propagate to the LLM loop.

| Tool | Input Schema | Output |
|---|---|---|
| `read_file` | `{ path: string, offset?: number, limit?: number }` | File contents (optionally sliced by line) |
| `write_file` | `{ path: string, content: string }` | `"Written N bytes to /path"` |
| `edit_file` | `{ path: string, old_string: string, new_string: string, replace_all?: boolean }` | `"Replaced N occurrence(s)"` — errors if `old_string` not found |
| `list_directory` | `{ path: string }` | JSON `DirEntry[]` |
| `file_info` | `{ path: string }` | JSON `FileStat` |
| `glob` | `{ pattern: string, base?: string }` | JSON `string[]` of matched paths (absolute VFS paths); `base` is a VFS path used to resolve the backend — defaults to the longest mounted prefix |

**Error handling**: `edit_file` returns `{ success: false }` if `old_string` appears zero times — prevents silent no-ops. All tools return `{ success: false, output: "Error: <message>" }` for any filesystem error.

**Path traversal safety**: all paths must resolve to a registered mount point. The VFS routing layer rejects any path that doesn't match a mount prefix, preventing escape to unintended paths.

---

## Consumer API

```ts
import {
  createFsVfs,
  createLocalBackend,
  createInMemoryBackend,
  createFsPackage,
} from '@loom-code/tool-fs'

const vfs = createFsVfs()
vfs.mount('/workspace', createLocalBackend(process.cwd()))
vfs.mount('/scratch', createInMemoryBackend())

session.addPackage(createFsPackage(vfs))
```

---

## Package Structure

```
packages/tool-fs/
  src/
    types.ts              — FsBackend, FileStat, DirEntry, FsError
    vfs.ts                — FsVfs class (mount table + routing)
    backends/
      local.ts            — LocalBackend
      memory.ts           — InMemoryBackend
    tools/
      read.ts             — read_file LoomTool
      write.ts            — write_file LoomTool
      edit.ts             — edit_file LoomTool
      list.ts             — list_directory LoomTool
      stat.ts             — file_info LoomTool
      glob.ts             — glob LoomTool
    index.ts              — createFsPackage(), createFsVfs(), createLocalBackend(), createInMemoryBackend()
  __tests__/
    vfs.test.ts
    backends/
      local.test.ts       — tests against tmpdir fixture
      memory.test.ts
    tools/
      read.test.ts
      write.test.ts
      edit.test.ts
      list.test.ts
      stat.test.ts
      glob.test.ts
  package.json
  tsconfig.json
```

---

## Testing Strategy

- All 6 tools tested against `InMemoryBackend` — fast, deterministic, no disk I/O
- `LocalBackend` tested against a `tmpdir` fixture (created and cleaned up per test)
- `FsVfs` routing logic tested with mock backends
- No mocking of `fs/promises` — backends are simple enough to test directly

---

## Dependencies

- **Runtime**: none (uses Bun built-ins — `Bun.file`, `Bun.write`, `Bun.Glob`, `fs/promises`)
- **Peer**: `@loom-code/core` (for `LoomTool`, `LoomPackage` types)
- **Dev**: `bun:test`

---

## Future Backends (not in scope for v1)

- `S3Backend` — read/write files in an S3 bucket
- `SftpBackend` — SSH/SFTP remote filesystem
- `WebDavBackend` — HTTP/WebDAV

All would implement `FsBackend` and mount at any prefix without API changes.
