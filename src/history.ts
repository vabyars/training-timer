import { validSeconds, type Interval, type Settings } from './intervals'

export const historyKey = 'training-timer:history'

export interface Entry {
  id: string
  startedAt: string
  settings: Settings
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInterval(value: unknown): value is Interval {
  if (!isObject(value) || typeof value.name !== 'string') return false
  if (value.type === 'fixed') return validSeconds(value.seconds)
  return value.type === 'random' && validSeconds(value.minSeconds)
    && validSeconds(value.maxSeconds) && value.minSeconds <= value.maxSeconds
}

function isEntry(value: unknown): value is Entry {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.startedAt !== 'string'
    || !Number.isFinite(Date.parse(value.startedAt)) || !isObject(value.settings)) return false

  const { sound, intervals } = value.settings
  return typeof sound === 'boolean' && Array.isArray(intervals)
    && intervals.length > 0 && intervals.every(isInterval)
}

export function readHistory(): Entry[] {
  const raw = localStorage.getItem(historyKey)
  if (raw === null) return []

  const data: unknown = JSON.parse(raw)
  if (!isObject(data) || data.version !== 1 || !Array.isArray(data.entries)
    || !data.entries.every(isEntry)) throw new Error('Invalid training history')

  return data.entries
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, 50)
}

export function saveHistory(entries: Entry[]) {
  localStorage.setItem(historyKey, JSON.stringify({ version: 1, entries }))
}
