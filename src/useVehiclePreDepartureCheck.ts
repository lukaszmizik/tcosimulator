import { useEffect, useRef, useState } from 'react'
import { insertedCardId } from './applyTimeJump'
import type { CardData, ManualEntrySegment, SecondActivitySnapshot } from './TachoTypes'
import { NO_CARD } from './TachoTypes'
import { evaluatePreDepartureWork, type VehicleCheckResult } from './vehiclePreDepartureCheck'

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
  secondHistory: SecondActivitySnapshot[]
}): VehicleCheckResult {
  const wasDrivingRef = useRef(false)
  const [checked, setChecked] = useState<{ card: CardData; result: VehicleCheckResult } | null>(null)

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
    const result = evaluatePreDepartureWork(cardId, insertedAtUtc, simulatedUtcTime, manualEntries, secondHistory)
    setChecked({ card, result })
  }, [card, checked, driverCardWizardOpen, insertedAtUtc, isDriving, manualEntries, secondHistory, simulatedUtcTime])

  return card && checked?.card === card && !driverCardWizardOpen ? checked.result : 'none'
}
