/** Generate an 8-character random ID using the first 8 hex chars of a UUID v4. */
export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}
