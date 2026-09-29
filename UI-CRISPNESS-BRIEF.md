# tars — UI crispness brief (iOS Safari, iPhone + iPad)

_Brief for a tars implementation session. Written 2026-09-29 from a research bundle on how
professional web apps look crisp on iOS Safari, plus an audit of tars' current frontend._

## TL;DR

- **Keep React + shadcn/Radix.** tars is already on the exact stack the research recommends.
  React is **not** why the UI feels not-crisp; switching frameworks would only add mobile JS cost.
- The foundation here is already strong (see "Already done right"). This is a **refinement pass**,
  not a rebuild. Do the changes below in priority order and **measure on a real iPhone between each**.
- Crispness = two things: **perceived responsiveness** (keep the main thread free — INP) and
  **visual polish** (CSS/design discipline). Neither is a framework property.

## Already done right — do NOT churn these

`index.html` has `viewport-fit=cover` + `apple-mobile-web-app-*` meta · `env(safe-area-inset-*)`
is used correctly in Home padding, Dock, and Toaster · `overscroll-behavior-y: none` ·
`-webkit-tap-highlight-color: transparent` · `input,textarea,select{font-size:16px}` (prevents
iOS zoom-on-focus) · `min-height:100dvh` · `useKeyboardOffset` via visualViewport · design tokens
as CSS vars · Geist variable font · shadcn/Radix primitives · dark `color-scheme`.

Leave all of the above alone. The gaps are below.

## The actual levers, in priority order

### 1. Enforce ONE spacing + type scale — stop the magic numbers (highest impact)
This is the #1 "amateur → pro" lever in the research (Refactoring UI; Learn UI Design). The code
currently escapes Tailwind's scale constantly with arbitrary values, and the little inconsistencies
are exactly what read as "subtly off":
- Type: `text-[13px]`, `text-[15px]`, `text-xs`, `text-sm` are mixed ad hoc. **Define a fixed type
  ramp** (e.g. 12 / 13 / 15 / 17 / 20 / 24 as named `--text-*` tokens or a small set of Tailwind
  sizes) and use ONLY those. One weight scheme for hierarchy (e.g. 400 body / 600 labels / 700 headings).
- Spacing: `pt-[22px]`, `pb-1.5`, `pb-2.5`, `pt-2`, `size-[18px]`, `rounded-[30px]`, `gap-3` etc.
  are a mix of scale steps and arbitrary px. **Snap everything to a 4px scale** (Tailwind's default:
  `1`=4px `2`=8px `3`=12px `4`=16px `5`=20px `6`=24px). Replace `[22px]`→`5` or `6`, `[18px]`→`4` or `5`,
  `rounded-[30px]`→a named radius token. Goal: **zero arbitrary `[..px]` values** in layout/spacing/type
  except deliberate one-offs with a comment.
- Build hierarchy with **weight + color/opacity + spacing, not font size alone**; make secondary text
  clearly "un-pop" (muted-foreground is good — use it consistently).
- _Why:_ a single enforced scale is the invisible grid that makes pro UIs feel orderly and crisp.

### 2. Test the backdrop-blur — it's the most likely iOS crispness killer
tars stacks several large `backdrop-filter: blur(20–26px) saturate(...)` surfaces (`glass`,
`glass-strong`, `PillBar`'s `backdrop-blur`, `bg-background/95 backdrop`, the Dock). On iOS Safari,
big/stacked backdrop filters are a known cause of **soft/blurry text and scroll-repaint jank**.
- **A/B it:** temporarily replace the glass surfaces with solid (or near-solid) fills and compare
  crispness + scroll smoothness on a real iPhone. If it sharpens up, that was it.
- If keeping glass: reduce blur radius (try 10–14px), drop `saturate` where it's not earning its
  keep, and avoid a blurred surface that sits over scrolling content (blur repaints every frame).
- Keep blur for the Dock (small, fixed, not over long scroll) — kill it on large/sticky surfaces first.

### 3. Hairline separators on retina
Borders are `1px` at low opacity. On a 2x/3x screen a 1px border is 2–3 physical px and reads
heavier/softer than the pros' crisp lines. Use **`0.5px`** hairlines for separators/dividers
(reliable on iOS retina) — noticeably crisper for row/section borders.

### 4. Motion: fast, interruptible, and honor reduced-motion
Motion is the finishing 10% (Emil Kowalski; Apple "Designing Fluid Interfaces"). tars already has
nice `active:scale` presses. Check: transitions animate only `transform`/`opacity` (never layout
props like width/top/height — those jank on iOS); durations are short (~150–250ms); and add a
`prefers-reduced-motion` guard. Note `duration-250` is not a standard Tailwind step — verify it
actually emits (use `duration-200`/`duration-300` or an arbitrary `[250ms]`).

### 5. Verify hierarchy, whitespace, contrast on device
The research's other big tells (too little whitespace; too many competing accents; inconsistent card
padding/alignment) can only be judged rendered. On a real iPhone: are all cards using identical
padding + gutters? Is there one accent doing the emphasis, or several competing? Is body text
comfortably large (≥15–16px) and secondary text clearly demoted? Fix per Refactoring UI.

## How to work this

1. Do **#1 and #2 first** — they're the biggest levers — and check each on a real iPhone before moving on.
2. Change one thing at a time; crispness is cumulative and easy to misattribute.
3. Don't add dependencies or switch frameworks. The stack is right.
4. Full source corpus (42 sources, not needed to implement this) lives in the robin toolbox at
   `desk/tars/crisp-ios-safari-ui-research/` — reference only if you want the primary docs.

## Source anchors (for verification)
- Safe-area/viewport: WebKit "Designing Websites for iPhone X"; web.dev "viewport units" (`dvh`/`svh`/`lvh`).
- Font smoothing myth: `-webkit-font-smoothing` is macOS-only — does nothing on iOS (dbushell, 2024).
- Framework verdict: Josh Comeau "You Don't Need a UI Framework"; web.dev "Optimize INP".
- Scale/hierarchy/shadows: Refactoring UI; Learn UI Design "7 Rules for Gorgeous UI"; Josh Comeau "Designing Shadows".
- Motion: Emil Kowalski "Great animations"; Apple WWDC18 "Designing Fluid Interfaces".
