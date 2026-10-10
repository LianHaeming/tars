// The Omarchy drill engine over the keybindings and commands in cards.json — the Burmese Words engine with keys and
// commands for words. Pure functions over a DrillState, shared by the web app (which plays offline, keeping the state on
// the phone) and the server (which merges the phone's state into state/drill.json so progress follows between devices).
//
// Each card has two memories: read (keys/command → what it does, always multiple choice) from its New card, and say
// (what it does → the keys/command) once read has graduated (it skips the first step: the card is known by then). A
// memory starts in Anki-style learning steps counted in cards, not minutes: it comes back STEPS[0] cards later, then
// STEPS[1], then STEPS[2]; a miss or "don't know" puts it back to the first step. After the last step it graduates to
// FSRS, which brings it back once predicted recall drops below 90%. Every answer updates FSRS: miss = Again; slow, a
// typo, or a multiple-choice right answer to a say review (it only shows recognition) = Hard; else Good.
//
// The mode picks the say cards' format: recall = typed, choice = multiple choice, mixed = multiple choice on the first
// step and typed after. Keys are typed as words in any order ("super shift b", "ctrl+alt+del"), with the usual aliases
// (win, cmd, control, enter, esc…) and a typo allowed in the long names; commands are typed as they'd be run, any
// <placeholder> arguments optional. A memory is "recalled" while its last typed answer was right; a card only counts
// as Recalled when its say memory is.
//
// The queue never runs dry: learning cards that are due, then slipping reviews, then a new card (while fewer than
// MAX_LEARNING cards are in steps), then the earliest learning card, then the weakest cards anyway.
import * as fsrs from '../../../packages/drill/fsrs.ts'
import { emptyState, merge, type DrillState, type Mem } from '../../../packages/drill/progress.ts'
import { distance, typosAllowed } from '../../../packages/drill/typo.ts'

export { emptyState, merge }
export type { DrillState, Mem }

export type Kind = 'keys' | 'cmd'
export type Item = { id: string; cat: string; kind: Kind; q: string; does: string; also?: string[] }
export type DrillData = { categories: { key: string; name: string }[]; cards: Item[] }
export type Dir = 'read' | 'say'
export type Mode = 'recall' | 'mixed' | 'choice'
export type Option = { id: string; text: string }
export type Format = 'choice' | 'type'
export type Card = {
  key: string; id: string; dir: Dir; stage: 'new' | 'learning' | 'review'; format: Format; cat: string; kind: Kind
  q: string; does: string; prompt?: string; options?: Option[]; answer?: string
}
export type Held = 'new' | 'learning' | 'slipping' | 'recognised' | 'recalled' | 'solid' | 'known'
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
// "I know this": a card marked known is never shown. Kept as an extra memory (<id>:known, recalled = known) so it
// merges between devices like any answer, the latest mark winning.
const isKnown = (st: DrillState, id: string) => !!st.mem[`${id}:known`]?.recalled

// Keys: every name a key goes by, mapped to one. Modifiers come first in a fixed order, so "shift super b" = "super
// shift b".
const MODS = ['super', 'shift', 'ctrl', 'alt']
const ALIASES: Record<string, string[]> = {
  super: ['win', 'windows', 'cmd', 'command', 'meta', 'mod', 'logo'],
  ctrl: ['control', 'ctl', 'strg'], alt: ['option', 'opt'], shift: [],
  return: ['enter', 'ret'], escape: ['esc'], backspace: ['bksp', 'back'], delete: ['del'],
  print: ['prtsc', 'prtscn', 'printscreen', 'prt', 'prnt'], space: ['spacebar'], tab: [], home: [],
  left: ['←', 'leftarrow'], right: ['→', 'rightarrow'], up: ['↑', 'uparrow'], down: ['↓', 'downarrow'],
  minus: ['-', '−', '–', 'dash', 'hyphen'], equal: ['=', 'equals'], slash: ['/', 'forwardslash'],
  comma: [','], period: ['.', 'dot', 'fullstop'],
}
const DASHES = ['-', '−', '–']
const KEY_NAME = new Map(Object.entries(ALIASES).flatMap(([k, as]) => [[k, k], ...as.map(a => [a, k] as [string, string])]))

function keyTokens(s: string): { tokens: string[]; fuzzed: boolean } | null {
  const raw = (s.toLowerCase().match(/[a-z0-9]+|[^\sa-z0-9+]/g) || []).filter(t => t !== 'plus' && t !== 'and')
  const parts = raw.filter((t, i) => !(DASHES.includes(t) && i < raw.length - 1))
  let fuzzed = false
  const tokens: string[] = []
  for (const t of parts) {
    let name = KEY_NAME.get(t) ?? (t.length === 1 ? t : undefined)
    if (!name && t.length >= 4) {
      const near = [...KEY_NAME.keys()].find(a => a.length >= 3 && distance(t, a) <= 1)
      if (near) { name = KEY_NAME.get(near); fuzzed = true }
    }
    if (!name) return null
    if (!tokens.includes(name)) tokens.push(name)
  }
  const mods = MODS.filter(m => tokens.includes(m))
  return { tokens: [...mods, ...tokens.filter(t => !MODS.includes(t))], fuzzed }
}

export function markKeys(typed: string, targets: string[]): Marked {
  const t = keyTokens(typed)
  if (!t || !t.tokens.length) return { right: false, close: false }
  const right = targets.some(x => keyTokens(x)?.tokens.join(' ') === t.tokens.join(' '))
  return { right, close: right && t.fuzzed }
}

// Commands: case and spacing never count, nor a leading "$"; <placeholder> and "quoted" arguments may be left out
// (anything after the command itself is ignored); in each word a typo allowed from 4 letters, two from 9.
const normCmd = (s: string) => s.toLowerCase().replace(/^\s*\$\s*/, '').replace(/\s+/g, ' ').trim()
const cmdBase = (s: string) => normCmd(s.replace(/<[^>]*>|"[^"]*"/g, ' '))
const hasArgs = (s: string) => /<[^>]*>|"[^"]*"/.test(s)

export function markCmd(typed: string, targets: string[]): Marked {
  const a = normCmd(typed)
  if (!a) return { right: false, close: false }
  const results = targets.map(x => {
    const base = cmdBase(x)
    const words = base.split(' ').length
    const mine = hasArgs(x) ? a.split(' ').slice(0, words).join(' ') : a
    if (mine === base) return { right: true, close: false }
    const mw = mine.split(' '), bw = base.split(' ')
    const ok = mw.length === bw.length && bw.every((b, i) => distance(mw[i], b) <= typosAllowed(b.length))
    return { right: ok, close: ok }
  })
  return results.find(r => r.right && !r.close) || results.find(r => r.right) || { right: false, close: false }
}

export function engine(data: DrillData) {
  const { cards: ITEMS } = data
  const byId = new Map(ITEMS.map(w => [w.id, w]))
  const cat = new Map(data.categories.map(c => [c.key, c.name]))
  const catName = (w: Item) => cat.get(w.cat) || w.cat

  function options(w: Item, dir: Dir): Option[] {
    const text = (x: Item) => dir === 'read' ? x.does : x.q
    const others = ITEMS.filter(x => x.id !== w.id && x.kind === w.kind)
    const same = shuffle(others.filter(x => x.cat === w.cat)).slice(0, 2)
    const rest = shuffle(others.filter(x => !same.includes(x))).slice(0, 3 - same.length)
    return shuffle([w, ...same, ...rest]).map(x => ({ id: x.id, text: text(x) }))
  }

  function formatOf(mode: Mode, dir: Dir, m?: Mem): Format {
    if (dir === 'read' || mode === 'choice') return 'choice'
    if (mode === 'recall') return 'type'
    return m && (m.step == null || m.step >= TYPED_FROM_STEP) ? 'type' : 'choice'
  }

  function card(st: DrillState, id: string, dir: Dir, stage: Card['stage'], mode: Mode): Card {
    const w = byId.get(id)!
    const format = stage === 'new' ? 'choice' : formatOf(mode, dir, st.mem[`${id}:${dir}`])
    const base = { key: `${id}:${dir}`, id, dir, stage, format, cat: catName(w), kind: w.kind, q: w.q, does: w.does, answer: id }
    if (stage === 'new') return base
    const prompt = dir === 'read' ? w.q : w.does
    return format === 'type' ? { ...base, prompt } : { ...base, prompt, options: options(w, dir) }
  }

  function next(st: DrillState, { last, mode = 'recall', now = Date.now() }: { last?: string; mode?: Mode; now?: number } = {}): Card | null {
    const all = Object.entries(st.mem).filter(([k]) => { const [id] = split(k); return byId.has(id) && !k.endsWith(':known') && !isKnown(st, id) && k !== last })
    const learning = all.filter(([, m]) => m.step != null).sort((a, b) => (a[1].due ?? 0) - (b[1].due ?? 0))
    const pick = ([k]: [string, Mem], stage: Card['stage']) => { const [id, dir] = split(k); return card(st, id, dir, stage, mode) }

    const dueStep = learning.find(([, m]) => (m.due ?? 0) <= st.seq)
    if (dueStep) return pick(dueStep, 'learning')
    const slipping = all.filter(([, m]) => m.step == null).map(e => [e, recallNow(e[1], now)] as const)
      .filter(([, r]) => r < fsrs.RETENTION).sort((a, b) => a[1] - b[1])
    if (slipping.length) return pick(slipping[0][0], 'review')
    const fresh = ITEMS.find(w => !st.mem[`${w.id}:read`] && !isKnown(st, w.id))
    const inSteps = new Set(all.filter(([, m]) => m.step != null).map(([k]) => split(k)[0])).size
    if (fresh && inSteps < MAX_LEARNING) return card(st, fresh.id, 'read', 'new', mode)
    if (learning.length) return pick(learning[0], 'learning')
    const weak = (m: Mem) => recallNow(m, now) - (mode === 'recall' && !m.recalled ? 1 : 0)
    const weakest = all.map(e => [e, weak(e[1])] as const).sort((a, b) => a[1] - b[1])
    if (weakest.length) return pick(weakest[Math.floor(Math.random() * Math.min(5, weakest.length))][0], 'review')
    return fresh ? card(st, fresh.id, 'read', 'new', mode) : null
  }

  // know — mark a card as already known (never shown again), or undo that.
  function know(st: DrillState, id: string, known = true, now = Date.now()) {
    if (byId.has(id)) st.mem[`${id}:known`] = { s: null, d: null, reps: 0, lapses: 0, step: null, last: now, recalled: known }
  }

  // seen — the New card was shown: start its read memory at the first learning step.
  function seen(st: DrillState, id: string, now = Date.now()) {
    const k = `${id}:read`
    if (byId.has(id) && !st.mem[k]) st.mem[k] = { s: null, d: null, reps: 0, lapses: 0, step: 0, due: st.seq + STEPS[0], last: null, introduced: now }
  }

  // mark — is this answer right? A choice of null is "I don't know"; an empty typed answer is too.
  function mark(key: string, given: Given): Marked {
    const [id] = split(key)
    const w = byId.get(id)!
    if (!('typed' in given)) return { right: given.choice === id, close: false }
    const targets = [w.q, ...(w.also || [])]
    return w.kind === 'keys' ? markKeys(given.typed, targets) : markCmd(given.typed, targets)
  }

  // answer — mark and record an answer, updating st in place.
  function answer(st: DrillState, key: string, given: Given, ms: number, now = Date.now()): LogEntry {
    const [id, dir] = split(key)
    const format: Format = 'typed' in given ? 'type' : 'choice'
    const { right, close: nearly } = mark(key, given)
    st.seq += 1
    const m: Mem = st.mem[key] || { s: null, d: null, reps: 0, lapses: 0, step: 0, due: st.seq, last: null }
    const recognisedOnly = dir === 'say' && format === 'choice' && m.step == null
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

  // status — counts for the home page, and every card with how well it's held: learning (in steps, or the say side not
  // started), slipping (due again), recognised (graduated, but not typed from memory), recalled (keys/command typed
  // right last time), solid (recalled and both memories stable for 3+ weeks).
  function status(st: DrillState, now = Date.now()) {
    const held = (w: Item): Held => {
      const read = st.mem[`${w.id}:read`], say = st.mem[`${w.id}:say`]
      if (isKnown(st, w.id)) return 'known'
      if (!read) return 'new'
      if (read.step != null || !say || say.step != null) return 'learning'
      if ([read, say].some(m => recallNow(m, now) < fsrs.RETENTION)) return 'slipping'
      if (!say.recalled) return 'recognised'
      return [read, say].every(m => (m.s ?? 0) >= STABLE) ? 'solid' : 'recalled'
    }
    const cards = ITEMS.map(w => ({ id: w.id, cat: catName(w), kind: w.kind, q: w.q, does: w.does, held: held(w) }))
    const count = (h: Held) => cards.filter(w => w.held === h).length
    return {
      total: ITEMS.length,
      counts: Object.fromEntries((['new', 'learning', 'slipping', 'recognised', 'recalled', 'solid', 'known'] as const).map(h => [h, count(h)])) as Record<Held, number>,
      answers: st.seq,
      cards,
    }
  }

  return { next, seen, know, mark, answer, status, item: (id: string) => byId.get(id) }
}

export type DrillStatus = ReturnType<ReturnType<typeof engine>['status']>
