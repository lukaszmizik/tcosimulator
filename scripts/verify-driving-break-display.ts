import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drivingBreakDisplay, type DrivingBreakInterval } from '../src/drivingBreakDisplay.ts'
import { buildSlot1DrivingBreakIntervals, buildSlot1VirtualCardDrivingBreak, capSlot1DrivingBreak } from '../src/slot1DrivingBreak.ts'
import type { ActivityHistoryEntry, ActivityKind, SecondActivitySnapshot } from '../src/TachoTypes.ts'

const MINUTE = 60 * 1000
const DRIVING_LIMIT = (4 * 60 + 30) * MINUTE

function at(minutes: number): number {
  return minutes * MINUTE
}

function availableNow(nowMs: number, intervals: DrivingBreakInterval[]): number {
  const display = drivingBreakDisplay(intervals, nowMs)
  return display.phase === 'driving' ? display.remainingDrivingMs : display.drivingIfStartNowMs
}

test('po 2:30 řízení zbývají 2:00 a celá přestávka je 0:45', () => {
  const intervals: DrivingBreakInterval[] = [{ kind: 'driving', startMs: 0, endMs: at(150) }]
  const display = drivingBreakDisplay(intervals, at(150))
  assert.equal(display.phase, 'driving')
  if (display.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, at(120))
  assert.equal(display.requiredBreakMs, at(45))
})

test('první část přestávky 0:15 nemění zbytek řízení 2:00', () => {
  const intervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: 0, endMs: at(150) },
    { kind: 'rest', startMs: at(150), endMs: at(165) },
  ]
  assert.equal(availableNow(at(165), intervals), at(120))
  assert.notEqual(availableNow(at(165), intervals), DRIVING_LIMIT)
})

test('po dalších 2:00 řízení zbývá 0:00 a je potřeba druhá část 0:30', () => {
  const intervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: 0, endMs: at(150) },
    { kind: 'rest', startMs: at(150), endMs: at(165) },
    { kind: 'driving', startMs: at(165), endMs: at(285) },
  ]
  const display = drivingBreakDisplay(intervals, at(285))
  assert.equal(display.phase, 'driving')
  if (display.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, 0)
  assert.equal(display.requiredBreakMs, at(30))
})

test('po 10 minutách druhé části je 0:00 teď, 0:20 do konce a pak 4:30', () => {
  const intervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: 0, endMs: at(150) },
    { kind: 'rest', startMs: at(150), endMs: at(165) },
    { kind: 'driving', startMs: at(165), endMs: at(285) },
    { kind: 'rest', startMs: at(285), endMs: at(295) },
  ]
  const display = drivingBreakDisplay(intervals, at(295))
  assert.deepEqual(display, {
    phase: 'break',
    drivingIfStartNowMs: 0,
    remainingBreakMs: at(20),
    drivingAfterBreakMs: DRIVING_LIMIT,
  })
})

test('dokončená druhá část zpřístupní 4:30, i když řidič ještě stojí', () => {
  const intervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: 0, endMs: at(150) },
    { kind: 'rest', startMs: at(150), endMs: at(165) },
    { kind: 'driving', startMs: at(165), endMs: at(285) },
    { kind: 'rest', startMs: at(285), endMs: at(315) },
  ]
  const display = drivingBreakDisplay(intervals, at(315))
  assert.equal(display.phase, 'driving')
  if (display.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, DRIVING_LIMIT)
  assert.equal(display.requiredBreakMs, at(45))
})

test('44 minut souvislé přestávky blok ještě neresetuje', () => {
  const intervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: 0, endMs: at(150) },
    { kind: 'rest', startMs: at(150), endMs: at(194) },
  ]
  const display = drivingBreakDisplay(intervals, at(194))
  assert.equal(display.phase, 'break')
  if (display.phase !== 'break') return
  assert.equal(display.drivingIfStartNowMs, at(120))
  assert.equal(display.remainingBreakMs, at(1))
  assert.notEqual(display.drivingIfStartNowMs, DRIVING_LIMIT)
})

test('45 minut resetuje blok i při rozdělení do sousedních intervalů odpočinku', () => {
  const intervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: 0, endMs: at(150) },
    { kind: 'rest', startMs: at(150), endMs: at(170) },
    { kind: 'rest', startMs: at(170), endMs: at(195) },
  ]
  const display = drivingBreakDisplay(intervals, at(195))
  assert.equal(display.phase, 'driving')
  if (display.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, DRIVING_LIMIT)
  assert.equal(display.requiredBreakMs, at(45))
})

function minuteEntry(minute: number, kind: ActivityKind): ActivityHistoryEntry {
  return { minuteStartUtc: minute * MINUTE, driver1: kind, driver2: 'none' }
}

function closedMinutes(startMinute: number, count: number, kind: ActivityKind): ActivityHistoryEntry[] {
  return Array.from({ length: count }, (_, index) => minuteEntry(startMinute + index, kind))
}

function secondSamples(
  minute: number,
  segments: Array<{ seconds: number; kind: ActivityKind }>,
): SecondActivitySnapshot[] {
  const samples: SecondActivitySnapshot[] = []
  let second = 0
  for (const segment of segments) {
    for (let index = 0; index < segment.seconds; index += 1) {
      second += 1
      samples.push({
        timestampUtc: minute * MINUTE + second * 1000,
        driver1: segment.kind,
        driver2: 'none',
        speed: segment.kind === 'driving' ? 80 : 0,
      })
    }
  }
  return samples
}

test('před uzavřením 150. minuty řízení se počítají sekundy, po něm už jen minuta', () => {
  const beforeNow = 149 * MINUTE + 59 * 1000
  const before = buildSlot1VirtualCardDrivingBreak({
    cardHistory: closedMinutes(0, 149, 'driving'),
    secondSamples: secondSamples(149, [{ seconds: 59, kind: 'driving' }]),
    nowMs: beforeNow,
  })
  assert.equal(before.phase, 'driving')
  if (before.phase !== 'driving') return
  assert.equal(before.remainingDrivingMs, DRIVING_LIMIT - (149 * MINUTE + 59 * 1000))
  assert.equal(before.requiredBreakMs, 45 * MINUTE)

  const after = buildSlot1VirtualCardDrivingBreak({
    cardHistory: [
      ...closedMinutes(0, 150, 'driving'),
      ...closedMinutes(0, 149, 'driving'),
    ],
    secondSamples: secondSamples(149, [{ seconds: 59, kind: 'driving' }]),
    nowMs: 150 * MINUTE,
  })
  assert.equal(after.phase, 'driving')
  if (after.phase !== 'driving') return
  assert.equal(after.remainingDrivingMs, 2 * 60 * MINUTE)
  assert.notEqual(after.remainingDrivingMs, before.remainingDrivingMs)
})

test('scénář 2:30, 0:15, 2:00 a 10 minut druhé části čte jen historii karty', () => {
  const driven = [
    ...closedMinutes(0, 150, 'driving'),
    ...closedMinutes(150, 15, 'rest'),
  ]
  const afterFirstPart = buildSlot1VirtualCardDrivingBreak({
    cardHistory: driven,
    secondSamples: secondSamples(0, [{ seconds: 59, kind: 'driving' }]),
    nowMs: 165 * MINUTE,
  })
  assert.equal(afterFirstPart.phase, 'break')
  if (afterFirstPart.phase !== 'break') return
  assert.equal(afterFirstPart.drivingIfStartNowMs, 2 * 60 * MINUTE)

  const afterSecondDrive = buildSlot1VirtualCardDrivingBreak({
    cardHistory: [...driven, ...closedMinutes(165, 120, 'driving')],
    secondSamples: [],
    nowMs: 285 * MINUTE,
  })
  assert.equal(afterSecondDrive.phase, 'driving')
  if (afterSecondDrive.phase !== 'driving') return
  assert.equal(afterSecondDrive.remainingDrivingMs, 0)
  assert.equal(afterSecondDrive.requiredBreakMs, 30 * MINUTE)

  const duringSecondPart = buildSlot1VirtualCardDrivingBreak({
    cardHistory: [
      ...driven,
      ...closedMinutes(165, 120, 'driving'),
      ...closedMinutes(285, 10, 'rest'),
    ],
    secondSamples: secondSamples(285, [{ seconds: 59, kind: 'rest' }]),
    nowMs: 295 * MINUTE,
  })
  assert.deepEqual(duringSecondPart, {
    phase: 'break',
    drivingIfStartNowMs: 0,
    remainingBreakMs: 20 * MINUTE,
    drivingAfterBreakMs: DRIVING_LIMIT,
  })
})

test('otevřená minuta zachová pořadí více změn a po uzavření je nahradí jeden záznam', () => {
  const open = buildSlot1DrivingBreakIntervals({
    cardHistory: [],
    secondSamples: secondSamples(0, [
      { seconds: 10, kind: 'driving' },
      { seconds: 10, kind: 'rest' },
      { seconds: 10, kind: 'driving' },
    ]),
    nowMs: 30 * 1000,
  })
  assert.deepEqual(open.map((interval) => interval.kind), ['driving', 'rest', 'driving'])

  const before = buildSlot1VirtualCardDrivingBreak({
    cardHistory: [],
    secondSamples: secondSamples(0, [
      { seconds: 20, kind: 'driving' },
      { seconds: 39, kind: 'rest' },
    ]),
    nowMs: 59 * 1000,
  })
  assert.equal(before.phase, 'break')
  if (before.phase !== 'break') return
  assert.equal(before.drivingIfStartNowMs, DRIVING_LIMIT - 20 * 1000)

  const after = buildSlot1VirtualCardDrivingBreak({
    cardHistory: [minuteEntry(0, 'rest')],
    secondSamples: secondSamples(0, [
      { seconds: 20, kind: 'driving' },
      { seconds: 39, kind: 'rest' },
    ]),
    nowMs: MINUTE + 1,
  })
  assert.equal(after.phase, 'driving')
  if (after.phase !== 'driving') return
  assert.equal(after.remainingDrivingMs, DRIVING_LIMIT)
})

test('denní nebo týdenní strop má přednost, když je nižší než zbytek bloku', () => {
  const capped = capSlot1DrivingBreak(
    { phase: 'driving', remainingDrivingMs: 2 * 60 * MINUTE, requiredBreakMs: 45 * MINUTE },
    { dailyRemainingMs: 30 * MINUTE, weeklyRemainingMs: 56 * 60 * MINUTE, fortnightRemainingMs: 90 * 60 * MINUTE },
  )
  assert.equal(capped.phase, 'driving')
  if (capped.phase !== 'driving') return
  assert.equal(capped.remainingDrivingMs, 30 * MINUTE)
  assert.equal(capped.requiredBreakMs, 45 * MINUTE)
})

test('vypnutí zapalování není vstup: odjeté minuty zůstávají v historii karty', () => {
  const display = buildSlot1VirtualCardDrivingBreak({
    cardHistory: closedMinutes(0, 10, 'driving'),
    secondSamples: [],
    nowMs: 10 * MINUTE,
  })
  assert.equal(display.phase, 'driving')
  if (display.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, DRIVING_LIMIT - 10 * MINUTE)
  assert.equal(display.requiredBreakMs, 45 * MINUTE)
})

test('mezera mezi odpočinky se do souvislé přestávky nepočítá', () => {
  const intervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: 0, endMs: at(150) },
    { kind: 'rest', startMs: at(150), endMs: at(170) },
    { kind: 'rest', startMs: at(171), endMs: at(196) },
  ]
  const display = drivingBreakDisplay(intervals, at(196))
  assert.equal(display.phase, 'break')
  if (display.phase !== 'break') return
  assert.equal(display.drivingIfStartNowMs, at(120))
  assert.notEqual(display.drivingIfStartNowMs, DRIVING_LIMIT)
})
