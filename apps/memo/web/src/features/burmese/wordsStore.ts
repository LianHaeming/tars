// The Words drill's progress on this device (packages/drill/store.ts: browser storage, synced with the server).
import data from '../../../../shared/burmese/words.json'
import { drillStore } from '../../../../../../packages/drill/store.ts'
import { engine, type LogEntry } from '../../../../shared/burmese/words.ts'

export const words = engine(data)
export const { getState, record, sync } = drillStore<LogEntry>('burmese-words', '/api/burmese/words/sync')
