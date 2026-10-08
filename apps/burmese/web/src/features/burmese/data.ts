import { api } from '@tars/ui/lib/api'

export type Word = { p: string; e: string }
export type Card = { id: string; cat: string; english: string; phonetic: string; words: Word[] }
export type Kind = 'read' | 'say'
export type ReviewCard = Card & { kind: Kind }
export type Unit = { unit: number; review: ReviewCard[]; new: Card[]; left: number }
export type Result = { score: number | null; grade: number; english: string; phonetic: string; words: Word[] }
export type Status = { slipping: number; newReady: number; left: number; pool: number }
export type Mem = { r: number; s: number | null; d: number | null; last: number | null; lastScore: number | null; best: number; reps: number; lapses: number }
export type Row = { id: string; cat: string; english: string; phonetic: string; read: Mem | null; say: Mem | null; state: 'learning' | 'stable' }
export type Stats = {
  counts: { new: number; learning: number; stable: number }
  recall: number | null
  atRisk: number
  answers: number
  trend: { unit: number; avg: number; n: number }[]
  rows: Row[]
  categories: { key: string; name: string }[]
}
export type Category = { key: string; name: string; sentences: { id: string; english: string; phonetic: string }[] }
export type Asked = { id: string; at: number; asked: string; english: string; phonetic: string }

export const getStatus = () => api<Status>('GET', 'burmese')
export const getUnit = () => api<Unit>('GET', 'burmese/unit')
export const postAnswer = (body: { unit: number; id: string; kind: Kind; answer: string | null; phase: 'review' | 'new' }) =>
  api<Result>('POST', 'burmese/answer', body)
export const getStats = () => api<Stats>('GET', 'burmese/stats')
export const getSentences = () => api<Category[]>('GET', 'burmese/sentences')
export const getAsked = () => api<Asked[]>('GET', 'burmese/asked')
export type Practise = { started: number; cards: Card[] }
export const getPractise = (skip = 0) => api<Practise>('GET', `burmese/practise?skip=${skip}`)
export const ask = (text: string) => api<Asked>('POST', 'burmese/ask', { text })

export const scoreTone = (score: number | null) =>
  score == null || score < 60 ? 'text-overdue' : score < 85 ? 'text-tomorrow' : 'text-today'
