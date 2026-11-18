/**
 * Orientační vizuál karty řidiče (KARTA ŘIDIČE) – CSS reprezentace.
 * Bez jemných detailů, místo fotografie ikona postavy.
 * Přijímá data karty a může být přesouvatelná do slotů (jako testovací karty).
 */

import { useMemo } from 'react'
import type { CardData } from './TachoTypes'

export type DriverCardVisualProps = {
  /** Data karty (jméno, příjmení, atd.). Když chybí, zobrazí se výchozí placeholder. */
  data: CardData | null
  /** Když je karta vložená ve slotu 1 nebo 2 – zobrazí se označení slotu a karta není přesouvatelná. */
  insertedSlot: 1 | 2 | null
  /** Lze kartu táhnout do slotu (zapalování musí být zapnuté). */
  draggable: boolean
  /** Volá se při začátku tažení. */
  onDragStart?: (e: React.DragEvent) => void
  /** Virtuální šablona. Určuje ukázkové údaje a obsah přetažení. */
  cardId?: 'zmizik' | 'novak'
  /** Hodnota přetažení, pokud to není šablona zmizik/novak. */
  dragValue?: string
  /** Údaje z výpisu. Když jsou předané, nenahrazují se ukázkovými hodnotami šablony. */
  birthDate?: string
  validityFrom?: string
  validityTo?: string
  authority?: string
  documentNumber?: string
  cardNumber?: string
  countryCode?: string
}

const DEFAULT_NAME = 'Jméno Příjmení'

/** Deterministic „náhodné“ datum narození podle cardId (stabilní mezi rendery). */
function getBirthDateForCard(cardId: 'zmizik' | 'novak'): string {
  const day = cardId === 'zmizik' ? 15 : 22
  const month = cardId === 'zmizik' ? 3 : 11
  const year = cardId === 'zmizik' ? 1985 : 1992
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}

/** Začátek a konec platnosti karty (platnost 5 let).
 *  Rok 2026 je prvním rokem platnosti a aktuální datum (2026) spadá dovnitř intervalu.
 *  Pro každou kartu je zvolen jiné (lépe „náhodné“) datum v roce 2026, ne 1.1.
 */
function getValidityDatesForCard(cardId: 'zmizik' | 'novak'): { from: string; to: string } {
  if (cardId === 'zmizik') {
    // Karta Lukáš: platnost 28.01.2026 – 28.01.2031
    return { from: '28.01.2026', to: '28.01.2031' }
  }
  // Karta Roman: platnost 06.02.2026 – 06.02.2031
  return { from: '06.02.2026', to: '06.02.2031' }
}

function shown(value: string | undefined, fallback: string): string {
  const text = value?.trim()
  return text ? text : fallback
}

export function DriverCardVisual({
  data,
  insertedSlot,
  draggable,
  onDragStart,
  cardId,
  dragValue,
  birthDate: birthDateProp,
  validityFrom,
  validityTo,
  authority,
  documentNumber,
  cardNumber,
  countryCode,
}: DriverCardVisualProps) {
  const displayName = data?.name ?? DEFAULT_NAME
  const isInserted = insertedSlot !== null
  const usesTemplateDefaults = cardId != null && birthDateProp == null && validityFrom == null && cardNumber == null

  const birthDate = useMemo(() => {
    if (!usesTemplateDefaults) return shown(birthDateProp, '—')
    return cardId ? getBirthDateForCard(cardId) : '—'
  }, [usesTemplateDefaults, birthDateProp, cardId])
  const validity = useMemo(() => {
    if (!usesTemplateDefaults) return { from: shown(validityFrom, '—'), to: shown(validityTo, '—') }
    const defaults = cardId ? getValidityDatesForCard(cardId) : { from: '—', to: '—' }
    return { ...defaults, to: validityTo ?? defaults.to }
  }, [usesTemplateDefaults, validityFrom, validityTo, cardId])
  const country = shown(countryCode, 'CZ')
  const authorityText = usesTemplateDefaults ? 'Ministerstvo dopravy' : shown(authority, '—')
  const documentText = usesTemplateDefaults ? 'XX 000000' : shown(documentNumber, '—')
  const cardNumberText = usesTemplateDefaults ? '0000000000000000' : shown(cardNumber, '—')

  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable || isInserted) return
    const payload = dragValue ?? cardId
    if (!payload) return
    e.dataTransfer.setData('card', payload)
    e.dataTransfer.setData('text/plain', payload)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(e)
  }

  return (
    <div
      className={`driver-card-visual-wrapper ${draggable && !isInserted ? 'driver-card-visual-wrapper--draggable' : ''} ${isInserted ? 'driver-card-visual-wrapper--inserted' : ''}`}
      draggable={draggable && !isInserted}
      onDragStart={handleDragStart}
    >
      {isInserted ? (
        <div className="driver-card-visual driver-card-visual--inserted-placeholder" aria-hidden="true">
          <span className="driver-card-visual-wrapper__slot-badge driver-card-visual-wrapper__slot-badge--on-placeholder">Slot {insertedSlot}</span>
        </div>
      ) : (
        <>
          <div className="driver-card-visual">
        <div className="driver-card-visual__eu">
          <div className="driver-card-visual__eu-stars" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className="driver-card-visual__eu-star"
                style={{
                  transform: `rotate(${i * 30}deg) translateY(-1.2em)`,
                }}
              />
            ))}
          </div>
          <span className="driver-card-visual__eu-cz">{country}</span>
        </div>
        <span className="driver-card-visual__cz-corner">{country}</span>
        <h2 className="driver-card-visual__title">KARTA ŘIDIČE</h2>
        <div className="driver-card-visual__photo">
          <span className="driver-card-visual__person-icon" aria-hidden="true">
            <span className="driver-card-visual__person-head" />
            <span className="driver-card-visual__person-body" />
          </span>
        </div>
        <div className="driver-card-visual__body">
          <div className="driver-card-visual__field" data-card-field="name">{displayName}</div>
          <div className="driver-card-visual__field" data-card-field="birth">{birthDate}</div>
          <div className="driver-card-visual__field driver-card-visual__field--dates">
            <span data-card-field="valid-from">{validity.from}</span>
            <span data-card-field="valid-to">{validity.to}</span>
          </div>
          <div className="driver-card-visual__field" data-card-field="authority">{authorityText}</div>
          <div className="driver-card-visual__field driver-card-visual__field--mono" data-card-field="document">{documentText}</div>
          <div className="driver-card-visual__field driver-card-visual__field--mono" data-card-field="number">{cardNumberText}</div>
        </div>
        <div className="driver-card-visual__decoration" aria-hidden="true" />
        <div className="driver-card-visual__signature">Podpis</div>
        <span className="driver-card-visual__g2">G2</span>
      </div>
        </>
      )}
    </div>
  )
}
