/**
 * Blok [3]/[3a] denní sestavy vozidla. Data jsou syntetická.
 */
import assert from 'node:assert/strict'
import { NO_CARD, type ActivityHistoryEntry, type ActivityKind } from '../src/TachoTypes.ts'
import {
  applyForwardDistance,
  applySecondDistances,
  noteBackwardJump,
  noteLiveDistance,
  openSyntheticDay,
  resetDayOdometers,
  sumDayIncrements,
} from '../src/dayOdometer.ts'
import type { PrintRow } from '../src/print/driverCardPrintRows.ts'
import {
  buildVehicleDayPrintRows,
  vehiclePrintHolder,
  type VehicleDayHolder,
  type VehicleDayPrintData,
} from '../src/print/vehicleDayPrintRows.ts'
import { buildSimulated4h10m } from '../src/simulate4h10m.ts'

const DAY = Date.UTC(2026, 0, 15)
const PRINTED = DAY + 10 * 60 * 60 * 1000

function line(row: PrintRow): string {
  return row.map((cell) => typeof cell === 'number' ? `(${cell})` : cell).join('')
}

function holder(partial: VehicleDayHolder): VehicleDayHolder {
  return partial
}

function rows(partial: Partial<VehicleDayPrintData> & { insertedHolders: readonly VehicleDayHolder[] }): PrintRow[] {
  return buildVehicleDayPrintRows({
    profile: {
      companyName: '', companyAddress: '', companyId: '',
      registration: 'SYNTH1', registrationNation: 'CZ', vin: 'VINSYNTHETIC00001', load: '',
    },
    localOffsetMs: 0,
    history: [],
    seconds: [],
    events: [],
    out: [],
    ferry: [],
    places: [],
    isCrew: false,
    dayOdometers: [],
    resolveCard: () => undefined,
    selectedDayUtc: DAY,
    printedAtUtc: PRINTED,
    isUtc: true,
    ...partial,
  })
}

function block9(printed: PrintRow[]): string[] {
  const text = printed.map(line)
  const start = text.findIndex((row) => row.includes('(17)') && row.startsWith('-'))
  const end = text.findIndex((row, index) => index > start && row.includes('(12)') && row.startsWith('-'))
  return text.slice(start, end)
}

function fillMinutes(
  start: number, end: number, driver1: ActivityKind, extra: Partial<ActivityHistoryEntry> = {},
): ActivityHistoryEntry[] {
  const entries: ActivityHistoryEntry[] = []
  for (let at = start; at < end; at += 60_000) {
    entries.push({
      minuteStartUtc: at, driver1, driver2: 'none',
      driver1CardId: NO_CARD, driver2CardId: NO_CARD, ...extra,
    })
  }
  return entries
}

function slotLines(printed: PrintRow[], slot: 1 | 2): string[] {
  const text = printed.map(line)
  const start = text.findIndex((row) => row.startsWith('-') && row.includes(slot === 1 ? '(12)' : '(13)'))
  const end = text.findIndex((row, index) => index > start && row.startsWith('-')
    && (slot === 1 ? row.includes('(13)') : row.includes('(40)')))
  return text.slice(start, end)
}

function summaryDurations(printed: PrintRow[]): string[] {
  const text = printed.map(line)
  const start = text.findIndex((row) => row.startsWith('-') && row.includes('(40)'))
  return text.slice(start).filter((row) => /^\([29871]\) /.test(row) || row.startsWith('(2)(2) '))
}

function identification(printed: PrintRow[]): string[] {
  const typeAt = printed.findIndex((row) => line(row).startsWith('24h') && row.includes(18))
  const vehicleAt = printed.findIndex((row, index) => index > typeAt && line(row).includes('VINSYNTHETIC00001'))
  assert.ok(typeAt >= 0 && vehicleAt > typeAt)
  return printed.slice(typeAt, vehicleAt + 1).map(line)
}

const virtual = holder({
  kind: 'driver', surname: 'Aktualni', firstName: 'Jan',
  issuingCountry: 'CZ', cardNumber: 'SYNTH0000000001', dateOfExpiry: '01.01.2031',
})
const ddd = holder({ ...virtual, surname: 'Novak', firstName: 'Petr', generation: 'GEN2 v2' })
const second = holder({
  kind: 'driver', surname: 'Druhy', firstName: 'Eva',
  issuingCountry: 'CZ', cardNumber: 'SYNTH0000000002', dateOfExpiry: '02.02.2032',
})

export function main(): void {
  assert.equal(vehiclePrintHolder('driver', { surname: 'Aktualni', generation: 'neznama' }).generation, undefined)
  assert.equal(vehiclePrintHolder('driver', { surname: 'Novak', generation: 'GEN2 v2' }).generation, 'GEN2 v2')

  const onlyVirtual = identification(rows({ insertedHolders: [virtual] }))
  assert.deepEqual(onlyVirtual, [
    '24h(24)(18)',
    '-----------(2)------------',
    '(2) Aktualni',
    '  Jan',
    '(14) CZ /SYNTH0000000001',
    '  01.01.2031',
    '-----------(24)------------',
    '(24) VINSYNTHETIC00001',
  ])
  assert.equal(onlyVirtual.some((row) => row.includes('GEN')), false)
  assert.equal(onlyVirtual.some((row) => row.includes('CZ00000000CTRL01')), false)

  const onlyDdd = identification(rows({ insertedHolders: [ddd] }))
  const validity = '  01.01.2031 - GEN2 v2'
  assert.equal(onlyDdd.includes(validity), true)
  assert.ok([...validity].length <= 24)
  assert.ok(onlyDdd.indexOf('(2) Novak') < onlyDdd.indexOf(validity))
  assert.ok(onlyDdd.indexOf(validity) < onlyDdd.indexOf('(24) VINSYNTHETIC00001'))
  assert.equal(onlyDdd.includes('  GEN2 v2'), false)

  const longDate = '01.01.2031-DODATEK'
  const wrapped = rows({ insertedHolders: [holder({ ...ddd, dateOfExpiry: longDate })] })
  assert.ok(wrapped.every((row) => row.length <= 24))
  const wrappedLines = identification(wrapped)
  assert.equal(wrappedLines.includes(`  ${longDate}`), true)
  assert.equal(wrappedLines.includes('  GEN2 v2'), true)
  assert.ok(wrappedLines.indexOf(`  ${longDate}`) < wrappedLines.indexOf('  GEN2 v2'))
  assert.ok(wrappedLines.indexOf('  GEN2 v2') < wrappedLines.indexOf('(24) VINSYNTHETIC00001'))
  assert.equal(wrappedLines.some((row) => row.includes(longDate) && row.includes('GEN2')), false)

  const ordered = identification(rows({ insertedHolders: [ddd, second] }))
  assert.ok(ordered.indexOf(validity) < ordered.indexOf('(2) Druhy'))
  assert.ok(ordered.indexOf('(2) Druhy') < ordered.indexOf('(24) VINSYNTHETIC00001'))

  const slot2 = identification(rows({ insertedHolders: [second] }))
  assert.equal(slot2.filter((row) => row.includes('(2)')).length, 2)
  assert.equal(slot2.some((row) => row.includes('(14)---') || row.includes('(14) ---')), false)
  assert.ok(slot2.indexOf('(2) Druhy') < slot2.indexOf('(24) VINSYNTHETIC00001'))

  const both = identification(rows({ insertedHolders: [virtual, second] }))
  assert.ok(both.indexOf('(2) Aktualni') < both.indexOf('(2) Druhy'))
  assert.ok(both.indexOf('(2) Druhy') < both.indexOf('(24) VINSYNTHETIC00001'))

  const empty = identification(rows({ insertedHolders: [] }))
  assert.deepEqual(empty, [
    '24h(24)(18)',
    '-----------(24)------------',
    '(24) VINSYNTHETIC00001',
  ])

  const previousMinute: ActivityHistoryEntry = {
    minuteStartUtc: DAY, driver1: 'rest', driver2: 'none', driver1CardId: 'previous',
  }
  const exchanged = rows({
    insertedHolders: [virtual],
    history: [previousMinute],
    resolveCard: (id) => id === 'previous'
      ? { surname: 'Predchozi', firstName: 'Stara', issuingCountry: 'CZ', cardNumber: 'OLD0000000000001' }
      : undefined,
  }).map(line)
  const header = exchanged.slice(0, exchanged.indexOf('(24) VINSYNTHETIC00001') + 1)
  assert.ok(header.some((row) => row.includes('Aktualni')))
  assert.equal(header.some((row) => row.includes('Predchozi')), false)
  assert.ok(exchanged.indexOf('(24) VINSYNTHETIC00001') < exchanged.findIndex((row) => row.includes('Predchozi')))

  const afterControl = Date.UTC(2026, 9, 16, 8, 0)
  const controlledRows = rows({
    insertedHolders: [],
    selectedDayUtc: afterControl,
    printedAtUtc: afterControl,
  })
  assert.ok(controlledRows.every((row) => row.length <= 24))
  const controlled = controlledRows.map(line)
  const calibration = controlled.findIndex((row) => row.includes('15.03.2024'))
  const controlCard = controlled.indexOf('(4)(14) CZ00000000CTRL01')
  const controlTime = controlled.indexOf('(4) 15.10.2026 10:30 (22)')
  const dayBlock = controlled.findIndex((row, index) => index > calibration && row.includes('(17)') && row.includes('-'))
  const dayRecord = controlled.findIndex((row, index) => index > dayBlock && row.includes('16.10.2026'))
  assert.ok(calibration < controlCard && controlCard < controlTime && controlTime < dayBlock && dayBlock < dayRecord)
  assert.ok(controlled.every((row) => row.length <= 24 || row.includes('(')))

  const local = rows({
    insertedHolders: [],
    selectedDayUtc: afterControl,
    printedAtUtc: afterControl,
    isUtc: false,
    localOffsetMs: 2 * 60 * 60 * 1000,
  }).map(line)
  assert.equal(local.includes('(4) 15.10.2026 12:30 (22)'), true)
  assert.equal(local.includes('(4) 15.10.2026 10:30 (22)'), false)

  const previousEvening = rows({
    insertedHolders: [],
    selectedDayUtc: afterControl,
    printedAtUtc: afterControl,
    isUtc: false,
    localOffsetMs: -12 * 60 * 60 * 1000,
  }).map(line)
  assert.equal(previousEvening.includes('(4) 14.10.2026 22:30 (22)'), true)

  const beforeControl = rows({
    insertedHolders: [],
    selectedDayUtc: Date.UTC(2026, 9, 15, 10, 29),
    printedAtUtc: Date.UTC(2026, 9, 15, 10, 29),
  }).map(line)
  assert.equal(beforeControl.some((row) => row.includes('CZ00000000CTRL01')), false)
  const atControl = rows({
    insertedHolders: [],
    selectedDayUtc: Date.UTC(2026, 9, 15, 10, 30),
    printedAtUtc: Date.UTC(2026, 9, 15, 10, 30),
  }).map(line)
  assert.equal(atControl.includes('(4) 15.10.2026 10:30 (22)'), true)
  assert.equal(controlled[dayRecord + 1]?.includes('km') ?? false, false)

  const hour = 60 * 60 * 1000
  const dayMs = 24 * hour

  // A. Den bez jízdy: syntetický začátek není 00:00 a konec není 23:59.
  const parkedAt = Date.UTC(2026, 9, 16, 8, 0)
  const parkedPrint = Date.UTC(2026, 9, 16, 10, 30)
  const parked = [openSyntheticDay(parkedAt, 220234)]
  noteLiveDistance(parked, parkedPrint, 0)
  assert.equal(sumDayIncrements(parked), 0)
  assert.deepEqual(block9(rows({
    insertedHolders: [], dayOdometers: parked, selectedDayUtc: parkedAt, printedAtUtc: parkedPrint,
  })), [
    '-----------(17)------------',
    '       16.10.2026',
    '  08:00  220 234 km',
    '  10:30  220 234 km',
  ])
  const midnightParked = [openSyntheticDay(Date.UTC(2026, 9, 16), 220234)]
  noteLiveDistance(midnightParked, Date.UTC(2026, 9, 16, 10), 0)
  assert.deepEqual(block9(rows({
    insertedHolders: [],
    dayOdometers: midnightParked,
    selectedDayUtc: Date.UTC(2026, 9, 16),
    printedAtUtc: Date.UTC(2026, 9, 16, 10),
  })), [
    '-----------(17)------------',
    '       16.10.2026',
    '  00:00  220 234 km',
    '  10:00  220 234 km',
  ])

  // B. Běžná jízda a přechod půlnoci.
  const firstDay = Date.UTC(2026, 0, 15)
  const driven = [openSyntheticDay(firstDay, 1000)]
  noteLiveDistance(driven, firstDay + 12 * hour, 30)
  noteLiveDistance(driven, firstDay + dayMs + 100, 1)
  assert.equal(driven[0].closedAtMidnight, true)
  assert.equal(driven[0].kmAtStart, 1000)
  assert.equal(driven[0].kmAtLast, 1030)
  assert.equal(driven[1].dayStartUtc, firstDay + dayMs)
  assert.equal(driven[1].kmAtStart, 1030)
  assert.equal(driven[1].kmAtLast, 1031)
  assert.equal(driven[1].syntheticStart, false)
  assert.deepEqual(block9(rows({
    insertedHolders: [], dayOdometers: driven, selectedDayUtc: firstDay, printedAtUtc: firstDay + dayMs + hour,
  })), [
    '-----------(17)------------',
    '       15.01.2026',
    '  1 000 km  1 030 km',
  ])
  assert.deepEqual(block9(rows({
    insertedHolders: [],
    dayOdometers: driven,
    selectedDayUtc: firstDay + dayMs,
    printedAtUtc: firstDay + dayMs + hour,
  })), [
    '-----------(17)------------',
    '       16.01.2026',
    '  00:00  1 030 km',
    '  01:00  1 031 km',
  ])

  // C. Simulace 4h10m přes půlnoc, jen podle sekund jízdy.
  const simStart = Date.UTC(2026, 0, 15, 22)
  const crafted = [openSyntheticDay(simStart, 5000)]
  const craftedEnd = simStart + 4 * hour + 10 * 60 * 1000
  applySecondDistances(crafted, [
    { timestampUtc: simStart, driver1: 'driving', speed: 3600 },
    { timestampUtc: simStart + 1000, driver1: 'otherWork', speed: 3600 },
    { timestampUtc: Date.UTC(2026, 0, 16, 0, 0, 1), driver1: 'driving', speed: 7200 },
  ], 3, 5000, craftedEnd)
  assert.equal(crafted[0].kmAtLast - crafted[0].kmAtStart, 1)
  assert.equal(crafted[0].closedAtMidnight, true)
  assert.equal(crafted[1].kmAtStart, 5001)
  assert.equal(crafted[1].kmAtLast - crafted[1].kmAtStart, 2)
  assert.equal(sumDayIncrements(crafted), 3)
  const simulated = buildSimulated4h10m({
    startMs: simStart,
    isMultiManning: false,
    card1Inserted: false,
    card2Inserted: false,
    card1TemplateId: undefined,
    card2TemplateId: undefined,
    distanceFromStartKm: 0,
  })
  const simulatedEnd = simStart + 4 * hour + 10 * 60 * 1000
  const simulatedDays = [openSyntheticDay(simStart, 220234)]
  applySecondDistances(
    simulatedDays, simulated.secondEntries, simulated.totalDrivingDistance, 220234, simulatedEnd,
  )
  assert.equal(simulatedDays[simulatedDays.length - 1].kmAtLast, 220234 + simulated.totalDrivingDistance)
  assert.ok(Math.abs(sumDayIncrements(simulatedDays) - simulated.totalDrivingDistance) < 1e-9)
  assert.equal(simulatedDays[0].closedAtMidnight, true)
  assert.equal(simulatedDays[1].dayStartUtc, Date.UTC(2026, 0, 16))
  assert.equal(simulatedDays[1].syntheticStart, false)
  const drivingOnly = simulated.secondEntries
    .filter((entry) => entry.driver1 === 'driving')
    .reduce((sum, entry) => sum + entry.speed / 3600, 0)
  const otherWorkKm = simulated.secondEntries
    .filter((entry) => entry.driver1 !== 'driving')
    .reduce((sum, entry) => sum + entry.speed / 3600, 0)
  assert.ok(otherWorkKm > 0)
  assert.ok(Math.abs(sumDayIncrements(simulatedDays) - drivingOnly) < 1e-9)
  assert.ok(sumDayIncrements(simulatedDays) < drivingOnly + otherWorkKm)

  // D. Skok přes půlnoc s jízdou i bez jízdy.
  const jumpFrom = Date.UTC(2026, 0, 15, 22)
  const jumpTo = Date.UTC(2026, 0, 16, 1)
  const jumpKm = (60 * Math.ceil((jumpTo - jumpFrom) / 60000)) / 60
  const jumped = [openSyntheticDay(jumpFrom, 1000)]
  applyForwardDistance(jumped, jumpFrom, jumpTo, jumpKm, 1000)
  assert.equal(jumpKm, 180)
  assert.equal(jumped[0].kmAtLast - jumped[0].kmAtStart, 120)
  assert.equal(jumped[0].closedAtMidnight, true)
  assert.equal(jumped[1].kmAtStart, 1120)
  assert.equal(jumped[1].kmAtLast - jumped[1].kmAtStart, 60)
  assert.equal(sumDayIncrements(jumped), jumpKm)
  assert.deepEqual(block9(rows({
    insertedHolders: [], dayOdometers: jumped, selectedDayUtc: jumpFrom, printedAtUtc: jumpTo,
  })), [
    '-----------(17)------------',
    '       15.01.2026',
    '  22:00  1 000 km',
    '  23:59  1 120 km',
  ])
  const skippedTo = Date.UTC(2026, 0, 17, 2)
  const skipped = [openSyntheticDay(jumpFrom, 1000)]
  applyForwardDistance(skipped, jumpFrom, skippedTo, 0, 1000)
  assert.equal(skipped.length, 2)
  assert.equal(skipped.some((record) => record.dayStartUtc === Date.UTC(2026, 0, 16)), false)
  assert.equal(skipped[0].closedAtMidnight, false)
  assert.equal(skipped[0].kmAtLast, 1000)
  assert.equal(skipped[1].dayStartUtc, Date.UTC(2026, 0, 17))
  assert.equal(skipped[1].startAtUtc, skippedTo)
  assert.equal(skipped[1].syntheticStart, true)
  assert.equal(sumDayIncrements(skipped), 0)
  const awkward = [openSyntheticDay(jumpFrom, 0)]
  applyForwardDistance(awkward, jumpFrom, Date.UTC(2026, 0, 16) + 1, 10, 0)
  assert.equal(sumDayIncrements(awkward), 10)

  // E. Historický den bez údajů a skok zpět.
  const missing = block9(rows({
    insertedHolders: [],
    dayOdometers: [openSyntheticDay(Date.UTC(2026, 0, 15, 10), 999999)],
    selectedDayUtc: Date.UTC(2026, 0, 14),
    printedAtUtc: Date.UTC(2026, 0, 16),
  }))
  assert.deepEqual(missing, [
    '-----------(17)------------',
    '       14.01.2026',
  ])
  assert.equal(missing.some((row) => row.includes('999')), false)
  const rewound = [openSyntheticDay(Date.UTC(2026, 0, 15, 10), 1000)]
  noteLiveDistance(rewound, Date.UTC(2026, 0, 15, 12), 40)
  const kmBeforeRewind = rewound[0].kmAtLast
  noteBackwardJump(rewound, Date.UTC(2026, 0, 15, 8))
  assert.equal(rewound.length, 1)
  assert.equal(rewound[0].unavailable, true)
  assert.equal(rewound[0].kmAtLast, kmBeforeRewind)
  assert.deepEqual(block9(rows({
    insertedHolders: [],
    dayOdometers: rewound,
    selectedDayUtc: Date.UTC(2026, 0, 15),
    printedAtUtc: Date.UTC(2026, 0, 15, 12),
  })), [
    '-----------(17)------------',
    '       15.01.2026',
  ])

  // F. Reset zachová tachometr a zahodí předchozí dny.
  const keptKm = 1050
  const resetAt = Date.UTC(2026, 0, 20, 9, 15)
  const reset = resetDayOdometers(resetAt, keptKm)
  assert.equal(reset.length, 1)
  assert.equal(reset[0].kmAtStart, keptKm)
  assert.equal(reset[0].kmAtLast, keptKm)
  assert.equal(reset[0].syntheticStart, true)
  assert.equal(reset[0].dayStartUtc, Date.UTC(2026, 0, 20))
  assert.deepEqual(block9(rows({
    insertedHolders: [], dayOdometers: reset, selectedDayUtc: resetAt, printedAtUtc: resetAt,
  })), [
    '-----------(17)------------',
    '       20.01.2026',
    '  09:15  1 050 km',
    '  09:15  1 050 km',
  ])

  // G + H. Součet denních přírůstků odpovídá jednomu přičtení, bez duplicity.
  const ledger = [openSyntheticDay(firstDay, 220234)]
  let added = 0
  noteLiveDistance(ledger, firstDay + 12 * hour, 20)
  added += 20
  noteLiveDistance(ledger, firstDay + dayMs + 100, 5)
  added += 5
  const laterFrom = firstDay + dayMs + 22 * hour
  const laterTo = firstDay + 2 * dayMs + hour
  const laterKm = (60 * Math.ceil((laterTo - laterFrom) / 60000)) / 60
  applyForwardDistance(ledger, laterFrom, laterTo, laterKm, 220234 + added)
  added += laterKm
  applySecondDistances(ledger, [
    { timestampUtc: laterTo, driver1: 'driving', speed: 3600 },
    { timestampUtc: laterTo + 1000, driver1: 'otherWork', speed: 9999 },
  ], 1, 220234 + added, laterTo + 60 * 1000)
  added += 1
  assert.equal(sumDayIncrements(ledger), added)
  assert.equal(ledger[ledger.length - 1].kmAtLast - 220234, added)
  noteLiveDistance(ledger, laterTo + 2 * 60 * 1000, 1)
  assert.equal(sumDayIncrements(ledger), added + 1)
  assert.notEqual(sumDayIncrements(ledger), added + laterKm + 1)

  // Místní čas nemění hranici UTC dne ani označení 00:00 a 23:59.
  const localFinished = block9(rows({
    insertedHolders: [],
    dayOdometers: driven,
    selectedDayUtc: firstDay,
    printedAtUtc: firstDay + dayMs + hour,
    isUtc: false,
    localOffsetMs: 2 * hour,
  }))
  assert.equal(localFinished[1], '       15.01.2026')
  assert.equal(localFinished[2], '  1 000 km  1 030 km')
  const localOpen = block9(rows({
    insertedHolders: [],
    dayOdometers: parked,
    selectedDayUtc: parkedAt,
    printedAtUtc: parkedPrint,
    isUtc: false,
    localOffsetMs: 2 * hour,
  }))
  assert.equal(localOpen[1], '       16.10.2026')
  assert.deepEqual(localOpen.slice(2), [
    '  10:00  220 234 km',
    '  12:30  220 234 km',
  ])

  const sampleDay = Date.UTC(2026, 9, 16)
  const sample = [openSyntheticDay(sampleDay, 220234)]
  noteLiveDistance(sample, sampleDay + 18 * hour, 46)
  noteLiveDistance(sample, sampleDay + dayMs + 100, 0)
  const sampleBlock = block9(rows({
    insertedHolders: [],
    dayOdometers: sample,
    selectedDayUtc: sampleDay,
    printedAtUtc: sampleDay + dayMs + 8 * hour,
  }))
  assert.equal(sampleBlock[2], '  220 234 km  220 280 km')
  assert.ok(rows({
    insertedHolders: [], dayOdometers: sample, selectedDayUtc: sampleDay, printedAtUtc: sampleDay + dayMs,
  }).every((row) => row.length <= 24))

  const evening = DAY + 20 * hour
  const rest = (fromHour: number, toHour: number) => fillMinutes(DAY + fromHour * hour, DAY + toHour * hour, 'rest')
  const work = (fromHour: number, toHour: number) => fillMinutes(DAY + fromHour * hour, DAY + toHour * hour, 'otherWork')

  // A. OUT začátek a konec během jedné aktivity.
  const outDuring = rows({
    insertedHolders: [], printedAtUtc: evening, history: rest(8, 12),
    out: [
      { minuteStartUtc: DAY + 9 * hour, type: 'activation' },
      { minuteStartUtc: DAY + 10 * hour, type: 'deactivation' },
    ],
  })
  assert.deepEqual(slotLines(outDuring, 1).slice(1, 5), [
    '(14)---',
    '(8) 08:00 04h00',
    '  09:00 OUT(59)',
    '  10:00 (59)OUT',
  ])
  assert.equal(slotLines(outDuring, 1).filter((row) => row.includes('(8)')).length, 1)

  // B. Trajekt začátek a konec během odpočinku, odpočinek se nedělí.
  const ferryDuring = rows({
    insertedHolders: [], printedAtUtc: evening,
    history: [...rest(8, 11), ...work(11, 12)],
    ferry: [
      { minuteStartUtc: DAY + 9 * hour + 30 * 60 * 1000, type: 'activation' },
      { minuteStartUtc: DAY + 10 * hour + 30 * 60 * 1000, type: 'deactivation' },
    ],
  })
  assert.deepEqual(slotLines(ferryDuring, 1).slice(1, 6), [
    '(14)---',
    '(8) 08:00 03h00',
    '  09:30 (49)(59)',
    '  10:30 (59)(49)',
    '(9) 11:00 01h00',
  ])

  // C. Více podmínek v jedné aktivitě.
  const several = rows({
    insertedHolders: [], printedAtUtc: evening, history: rest(8, 12),
    out: [
      { minuteStartUtc: DAY + 8 * hour + 30 * 60 * 1000, type: 'activation' },
      { minuteStartUtc: DAY + 11 * hour, type: 'deactivation' },
    ],
    ferry: [
      { minuteStartUtc: DAY + 9 * hour + 30 * 60 * 1000, type: 'activation' },
      { minuteStartUtc: DAY + 10 * hour + 30 * 60 * 1000, type: 'deactivation' },
    ],
  })
  assert.deepEqual(slotLines(several, 1).filter((row) => row.startsWith('  ')), [
    '  08:30 OUT(59)',
    '  09:30 (49)(59)',
    '  10:30 (59)(49)',
    '  11:00 (59)OUT',
  ])
  assert.equal(slotLines(several, 1).filter((row) => row.startsWith('(8)')).length, 1)

  // D. Událost přesně na hranici dvou aktivit.
  const onBoundary = rows({
    insertedHolders: [], printedAtUtc: evening,
    history: [...rest(8, 11), ...work(11, 13)],
    ferry: [{ minuteStartUtc: DAY + 11 * hour, type: 'activation' }],
  })
  const boundary = slotLines(onBoundary, 1)
  assert.ok(boundary.indexOf('(8) 08:00 03h00') < boundary.indexOf('  11:00 (49)(59)'))
  assert.ok(boundary.indexOf('  11:00 (49)(59)') < boundary.indexOf('(9) 11:00 02h00'))

  // E. Událost bez uložené aktivity v daném okamžiku.
  const inGap = rows({
    insertedHolders: [], printedAtUtc: evening,
    history: [...rest(8, 9), ...work(11, 12)],
    out: [{ minuteStartUtc: DAY + 10 * hour, type: 'activation' }],
  })
  const gap = slotLines(inGap, 1)
  assert.ok(gap.indexOf('(8) 08:00 01h00') < gap.indexOf('  10:00 OUT(59)'))
  assert.ok(gap.indexOf('  10:00 OUT(59)') < gap.indexOf('(9) 11:00 01h00'))
  const noActivity = slotLines(rows({
    insertedHolders: [], printedAtUtc: evening,
    out: [{ minuteStartUtc: DAY + 9 * hour + 30 * 60 * 1000, type: 'activation' }],
  }), 1)
  assert.deepEqual(noActivity, [
    '-----------(12)------------',
    '---',
    '  09:30 OUT(59)',
  ])

  // F. OUT aktivní přes půlnoc.
  const overnight = rows({
    insertedHolders: [], printedAtUtc: evening, history: rest(8, 10),
    out: [
      { minuteStartUtc: DAY - hour, type: 'activation' },
      { minuteStartUtc: DAY + 8 * hour + 30 * 60 * 1000, type: 'deactivation' },
    ],
  })
  const overnightText = overnight.map(line)
  const outBanner = overnightText.findIndex((row) => row.startsWith('-') && row.includes('OUT') && !row.includes('(59)'))
  const slot1At = overnightText.findIndex((row) => row.startsWith('-') && row.includes('(12)'))
  assert.ok(outBanner >= 0 && outBanner < slot1At)
  assert.equal(overnightText.some((row) => row.includes('OUT(59)')), false)
  assert.ok(slotLines(overnight, 1).includes('  08:30 (59)OUT'))
  const previousDay = rows({
    insertedHolders: [], selectedDayUtc: DAY - dayMs, printedAtUtc: evening,
    history: fillMinutes(DAY - 2 * hour, DAY, 'rest'),
    out: [{ minuteStartUtc: DAY - hour, type: 'activation' }],
  })
  assert.ok(slotLines(previousDay, 1).includes('  23:00 OUT(59)'))
  assert.equal(previousDay.map(line).some((row) => row.startsWith('-') && row.includes('OUT') && !row.includes('(12)')), false)

  // G. Šachta 1 a 2: značky jen ve šachtě 1, chronologie oddělená.
  const twoSlots = rows({
    insertedHolders: [], printedAtUtc: evening,
    history: fillMinutes(DAY + 8 * hour, DAY + 12 * hour, 'rest', { driver2: 'availability' }),
    ferry: [{ minuteStartUtc: DAY + 9 * hour + 30 * 60 * 1000, type: 'activation' }],
  })
  assert.ok(slotLines(twoSlots, 1).includes('  09:30 (49)(59)'))
  assert.equal(slotLines(twoSlots, 2).some((row) => row.includes('(49)') || row.includes('OUT')), false)
  assert.ok(slotLines(twoSlots, 2).some((row) => row.startsWith('(7)')))

  // H. UTC/LOC, událost před půlnocí UTC se v LOC může posunout na další kalendářní datum.
  const late = DAY + 23 * hour + 30 * 60 * 1000
  const localCrossing = rows({
    insertedHolders: [], selectedDayUtc: DAY, printedAtUtc: DAY + dayMs,
    history: rest(22, 24),
    out: [{ minuteStartUtc: late, type: 'activation' }],
    isUtc: false, localOffsetMs: 2 * hour,
  })
  assert.equal(block9(localCrossing)[1], '       15.01.2026')
  assert.ok(slotLines(localCrossing, 1).includes('  01:30 OUT(59)'))
  assert.equal(slotLines(localCrossing, 1).some((row) => row.includes('23:30')), false)
  const utcCrossing = rows({
    insertedHolders: [], selectedDayUtc: DAY, printedAtUtc: DAY + dayMs,
    history: rest(22, 24),
    out: [{ minuteStartUtc: late, type: 'activation' }],
  })
  assert.ok(slotLines(utcCrossing, 1).includes('  23:30 OUT(59)'))
  assert.equal(rows({
    insertedHolders: [], selectedDayUtc: DAY + dayMs, printedAtUtc: DAY + 2 * dayMs,
    out: [{ minuteStartUtc: late, type: 'activation' }],
  }).map(line).some((row) => row.includes('OUT(59)')), false)

  // I. Součty aktivit se značkami i bez nich jsou stejné.
  const historyForTotals = [...rest(8, 11), ...work(11, 13)]
  const withoutMarks = rows({ insertedHolders: [], printedAtUtc: evening, history: historyForTotals })
  const withMarks = rows({
    insertedHolders: [], printedAtUtc: evening, history: historyForTotals,
    out: [
      { minuteStartUtc: DAY + 9 * hour, type: 'activation' },
      { minuteStartUtc: DAY + 11 * hour, type: 'deactivation' },
    ],
    ferry: [{ minuteStartUtc: DAY + 10 * hour, type: 'activation' }],
  })
  assert.deepEqual(summaryDurations(withMarks), summaryDurations(withoutMarks))
  assert.ok(slotLines(withoutMarks, 1).includes('(8) 08:00 03h00'))
  assert.ok(slotLines(withMarks, 1).includes('(8) 08:00 03h00'))
  assert.ok(slotLines(withMarks, 1).includes('(9) 11:00 02h00'))
  assert.ok(withMarks.every((row) => row.length <= 24))

  console.log(controlled.slice(calibration, dayRecord + 1).join('\n'))
  console.log(sampleBlock.join('\n'))
  console.log(block9(rows({
    insertedHolders: [], dayOdometers: parked, selectedDayUtc: parkedAt, printedAtUtc: parkedPrint,
  })).join('\n'))
  console.log(slotLines(ferryDuring, 1).join('\n'))
}
