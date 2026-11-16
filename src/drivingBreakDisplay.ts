/**
 * Blok řízení 4:30 a přestávka jednoho řidiče.
 * Časy jsou v milisekundách. Formátování patří do displeje.
 * Denní a týdenní strop, osádka, trajekt a OUT se zde neuplatňují.
 */

const DRIVING_LIMIT_MS = 4 * 60 * 60 * 1000 + 30 * 60 * 1000
const FULL_BREAK_MS = 45 * 60 * 1000
const FIRST_PART_MS = 15 * 60 * 1000
const SECOND_PART_MS = 30 * 60 * 1000

export type DrivingBreakActivity = 'driving' | 'rest' | 'work' | 'availability'

export type DrivingBreakInterval = {
  kind: DrivingBreakActivity
  startMs: number
  endMs: number
}

export type DrivingBreakDisplay =
  | { phase: 'driving'; remainingDrivingMs: number; requiredBreakMs: number }
  | {
      phase: 'break'
      drivingIfStartNowMs: number
      remainingBreakMs: number
      drivingAfterBreakMs: number
    }

/**
 * Intervaly jsou seřazené a nepřekrývají se. Poslední může končit v `nowMs`
 * a je pak právě probíhající činnost. Sousední odpočinky bez mezery jsou jeden
 * souvislý odpočinek. Mezera ani jiná činnost se do něj nepočítá.
 */
export function drivingBreakDisplay(
  intervals: readonly DrivingBreakInterval[],
  nowMs: number,
): DrivingBreakDisplay {
  const spans = normalize(intervals, nowMs)
  let drivingMs = 0
  let firstPartTaken = false

  const remainingDrivingMs = () => Math.max(0, DRIVING_LIMIT_MS - drivingMs)
  const resetBlock = () => {
    drivingMs = 0
    firstPartTaken = false
  }
  const drivingView = (): DrivingBreakDisplay => ({
    phase: 'driving',
    remainingDrivingMs: remainingDrivingMs(),
    requiredBreakMs: firstPartTaken ? SECOND_PART_MS : FULL_BREAK_MS,
  })

  for (const span of spans) {
    const durationMs = span.endMs - span.startMs
    const ongoing = span.endMs === nowMs
    if (span.kind === 'driving') {
      drivingMs += durationMs
      continue
    }
    if (span.kind !== 'rest') continue

    const resets = durationMs >= FULL_BREAK_MS || (firstPartTaken && durationMs >= SECOND_PART_MS)
    if (ongoing) {
      if (resets) {
        resetBlock()
        return {
          phase: 'driving',
          remainingDrivingMs: DRIVING_LIMIT_MS,
          requiredBreakMs: FULL_BREAK_MS,
        }
      }
      return {
        phase: 'break',
        drivingIfStartNowMs: remainingDrivingMs(),
        remainingBreakMs: (firstPartTaken ? SECOND_PART_MS : FULL_BREAK_MS) - durationMs,
        drivingAfterBreakMs: DRIVING_LIMIT_MS,
      }
    }
    if (resets) resetBlock()
    else if (!firstPartTaken && durationMs >= FIRST_PART_MS) firstPartTaken = true
  }

  return drivingView()
}

function normalize(intervals: readonly DrivingBreakInterval[], nowMs: number): DrivingBreakInterval[] {
  const spans: DrivingBreakInterval[] = []
  for (const interval of intervals) {
    const endMs = Math.min(interval.endMs, nowMs)
    if (endMs <= interval.startMs) continue
    const previous = spans[spans.length - 1]
    if (
      previous &&
      previous.kind === 'rest' &&
      interval.kind === 'rest' &&
      previous.endMs === interval.startMs
    ) {
      previous.endMs = endMs
      continue
    }
    spans.push({ kind: interval.kind, startMs: interval.startMs, endMs })
  }
  return spans
}
