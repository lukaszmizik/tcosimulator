import { useState } from 'react'
import { TEST_CARDS } from './TachoTypes'
import type { SupportedLanguage } from './translations/types'

type CardId = keyof typeof TEST_CARDS
export type TrainingProfile = 'empty' | 'week' | 'expiring'
type CardNames = Record<CardId, string>

const STORAGE_KEY = 'tcosimulator.virtualCardNames'
const CARD_IDS = ['zmizik', 'novak'] as const
const MAX_NAME_LENGTH = 64
const labels = {
  cs: { title: 'Jména virtuálních karet', card: 'Karta', save: 'Uložit jména', saved: 'Jména uložena.', error: 'Jména se nepodařilo uložit do prohlížeče.' },
  en: { title: 'Virtual card names', card: 'Card', save: 'Save names', saved: 'Names saved.', error: 'Could not save names in this browser.' },
  ru: { title: 'Имена виртуальных карт', card: 'Карта', save: 'Сохранить имена', saved: 'Имена сохранены.', error: 'Не удалось сохранить имена в браузере.' },
}

const preparationLabels = {
  cs: { empty: 'Nepoužitá karta', expiring: 'Karta s končící platností', select: 'Připravit kartu…', expiryConfirm: 'Nastavit konec platnosti za 7 simulovaných dní? Historie karty zůstane zachována.', week: 'Karta s modelovým týdnem', confirm: 'Připravit kartu? Přepíše historii vybrané karty.', done: 'Karta připravena.' },
  en: { empty: 'Unused card', expiring: 'Card nearing expiry', select: 'Prepare card…', expiryConfirm: 'Set expiry to 7 simulated days from now? Card history will be kept.', week: 'Card with a sample week', confirm: 'Prepare the card? This replaces the selected card’s history.', done: 'Card prepared.' },
  ru: { empty: 'Неиспользованная карта', expiring: 'Карта с истекающим сроком', select: 'Подготовить карту…', expiryConfirm: 'Установить срок действия ещё на 7 дней симуляции? История карты сохранится.', week: 'Карта с примером недели', confirm: 'Подготовить карту? История выбранной карты будет заменена.', done: 'Карта подготовлена.' },
}

function normalizeName(value: unknown, cardId: CardId): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH).trimEnd() : ''
  return name || TEST_CARDS[cardId].name
}

export function loadVirtualCardNames(): CardNames {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return { zmizik: normalizeName(saved?.zmizik, 'zmizik'), novak: normalizeName(saved?.novak, 'novak') }
  } catch {
    return { zmizik: TEST_CARDS.zmizik.name, novak: TEST_CARDS.novak.name }
  }
}

export function virtualCardTemplate(cardId: CardId, names: CardNames) {
  const name = names[cardId]
  return { ...TEST_CARDS[cardId], name, surname: name.slice(name.lastIndexOf(' ') + 1) }
}

export function VirtualCardNameSettings({ names, onSave, language, onPrepare, insertedIds }: {
  names: CardNames
  onSave: (names: CardNames) => void
  language: SupportedLanguage
  onPrepare: (cardId: CardId, profile: TrainingProfile) => void
  insertedIds: (CardId | undefined)[]
}) {
  const [draft, setDraft] = useState(names)
  const [status, setStatus] = useState('')
  const copy = labels[language]

  const preparation = preparationLabels[language]
  const prepare = (id: CardId, profile: TrainingProfile) => {
    if (!window.confirm(profile === 'expiring' ? preparation.expiryConfirm : preparation.confirm)) return
    onPrepare(id, profile)
    setStatus(preparation.done)
  }

  return (
    <form className="virtual-card-names" onSubmit={(event) => {
      event.preventDefault()
      const next = { zmizik: normalizeName(draft.zmizik, 'zmizik'), novak: normalizeName(draft.novak, 'novak') }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        setStatus(copy.error)
        return
      }
      onSave(next)
      setDraft(next)
      setStatus(copy.saved)
    }}>
      <fieldset>
        <legend>{copy.title}</legend>
        {CARD_IDS.map((cardId, index) => (
          <div key={cardId}>
          <label>
            {copy.card} {index + 1}
            <input
              type="text"
              maxLength={MAX_NAME_LENGTH}
              value={draft[cardId]}
              placeholder={TEST_CARDS[cardId].name}
              onChange={(event) => {
                const name = event.target.value
                setDraft((previous) => ({ ...previous, [cardId]: name }))
                setStatus('')
              }}
            />
          </label>
          <select value="" aria-label={`${copy.card} ${index + 1} · ${preparation.select}`}
            disabled={insertedIds.includes(cardId)}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'empty' || value === 'week' || value === 'expiring') prepare(cardId, value)
            }}>
            <option value="" disabled>{preparation.select}</option>
            <option value="empty">{preparation.empty}</option>
            <option value="week">{preparation.week}</option>
            <option value="expiring">{preparation.expiring}</option>
          </select>
          </div>
        ))}
        <button type="submit">{copy.save}</button>
        <span role="status">{status}</span>
      </fieldset>
    </form>
  )
}
