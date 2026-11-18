import { useState } from 'react'
import { TEST_CARDS } from './TachoTypes'
import type { SupportedLanguage } from './translations/types'

type CardId = keyof typeof TEST_CARDS
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
  cs: { empty: 'Nepoužitá karta', week: 'Karta s modelovým týdnem', confirm: 'Připravit kartu? Přepíše historii vybrané karty.', done: 'Karta připravena.' },
  en: { empty: 'Unused card', week: 'Card with a sample week', confirm: 'Prepare the card? This replaces the selected card’s history.', done: 'Card prepared.' },
  ru: { empty: 'Неиспользованная карта', week: 'Карта с примером недели', confirm: 'Подготовить карту? История выбранной карты будет заменена.', done: 'Карта подготовлена.' },
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
  onPrepare: (cardId: CardId, withWeek: boolean) => void
  insertedIds: (CardId | undefined)[]
}) {
  const [draft, setDraft] = useState(names)
  const [status, setStatus] = useState('')
  const copy = labels[language]

  const preparation = preparationLabels[language]
  const prepare = (id: CardId, withWeek: boolean) => {
    if (!window.confirm(preparation.confirm)) return
    onPrepare(id, withWeek)
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
          <button type="button" disabled={insertedIds.includes(cardId)} onClick={() => prepare(cardId, false)}>{preparation.empty}</button>
          <button type="button" disabled={insertedIds.includes(cardId)} onClick={() => prepare(cardId, true)}>{preparation.week}</button>
          </div>
        ))}
        <button type="submit">{copy.save}</button>
        <span role="status">{status}</span>
      </fieldset>
    </form>
  )
}
