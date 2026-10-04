export { cn } from "cn"

// soften a vivid tag/accent colour so it reads professional rather than neon, while
// keeping AA contrast on the lighter chrome/dock surfaces (mix toward foreground, not muted)
export const dim = (c: string) => `color-mix(in srgb, ${c} 72%, var(--foreground))`
