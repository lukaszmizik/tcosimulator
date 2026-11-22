import assert from 'node:assert/strict'
import { VEHICLE_TECHNICAL_DATA } from '../src/data/vehicle_technical_data.ts'
import type { PrintVehicleProfile } from '../src/data/printVehicleProfile.ts'
import { buildTechnicalDataPrintRows, type UtcTimeAdjustment } from '../src/print/technicalDataPrintRows.ts'
import { toDisplayRows } from '../src/print/printDisplayBrowse.ts'
import type { PrintRow } from '../src/print/driverCardPrintRows.ts'
import { resolvePrintMenuAction } from '../src/print/printWizardHandling.ts'

const printedAt = Date.UTC(2026, 10, 22, 9, 0)
const profile: PrintVehicleProfile = {
  companyName: 'Transdev Morava s.r.o.',
  companyAddress: 'Bozděchova 567/8, 702 00 Ostrava',
  companyId: '06738346',
  registration: '1T23456',
  registrationNation: 'SK',
  vin: 'WDB9630201L000001',
  load: 'passengers',
}

function line(row: PrintRow): string {
  return row.map((cell) => (typeof cell === 'number' ? `(${cell})` : cell)).join('')
}

function text(rows: readonly PrintRow[]): string {
  return rows.map(line).join('\n')
}

function rules(rows: readonly PrintRow[]): string[] {
  return rows
    .filter((row) => row.filter((cell) => cell === '-').length >= 12)
    .map((row) => row.filter((cell): cell is number => typeof cell === 'number').join('+'))
}

const rows = buildTechnicalDataPrintRows({
  printedAtUtc: printedAt,
  isUtc: true,
  localOffsetMs: 3_600_000,
  profile,
})
const body = text(rows).replaceAll('\n', '')

assert.deepEqual(rules(rows), ['18', '6', '23', '29', '30', '5', '5', '5+17+18'])
assert.ok(rows.every((row) => row.length <= 24))
assert.equal(body.includes('(5)(17)(18)'), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.tachographManufacturer), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.dtcoNumber), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.typeApprovalNumber), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.serialNumber), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.sensor.serialNumber), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.gnss.serialNumber), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.dsrc.serialNumber), true)
assert.equal(body.includes(profile.vin), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.vehicleIdentificationNumber), false)
assert.equal(body.includes('SK /1T23456'), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.vehicleRegistration), false)
assert.equal(body.includes('(50)'), true)
assert.equal(body.includes('(51)'), false)
assert.ok(body.indexOf('(04)') < body.indexOf('(02)'))
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.lastCalibration.serviceName), true)
assert.equal(body.includes(VEHICLE_TECHNICAL_DATA.lastCalibration.workshopCardId), true)
assert.equal(body.includes('15.03.2024 08:40'), true)
for (const calibration of VEHICLE_TECHNICAL_DATA.calibrations) {
  assert.equal(body.includes(String(calibration.wImpulsesPerKm)), true)
  assert.equal(body.includes(String(calibration.kImpulsesPerKm)), true)
  assert.equal(body.includes(String(calibration.tyreCircumferenceMm)), true)
  assert.equal(body.includes(calibration.tyreSize), true)
}
assert.equal(rules(rows).includes('17'), false)

const stored: PrintVehicleProfile = { ...profile, load: '' }
const storedText = text(buildTechnicalDataPrintRows({
  printedAtUtc: printedAt,
  isUtc: true,
  localOffsetMs: 0,
  profile: stored,
})).replaceAll('\n', '')
assert.equal(storedText.includes('(51)'), true)
assert.equal(storedText.includes('(50)'), false)

const adjustment: UtcTimeAdjustment = {
  oldUtc: Date.UTC(2026, 0, 8, 10, 16),
  newUtc: Date.UTC(2026, 0, 8, 10, 15),
  workshopName: 'Servis tachografů Praha s.r.o.',
  workshopAddress: 'Plzeňská 210, Praha 5',
  workshopCardId: 'CZE99887766554433',
  workshopCardExpiry: '14.03.2029',
}
const adjusted = buildTechnicalDataPrintRows({
  printedAtUtc: printedAt,
  isUtc: true,
  localOffsetMs: 0,
  profile,
  utcAdjustments: [adjustment],
})
const adjustedText = text(adjusted).replaceAll('\n', '')
assert.deepEqual(rules(adjusted), ['18', '6', '23', '29', '30', '5', '5', '17', '5+17+18'])
assert.equal(adjustedText.includes('08.01.2026 10:16'), true)
assert.equal(adjustedText.includes('08.01.2026 10:15'), true)

const display = toDisplayRows(rows)
assert.equal(display.length, rows.length)
for (let index = 0; index < rows.length; index += 1) {
  const source = rows[index]!
  const shown = display[index]!
  assert.equal(shown.length, source.length)
  for (let cell = 0; cell < source.length; cell += 1) {
    const expected = source[cell] === 18 ? 20 : source[cell]
    assert.equal(shown[cell], expected)
  }
}
assert.equal(display.some((row) => row.includes(18)), false)

assert.equal(VEHICLE_TECHNICAL_DATA.lastCalibration.date, '15.03.2024')
assert.equal(VEHICLE_TECHNICAL_DATA.lastCalibration.serviceName, 'Servis tachografů Praha s.r.o.')
assert.equal(VEHICLE_TECHNICAL_DATA.lastCalibration.workshopCardId, 'CZE99887766554433')
assert.equal(VEHICLE_TECHNICAL_DATA.calibrations.length, 2)

const menu = {
  line2: '(5)(17)(18) tech. data',
  requiresDate: false,
  requiresUtcConfirm: false,
  secondHistory: [],
  simulatedUtcTime: printedAt,
  currentMenuPath: ['ENTRY'],
}
assert.equal(resolvePrintMenuAction({ ...menu, action: 'PRINT_TECH_V' })?.type, 'openTechnical')
assert.equal(resolvePrintMenuAction({ ...menu, action: 'DISP_TECH_V' })?.type, 'openTechnicalDisplay')

console.log('technical print ok')
