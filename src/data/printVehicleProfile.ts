import { VEHICLE_TECHNICAL_DATA } from './vehicle_technical_data'

export type PrintVehicleProfile = {
  companyName: string
  companyAddress: string
  companyId: string
  registration: string
  registrationNation: string
  vin: string
  load: '' | 'passengers' | 'goods'
}

const STORAGE_KEY = 'simulator.printVehicleProfile'

/** Výchozí firma na výtiscích; uživatel ji může v „Firma a vozidlo“ změnit. */
const defaults: PrintVehicleProfile = {
  companyName: 'Transdev Morava s.r.o.',
  companyAddress: 'Bozděchova 567/8, 702 00 Ostrava',
  companyId: '06738346',
  registration: VEHICLE_TECHNICAL_DATA.vehicleRegistration,
  registrationNation: VEHICLE_TECHNICAL_DATA.approvingMemberState,
  vin: VEHICLE_TECHNICAL_DATA.vehicleIdentificationNumber,
  load: '',
}

export function loadPrintVehicleProfile(): PrintVehicleProfile {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<PrintVehicleProfile> | null
    if (!data) return { ...defaults }
    const profile = { ...defaults }
    for (const key of ['registration', 'registrationNation', 'vin'] as const) {
      if (typeof data[key] === 'string') profile[key] = data[key]
    }
    const hasCustomCompany =
      (typeof data.companyName === 'string' && data.companyName.trim() !== '') ||
      (typeof data.companyAddress === 'string' && data.companyAddress.trim() !== '') ||
      (typeof data.companyId === 'string' && data.companyId.trim() !== '')
    if (hasCustomCompany) {
      if (typeof data.companyName === 'string') profile.companyName = data.companyName
      if (typeof data.companyAddress === 'string') profile.companyAddress = data.companyAddress
      if (typeof data.companyId === 'string') profile.companyId = data.companyId
    }
    if (data.load === 'passengers' || data.load === 'goods') profile.load = data.load
    return profile
  } catch {
    return { ...defaults }
  }
}

export function savePrintVehicleProfile(profile: PrintVehicleProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}
