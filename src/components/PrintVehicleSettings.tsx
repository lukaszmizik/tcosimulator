import { useState, type FormEvent } from 'react'
import { useLanguage } from '../translations'
import { savePrintVehicleProfile, type PrintVehicleProfile } from '../data/printVehicleProfile'

const fields = [
  ['companyName', 100],
  ['companyAddress', 150],
  ['companyId', 20],
  ['registration', 16],
  ['registrationNation', 3],
  ['vin', 17],
] as const

export function PrintVehicleSettings({ profile, onSave }: {
  profile: PrintVehicleProfile
  onSave: (profile: PrintVehicleProfile) => void
}) {
  const { t } = useLanguage()
  const labels = t.vehicleSettings
  const [draft, setDraft] = useState(profile)
  const [message, setMessage] = useState<'saved' | 'saveFailed' | null>(null)

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
      setMessage('saved')
    } catch {
      setMessage('saveFailed')
    }
  }

  return (
    <form className="print-vehicle-settings" onSubmit={submit} onChange={() => setMessage(null)}>
      <h2>{labels.title}</h2>
      <div className="print-vehicle-fields">
        {fields.map(([key, maxLength]) => (
          <label key={key}>
            {key === 'vin' ? 'VIN' : labels[key]}
            <input
              value={draft[key]}
              maxLength={maxLength}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          </label>
        ))}
        <label>
          {labels.load}
          <select value={draft.load} onChange={(event) => setDraft({
            ...draft, load: event.target.value as PrintVehicleProfile['load'],
          })}>
            <option value="">{labels.unspecified}</option>
            <option value="passengers">{labels.passengers}</option>
            <option value="goods">{labels.goods}</option>
          </select>
        </label>
      </div>
      <button type="submit">{labels.save}</button>
      <span role="status">{message && labels[message]}</span>
    </form>
  )
}
