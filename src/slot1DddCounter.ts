import type { DrivingBreakDisplay } from './drivingBreakDisplay'

/**
 * Nový Counter pro jednoho řidiče, pro dvě karty bez osádky a pro osádku zapnutou dvěma kartami.
 * Podmínky zapnutí a přerušení osádky se nemění. Trajekt a OUT zůstávají na původní větvi.
 * Rozdíl karet je v přípravě intervalů, ne v těchto podmínkách.
 */
export type Slot1DddCounterContext = {
  vdoCounterActive: boolean
  operatingScreenIndex: number
  card1Inserted: boolean
  isMultiManning: boolean
  ferryTrainModeActive: boolean
  outModeActive: boolean
  templateId?: string | null
  cardNumber?: string | null
  card2Inserted?: boolean
  slot2TemplateId?: string | null
  slot2CardNumber?: string | null
}

/** Prozatímní obrazovky simulátoru: časy karty, VDO24h, týdenní hodnoty, VDOi. Hlavní Counter je výchozí obrazovka. */
export type VdoNamedScreen = 'vdoCard' | 'vdo24h' | 'vdoWeek' | 'vdoi'

export function slot1DddCounterSelected(input: Slot1DddCounterContext): boolean {
  if (!input.vdoCounterActive || input.operatingScreenIndex !== 0 || !input.card1Inserted) return false
  if (input.isMultiManning || input.ferryTrainModeActive || input.outModeActive) return false
  return Boolean(input.templateId || input.cardNumber)
}

/** Jen šachta 2, šachta 1 prázdná, osádka vypnutá. Obrazovka Counteru má index 1. */
export function slot2OnlyCounterSelected(input: Slot1DddCounterContext): boolean {
  if (!input.vdoCounterActive || input.operatingScreenIndex !== 1 || input.card1Inserted || !input.card2Inserted) return false
  if (input.isMultiManning || input.ferryTrainModeActive || input.outModeActive) return false
  return Boolean(input.slot2TemplateId || input.slot2CardNumber)
}

export function singleDriverCounterSelected(input: Slot1DddCounterContext): boolean {
  return slot1DddCounterSelected(input) || slot2OnlyCounterSelected(input)
}

/**
 * Otevřený Counter na šachtě 1 po jejím vysunutí přejde na zbývající kartu ve šachtě 2.
 * Vysunutí šachty 2 index nemění: obrazovka se vrací na řidiče 1.
 */
export function counterIndexAfterCardRemoval(input: {
  index: number
  card1Inserted: boolean
  card2Inserted: boolean
}): number {
  if (input.index === 0 && !input.card1Inserted && input.card2Inserted) return 1
  return input.index
}

/**
 * Stejná volba řidiče jako na Counteru.
 * Index 0 je šachta 1. Index 1 je šachta 2, dokud v ní karta je; po vysunutí se vrací šachta 1.
 */
export function counterCardSlot(index: number, card1Inserted: boolean, card2Inserted: boolean): 1 | 2 | null {
  if (index === 0) return card1Inserted ? 1 : null
  if (index === 1 && card2Inserted) return 2
  if (index === 1 && card1Inserted) return 1
  return null
}

/** Index 1 po vysunutí šachty 2 ukazuje řidiče 1, ne staré hodnoty vysunuté karty. */
function slot2EjectShowsCard1(input: Slot1DddCounterContext): boolean {
  if (!input.vdoCounterActive || input.isMultiManning || input.ferryTrainModeActive || input.outModeActive) return false
  if (input.operatingScreenIndex !== 1 || input.card2Inserted || !input.card1Inserted) return false
  return Boolean(input.templateId || input.cardNumber)
}

/** Obě karty a vypnutá osádka. Každý index čte jen kartu své šachty. */
export function crewOffPairCounterSelected(input: Slot1DddCounterContext): boolean {
  if (!input.vdoCounterActive || input.isMultiManning || input.ferryTrainModeActive || input.outModeActive) return false
  if (!input.card1Inserted || !input.card2Inserted) return false
  if (input.operatingScreenIndex !== 0 && input.operatingScreenIndex !== 1) return false
  const slot = counterCardSlot(input.operatingScreenIndex, true, true)
  if (slot === 1) return Boolean(input.templateId || input.cardNumber)
  return Boolean(input.slot2TemplateId || input.slot2CardNumber)
}

/** Obě karty a zapnutá osádka. Každý index čte jen kartu své šachty. */
export function crewPairCounterSelected(input: Slot1DddCounterContext): boolean {
  if (!input.vdoCounterActive || !input.isMultiManning || input.ferryTrainModeActive || input.outModeActive) return false
  if (!input.card1Inserted || !input.card2Inserted) return false
  if (input.operatingScreenIndex !== 0 && input.operatingScreenIndex !== 1) return false
  const slot = counterCardSlot(input.operatingScreenIndex, true, true)
  if (slot === 1) return Boolean(input.templateId || input.cardNumber)
  return Boolean(input.slot2TemplateId || input.slot2CardNumber)
}

export type Slot1CounterLcdProps = {
  slot1DebugBreak: DrivingBreakDisplay | null
  slot1DebugDailyRemainingMs: number | null | undefined
  slot1DebugWeeklyRemainingMs: number | null | undefined
  slot1DebugFortnightRemainingMs: number | null | undefined
  slot1DebugFortnightSumMs: number | null | undefined
  /** Zbývající prodloužení na 10 h. null je neurčené, 0 je skutečná nula. */
  slot1DebugDailyExtensionsRemaining: number | null | undefined
/**
 * Jiná práce ve směně. null je při osádce neurčené, protože směna osádky nemá ověřený výpočet.
 * undefined v běžném režimu pořád použije původní součet směny.
 */
  slot1DebugOtherWorkMs: number | null | undefined
}

/**
 * Běžný režim s kartou ve čtené šachtě. Trajekt a OUT sem nepatří.
 * Index 0 bez karty 1 nečte kartu 2: otevřený Counter na ni přejde změnou indexu.
 */
export function normalInsertedCardCounter(input: Slot1DddCounterContext): boolean {
  if (!input.vdoCounterActive || input.ferryTrainModeActive || input.outModeActive) return false
  if (input.operatingScreenIndex === 0) return input.card1Inserted
  if (input.operatingScreenIndex === 1) return Boolean(input.card2Inserted || input.card1Inserted)
  return false
}

/** Po vysunutí poslední karty se Counter zavře a neukáže předchozí hodnoty. */
export function vdoCounterClosesWithoutCard(card1Inserted: boolean, card2Inserted: boolean): boolean {
  return !card1Inserted && !card2Inserted
}

/** Nový výpočet jde na LCD i bez diagnostiky. Chybějící údaj je null, ne původní vzorec. */
export function slot1CounterLcdProps(input: {
  diagnostics: boolean
  context: Slot1DddCounterContext
  dddBreak: DrivingBreakDisplay | null
  daily: { remainingMs: number | null; extensionsRemaining: number | null } | null
  calendar: {
    weeklyRemainingMs: number | null
    fortnightRemainingMs: number | null
    fortnightSumMs: number | null
  } | null
  virtualDebugBreak: DrivingBreakDisplay | null
}): Slot1CounterLcdProps {
  if (normalInsertedCardCounter(input.context)) {
    return {
      slot1DebugBreak: input.dddBreak,
      slot1DebugDailyRemainingMs: input.daily ? input.daily.remainingMs : null,
      slot1DebugWeeklyRemainingMs: input.calendar ? input.calendar.weeklyRemainingMs : null,
      slot1DebugFortnightRemainingMs: input.calendar ? input.calendar.fortnightRemainingMs : null,
      slot1DebugFortnightSumMs: input.calendar ? input.calendar.fortnightSumMs : null,
      slot1DebugDailyExtensionsRemaining: input.daily ? input.daily.extensionsRemaining : null,
      slot1DebugOtherWorkMs: input.context.isMultiManning ? null : undefined,
    }
  }
  if (input.diagnostics && input.virtualDebugBreak) {
    return {
      slot1DebugBreak: input.virtualDebugBreak,
      slot1DebugDailyRemainingMs: undefined,
      slot1DebugWeeklyRemainingMs: undefined,
      slot1DebugFortnightRemainingMs: undefined,
      slot1DebugFortnightSumMs: undefined,
      slot1DebugDailyExtensionsRemaining: undefined,
      slot1DebugOtherWorkMs: undefined,
    }
  }
  return {
    slot1DebugBreak: null,
    slot1DebugDailyRemainingMs: undefined,
    slot1DebugWeeklyRemainingMs: undefined,
    slot1DebugFortnightRemainingMs: undefined,
    slot1DebugFortnightSumMs: undefined,
    slot1DebugDailyExtensionsRemaining: undefined,
    slot1DebugOtherWorkMs: undefined,
  }
}

/** Dolů na VDO24h při stání a jiné práci nebo pohotovosti. U šachty 2 se čte pravá činnost. */
export function vdo24hEntryAvailable(input: Slot1DddCounterContext & {
  card2Inserted: boolean
  speed: number
  leftActivityId: string
  rightActivityId?: string
}): boolean {
  if (input.speed !== 0) return false
  const standing = (activity: string | undefined) => activity === 'WORK' || activity === 'AVAILABILITY'
  if (slot2OnlyCounterSelected({ ...input, card2Inserted: input.card2Inserted })) return standing(input.rightActivityId)
  if (slot2EjectShowsCard1(input)) return standing(input.leftActivityId)
  if (crewOffPairCounterSelected(input) || crewPairCounterSelected(input)) {
    const slot = counterCardSlot(input.operatingScreenIndex, input.card1Inserted, input.card2Inserted)
    return standing(slot === 2 ? input.rightActivityId : input.leftActivityId)
  }
  if (slot1DddCounterSelected(input) && !input.card2Inserted) return standing(input.leftActivityId)
  return false
}

/**
 * Další obrazovka. V běžném režimu je mezi Counterem a VDO24h obrazovka časů karty.
 * index znamená posun číselného indexu a nemění se při čtení časů vybrané karty.
 * Trajekt a OUT kartu časů neotvírají.
 */
export function vdoScreenAfterDown(current: VdoNamedScreen | null, entryAvailable: boolean, cardTimes = false): VdoNamedScreen | 'index' {
  if (current === 'vdoi') return 'vdoi'
  if (current === 'vdoWeek') return entryAvailable ? 'vdoi' : 'vdoWeek'
  if (current === 'vdo24h') return entryAvailable ? 'vdoWeek' : 'vdo24h'
  if (current === 'vdoCard') return entryAvailable ? 'vdo24h' : 'vdoCard'
  if (cardTimes) return 'vdoCard'
  return entryAvailable ? 'vdo24h' : 'index'
}

/** Předchozí obrazovka. null je hlavní Counter, index je posun číselného indexu. */
export function vdoScreenAfterUp(current: VdoNamedScreen | null, cardTimes = false): VdoNamedScreen | null | 'index' {
  if (current === 'vdoi') return 'vdoWeek'
  if (current === 'vdoWeek') return 'vdo24h'
  if (current === 'vdo24h') return cardTimes ? 'vdoCard' : null
  if (current === 'vdoCard') return null
  return 'index'
}
