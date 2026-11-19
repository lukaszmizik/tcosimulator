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
  driverState: DroppedCardDriverState | undefined
}

export function buildDroppedCardData(input: BuildDroppedCardDataInput): CardData {
  const {
    cardId,
    template,
    card1StoredLastWithdrawal,
    card2StoredLastWithdrawal,
    driverState,
  } = input

  const lastWithdrawal = cardId === 'zmizik' ? card1StoredLastWithdrawal : card2StoredLastWithdrawal

  return {
    ...template,
    lastWithdrawal,
    templateId: cardId,
    isFirstInsertion: driverState?.isFirstInsertion ?? true,
    itsConsent: driverState?.itsConsent,
    vdoConsent: driverState?.vdoConsent,
  }
}
