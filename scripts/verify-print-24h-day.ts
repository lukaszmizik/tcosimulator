/**
 * 16. 11. 2026 UTC: ruční odpočinek od předchozího dne, práce s razítkem země uprostřed,
 * pohotovost, odpočinek do změny následujícího dne.
 */
import assert from 'node:assert/strict'
import type { ManualEntrySegment } from '../src/TachoTypes.ts'
import { buildDriverCardPrintRows } from '../src/print/driverCardPrintRows.ts'
import { extractDddPrintFields } from '../src/loadDddCard.ts'
import { applyPrintWizardKey, resolvePrintMenuAction } from '../src/print/printWizardHandling.ts'
import {
  driver1PrintCardActivities,
  prepareDriver1Print24hUtc,
  type Driver1PrintCardActivity,
} from '../src/print/prepareDriver1Print24h.ts'

const MINUTE = 60 * 1000

function at(year: number, month: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month - 1, day, hour, minute)
}

function seg(
  activityId: ManualEntrySegment['activityId'],
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  countryCode?: string,
): ManualEntrySegment {
  return { activityId, year, month, day, hour, minute, countryCode, isManualEntry: true }
}

function hhmm(ms: number): string {
  const totalMin = Math.floor(ms / MINUTE)
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
}

function clock(ms: number, dayEndMs: number): string {
  if (ms === dayEndMs) return '24:00'
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function main(): void {
  const dayUtc = at(2026, 11, 16, 0, 0)
  const buffer: ManualEntrySegment[] = [
    seg('REST', 2026, 11, 15, 22, 0),
    seg('WORK', 2026, 11, 16, 1, 30),
    seg('START_COUNTRY', 2026, 11, 16, 2, 15, 'CZ'),
    seg('AVAILABILITY', 2026, 11, 16, 3, 0),
    seg('REST', 2026, 11, 16, 4, 0),
    seg('WORK', 2026, 11, 17, 2, 0),
  ]

  const day = prepareDriver1Print24hUtc(dayUtc, buffer)
  const lines = day.activities.map((item) => `${clock(item.startMs, day.dayEndMs)}–${clock(item.endMs, day.dayEndMs)} ${item.activityId}`)
  const sums = `řízení ${hhmm(day.sums.drivingMs)}, práce ${hhmm(day.sums.workMs)}, pohotovost ${hhmm(day.sums.availabilityMs)}, odpočinek ${hhmm(day.sums.restMs)}`
  console.log(['16.11.2026 UTC', ...lines, `součty: ${sums}`].join('\n'))

  assert.deepEqual(lines, [
    '00:00–01:30 REST',
    '01:30–03:00 WORK',
    '03:00–04:00 AVAILABILITY',
    '04:00–24:00 REST',
  ])
  assert.equal(day.sums.drivingMs, 0)
  assert.equal(day.sums.workMs, 90 * MINUTE)
  assert.equal(day.sums.availabilityMs, 60 * MINUTE)
  assert.equal(day.sums.restMs, (21 * 60 + 30) * MINUTE)

  const openEnded = prepareDriver1Print24hUtc(dayUtc, [
    seg('REST', 2026, 11, 16, 4, 0),
    seg('END_COUNTRY', 2026, 11, 16, 6, 0, 'CZ'),
  ])
  assert.equal(openEnded.activities.length, 0)
  assert.equal(openEnded.sums.restMs, 0)

  const onlyWork = prepareDriver1Print24hUtc(dayUtc, [
    seg('WORK', 2026, 11, 16, 1, 30),
    seg('AVAILABILITY', 2026, 11, 16, 3, 0),
  ])
  assert.equal(onlyWork.sums.workMs, 90 * MINUTE)
  assert.equal(onlyWork.sums.restMs, 0)
  assert.equal(onlyWork.sums.drivingMs, 0)

  const slot1Driving: Driver1PrintCardActivity[] = [{
    kind: 'driving',
    startUtc: at(2026, 11, 15, 23, 30),
    endUtc: at(2026, 11, 16, 1, 0),
  }]
  const slot2Work: Driver1PrintCardActivity[] = [{
    kind: 'work',
    startUtc: at(2026, 11, 16, 0, 0),
    endUtc: at(2026, 11, 16, 3, 0),
  }]
  const manualWork: ManualEntrySegment[] = [
    seg('WORK', 2026, 11, 16, 0, 30),
    seg('REST', 2026, 11, 16, 2, 0),
  ]
  const fromSlot1 = driver1PrintCardActivities(slot1Driving)
  assert.deepEqual(fromSlot1, slot1Driving)
  assert.notDeepEqual(driver1PrintCardActivities(slot2Work), fromSlot1)

  const mixed = prepareDriver1Print24hUtc(dayUtc, manualWork, fromSlot1)
  const mixedLines = mixed.activities.map((item) => {
    const origin = item.isManualEntry ? ' ruční' : ''
    return `${clock(item.startMs, mixed.dayEndMs)}–${clock(item.endMs, mixed.dayEndMs)} ${item.activityId}${origin}`
  })
  console.log(['16.11.2026 UTC DDD + ruční', ...mixedLines, `součty: řízení ${hhmm(mixed.sums.drivingMs)}, práce ${hhmm(mixed.sums.workMs)}`].join('\n'))
  assert.deepEqual(mixedLines, [
    '00:00–01:00 DRIVING',
    '01:00–02:00 WORK ruční',
  ])
  assert.equal(mixed.sums.drivingMs, 60 * MINUTE)
  assert.equal(mixed.sums.workMs, 60 * MINUTE)
  assert.equal(mixed.sums.availabilityMs, 0)
  assert.equal(mixed.sums.restMs, 0)
  assert.equal(mixed.activities[1]?.isManualEntry, true)

  const unknownDay = prepareDriver1Print24hUtc(dayUtc, [
    seg('REST', 2026, 11, 16, 2, 0),
    seg('WORK', 2026, 11, 16, 4, 0),
  ], [{
    kind: 'unknown',
    startUtc: at(2026, 11, 16, 2, 0),
    endUtc: at(2026, 11, 16, 3, 0),
  }])
  assert.deepEqual(
    unknownDay.activities.map((item) => `${clock(item.startMs, unknownDay.dayEndMs)} ${item.activityId}`),
    ['02:00 UNKNOWN', '03:00 REST'],
  )
  assert.equal(unknownDay.sums.restMs, 60 * MINUTE)

  const slot2Day = prepareDriver1Print24hUtc(dayUtc, manualWork, driver1PrintCardActivities(slot2Work))
  assert.equal(slot2Day.activities.some((item) => item.activityId === 'DRIVING'), false)
  assert.equal(slot2Day.sums.workMs, 3 * 60 * MINUTE)

  const dates = resolvePrintMenuAction({
    action: 'PRINT_24H_D1',
    line2: '24h karta 1',
    requiresDate: true,
    requiresUtcConfirm: true,
    secondHistory: [],
    simulatedUtcTime: at(2026, 11, 20, 8, 0),
    currentMenuPath: ['print'],
    cardActivities: [
      ...slot1Driving,
      { startUtc: at(2026, 11, 12, 1, 0), endUtc: at(2026, 11, 12, 2, 0), isManualEntry: true },
    ],
  })
  assert.equal(dates?.type, 'dateWizard')
  if (dates?.type === 'dateWizard') {
    assert.deepEqual(dates.state.availableDatesUtc, [at(2026, 11, 16, 0, 0), at(2026, 11, 15, 0, 0)])
  }

  const withHistory = resolvePrintMenuAction({
    action: 'PRINT_24H_D1',
    line2: '24h karta 1',
    requiresDate: true,
    requiresUtcConfirm: true,
    secondHistory: [{ timestampUtc: at(2026, 11, 10, 12, 0) }],
    simulatedUtcTime: at(2026, 11, 20, 8, 0),
    currentMenuPath: ['print'],
    cardActivities: slot1Driving,
  })
  if (withHistory?.type === 'dateWizard') {
    assert.deepEqual(withHistory.state.availableDatesUtc, [
      at(2026, 11, 16, 0, 0),
      at(2026, 11, 15, 0, 0),
      at(2026, 11, 10, 0, 0),
    ])
  }

  const vehicleDates = resolvePrintMenuAction({
    action: 'PRINT_24H_V',
    line2: '24h vozidlo',
    requiresDate: true,
    requiresUtcConfirm: true,
    secondHistory: [],
    simulatedUtcTime: at(2026, 11, 20, 8, 0),
    currentMenuPath: ['print'],
    cardActivities: slot1Driving,
  })
  if (vehicleDates?.type === 'dateWizard') {
    assert.deepEqual(vehicleDates.state.availableDatesUtc, [at(2026, 11, 20, 0, 0)])
  }

  const cardFields = extractDddPrintFields({
    driver_card_application_identification_v2: { length_of_following_data: 10 },
    card_driver_activity_2: { decoded_activity_daily_records: [{
      activity_record_date: '2026-11-16T00:00:00Z', activity_daily_presence_counter: 317, activity_day_distance: 41,
    }] },
  })
  assert.equal(cardFields.generation, 'GEN2 v2')
  assert.deepEqual(cardFields.printDays?.['2026-11-16'], { presence: 317, distance: 41 })
  const rows = buildDriverCardPrintRows({
    selectedDayUtc: dayUtc,
    printedAtUtc: dayUtc + 26 * 60 * MINUTE,
    localOffsetMs: 60 * MINUTE,
    isUtc: false,
    profile: {
      companyName: 'Přeprava Říha', companyAddress: '', companyId: '',
      vin: 'WBADT43452G123456', registration: '1TL0280', registrationNation: 'CZ', load: 'passengers',
    },
    card: null, secondCard: null, manual: [], simulated: [], vehicleEvents: [],
    imported: {
      ...cardFields,
      cardNumber: '1111111111111111', firstName: 'Jiří', surname: 'Říha', lastWithdrawalUtc: null,
      locations: [],
      activities: [
        { kind: 'driving', slot: 1, startUtc: dayUtc + 60 * MINUTE, endUtc: dayUtc + 90 * MINUTE, registration: 'FIRST' },
        { kind: 'rest', slot: 2, isCrew: true, startUtc: dayUtc + 120 * MINUTE, endUtc: dayUtc + 140 * MINUTE, registration: 'SECOND' },
      ],
      vehicleUses: [
        { fromUtc: dayUtc + 60 * MINUTE, toUtc: dayUtc + 90 * MINUTE, registration: 'FIRST', odometerBeginKm: 10123, odometerEndKm: 10164, kilometers: 41 },
        { fromUtc: dayUtc + 120 * MINUTE, toUtc: dayUtc + 140 * MINUTE, registration: 'SECOND', kilometers: 0 },
      ],
    },
  })
  assert.ok(rows.every((row) => row.length <= 24))
  const textRows = rows.map((row) => row.filter((cell) => typeof cell === 'string').join(''))
  assert.ok(textRows.includes('!!! No legal printout!!!'))
  assert.ok(textRows.some((row) => row.includes('16.11.2026 01:00')))
  assert.ok(textRows.some((row) => row.includes('17.11.2026 01:00')))
  assert.ok(textRows.some((row) => row.includes('16.11.2026 317')))
  assert.ok(textRows.some((row) => row.includes('10 164 km')))
  assert.ok(textRows.some((row) => row.includes('00h30 41 km')))
  assert.ok(textRows.some((row) => row.includes('FIRST')))
  assert.ok(textRows.some((row) => row.includes('SECOND')))
  assert.ok(textRows.includes('Přeprava Říha'))
  for (const slot of [1, 2] as const) {
    const wizard = resolvePrintMenuAction({
      action: `PRINT_24H_D${slot}`, requiresDate: true, requiresUtcConfirm: true, line2: '',
      secondHistory: [], simulatedUtcTime: dayUtc, currentMenuPath: [],
    })
    if (wizard?.type !== 'dateWizard') assert.fail('Průvodce výtiskem se neotevřel')
    let confirmed: [number, boolean, number] | undefined
    applyPrintWizardKey({ ...wizard.state, step: 'utc', utcYes: false }, 'ok', {
      setCurrentMenuPath: () => {},
      openPrintVDiagram: () => {},
      openPrintVehicle24h: () => {},
      openPrintDriverCard: (...args) => { confirmed = args },
    })
    assert.deepEqual(confirmed, [dayUtc, false, slot])
  }
  console.log('Termopáska karty: formát, DDD, historie vozidel a oba průvodce UTC/LOC v pořádku.')

}
