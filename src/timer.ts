import { duration, type Interval } from './intervals'

export function createTimer(intervals: Interval[], now: number) {
  let index = 0
  let cycle = 1
  let length = duration(intervals[index])
  let deadline = now + length
  let paused: number | null = null

  return {
    advance(time: number) {
      if (paused !== null || time < deadline) return false

      while (time >= deadline) {
        index = (index + 1) % intervals.length
        if (index === 0) cycle += 1
        length = duration(intervals[index])
        deadline += length
      }
      return true
    },
    pause(time: number) {
      paused = Math.max(0, deadline - time)
    },
    resume(time: number) {
      if (paused === null) return
      deadline = time + paused
      paused = null
    },
    read(time: number) {
      return {
        cycle,
        current: intervals[index],
        next: intervals[(index + 1) % intervals.length],
        remaining: paused ?? Math.max(0, deadline - time),
        length,
        paused: paused !== null,
      }
    },
  }
}
