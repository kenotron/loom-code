/**
 * Core types for @loom-code/tool-fs
 */

// ── FsError ────────────────────────────────────────────────────────────────

/**
 * Custom error class for all VFS/backend errors.
 * `code` mirrors POSIX errno names (ENOENT, ENOMOUNT, ENOTFOUND, …).
 */
export class FsError extends Error {
  constructor(
    public readonly code: string,
    public readonly path: string,
    message?: string,
  ) {
    super(message ?? `${code}: ${path}`)
    this.name = 'FsError'
    // Ensure instanceof works correctly across transpilation boundaries
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ── FileStat ───────────────────────────────────────────────────────────────

export interface FileStat {
  /** true if the path exists */
  exists: boolean
  /** 'file' | 'directory' | 'symlink' — meaningless if exists=false; use 'file' */
  type: 'file' | 'directory' | 'symlink'
  /** byte size; 0 if exists=false or type=directory */
  size: number
  /** ISO 8601 string; empty string if exists=false */
  modified: string
}

// ── DirEntry ───────────────────────────────────────────────────────────────

export interface DirEntry {
  name: string
  type: 'file' | 'directory' | 'symlink'
  size: number
}

// ── FsBackend ──────────────────────────────────────────────────────────────

/**
 * Backend interface that every storage adapter must implement.
 * All paths are relative to the backend's root (no mount-point prefix).
 */
export interface FsBackend {
  /**
   * Read file content. If `range` is provided, slice by lines:
   *   offset = number of lines to skip (0-based)
   *   limit  = max lines to return
   */
  read(path: string, range?: { offset: number; limit: number }): Promise<string>

  /** Write (create or overwrite) a file. Creates parent directories if needed. */
  write(path: string, content: string): Promise<void>

  /**
   * Replace occurrences of `oldStr` with `newStr`.
   * Returns `{ replaced: N }` (N >= 1).
   * Throws `FsError('ENOTFOUND', path)` if zero occurrences found.
   * If `replaceAll` is false (default) only the first occurrence is replaced.
   */
  edit(
    path: string,
    oldStr: string,
    newStr: string,
    replaceAll?: boolean,
  ): Promise<{ replaced: number }>

  /** List entries of a directory. */
  list(path: string): Promise<DirEntry[]>

  /**
   * Stat a path. Returns `{ exists: false, … }` for missing paths —
   * not an error, matching the spec.
   */
  stat(path: string): Promise<FileStat>

  /**
   * Glob files matching `pattern` (relative paths from backend root).
   * Returns relative paths sorted alphabetically.
   */
  glob(pattern: string): Promise<string[]>
}
