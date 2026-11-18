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

const defaults: PrintVehicleProfile = {
  companyName: '',
  companyAddress: '',
  companyId: '',
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
    for (const key of ['companyName', 'companyAddress', 'companyId', 'registration', 'registrationNation', 'vin'] as const) {
      if (typeof data[key] === 'string') profile[key] = data[key]
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
