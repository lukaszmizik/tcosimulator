import assert from 'node:assert/strict'
import { drivingBreakDisplay, type DrivingBreakInterval } from '../src/drivingBreakDisplay.ts'
import { ferryDailyRestRemaining, intervalsWithRecognizedFerryRest } from '../src/ferryRestEvaluation.ts'
import { slot1DddCalendarRemaining, slot1DddDailyRemaining } from '../src/slot1DddDailyRemaining.ts'
import { DAILY_DRIVING_LIMIT_MS, DAILY_REST_MIN_11H_MS } from '../src/VDOCounter.ts'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

function sameAxis(left: readonly DrivingBreakInterval[], right: readonly DrivingBreakInterval[]) {
  assert.equal(left.length, right.length)
  for (let index = 0; index < left.length; index += 1) {
    assert.equal(left[index]?.kind, right[index]?.kind)
    assert.equal(left[index]?.startMs, right[index]?.startMs)
    assert.equal(left[index]?.endMs, right[index]?.endMs)
  }
}

function drivingSum(intervals: readonly DrivingBreakInterval[]) {
  return intervals.reduce((sum, interval) => (
    interval.kind === 'driving' ? sum + interval.endMs - interval.startMs : sum
  ), 0)
}

const now = Date.UTC(2026, 0, 8, 12, 0, 0)

const activationOnly: DrivingBreakInterval[] = [
  { kind: 'driving', startMs: now - HOUR, endMs: now },
]
const activated = ferryDailyRestRemaining({
  imported: [],
  vehicle: activationOnly,
  vehicleEvents: [{ minuteStartUtc: now - HOUR, type: 'activation' }],
  nowMs: now,
})
assert.equal(activated.remainingMs, null)
assert.equal(activated.accumulatedMs, null)
assert.equal(activated.completed.length, 0)
assert.equal(activated.conditional, false)
const activationBreak = drivingBreakDisplay(activationOnly, now)
assert.equal(activationBreak.phase, 'driving')
if (activationBreak.phase === 'driving') assert.equal(activationBreak.remainingDrivingMs, 4 * HOUR + 30 * MINUTE - HOUR)
sameAxis(intervalsWithRecognizedFerryRest(activationOnly, activated.completed), activationOnly)

const restStart = now - 3 * HOUR
const resting: DrivingBreakInterval[] = [
  { kind: 'driving', startMs: restStart - 2 * HOUR, endMs: restStart },
  { kind: 'rest', startMs: restStart, endMs: now },
]
const partial = ferryDailyRestRemaining({
  imported: resting,
  vehicle: [],
  cardConditions: [{ kind: 'ferry', atUtc: restStart }],
  nowMs: now,
})
assert.equal(partial.accumulatedMs, 3 * HOUR)
assert.equal(partial.remainingMs, 8 * HOUR)
assert.equal(partial.completed.length, 0)
const later = now + 15 * MINUTE
const laterRest: DrivingBreakInterval[] = [
  { kind: 'driving', startMs: restStart - 2 * HOUR, endMs: restStart },
  { kind: 'rest', startMs: restStart, endMs: later },
]
const decreased = ferryDailyRestRemaining({
  imported: laterRest,
  vehicle: [],
  cardConditions: [{ kind: 'ferry', atUtc: restStart }],
  nowMs: later,
})
assert.equal(decreased.remainingMs, 8 * HOUR - 15 * MINUTE)
assert.equal(decreased.accumulatedMs, 3 * HOUR + 15 * MINUTE)

const fullEnd = restStart + DAILY_REST_MIN_11H_MS
const afterFull = fullEnd + 30 * MINUTE
const fullRest: DrivingBreakInterval[] = [
  { kind: 'driving', startMs: restStart - 2 * HOUR, endMs: restStart },
  { kind: 'rest', startMs: restStart, endMs: fullEnd },
  { kind: 'driving', startMs: fullEnd, endMs: afterFull },
]
const finished = ferryDailyRestRemaining({
  imported: fullRest,
  vehicle: [],
  cardConditions: [
    { kind: 'ferry', atUtc: restStart },
    { kind: 'ferry_end', atUtc: fullEnd },
  ],
  nowMs: afterFull,
})
assert.equal(finished.remainingMs, null)
assert.equal(finished.completed.length, 1)
assert.equal(finished.completed[0]?.endMs, fullEnd)
assert.equal(finished.completed[0]?.conditional, false)
const fullDaily = slot1DddDailyRemaining(fullRest, afterFull, finished.completed.map((item) => item.endMs))
assert.equal(fullDaily.drivenMs, 30 * MINUTE)
assert.equal(fullDaily.limitMs, DAILY_DRIVING_LIMIT_MS)
assert.equal(fullDaily.remainingMs, DAILY_DRIVING_LIMIT_MS - 30 * MINUTE)
assert.equal(fullDaily.periodStartMs, fullEnd)
const fullBreak = drivingBreakDisplay(fullRest, afterFull)
assert.equal(fullBreak.phase, 'driving')
if (fullBreak.phase === 'driving') assert.equal(fullBreak.remainingDrivingMs, 4 * HOUR)
sameAxis(intervalsWithRecognizedFerryRest(fullRest, finished.completed), fullRest)
assert.deepEqual(
  drivingBreakDisplay(intervalsWithRecognizedFerryRest(fullRest, finished.completed), afterFull),
  fullBreak,
)

const splitOrigin = Date.UTC(2026, 0, 8, 6, 0, 0)
const previousRestEnd = splitOrigin
const driveBeforeEnd = previousRestEnd + 2 * HOUR
const ferryRestStart = driveBeforeEnd
const interruptionStart = ferryRestStart + 5 * HOUR
const interruptionEnd = interruptionStart + 30 * MINUTE
const ferryRestEnd = interruptionEnd + 6 * HOUR
const driveAfterEnd = ferryRestEnd + 40 * MINUTE
const split: DrivingBreakInterval[] = [
  { kind: 'rest', startMs: previousRestEnd - 11 * HOUR, endMs: previousRestEnd },
  { kind: 'driving', startMs: previousRestEnd, endMs: driveBeforeEnd },
  { kind: 'rest', startMs: ferryRestStart, endMs: interruptionStart },
  { kind: 'driving', startMs: interruptionStart, endMs: interruptionEnd },
  { kind: 'rest', startMs: interruptionEnd, endMs: ferryRestEnd },
  { kind: 'driving', startMs: ferryRestEnd, endMs: driveAfterEnd },
]
const splitRest = ferryDailyRestRemaining({
  imported: [],
  vehicle: split,
  vehicleEvents: [
    { minuteStartUtc: ferryRestStart, type: 'activation' },
    { minuteStartUtc: ferryRestEnd, type: 'deactivation' },
  ],
  nowMs: driveAfterEnd,
})
assert.equal(splitRest.completed.length, 2)
assert.equal(splitRest.completed[0]?.endMs, previousRestEnd)
assert.equal(splitRest.completed[0]?.conditional, false)
assert.equal(splitRest.completed[1]?.endMs, ferryRestEnd)
assert.equal(splitRest.completed[1]?.conditional, true)
const preserved = intervalsWithRecognizedFerryRest(split, splitRest.completed)
sameAxis(preserved, split)
assert.equal(drivingSum(preserved), drivingSum(split))
assert.equal(preserved.some((interval) => interval.kind === 'rest' && interval.endMs - interval.startMs >= 11 * HOUR && interval.endMs === ferryRestEnd), false)
const splitDaily = slot1DddDailyRemaining(preserved, driveAfterEnd, splitRest.completed.map((item) => item.endMs))
assert.equal(splitDaily.periodStartMs, ferryRestEnd)
assert.equal(splitDaily.drivenMs, 40 * MINUTE)
assert.equal(splitDaily.remainingMs, DAILY_DRIVING_LIMIT_MS - 40 * MINUTE)
const withoutBoundary = slot1DddDailyRemaining(split, driveAfterEnd)
assert.equal(withoutBoundary.periodStartMs, previousRestEnd)
assert.equal(withoutBoundary.drivenMs, 2 * HOUR + 30 * MINUTE + 40 * MINUTE)
assert.equal(
  (splitDaily.drivenMs ?? 0) + (2 * HOUR + 30 * MINUTE),
  drivingSum(split),
)
const splitBreak = drivingBreakDisplay(split, driveAfterEnd)
assert.deepEqual(drivingBreakDisplay(preserved, driveAfterEnd), splitBreak)
assert.equal(splitBreak.phase, 'driving')
if (splitBreak.phase === 'driving') assert.equal(splitBreak.remainingDrivingMs, 4 * HOUR + 30 * MINUTE - 40 * MINUTE)
const painted: DrivingBreakInterval[] = [
  ...split,
  { kind: 'rest', startMs: ferryRestEnd - DAILY_REST_MIN_11H_MS, endMs: ferryRestEnd },
]
assert.notDeepEqual(drivingBreakDisplay(painted, driveAfterEnd), splitBreak)
assert.deepEqual(
  slot1DddCalendarRemaining(preserved, driveAfterEnd),
  slot1DddCalendarRemaining(split, driveAfterEnd),
)

const twoOrigin = Date.UTC(2026, 0, 8, 8, 0, 0)
const twoA = twoOrigin + 4 * HOUR
const twoB = twoA + 30 * MINUTE
const twoC = twoB + 4 * HOUR
const twoD = twoC + 30 * MINUTE
const twoEnd = twoD + 3 * HOUR
const twoNow = twoEnd + 10 * MINUTE
const two: DrivingBreakInterval[] = [
  { kind: 'rest', startMs: twoOrigin, endMs: twoA },
  { kind: 'work', startMs: twoA, endMs: twoB },
  { kind: 'rest', startMs: twoB, endMs: twoC },
  { kind: 'work', startMs: twoC, endMs: twoD },
  { kind: 'rest', startMs: twoD, endMs: twoEnd },
  { kind: 'driving', startMs: twoEnd, endMs: twoNow },
]
const twoJoined = ferryDailyRestRemaining({
  imported: two,
  vehicle: [],
  cardConditions: [
    { kind: 'ferry', atUtc: twoOrigin },
    { kind: 'ferry_end', atUtc: twoEnd },
  ],
  nowMs: twoNow,
})
assert.equal(twoJoined.completed.length, 1)
assert.equal(twoJoined.completed[0]?.conditional, true)
assert.equal(twoJoined.completed[0]?.endMs, twoEnd)
const twoDaily = slot1DddDailyRemaining(two, twoNow, twoJoined.completed.map((item) => item.endMs))
assert.equal(twoDaily.drivenMs, 10 * MINUTE)
assert.equal(twoDaily.periodStartMs, twoEnd)
sameAxis(intervalsWithRecognizedFerryRest(two, twoJoined.completed), two)
const twoBreak = drivingBreakDisplay(two, twoNow)
assert.deepEqual(drivingBreakDisplay(intervalsWithRecognizedFerryRest(two, twoJoined.completed), twoNow), twoBreak)
if (twoBreak.phase === 'driving') assert.equal(twoBreak.remainingDrivingMs, 4 * HOUR + 20 * MINUTE)

const longWorkEnd = twoC + 31 * MINUTE
const longRestEnd = longWorkEnd + 2 * HOUR
const longNow = longRestEnd
const tooLong: DrivingBreakInterval[] = [
  { kind: 'rest', startMs: twoOrigin, endMs: twoA },
  { kind: 'work', startMs: twoA, endMs: twoB },
  { kind: 'rest', startMs: twoB, endMs: twoC },
  { kind: 'work', startMs: twoC, endMs: longWorkEnd },
  { kind: 'rest', startMs: longWorkEnd, endMs: longRestEnd },
]
const refused = ferryDailyRestRemaining({
  imported: tooLong,
  vehicle: [],
  cardConditions: [
    { kind: 'ferry', atUtc: twoOrigin },
    { kind: 'ferry_end', atUtc: longNow },
  ],
  nowMs: longNow,
})
assert.equal(refused.completed.length, 0)
assert.equal(refused.accumulatedMs, 2 * HOUR)
assert.equal(refused.remainingMs, 9 * HOUR)
assert.equal(refused.conditional, false)
assert.equal(slot1DddDailyRemaining(tooLong, longNow, refused.completed.map((item) => item.endMs)).remainingMs, null)

const thirdStart = Date.UTC(2026, 0, 8, 8, 0, 0)
const third: DrivingBreakInterval[] = []
let cursor = thirdStart
for (let index = 0; index < 4; index += 1) {
  const restEnd = cursor + 2 * HOUR
  third.push({ kind: 'rest', startMs: cursor, endMs: restEnd })
  cursor = restEnd
  if (index < 3) {
    third.push({ kind: 'work', startMs: cursor, endMs: cursor + 10 * MINUTE })
    cursor += 10 * MINUTE
  }
}
const three = ferryDailyRestRemaining({
  imported: third,
  vehicle: [],
  cardConditions: [
    { kind: 'ferry', atUtc: thirdStart },
    { kind: 'ferry_end', atUtc: cursor },
  ],
  nowMs: cursor,
})
assert.equal(three.completed.length, 0)
assert.equal(three.accumulatedMs, 2 * HOUR)
assert.equal(three.remainingMs, 9 * HOUR)
assert.equal(three.conditional, false)
assert.equal(slot1DddDailyRemaining(third, cursor).remainingMs, null)

const continuedStart = now - 4 * HOUR
const continuedFerryEnd = continuedStart + HOUR
const continued: DrivingBreakInterval[] = [
  { kind: 'rest', startMs: continuedStart, endMs: now },
]
const stillResting = ferryDailyRestRemaining({
  imported: [],
  vehicle: continued,
  vehicleEvents: [
    { minuteStartUtc: continuedStart, type: 'activation' },
    { minuteStartUtc: continuedFerryEnd, type: 'deactivation' },
  ],
  nowMs: now,
})
assert.equal(stillResting.accumulatedMs, 4 * HOUR)
assert.equal(stillResting.remainingMs, 7 * HOUR)
assert.equal(stillResting.completed.length, 0)
const continuedFullEnd = continuedStart + 11 * HOUR
const continuedDriveEnd = continuedFullEnd + 20 * MINUTE
const continuedDone: DrivingBreakInterval[] = [
  { kind: 'rest', startMs: continuedStart, endMs: continuedFullEnd },
  { kind: 'driving', startMs: continuedFullEnd, endMs: continuedDriveEnd },
]
const continuedClosed = ferryDailyRestRemaining({
  imported: [],
  vehicle: continuedDone,
  vehicleEvents: [
    { minuteStartUtc: continuedStart, type: 'activation' },
    { minuteStartUtc: continuedFerryEnd, type: 'deactivation' },
  ],
  nowMs: continuedDriveEnd,
})
assert.equal(continuedClosed.completed.length, 1)
assert.equal(continuedClosed.completed[0]?.endMs, continuedFullEnd)
const continuedDaily = slot1DddDailyRemaining(
  continuedDone,
  continuedDriveEnd,
  continuedClosed.completed.map((item) => item.endMs),
)
assert.equal(continuedDaily.drivenMs, 20 * MINUTE)
assert.equal(continuedDaily.remainingMs, DAILY_DRIVING_LIMIT_MS - 20 * MINUTE)
const continuedBreak = drivingBreakDisplay(continuedDone, continuedDriveEnd)
assert.equal(continuedBreak.phase, 'driving')
if (continuedBreak.phase === 'driving') assert.equal(continuedBreak.remainingDrivingMs, 4 * HOUR + 10 * MINUTE)

const gapStart = now - 2 * HOUR
const gapEnd = now - HOUR
const gapped: DrivingBreakInterval[] = [
  { kind: 'rest', startMs: gapStart - 2 * HOUR, endMs: gapStart },
  { kind: 'rest', startMs: gapEnd, endMs: now },
]
const ambiguous = ferryDailyRestRemaining({
  imported: gapped,
  vehicle: [],
  cardConditions: [{ kind: 'ferry', atUtc: gapStart - 2 * HOUR }],
  nowMs: now,
})
assert.equal(ambiguous.remainingMs, null)
assert.equal(ambiguous.completed.length, 0)
assert.equal(slot1DddDailyRemaining(gapped, now).remainingMs, null)

const symbolOnly = ferryDailyRestRemaining({
  imported: [],
  vehicle: [],
  cardConditions: [{ kind: 'ferry', atUtc: now - HOUR }],
  vehicleEvents: [{ minuteStartUtc: now - HOUR, type: 'activation' }],
  nowMs: now,
})
assert.equal(symbolOnly.remainingMs, null)
assert.equal(symbolOnly.completed.length, 0)

const reset = ferryDailyRestRemaining({
  imported: [],
  vehicle: [],
  vehicleEvents: [],
  nowMs: now,
})
assert.equal(reset.remainingMs, null)
assert.equal(reset.completed.length, 0)
assert.equal(slot1DddDailyRemaining([], now, reset.completed.map((item) => item.endMs)).remainingMs, null)
assert.equal(intervalsWithRecognizedFerryRest([], reset.completed).length, 0)

console.log('ferry vdo counter ok')
