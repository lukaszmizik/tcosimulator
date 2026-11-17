import assert from 'node:assert/strict'
import {
  advanceConfirmedCapToMinute,
  floorToMinute,
  tachographSegmentToUtcForBuffer,
  tachographSegmentToUtcMs,
  utcMsToSegment,
  utcMsToTachographSegment,
} from '../src/CardLogic.ts'
import { clockParts } from '../vendor/cardviewer/src/lib/clock.ts'
import { buildSimulatorSlotGraph } from '../vendor/cardviewer/src/utils/simulatorSlotGraph.ts'
import { activitiesByDay } from '../vendor/cardviewer/src/workWeekTxtParser.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const SIM = Date.parse('2026-11-16T22:40:00.000Z')
const OFFSET = 2 * HOUR

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function fieldsOf(ms: number) {
  const segment = utcMsToSegment(ms)
  return { day: segment.day, month: segment.month, year: segment.year, hour: segment.hour, minute: segment.minute }
}

function graphBounds(manualEndUtc: number, drivingStartUtc: number) {
  const withdrawal = Date.parse('2026-11-16T20:00:00.000Z')
  const graph = buildSimulatorSlotGraph({
    currentSlot: 1,
    activities: [{ kind: 'driving', startUtc: drivingStartUtc, endUtc: drivingStartUtc + MINUTE, slot: 1 }],
    manualSegments: [
      { ...fieldsOf(withdrawal), activityId: 'REST', isManualEntry: true },
      { ...fieldsOf(manualEndUtc), activityId: 'REST', isManualEntry: true },
      { ...fieldsOf(manualEndUtc), activityId: 'START_COUNTRY', countryCode: 'CZ', isManualEntry: true },
    ],
    simulatedMinutes: [],
    locations: [],
  })
  const utcDays = graph.days
  const localDays = activitiesByDay(utcDays.flatMap((day) => day.activities), { useLocalTime: true })
  const flat = (days: typeof utcDays) => days.flatMap((day) => day.activities)
  const manualEnd = (activities: ReturnType<typeof flat>) => Math.max(
    ...activities.filter((activity) => activity.isManualEntry).map((activity) => activity.endMs),
  )
  const drivingStart = (activities: ReturnType<typeof flat>) => Math.min(
    ...activities.filter((activity) => !activity.isManualEntry && activity.type === 'řízení').map((activity) => activity.startMs),
  )
  const dayOf = (days: typeof localDays, ms: number) => days.find((day) => day.activities.some((activity) => activity.startMs === ms || activity.endMs === ms))?.dateUtc ?? null
  return {
    utcManualEnd: manualEnd(flat(utcDays)),
    utcDrivingStart: drivingStart(flat(utcDays)),
    localManualEnd: manualEnd(flat(localDays)),
    localDrivingStart: drivingStart(flat(localDays)),
    utcDrivingDay: dayOf(utcDays, drivingStartUtc),
    localDrivingDay: dayOf(localDays, drivingStartUtc),
    utcParts: clockParts(manualEndUtc, 'utc'),
    localParts: clockParts(manualEndUtc, 'local'),
    localDrivingParts: clockParts(drivingStartUtc, 'local'),
  }
}

export function main() {
  const editorCap = utcMsToTachographSegment(SIM, OFFSET)
  assert.deepEqual(
    { day: editorCap.day, month: editorCap.month, hour: editorCap.hour, minute: editorCap.minute },
    { day: 17, month: 11, hour: 0, minute: 40 },
  )
  const storedCap = tachographSegmentToUtcForBuffer({ ...editorCap, activityId: 'REST' }, OFFSET)
  assert.equal(iso(tachographSegmentToUtcMs(storedCap, 0)), '2026-11-16T22:40:00.000Z')
  assert.equal(tachographSegmentToUtcMs(editorCap, OFFSET), SIM)

  const withdrawal = Date.parse('2026-11-16T20:00:00.000Z')
  const editorStart = utcMsToTachographSegment(withdrawal, OFFSET)
  assert.equal(editorStart.hour, 22)
  assert.equal(editorStart.day, 16)
  const buffer = [
    tachographSegmentToUtcForBuffer({ ...editorStart, activityId: 'REST' }, OFFSET),
    storedCap,
    { ...utcMsToSegment(floorToMinute(SIM)), activityId: 'START_COUNTRY' as const, countryCode: 'CZ', isManualEntry: true as const },
  ]
  const sameMinute = advanceConfirmedCapToMinute(buffer, floorToMinute(SIM), SIM + 20_000)
  assert.equal(iso(tachographSegmentToUtcMs(sameMinute[1]!, 0)), '2026-11-16T22:40:00.000Z')

  const drivingMinute = floorToMinute(SIM)
  assert.equal(drivingMinute, tachographSegmentToUtcMs(storedCap, 0))

  const bounds = graphBounds(drivingMinute, drivingMinute)
  assert.equal(iso(bounds.utcManualEnd), '2026-11-16T22:40:00.000Z')
  assert.equal(iso(bounds.utcDrivingStart), '2026-11-16T22:40:00.000Z')
  assert.equal(bounds.utcManualEnd, bounds.localManualEnd)
  assert.equal(bounds.utcDrivingStart, bounds.localDrivingStart)
  assert.equal(bounds.utcManualEnd - bounds.utcDrivingStart, bounds.localManualEnd - bounds.localDrivingStart)
  assert.deepEqual(
    { hour: bounds.utcParts.hour, minute: bounds.utcParts.minute, day: bounds.utcParts.day },
    { hour: 22, minute: 40, day: 16 },
  )

  const zoneHours = -new Date(SIM).getTimezoneOffset() / 60
  if (zoneHours === 1) {
    assert.deepEqual(
      { hour: bounds.localParts.hour, minute: bounds.localParts.minute, day: bounds.localParts.day },
      { hour: 23, minute: 40, day: 16 },
    )
    assert.equal(bounds.localDrivingParts.day, 16)
  }
  if (zoneHours === 0) {
    assert.deepEqual(
      { hour: bounds.localParts.hour, minute: bounds.localParts.minute, day: bounds.localParts.day },
      { hour: 22, minute: 40, day: 16 },
    )
  }

  const zeroEditor = utcMsToTachographSegment(SIM, 0)
  assert.equal(zeroEditor.day, 16)
  assert.equal(zeroEditor.hour, 22)
  assert.equal(zeroEditor.minute, 40)
  const zeroStored = tachographSegmentToUtcForBuffer({ ...zeroEditor, activityId: 'WORK' }, 0)
  assert.equal(iso(tachographSegmentToUtcMs(zeroStored, 0)), '2026-11-16T22:40:00.000Z')

  const earlierEditor = { day: 17, month: 11, year: 2026, hour: 0, minute: 10 }
  const earlierStored = tachographSegmentToUtcForBuffer({ ...earlierEditor, activityId: 'WORK' }, OFFSET)
  assert.equal(iso(tachographSegmentToUtcMs(earlierStored, 0)), '2026-11-16T22:10:00.000Z')
  const moved = advanceConfirmedCapToMinute(
    [buffer[0]!, earlierStored, storedCap],
    floorToMinute(SIM),
    SIM + MINUTE,
  )
  assert.equal(iso(tachographSegmentToUtcMs(moved[1]!, 0)), '2026-11-16T22:10:00.000Z')
  assert.equal(iso(tachographSegmentToUtcMs(moved[2]!, 0)), '2026-11-16T22:41:00.000Z')

  const midnightEnd = Date.parse('2026-11-16T23:30:00.000Z')
  const midnight = graphBounds(midnightEnd, midnightEnd)
  assert.equal(midnight.utcManualEnd, midnight.localManualEnd)
  assert.equal(midnight.utcDrivingStart, midnight.localDrivingStart)
  assert.equal(midnight.localManualEnd - midnight.localDrivingStart, 0)
  if (zoneHours === 1) {
    assert.equal(midnight.localDrivingParts.day, 17)
    assert.equal(midnight.localDrivingParts.hour, 0)
    assert.equal(midnight.localDrivingParts.minute, 30)
    assert.equal(clockParts(midnightEnd, 'utc').day, 16)
    assert.equal(iso(midnight.utcDrivingDay!), '2026-11-16T00:00:00.000Z')
    assert.equal(iso(midnight.localDrivingDay!), '2026-11-16T23:00:00.000Z')
  }

  console.log(JSON.stringify({
    zoneHours,
    editor: { day: editorCap.day, month: editorCap.month, hour: editorCap.hour, minute: editorCap.minute },
    storedUtc: iso(tachographSegmentToUtcMs(storedCap, 0)),
    drivingUtc: iso(drivingMinute),
    localGraph: bounds.localParts,
    utcGraph: bounds.utcParts,
    earlierUtc: iso(tachographSegmentToUtcMs(earlierStored, 0)),
    midnightLocal: midnight.localDrivingParts,
    gapMs: bounds.localManualEnd - bounds.localDrivingStart,
  }, null, 2))
}
