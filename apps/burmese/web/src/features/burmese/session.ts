import { hash, KINDS, type BurmeseState, type Card, type Kind, type Mem } from './data'

export type Ex = 'flip' | 'pick' | 'build' | 'gap' | 'swap'
export type Item = { card: Card; kind: Kind; key: string; mem: Mem; ex: Ex; isNew: boolean }

export const LEARN_REPS = 3
export const MISS_GAP = 3

export const tokens = (phonetic: string) => {
  const words = phonetic.split(/\s+/).filter(Boolean)
  return words.length >= 3 ? words : phonetic.split(/[\s-]+/).filter(Boolean)
}

const shuffle = <T,>(xs: T[], seed: string) => xs.map((x, i) => ({ x, h: hash(seed + i) })).sort((a, b) => a.h - b.h).map(o => o.x)

export function chooseEx(card: Card, kind: Kind, mem: Mem, today: string): Ex {
  const s = mem.s ?? 0
  const seed = `${today}:${card.id}:${kind}:${mem.reps}`
  if (kind !== 'say') return mem.s == null || s < 3 ? 'pick' : 'flip'
  const canBuild = tokens(card.phonetic).length >= 3
  const canGap = card.phonetic.split(/\s+/).length >= 2
  const options: Ex[] = s >= 7 ? ['flip', ...(canBuild ? ['build' as Ex] : []), ...(canGap ? ['gap' as Ex] : []), ...(card.swaps?.length ? ['swap' as Ex] : [])]
    : s >= 3 && canBuild ? ['flip', 'build'] : ['flip']
  return options[hash(seed) % options.length]
}

export type Session = { counts: Record<string, number>; wait: Record<string, number>; extra: Record<string, number>; turn: number }
export const emptySession = (): Session => ({ counts: {}, wait: {}, extra: {}, turn: 0 })

export function candidates(data: BurmeseState, s: Session): Item[] {
  const { today, deck, progress, reviewsToday, settings } = data
  const capped = reviewsToday >= settings.maxReviews
  return deck.flatMap(card => {
    const p = progress[card.id]
    if (!p) return []
    return KINDS.flatMap(kind => {
      const mem = p[kind]
      if (!mem) return []
      const key = `${card.id}:${kind}`
      const isNew = mem.since === today
      const due = mem.due <= today
      const learning = isNew && (s.counts[key] || 0) < LEARN_REPS
      const extra = (s.extra[key] || 0) > 0
      if (!due && !learning && !extra) return []
      if (!isNew && due && capped && !extra) return []
      return [{ card, kind, key, mem, ex: chooseEx(card, kind, mem, today), isNew }]
    })
  })
}

export function pickNext(items: Item[], s: Session, today: string) {
  const ready = items.filter(i => (s.wait[i.key] || 0) <= s.turn)
  const order = (a: Item, b: Item) => a.mem.due.localeCompare(b.mem.due) || hash(today + a.key) - hash(today + b.key)
  const old = ready.filter(i => !i.isNew).sort(order)
  const fresh = ready.filter(i => i.isNew).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || order(a, b))
  const waiting = items.filter(i => !ready.includes(i)).sort((a, b) => (s.wait[a.key] || 0) - (s.wait[b.key] || 0))
  const first = (xs: Item[]): Item | undefined => xs[0]
  return { old: first(old), fresh: first(fresh), waiting: first(waiting), learning: items.filter(i => i.isNew).length }
}

export function afterAnswer(s: Session, key: string, grade: number, sure: boolean | null | undefined, isNew: boolean): Session {
  const turn = s.turn + 1
  const counts = { ...s.counts }, wait = { ...s.wait }, extra = { ...s.extra }
  if (grade > 1) {
    counts[key] = (counts[key] || 0) + 1
    if (extra[key]) extra[key]--
    if ((isNew && counts[key] < LEARN_REPS) || extra[key]) wait[key] = turn + MISS_GAP
  } else {
    wait[key] = turn + MISS_GAP
    if (isNew) counts[key] = 0
    if (sure) extra[key] = 1
  }
  return { counts, wait, extra, turn }
}

export function pickOptions(card: Card, deck: Card[], seed: string) {
  const same = deck.filter(c => c.id !== card.id && c.topic === card.topic && c.english !== card.english)
  const rest = deck.filter(c => c.id !== card.id && c.topic !== card.topic && c.english !== card.english)
  const distractors = [...shuffle(same, seed), ...shuffle(rest, seed)].slice(0, 3).map(c => c.english)
  return shuffle([card.english, ...distractors], seed + 'o')
}

export function gapFor(card: Card, deck: Card[], seed: string) {
  const words = card.phonetic.split(/\s+/)
  const at = hash(seed) % words.length
  const answer = words[at]
  const pool = [...new Set(deck.flatMap(c => c.phonetic.split(/\s+/)))].filter(w => w !== answer)
  const close = pool.filter(w => w.split('-').length === answer.split('-').length)
  const distractors = [...shuffle(close, seed), ...shuffle(pool, seed)].filter((w, i, a) => a.indexOf(w) === i).slice(0, 3)
  return { words, at, answer, options: shuffle([answer, ...distractors], seed + 'g') }
}

export function buildFor(card: Card, seed: string) {
  const parts = tokens(card.phonetic)
  let tiles = shuffle(parts.map((t, i) => ({ t, i })), seed)
  if (tiles.every((x, i) => x.i === i)) tiles = [...tiles.slice(1), tiles[0]]
  return { parts, tiles }
}
