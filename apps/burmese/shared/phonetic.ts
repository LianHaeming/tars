// Comparing typed phonetics: case, spaces, hyphens and punctuation never count. Shared by the sentence scorer
// (server/score.js) and the Words engine (shared/words.ts, which runs on the phone).
export const normPhonetic = (s: string) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')

export function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}
