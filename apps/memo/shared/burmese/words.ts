// The Words drill engine over the words in words.json. Pure functions over a WordsState, shared by the web app (which
// plays offline, keeping the state on the phone) and the server (which merges the phone's state into state/words.json so
// progress follows between devices).
//
// Each word has two memories: read (phonetic → English) from its New-word card, say (English → phonetic) once read has
// graduated (it skips the first step: the word is known by then). A memory starts in Anki-style learning steps counted
// in cards, not minutes: it comes back STEPS[0] cards later, then STEPS[1], then STEPS[2]; a miss or "don't know" puts
// it back to the first step. After the last step it graduates to FSRS, which brings it back once predicted recall drops
// below 90%. Every answer updates FSRS: miss = Again; slow, a typo, or a multiple-choice right answer in a review (it only
// shows recognition) = Hard; else Good.
//
// The mode picks each card's format: recall = every card typed (phonetic for say, English for read), choice = every card
// multiple choice, mixed = say cards multiple choice on their first step and typed after that. Typed answers are marked
// by spelling closeness (phonetic.ts) and English answers against any of a word's meanings — no model, so it all runs
// offline. A memory is "recalled" while its last typed answer was right; a word only counts as Recalled when its say
// memory is.
//
// The queue never runs dry: learning cards that are due, then slipping reviews, then a new word (while fewer than
// MAX_LEARNING words are in steps), then the earliest learning card, then the weakest words anyway.
import * as fsrs from '../../../../packages/drill/fsrs.ts'
import { emptyState, merge, type DrillState, type Mem } from '../../../../packages/drill/progress.ts'
import { distance, typosAllowed } from '../../../../packages/drill/typo.ts'
import { normPhonetic } from './phonetic.ts'

export { emptyState, merge }
export type { Mem }
export type WordsState = DrillState

export type Word = { id: string; cat: string; burmese: string; phonetic: string; english: string; also?: string[] }
export type WordData = { categories: { key: string; name: string }[]; words: Word[] }
export type Dir = 'read' | 'say'
export type Mode = 'recall' | 'mixed' | 'choice'
export type WordOption = { id: string; text: string }
export type Format = 'choice' | 'type'
export type WordCard = {
  key: string; id: string; dir: Dir; stage: 'new' | 'learning' | 'review'; format: Format; cat: string
  phonetic: string; english: string; prompt?: string; options?: WordOption[]; answer?: string
}
export type Held = 'new' | 'learning' | 'slipping' | 'recognised' | 'recalled' | 'solid'
export type Given = { choice: string | null } | { typed: string }
export type Marked = { right: boolean; close: boolean }
export type LogEntry = {
  at: number; key: string; format: Format; choice?: string | null; typed?: string
  right: boolean; close: boolean; ms: number | null; grade: number
}

export const MODES: Mode[] = ['recall', 'mixed', 'choice']
const STEPS = [2, 5, 12]
const MAX_LEARNING = 6
const SLOW_MS = { choice: 5000, type: 12000 }
const TYPED_FROM_STEP = 2
const STABLE = 21
const DAY = 864e5

const recallNow = (m: Mem, now: number) => m.s == null || m.last == null ? 0 : fsrs.recall((now - m.last) / DAY, m.s)
const shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const split = (key: string) => key.split(':') as [string, Dir]

function close(a: string, b: string): Marked {
  if (!a) return { right: false, close: false }
  if (a === b) return { right: true, close: false }
  const ok = distance(a, b) <= typosAllowed(b.length)
  return { right: ok, close: ok }
}

export const markTyped = (typed: string, target: string) => close(normPhonetic(typed), normPhonetic(target))

// English answers: any of the meanings ("rice / a meal" → rice, a meal; "no, it isn't" → no, it isn't), ignoring
// brackets ("I (casual)" → I), a leading a / an / the / to, and punctuation.
const normEnglish = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z' ]/g, ' ')
  .replace(/^\s*(a|an|the|to)\s+/, '').replace(/\s+/g, ' ').trim()
export const meanings = (w: Word) => [...new Set([w.english, ...w.english.split(/[/,]/), ...(w.also || [])].map(normEnglish).filter(Boolean))]

export function markEnglish(typed: string, w: Word): Marked {
  const a = normEnglish(typed)
  const results = meanings(w).map(m => close(a.replace(/\s/g, ''), m.replace(/\s/g, '')))
  return results.find(r => r.right && !r.close) || results.find(r => r.right) || { right: false, close: false }
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

  function formatOf(mode: Mode, dir: Dir, m?: Mem): Format {
    if (mode === 'recall') return 'type'
    if (mode === 'choice') return 'choice'
    return dir === 'say' && m && (m.step == null || m.step >= TYPED_FROM_STEP) ? 'type' : 'choice'
  }

  function card(st: WordsState, id: string, dir: Dir, stage: WordCard['stage'], mode: Mode): WordCard {
    const w = byId.get(id)!
    const format = stage === 'new' ? 'choice' : formatOf(mode, dir, st.mem[`${id}:${dir}`])
    const base = { key: `${id}:${dir}`, id, dir, stage, format, cat: catName(w), phonetic: w.phonetic, english: w.english, answer: id }
    if (stage === 'new') return base
    const prompt = dir === 'read' ? w.phonetic : w.english
    return format === 'type' ? { ...base, prompt } : { ...base, prompt, options: options(w, dir) }
  }

  function next(st: WordsState, { last, mode = 'mixed', now = Date.now() }: { last?: string; mode?: Mode; now?: number } = {}): WordCard | null {
    const all = Object.entries(st.mem).filter(([k]) => byId.has(split(k)[0]) && k !== last)
    const learning = all.filter(([, m]) => m.step != null).sort((a, b) => (a[1].due ?? 0) - (b[1].due ?? 0))
    const pick = ([k]: [string, Mem], stage: WordCard['stage']) => { const [id, dir] = split(k); return card(st, id, dir, stage, mode) }

    const dueStep = learning.find(([, m]) => (m.due ?? 0) <= st.seq)
    if (dueStep) return pick(dueStep, 'learning')
    const slipping = all.filter(([, m]) => m.step == null).map(e => [e, recallNow(e[1], now)] as const)
      .filter(([, r]) => r < fsrs.RETENTION).sort((a, b) => a[1] - b[1])
    if (slipping.length) return pick(slipping[0][0], 'review')
    const fresh = WORDS.find(w => !st.mem[`${w.id}:read`])
    const inSteps = new Set(Object.entries(st.mem).filter(([, m]) => m.step != null).map(([k]) => split(k)[0])).size
    if (fresh && inSteps < MAX_LEARNING) return card(st, fresh.id, 'read', 'new', mode)
    if (learning.length) return pick(learning[0], 'learning')
    // Nothing due: the weakest — in recall mode, words not yet recalled first.
    const weak = (m: Mem) => recallNow(m, now) - (mode === 'recall' && !m.recalled ? 1 : 0)
    const weakest = all.map(e => [e, weak(e[1])] as const).sort((a, b) => a[1] - b[1])
    if (weakest.length) return pick(weakest[Math.floor(Math.random() * Math.min(5, weakest.length))][0], 'review')
    return fresh ? card(st, fresh.id, 'read', 'new', mode) : null
  }

  // seen — the New-word card was shown: start its read memory at the first learning step.
  function seen(st: WordsState, id: string, now = Date.now()) {
    const k = `${id}:read`
    if (byId.has(id) && !st.mem[k]) st.mem[k] = { s: null, d: null, reps: 0, lapses: 0, step: 0, due: st.seq + STEPS[0], last: null, introduced: now }
  }

  // mark — is this answer right? A choice of null is "I don't know"; an empty typed answer is too.
  function mark(key: string, given: Given): Marked {
    const [id, dir] = split(key)
    const w = byId.get(id)!
    if ('typed' in given) return dir === 'say' ? markTyped(given.typed, w.phonetic) : markEnglish(given.typed, w)
    return { right: given.choice === id, close: false }
  }

  // answer — mark and record an answer, updating st in place.
  function answer(st: WordsState, key: string, given: Given, ms: number, now = Date.now()): LogEntry {
    const [id, dir] = split(key)
    const format: Format = 'typed' in given ? 'type' : 'choice'
    const { right, close: nearly } = mark(key, given)
    st.seq += 1
    const m: Mem = st.mem[key] || { s: null, d: null, reps: 0, lapses: 0, step: 0, due: st.seq, last: null }
    const recognisedOnly = format === 'choice' && m.step == null
    const grade: fsrs.Grade = !right ? 1 : nearly || recognisedOnly || ms > SLOW_MS[format] ? 2 : 3
    const t = m.last ? (now - m.last) / DAY : 0
    Object.assign(m, fsrs.step(m, grade, t), { last: now, reps: m.reps + 1 })
    if (format === 'type') m.recalled = right
    else if (!right) m.recalled = false
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
    return { at: now, key, format, ...given, right, close: nearly, ms, grade }
  }

  // status — counts for the Words tab, and every word with how well it's held: learning (in steps, or English → Burmese
  // not started), slipping (due again), recognised (graduated, but not typed from memory), recalled (English → Burmese
  // typed right last time), solid (recalled and both memories stable for 3+ weeks).
  function status(st: WordsState, now = Date.now()) {
    const held = (w: Word): Held => {
      const read = st.mem[`${w.id}:read`], say = st.mem[`${w.id}:say`]
      if (!read) return 'new'
      if (read.step != null || !say || say.step != null) return 'learning'
      if ([read, say].some(m => recallNow(m, now) < fsrs.RETENTION)) return 'slipping'
      if (!say.recalled) return 'recognised'
      return [read, say].every(m => (m.s ?? 0) >= STABLE) ? 'solid' : 'recalled'
    }
    const words = WORDS.map(w => ({ id: w.id, cat: catName(w), phonetic: w.phonetic, english: w.english, held: held(w) }))
    const count = (h: Held) => words.filter(w => w.held === h).length
    return {
      total: WORDS.length,
      counts: Object.fromEntries((['new', 'learning', 'slipping', 'recognised', 'recalled', 'solid'] as const).map(h => [h, count(h)])) as Record<Held, number>,
      answers: st.seq,
      words,
    }
  }

  return { next, seen, mark, answer, status, word: (id: string) => byId.get(id) }
}

export type WordsStatus = ReturnType<ReturnType<typeof engine>['status']>
