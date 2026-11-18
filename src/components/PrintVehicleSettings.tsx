import { useState, type FormEvent } from 'react'
import { savePrintVehicleProfile, type PrintVehicleProfile } from '../data/printVehicleProfile'

const fields = [
  ['companyName', 'Název firmy', 100],
  ['companyAddress', 'Adresa', 150],
  ['companyId', 'IČO', 20],
  ['registration', 'Registrační značka', 16],
  ['registrationNation', 'Stát registrace', 3],
  ['vin', 'VIN', 17],
] as const

export function PrintVehicleSettings({ profile, onSave }: {
  profile: PrintVehicleProfile
  onSave: (profile: PrintVehicleProfile) => void
}) {
  const [draft, setDraft] = useState(profile)
  const [message, setMessage] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = {
      companyName: draft.companyName.trim(),
      companyAddress: draft.companyAddress.trim(),
      companyId: draft.companyId.trim(),
      registration: draft.registration.trim().toUpperCase(),
      registrationNation: draft.registrationNation.trim().toUpperCase(),
      vin: draft.vin.trim().toUpperCase(),
      load: draft.load,
    }
    try {
      savePrintVehicleProfile(next)
      onSave(next)
      setDraft(next)
      setMessage('Údaje uloženy.')
    } catch {
      setMessage('Údaje se nepodařilo uložit.')
    }
  }

  return (
    <form className="print-vehicle-settings" onSubmit={submit} onChange={() => setMessage('')}>
      <h2>Firma a vozidlo</h2>
      <div className="print-vehicle-fields">
        {fields.map(([key, label, maxLength]) => (
          <label key={key}>
            {label}
            <input
              value={draft[key]}
              maxLength={maxLength}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          </label>
        ))}
        <label>
          Standardní druh nákladu
          <select value={draft.load} onChange={(event) => setDraft({
            ...draft, load: event.target.value as PrintVehicleProfile['load'],
          })}>
            <option value="">Neuveden</option>
            <option value="passengers">Cestující</option>
            <option value="goods">Zboží</option>
          </select>
        </label>
      </div>
      <button type="submit">Uložit údaje</button>
      <span role="status">{message}</span>
    </form>
  )
}
