/**
 * Sestavení CardData při vložení šablony zmizik nebo novak.
 * Uložené vyjmutí patří identitě karty. U starší nepřipravené šablony zůstává výchozí čas.
 */

import { FIRST_INSERTION_OFFSET_MS } from './Constants'
import type { CardData } from './TachoTypes'

export type DroppedCardDriverState = {
  isFirstInsertion?: boolean
  itsConsent?: boolean
  vdoConsent?: boolean
}

export type BuildDroppedCardDataInput = {
  cardId: 'zmizik' | 'novak'
  template: CardData
  card1StoredLastWithdrawal: number | null
  card2StoredLastWithdrawal: number | null
  /** Okamžik, který handler dřív četl jako new Date() pro výchozí vyjmutí. */
  now: Date
  prepared?: boolean
  driverState: DroppedCardDriverState | undefined
}

export function buildDroppedCardData(input: BuildDroppedCardDataInput): CardData {
  const {
    cardId,
    template,
    card1StoredLastWithdrawal,
    card2StoredLastWithdrawal,
    now,
    prepared,
    driverState,
  } = input

  const templateId = cardId === 'zmizik' || cardId === 'novak' ? cardId : undefined
  let lastWithdrawal: number | null =
    templateId === 'zmizik'
      ? card1StoredLastWithdrawal
      : templateId === 'novak'
        ? card2StoredLastWithdrawal
        : null
  if (!prepared && lastWithdrawal == null && cardId === 'zmizik') {
    const raw = now.getTime() - FIRST_INSERTION_OFFSET_MS
    const d = new Date(raw)
    d.setSeconds(0, 0)
    lastWithdrawal = d.getTime()
  }

  return {
    ...template,
    lastWithdrawal,
    templateId,
    isFirstInsertion: driverState?.isFirstInsertion ?? true,
    itsConsent: driverState?.itsConsent,
    vdoConsent: driverState?.vdoConsent,
  }
}
