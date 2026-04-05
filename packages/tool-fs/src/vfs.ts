import { FsError, type FsBackend } from './types'

export interface ResolveResult {
  backend: FsBackend
  /** Path relative to the backend root (no leading slash, no mount prefix). */
  relativePath: string
  /** The mount point that matched, e.g. '/workspace' or '/'. */
  mountPoint: string
}

interface MountEntry {
  mountPoint: string
  backend: FsBackend
}

/**
 * FsVfs — virtual filesystem with a POSIX-style mount table.
 *
 * Routing uses longest-prefix-match semantics. The mount table is kept
 * sorted in descending order by prefix length so the first match is always
 * the most specific one.
 *
 * Root '/' is supported as a catch-all fallback (matches any absolute path).
 */
export class FsVfs {
  private mounts: MountEntry[] = []

  // ── mount management ───────────────────────────────────────────────────

  mount(mountPoint: string, backend: FsBackend): void {
    // Normalise: strip trailing slash unless it's the root itself
    const mp = normalizeMountPoint(mountPoint)
    // Remove existing entry for this mount point (allows override)
    this.unmount(mp)
    this.mounts.push({ mountPoint: mp, backend })
    // Sort descending by length so longest prefix matches first
    this.mounts.sort((a, b) => b.mountPoint.length - a.mountPoint.length)
  }

  unmount(mountPoint: string): void {
    const mp = normalizeMountPoint(mountPoint)
    this.mounts = this.mounts.filter(e => e.mountPoint !== mp)
  }

  // ── routing ────────────────────────────────────────────────────────────

  resolve(path: string): ResolveResult {
    const normalizedPath = normalizeInputPath(path)

    for (const entry of this.mounts) {
      const { mountPoint, backend } = entry

      if (mountPoint === '/') {
        // Root catch-all: strip leading slash
        return {
          backend,
          relativePath: normalizedPath.slice(1),
          mountPoint: '/',
        }
      }

      if (normalizedPath === mountPoint || normalizedPath.startsWith(mountPoint + '/')) {
        const relativePath =
          normalizedPath === mountPoint ? '' : normalizedPath.slice(mountPoint.length + 1)
        return { backend, relativePath, mountPoint }
      }
    }

    throw new FsError('ENOMOUNT', path)
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /**
   * Returns the mount with the longest prefix (first in sorted table),
   * or null if no mounts are registered. Used as the default for glob.
   */
  defaultMount(): { mountPoint: string; backend: FsBackend } | null {
    if (this.mounts.length === 0) return null
    const { mountPoint, backend } = this.mounts[0]
    return { mountPoint, backend }
  }
}

// ── path helpers ───────────────────────────────────────────────────────────

function normalizeMountPoint(mp: string): string {
  if (mp === '/') return '/'
  // Strip trailing slash
  return mp.replace(/\/+$/, '')
}

function normalizeInputPath(path: string): string {
  // Strip trailing slash unless root
  if (path === '/') return '/'
  return path.replace(/\/+$/, '')
}
