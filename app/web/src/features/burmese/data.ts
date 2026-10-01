import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export type Phrase = { burmese: string; phonetic: string; english: string; note: string }
export type Today = { phrase: Phrase | null; index: number; total: number }
export type Bank = { index: number; total: number; phrases: Phrase[] }

let todayCache: Today | null = null

export function useToday() {
  const [data, setData] = useState<Today | null>(todayCache)
  useEffect(() => {
    api<Today>('GET', 'burmese').then(x => { todayCache = x; setData(x) }, () => {})
  }, [])
  return data
}
