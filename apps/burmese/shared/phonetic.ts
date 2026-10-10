// Comparing typed phonetics: case, spaces, hyphens and punctuation never count. Shared by the sentence scorer
// (server/score.js) and the Words engine (shared/words.ts, which runs on the phone).
export { distance } from '../../../packages/drill/typo.ts'
export const normPhonetic = (s: string) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')
