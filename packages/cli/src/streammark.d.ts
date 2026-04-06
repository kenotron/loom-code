declare module 'streammark' {
  type Theme = 'dark' | 'dracula' | 'nord' | 'light' | Record<string, unknown>
  interface RenderOptions { theme?: Theme }
  export function render(markdown: string, opts?: RenderOptions): string
}
