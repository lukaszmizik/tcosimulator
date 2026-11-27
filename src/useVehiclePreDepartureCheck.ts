import { useEffect, useRef, useState } from 'react'
import { insertedCardId } from './applyTimeJump'
import type { SecondSampleRead } from './secondHistoryBuffer'
import type { CardData, ManualEntrySegment } from './TachoTypes'
import { NO_CARD } from './TachoTypes'
import { evaluatePreDepartureWork, type PreDepartureCheck } from './vehiclePreDepartureCheck'

export function useVehiclePreDepartureCheck({
  card,
  insertedAtUtc,
  driverCardWizardOpen,
  isDriving,
  simulatedUtcTime,
  manualEntries,
  secondHistory,
}: {
  card: CardData | null
  insertedAtUtc: number
  driverCardWizardOpen: boolean
  isDriving: boolean
  simulatedUtcTime: number
  manualEntries: ManualEntrySegment[]
  secondHistory: SecondSampleRead
}): PreDepartureCheck {
  const wasDrivingRef = useRef(false)
  const [checked, setChecked] = useState<{ card: CardData; check: PreDepartureCheck } | null>(null)

  useEffect(() => {
    const startedDriving = isDriving && !wasDrivingRef.current
    wasDrivingRef.current = isDriving
    if (!card) {
      if (checked) setChecked(null)
      return
    }
    if (!startedDriving || driverCardWizardOpen || checked?.card === card) return

    const cardId = insertedCardId(true, card.cardNumber, card.templateId)
    if (cardId === NO_CARD) return
    const check = evaluatePreDepartureWork(cardId, insertedAtUtc, simulatedUtcTime, manualEntries, secondHistory)
    setChecked({ card, check })
  }, [card, checked, driverCardWizardOpen, insertedAtUtc, isDriving, manualEntries, secondHistory, simulatedUtcTime])

  return card && checked?.card === card && !driverCardWizardOpen ? checked.check : { result: 'none', workMs: 0 }
}
