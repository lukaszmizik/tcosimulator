/**
 * Výtisk technických údajů (5)(17)(18).
 * DTCO 4.1b, str. 136 a klíč bloků na str. 144–145.
 * VIN a SPZ jdou z profilu vozidla. Změna UTC jen ze záznamu, který simulátor má.
 */

import { VEHICLE_TECHNICAL_DATA, type TechnicalCalibration } from '../data/vehicle_technical_data'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import { createPrintRows, printDateUtc, printTimeUtc, type PrintRow } from './driverCardPrintRows'

export type UtcTimeAdjustment = {
  oldUtc: number
  newUtc: number
  workshopName: string
  workshopAddress: string
  workshopCardId: string
  workshopCardExpiry: string
}

export type TechnicalDataPrintInput = {
  printedAtUtc: number
  isUtc: boolean
  localOffsetMs: number
  profile: PrintVehicleProfile
  utcAdjustments?: readonly UtcTimeAdjustment[]
}

const technical = VEHICLE_TECHNICAL_DATA

function kilometers(km: number): string {
  return `${String(Math.trunc(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`
}

function stamp(atUtc: number, offset: number): string {
  return `${printDateUtc(atUtc + offset)} ${printTimeUtc(atUtc + offset)}`
}

function addCalibration(
  add: (...parts: (string | number)[]) => void,
  calibration: TechnicalCalibration,
  profile: PrintVehicleProfile,
  offset: number,
) {
  add(5, ' ', calibration.serviceName)
  add('  ', calibration.address)
  add(5, 14, ' ', calibration.workshopCardId)
  add('  ', calibration.workshopCardExpiry)
  add(5, ' ', stamp(calibration.atUtc, offset), ' (', calibration.purpose, ')')
  if (profile.vin) add(24, ' ', profile.vin)
  if (profile.registration) add('  ', profile.registrationNation, ' /', profile.registration)
  add('  w ', String(calibration.wImpulsesPerKm), ' imp/km')
  add('  k ', String(calibration.kImpulsesPerKm), ' imp/km')
  add('  l ', String(calibration.tyreCircumferenceMm), ' mm')
  add(25, ' ', calibration.tyreSize)
  add('  > ', String(calibration.maxSpeedKmh), ' km/h')
  add('  ', kilometers(calibration.odometerOldKm), '  ', kilometers(calibration.odometerNewKm))
  const load = profile.load || technical.standardLoad
  add(load === 'passengers' ? 50 : 51)
  add('  ', calibration.country, ' ', stamp(calibration.gnssAtUtc, offset))
  for (const seal of calibration.seals) add(38, ' ', seal)
}

export function buildTechnicalDataPrintRows(input: TechnicalDataPrintInput): PrintRow[] {
  const offset = input.isUtc ? 0 : input.localOffsetMs
  const { rows, add, separator, addLocalTimeWarning } = createPrintRows()
  const adjustments = (input.utcAdjustments ?? []).filter((item) => item.newUtc <= input.printedAtUtc)

  if (!input.isUtc) addLocalTimeWarning()
  add(18, ' ', stamp(input.printedAtUtc, offset), input.isUtc ? ' (UTC)' : ' (LOC)')
  separator(18)
  add('         GEN2 v2')
  add(5, 17, 18, ...(input.isUtc ? [] : [17]))

  separator(6)
  add(6, ' ', technical.tachographManufacturer)
  for (const line of technical.manufacturerAddress) add('  ', line)
  add('  ', technical.dtcoNumber)
  add('  ', technical.typeApprovalNumber)
  add('  ', technical.serialNumber)
  add('  ', technical.yearOfManufacture)
  add('  ', technical.softwareVersion, ' ', technical.softwareInstalledOn)
  add('  ', technical.digitalMapVersion)

  separator(23)
  add(23, ' ', technical.sensor.serialNumber)
  add('  ', technical.sensor.typeApprovalNumber)
  add(23, ' ', stamp(technical.sensor.coupledAtUtc, offset))

  separator(29)
  add(29, ' ', technical.gnss.serialNumber)
  add('  ', technical.gnss.deviceType)
  add('  ', technical.gnss.productionPeriod, ' ', technical.gnss.manufacturerCode)

  separator(30)
  add(30, ' ', technical.dsrc.serialNumber)
  add('  ', technical.dsrc.deviceType)
  add('  ', technical.dsrc.productionPeriod, ' ', technical.dsrc.manufacturerCode)

  for (const calibration of technical.calibrations) {
    separator(5)
    addCalibration(add, calibration, input.profile, offset)
  }

  if (adjustments.length > 0) {
    separator(17)
    for (const item of adjustments) {
      add(17, ' ', stamp(item.oldUtc, offset))
      add('  ', stamp(item.newUtc, offset))
      add(5, ' ', item.workshopName)
      add('  ', item.workshopAddress)
      add(5, 14, ' ', item.workshopCardId)
      add('  ', item.workshopCardExpiry)
    }
  }

  separator(5, 17, 18)
  return rows
}
