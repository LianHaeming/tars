// A drill's progress: one memory per card side, in Anki-style learning steps (step/due counted in cards answered, seq)
// and then FSRS (s, d). Shared by the drill engines and their servers.
export type Mem = {
  s: number | null; d: number | null; reps: number; lapses: number
  step: number | null; due?: number; last: number | null; introduced?: number; recalled?: boolean
}
export type DrillState = { seq: number; mem: Record<string, Mem> }

export const emptyState = (): DrillState => ({ seq: 0, mem: {} })

const touched = (m: Mem) => m.last ?? m.introduced ?? 0

// merge(a, b) — the union of two devices' progress: per memory, whichever was answered (or introduced) most recently.
export function merge(a: DrillState, b: DrillState): DrillState {
  const mem: Record<string, Mem> = { ...a.mem }
  for (const [k, m] of Object.entries(b.mem || {})) {
    const o = mem[k]
    if (!o || touched(m) > touched(o) || (touched(m) === touched(o) && m.reps > o.reps)) mem[k] = m
  }
  return { seq: Math.max(a.seq || 0, b.seq || 0), mem }
}
