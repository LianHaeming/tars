export { cn } from "cn"

// soften a vivid tag/accent colour so it reads professional rather than neon
export const dim = (c: string) => `color-mix(in srgb, ${c} 70%, var(--muted-foreground))`
