// The drill's progress on this device (packages/drill/store.ts: browser storage, synced with the server).
import data from '../../../../shared/cards.json'
import { drillStore } from '../../../../../../packages/drill/store.ts'
import { engine, type DrillData, type LogEntry } from '../../../../shared/drill.ts'

export const drill = engine(data as DrillData)
export const { getState, record, sync } = drillStore<LogEntry>('omarchy-drill', '/api/omarchy/drill/sync')
