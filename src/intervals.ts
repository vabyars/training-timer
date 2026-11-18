export type Interval = { name: string } & (
  | { type: 'fixed'; seconds: number }
  | { type: 'random'; minSeconds: number; maxSeconds: number }
)

export interface Settings {
  sound: boolean
  intervals: Interval[]
}

export function validSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3600
}

export function duration(interval: Interval) {
  if (interval.type === 'fixed') return interval.seconds * 1000
  const { minSeconds, maxSeconds } = interval
  return (minSeconds + Math.floor(Math.random() * (maxSeconds - minSeconds + 1))) * 1000
}
