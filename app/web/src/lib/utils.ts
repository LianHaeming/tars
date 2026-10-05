export { cn } from "cn"

// soften a vivid tag/accent colour so it reads professional rather than neon, while
// keeping AA contrast on the lighter chrome/dock surfaces (mix toward foreground, not muted)
export const dim = (c: string) => `color-mix(in srgb, ${c} 72%, var(--foreground))`

let primer: HTMLInputElement | null = null
export function primeKeyboard() {
  if (typeof document === 'undefined') return
  if (!primer) {
    primer = document.createElement('input')
    primer.setAttribute('aria-hidden', 'true')
    primer.tabIndex = -1
    primer.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;background:transparent;pointer-events:none;z-index:-1;'
    document.body.appendChild(primer)
  }
  primer.focus({ preventScroll: true })
}
