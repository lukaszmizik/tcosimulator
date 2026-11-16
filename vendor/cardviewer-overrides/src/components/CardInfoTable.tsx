import type { DriverCardData } from '../types/tacho'
import type { ClockMode } from '../lib/clock'
import { formatClockDateTime } from '../lib/clock'
import { driverDisplayName } from '../lib/placeholderCard'
import { useLanguage } from '../translations'

type CardInfoTableProps = {
  card: DriverCardData
  clockMode: ClockMode
}

function cell(value: string | null | undefined): string {
  const text = value?.trim()
  return text ? text : '—'
}

function languageCell(value: string | null | undefined, names: Record<string, string>): string {
  const text = value?.trim()
  if (!text) return '—'
  return names[text.toLowerCase()] ?? text
}

function instant(ms: number | null | undefined, mode: ClockMode): string {
  if (ms == null) return '—'
  return formatClockDateTime(ms, mode)
}

function DriverCardFace({ card }: { card: DriverCardData }) {
  const { t } = useLanguage()
  const country = cell(card.issuingCountry)
  return (
    <div className="driver-card-visual" aria-label={t.workWeek.driverCard}>
      <div className="driver-card-visual__eu">
        <div className="driver-card-visual__eu-stars" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="driver-card-visual__eu-star"
              style={{ transform: `rotate(${i * 30}deg) translateY(-1.2em)` }}
            />
          ))}
        </div>
        <span className="driver-card-visual__eu-cz">{country}</span>
      </div>
      <span className="driver-card-visual__cz-corner">{country}</span>
      <h2 className="driver-card-visual__title">{t.workWeek.driverCardTitle}</h2>
      <div className="driver-card-visual__photo">
        <span className="driver-card-visual__person-icon" aria-hidden="true">
          <span className="driver-card-visual__person-head" />
          <span className="driver-card-visual__person-body" />
        </span>
      </div>
      <div className="driver-card-visual__body">
        <div className="driver-card-visual__field">{cell(driverDisplayName(card))}</div>
        <div className="driver-card-visual__field">{cell(card.dateOfBirth)}</div>
        <div className="driver-card-visual__field driver-card-visual__field--dates">
          <span>{cell(card.validityBegin)}</span>
          <span>{cell(card.dateOfExpiry)}</span>
        </div>
        <div className="driver-card-visual__field">{cell(card.issuingAuthority)}</div>
        <div className="driver-card-visual__field driver-card-visual__field--mono">{cell(card.drivingLicenseNumber)}</div>
        <div className="driver-card-visual__field driver-card-visual__field--mono">{cell(card.cardNumber)}</div>
      </div>
      <div className="driver-card-visual__decoration" aria-hidden="true" />
      <div className="driver-card-visual__signature">{t.workWeek.signature}</div>
      <span className="driver-card-visual__g2">G2</span>
    </div>
  )
}

export function CardInfoTable({ card, clockMode }: CardInfoTableProps) {
  const { t } = useLanguage()
  const labels = t.workWeek
  const rows: Array<[string, string]> = [
    [labels.preferredLanguage, languageCell(card.preferredLanguage, labels.languageNames)],
    [labels.issueDate, cell(card.dateOfIssue)],
    [labels.licenceIssuedBy, cell(card.licenceIssuingAuthority)],
    [labels.licenceCountry, cell(card.licenceIssuingCountry ?? card.nationality)],
    [labels.lastDownload, instant(card.lastCardDownloadUtc, clockMode)],
    [labels.lastWithdrawalInfo, instant(card.lastWithdrawalUtc, clockMode)],
  ]

  return (
    <section className="work-week-graph-table-wrapper card-info-table-wrapper">
      <div className="card-info-face">
        <DriverCardFace card={card} />
      </div>
      <table className="work-week-graph-table card-info-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
