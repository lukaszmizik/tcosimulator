import type { ClockMode } from '../lib/clock'
import { useLanguage } from '../translations'

type TimeScaleSelectProps = {
  value: ClockMode
  onChange: (mode: ClockMode) => void
}

export function TimeScaleSelect({ value, onChange }: TimeScaleSelectProps) {
  const { t } = useLanguage()
  return (
    <label className="time-scale-select">
      <span className="time-scale-select-label">{t.workWeek.timeScale}</span>
      <select
        className="time-scale-select-field"
        value={value}
        onChange={(event) => onChange(event.target.value as ClockMode)}
        aria-label={t.workWeek.timeScaleAria}
      >
        <option value="local">{t.workWeek.localTime}</option>
        <option value="utc">UTC</option>
      </select>
    </label>
  )
}
