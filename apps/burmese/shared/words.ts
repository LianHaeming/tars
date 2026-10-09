// The Words drill engine: fast multiple choice over the words in words.json. Pure functions over a WordsState, shared by
// the web app (which plays offline, keeping the state on the phone) and the server (which merges the phone's state into
// state/words.json so progress follows between devices).
//
// Each word has two memories: read (phonetic → English) from its New-word card, say (English → phonetic) once read has
// graduated (it skips the first step: the word is known by then). A memory starts in Anki-style learning steps counted
// in cards, not minutes: it comes back STEPS[0] cards later, then STEPS[1], then STEPS[2]; a miss or "don't know" puts
// it back to the first step. After the last step it graduates to FSRS, which brings it back once predicted recall drops
// below 90%. Every answer also updates FSRS: miss = Again, slow = Hard, else Good. The queue never runs dry: learning
// cards that are due, then slipping reviews, then a new word (while fewer than MAX_LEARNING words are in steps), then
// the earliest learning card, then the weakest words anyway.
import * as fsrs from './fsrs.ts'

export type Word = { id: string; cat: string; burmese: string; phonetic: string; english: string }
export type WordData = { categories: { key: string; name: string }[]; words: Word[] }
export type Dir = 'read' | 'say'
export type Mem = {
  s: number | null; d: number | null; reps: number; lapses: number
  step: number | null; due?: number; last: number | null; introduced?: number
}
export type WordsState = { seq: number; mem: Record<string, Mem> }
export type WordOption = { id: string; text: string }
export type WordCard = {
  key: string; id: string; dir: Dir; stage: 'new' | 'learning' | 'review'; cat: string
  phonetic: string; english: string; prompt?: string; options?: WordOption[]; answer?: string
}
export type Held = 'new' | 'learning' | 'slipping' | 'known' | 'solid'
export type LogEntry = { at: number; key: string; choice: string | null; right: boolean; ms: number | null; grade: number }

const STEPS = [2, 5, 12]
const MAX_LEARNING = 6
const SLOW_MS = 5000
const STABLE = 21
const DAY = 864e5

export const emptyState = (): WordsState => ({ seq: 0, mem: {} })

const recallNow = (m: Mem, now: number) => m.s == null || m.last == null ? 0 : fsrs.recall((now - m.last) / DAY, m.s)
const shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const split = (key: string) => key.split(':') as [string, Dir]
const touched = (m: Mem) => m.last ?? m.introduced ?? 0

// merge(a, b) — the union of two devices' progress: per memory, whichever was answered (or introduced) most recently.
export function merge(a: WordsState, b: WordsState): WordsState {
  const mem: Record<string, Mem> = { ...a.mem }
  for (const [k, m] of Object.entries(b.mem || {})) {
    const o = mem[k]
    if (!o || touched(m) > touched(o) || (touched(m) === touched(o) && m.reps > o.reps)) mem[k] = m
  }
  return { seq: Math.max(a.seq || 0, b.seq || 0), mem }
}

export function engine(data: WordData) {
  const { words: WORDS } = data
  const byId = new Map(WORDS.map(w => [w.id, w]))
  const cat = new Map(data.categories.map(c => [c.key, c.name]))
  const catName = (w: Word) => cat.get(w.cat) || w.cat

  function options(w: Word, dir: Dir): WordOption[] {
    const text = (x: Word) => dir === 'read' ? x.english : x.phonetic
    const others = WORDS.filter(x => x.id !== w.id && x.phonetic !== w.phonetic && x.english !== w.english)
    const same = shuffle(others.filter(x => x.cat === w.cat)).slice(0, 2)
    const rest = shuffle(others.filter(x => !same.includes(x))).slice(0, 3 - same.length)
    return shuffle([w, ...same, ...rest]).map(x => ({ id: x.id, text: text(x) }))
  }

  function card(id: string, dir: Dir, stage: WordCard['stage']): WordCard {
    const w = byId.get(id)!
    const base = { key: `${id}:${dir}`, id, dir, stage, cat: catName(w), phonetic: w.phonetic, english: w.english }
    if (stage === 'new') return base
    return { ...base, prompt: dir === 'read' ? w.phonetic : w.english, options: options(w, dir), answer: id }
  }

  function next(st: WordsState, last?: string, now = Date.now()): WordCard | null {
    const all = Object.entries(st.mem).filter(([k]) => byId.has(split(k)[0]) && k !== last)
    const learning = all.filter(([, m]) => m.step != null).sort((a, b) => (a[1].due ?? 0) - (b[1].due ?? 0))
    const pick = ([k]: [string, Mem], stage: WordCard['stage']) => { const [id, dir] = split(k); return card(id, dir, stage) }

    const dueStep = learning.find(([, m]) => (m.due ?? 0) <= st.seq)
    if (dueStep) return pick(dueStep, 'learning')
    const slipping = all.filter(([, m]) => m.step == null).map(e => [e, recallNow(e[1], now)] as const)
      .filter(([, r]) => r < fsrs.RETENTION).sort((a, b) => a[1] - b[1])
    if (slipping.length) return pick(slipping[0][0], 'review')
    const fresh = WORDS.find(w => !st.mem[`${w.id}:read`])
    const inSteps = new Set(Object.entries(st.mem).filter(([, m]) => m.step != null).map(([k]) => split(k)[0])).size
    if (fresh && inSteps < MAX_LEARNING) return card(fresh.id, 'read', 'new')
    if (learning.length) return pick(learning[0], 'learning')
    const weakest = all.map(e => [e, recallNow(e[1], now)] as const).sort((a, b) => a[1] - b[1])
    if (weakest.length) return pick(weakest[Math.floor(Math.random() * Math.min(5, weakest.length))][0], 'review')
    return fresh ? card(fresh.id, 'read', 'new') : null
  }

  // seen — the New-word card was shown: start its read memory at the first learning step.
  function seen(st: WordsState, id: string, now = Date.now()) {
    const k = `${id}:read`
    if (byId.has(id) && !st.mem[k]) st.mem[k] = { s: null, d: null, reps: 0, lapses: 0, step: 0, due: st.seq + STEPS[0], last: null, introduced: now }
  }

  // answer — score a multiple-choice answer (choice null = "I don't know"), updating st in place.
  function answer(st: WordsState, key: string, choice: string | null, ms: number, now = Date.now()): LogEntry {
    const [id, dir] = split(key)
    const right = choice === id
    const grade: fsrs.Grade = !right ? 1 : ms > SLOW_MS ? 2 : 3
    st.seq += 1
    const m: Mem = st.mem[key] || { s: null, d: null, reps: 0, lapses: 0, step: 0, due: st.seq, last: null }
    const t = m.last ? (now - m.last) / DAY : 0
    Object.assign(m, fsrs.step(m, grade, t), { last: now, reps: m.reps + 1 })
    if (!right) {
      if (m.step == null) m.lapses += 1
      m.step = 0; m.due = st.seq + STEPS[0]
    } else if (m.step != null) {
      m.step += 1
      if (m.step >= STEPS.length) { m.step = null; delete m.due } else m.due = st.seq + STEPS[m.step]
    }
    st.mem[key] = m
    const sayKey = `${id}:say`
    if (dir === 'read' && m.step == null && !st.mem[sayKey]) st.mem[sayKey] = { s: null, d: null, reps: 0, lapses: 0, step: 1, due: st.seq + STEPS[0], last: null }
    return { at: now, key, choice, right, ms, grade }
  }

  // status — counts for the Words tab, and every word with how well it's held.
  function status(st: WordsState, now = Date.now()) {
    const held = (w: Word): Held => {
      const ms = (['read', 'say'] as const).map(k => st.mem[`${w.id}:${k}`]).filter(Boolean)
      if (!ms.length) return 'new'
      if (ms.some(m => m.step != null)) return 'learning'
      if (ms.some(m => recallNow(m, now) < fsrs.RETENTION)) return 'slipping'
      return ms.length === 2 && ms.every(m => (m.s ?? 0) >= STABLE) ? 'solid' : 'known'
    }
    const words = WORDS.map(w => ({ id: w.id, cat: catName(w), phonetic: w.phonetic, english: w.english, held: held(w) }))
    const count = (h: Held) => words.filter(w => w.held === h).length
    return {
      total: WORDS.length,
      counts: { new: count('new'), learning: count('learning'), slipping: count('slipping'), known: count('known'), solid: count('solid') },
      answers: st.seq,
      words,
    }
  }

  return { next, seen, answer, status, word: (id: string) => byId.get(id) }
}

export type WordsStatus = ReturnType<ReturnType<typeof engine>['status']>
