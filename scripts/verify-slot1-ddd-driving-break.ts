import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSlot1DddDrivingBreak, buildSlot1DddDrivingBreakIntervals } from '../src/slot1DddDrivingBreak.ts'
import type { DddCardRecord } from '../src/dddCardSession.ts'
import type { ActivityHistoryEntry, ActivityKind, ManualEntrySegment, SecondActivitySnapshot } from '../src/TachoTypes.ts'
import type { DddParsedActivity } from '../src/types/tachoViewerDddMapper.ts'

const MINUTE = 60_000
const DRIVING_LIMIT = (4 * 60 + 30) * MINUTE

function at(minutes: number): number {
  return minutes * MINUTE
}

function card(cardNumber: string, activities: DddParsedActivity[], extra?: {
  workingActivities?: ActivityHistoryEntry[]
  workingManual?: ManualEntrySegment[]
}): DddCardRecord {
  return {
    cardNumber,
    firstName: 'Test',
    surname: 'Ridic',
    original: {
      cardNumber,
      firstName: 'Test',
      surname: 'Ridic',
      lastWithdrawalUtc: null,
      activities,
      locations: [],
    },
    originalPreview: {
      firstName: 'Test',
      surname: 'Ridic',
      days: [],
      countryMarkers: [],
      firstDriving: null,
      countrySample: null,
      focusMs: null,
    },
    workingActivities: extra?.workingActivities ?? [],
    workingManual: extra?.workingManual ?? [],
    vehicleLastUseUtc: null,
    vehicleLastUseSource: null,
    workingLastWithdrawalUtc: null,
  }
}

function activity(startMin: number, endMin: number, kind: DddParsedActivity['kind'], slot?: 1 | 2): DddParsedActivity {
  return { kind, startUtc: at(startMin), endUtc: at(endMin), slot }
}

function minute(startMin: number, kind: ActivityKind): ActivityHistoryEntry {
  return { minuteStartUtc: at(startMin), driver1: kind, driver2: 'none' }
}

function minutes(startMin: number, count: number, kind: ActivityKind): ActivityHistoryEntry[] {
  return Array.from({ length: count }, (_, index) => minute(startMin + index, kind))
}

function manual(ms: number, activityId: ManualEntrySegment['activityId']): ManualEntrySegment {
  const date = new Date(ms)
  return {
    activityId,
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    isManualEntry: true,
  }
}

function samples(startMs: number, count: number, kind: ActivityKind): SecondActivitySnapshot[] {
  return Array.from({ length: count }, (_, index) => ({
    timestampUtc: startMs + (index + 1) * 1000,
    driver1: kind,
    driver2: 'none',
    speed: kind === 'driving' ? 80 : 0,
  }))
}

test('2:30 řízení v originálu, i ve slotu 2, nechá zbývat 2:00', () => {
  const holder = card('A', [activity(0, 150, 'driving', 2)])
  const originalActivity = holder.original.activities[0]
  const display = buildSlot1DddDrivingBreak({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(150),
  })
  assert.equal(holder.original.activities[0], originalActivity)
  assert.equal(display?.phase, 'driving')
  if (display?.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, at(120))
  assert.equal(display.requiredBreakMs, at(45))
})

test('navazující ruční odpočinek 0:15 blok neresetuje', () => {
  const holder = card('A', [activity(0, 150, 'driving', 2)], {
    workingManual: [manual(at(150), 'REST'), manual(at(165), 'REST')],
  })
  const display = buildSlot1DddDrivingBreak({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(165),
  })
  assert.equal(display?.phase, 'break')
  if (display?.phase !== 'break') return
  assert.equal(display.drivingIfStartNowMs, at(120))
  assert.notEqual(display.drivingIfStartNowMs, DRIVING_LIMIT)
})

test('další pracovní řízení 2:00 nechá 0:00 a druhou část 0:30', () => {
  const holder = card('A', [activity(0, 150, 'driving')], {
    workingManual: [manual(at(150), 'REST'), manual(at(165), 'REST')],
    workingActivities: minutes(165, 120, 'driving'),
  })
  const display = buildSlot1DddDrivingBreak({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(285),
  })
  assert.equal(display?.phase, 'driving')
  if (display?.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, 0)
  assert.equal(display.requiredBreakMs, at(30))
})

test('po 10 minutách druhé části je 0:00, 0:20 a 4:30', () => {
  const holder = card('A', [activity(0, 150, 'driving')], {
    workingManual: [manual(at(150), 'REST'), manual(at(165), 'REST')],
    workingActivities: [...minutes(165, 120, 'driving'), ...minutes(285, 10, 'rest')],
  })
  const display = buildSlot1DddDrivingBreak({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(295),
  })
  assert.deepEqual(display, {
    phase: 'break',
    drivingIfStartNowMs: 0,
    remainingBreakMs: at(20),
    drivingAfterBreakMs: DRIVING_LIMIT,
  })
})

test('dokončená druhá část zpřístupní 4:30', () => {
  const holder = card('A', [activity(0, 150, 'driving')], {
    workingManual: [manual(at(150), 'REST'), manual(at(165), 'REST')],
    workingActivities: [...minutes(165, 120, 'driving'), ...minutes(285, 30, 'rest')],
  })
  const display = buildSlot1DddDrivingBreak({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(315),
  })
  assert.equal(display?.phase, 'driving')
  if (display?.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, DRIVING_LIMIT)
  assert.equal(display.requiredBreakMs, at(45))
})

test('data druhé karty výsledek držitele nemění', () => {
  const holder = card('A', [activity(0, 150, 'driving', 1)])
  const other = card('B', [activity(0, 600, 'driving', 1)], {
    workingActivities: minutes(0, 600, 'driving'),
  })
  const display = buildSlot1DddDrivingBreak({
    cards: { A: holder, B: other },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(150),
  })
  assert.equal(display?.phase, 'driving')
  if (display?.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, at(120))
})

test('uzavření otevřené minuty nepřičte její sekundy podruhé', () => {
  const openMinute = at(149)
  const before = buildSlot1DddDrivingBreak({
    cards: {
      A: card('A', [], { workingActivities: minutes(0, 149, 'driving') }),
    },
    cardNumber: 'A',
    secondSamples: samples(openMinute, 59, 'driving'),
    nowMs: openMinute + 59_000,
  })
  const closedCard = card('A', [], { workingActivities: minutes(0, 150, 'driving') })
  const after = buildSlot1DddDrivingBreak({
    cards: { A: closedCard },
    cardNumber: 'A',
    secondSamples: samples(openMinute, 59, 'driving'),
    nowMs: openMinute + MINUTE + 1,
  })
  const overlapped = buildSlot1DddDrivingBreak({
    cards: { A: card('A', [], { workingActivities: minutes(0, 150, 'driving') }) },
    cardNumber: 'A',
    secondSamples: samples(openMinute, 59, 'driving'),
    nowMs: openMinute + 59_000,
  })
  assert.equal(before?.phase, 'driving')
  assert.equal(after?.phase, 'driving')
  assert.equal(overlapped?.phase, 'driving')
  if (before?.phase !== 'driving' || after?.phase !== 'driving' || overlapped?.phase !== 'driving') return
  assert.equal(before.remainingDrivingMs, at(120) + 1000)
  assert.equal(after.remainingDrivingMs, at(120))
  assert.equal(overlapped.remainingDrivingMs, at(120) + 1000)
})

test('unknown ani mezera se nestanou odpočinkem a ruční úsek bez konce se nedomýšlí', () => {
  const holder = card('A', [
    activity(0, 150, 'driving'),
    activity(150, 195, 'unknown'),
  ], {
    workingManual: [manual(at(195), 'REST')],
  })
  const built = buildSlot1DddDrivingBreakIntervals({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(195),
  })
  const display = buildSlot1DddDrivingBreak({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(195),
  })
  assert.deepEqual(built.intervals.map((interval) => interval.kind), ['driving'])
  assert.deepEqual(built.unboundedManualStartMs, [at(195)])
  assert.equal(display?.phase, 'driving')
  if (display?.phase !== 'driving') return
  assert.equal(display.remainingDrivingMs, at(120))
})

test('překryv pracovních minut originál nepřepíše', () => {
  const holder = card('A', [activity(0, 150, 'driving')], {
    workingActivities: minutes(140, 20, 'rest'),
  })
  const built = buildSlot1DddDrivingBreakIntervals({
    cards: { A: holder },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: at(160),
  })
  assert.equal(built.intervals[0]?.kind, 'driving')
  assert.equal(built.intervals[0]?.startMs, 0)
  assert.equal(built.intervals[0]?.endMs, at(150))
  assert.equal(built.intervals.some((interval) => interval.kind === 'rest' && interval.startMs < at(150)), false)
  assert.equal(built.intervals.filter((interval) => interval.kind === 'rest').at(-1)?.endMs, at(160))
  assert.equal(holder.original.activities[0]?.endUtc, at(150))
})
