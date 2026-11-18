import { UTC_PAGE, LANGUAGE_PAGE, MAIN_MENU_PAGE } from './firstLevelDisplay'
import type { DrivingBreakDisplay } from './drivingBreakDisplay'

/**
 * Nový Counter pro jednoho řidiče, pro dvě karty bez osádky a pro osádku zapnutou dvěma kartami.
 * Podmínky zapnutí a přerušení osádky se nemění.
 * Trajekt používá dvouřádkový Counter. Pojmenované obrazovky a časy karty zůstávají zavřené.
 * OUT používá nový Counter. Jízda v doloženém OUT se jako jiná práce vyhodnotí dřív, než sem intervaly přijdou.
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

/** Přehled za jízdy, počitadlo pracovní doby, časy karty, VDO24h, týdenní hodnoty a VDOi. Hlavní Counter je obrazovka bez názvu. */
export type VdoNamedScreen = 'driveRest' | 'workTime' | 'vdoCard' | 'vdo24h' | 'vdoWeek' | 'vdoi'

export type TimesLocation =
  | { kind: 'standard' }
  | { kind: 'driveRest' }
  | { kind: 'card'; slot: 1 | 2 }
  | { kind: 'counter'; slot: 1 | 2 }
  | { kind: 'workTime' }
  | { kind: 'vdo24h'; slot: 1 | 2 }
  | { kind: 'vdoWeek'; slot: 1 | 2 }
  | { kind: 'vdoi'; slot: 1 | 2 }
  | { kind: 'info'; index: number }

/**
 * Za jízdy: přehled řízení a odpočinku, hlavní Counter a počitadlo pracovní doby.
 * Při stání: časy každé šachty zvlášť, potom Counter a při jiné práci nebo pohotovosti VDO24h, týden a VDOi.
 * Trajekt časy karet neotvírá.
 */
export function buildTimesSequence(input: {
  moving: boolean
  card1: boolean
  card2: boolean
  counterOn: boolean
  ferry: boolean
  entry: { 1: boolean; 2: boolean }
}): TimesLocation[] {
  const slots: Array<1 | 2> = []
  if (input.card1) slots.push(1)
  if (input.card2) slots.push(2)
  if (input.moving) {
    const steps: TimesLocation[] = [{ kind: 'driveRest' }]
    if (input.counterOn && slots[0]) steps.push({ kind: 'counter', slot: slots[0] }, { kind: 'workTime' })
    return steps
  }
  const steps: TimesLocation[] = []
  if (!input.ferry) {
    for (const slot of slots) steps.push({ kind: 'card', slot })
  }
  if (input.counterOn) {
    for (const slot of slots) {
      steps.push({ kind: 'counter', slot })
      if (input.entry[slot]) {
        steps.push({ kind: 'vdo24h', slot }, { kind: 'vdoWeek', slot }, { kind: 'vdoi', slot })
      }
    }
  }
  for (const index of [UTC_PAGE, LANGUAGE_PAGE, MAIN_MENU_PAGE]) steps.push({ kind: 'info', index })
  return steps
}

export function timesLocationFrom(active: boolean, named: VdoNamedScreen | null, index: number): TimesLocation {
  if (!active) return { kind: 'standard' }
  const slot: 1 | 2 = index === 1 ? 2 : 1
  if (named === 'driveRest') return { kind: 'driveRest' }
  if (named === 'workTime') return { kind: 'workTime' }
  if (named === 'vdoCard') return { kind: 'card', slot }
  if (named === 'vdo24h') return { kind: 'vdo24h', slot }
  if (named === 'vdoWeek') return { kind: 'vdoWeek', slot }
  if (named === 'vdoi') return { kind: 'vdoi', slot }
  if (index >= 2) return { kind: 'info', index }
  return { kind: 'counter', slot }
}

function sameTimesLocation(a: TimesLocation, b: TimesLocation): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'card' || a.kind === 'counter' || a.kind === 'vdo24h' || a.kind === 'vdoWeek' || a.kind === 'vdoi') {
    return b.kind === a.kind && a.slot === b.slot
  }
  if (a.kind === 'info') return b.kind === 'info' && a.index === b.index
  return true
}

/** Další nebo předchozí provozní obrazovka. Ze standardní obrazovky nahoru nikam neodchází. */
export function stepTimesLocation(
  current: TimesLocation,
  direction: 'down' | 'up',
  sequence: TimesLocation[],
): TimesLocation {
  if (current.kind === 'standard') {
    if (direction === 'down' && sequence.length > 0) return sequence[0]
    return current
  }
  const index = sequence.findIndex((item) => sameTimesLocation(item, current))
  if (index < 0) {
    if (direction === 'up' || sequence.length === 0) return { kind: 'standard' }
    return sequence[0]
  }
  if (direction === 'down') return sequence[Math.min(sequence.length - 1, index + 1)]
  if (index === 0) return { kind: 'standard' }
  return sequence[index - 1]
}

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
 * Běžný režim, OUT a trajekt s kartou ve čtené šachtě.
 * Index 0 bez karty 1 nečte kartu 2: otevřený Counter na ni přejde změnou indexu.
 */
export function normalInsertedCardCounter(input: Slot1DddCounterContext): boolean {
  if (!input.vdoCounterActive) return false
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
 * Trajekt kartu časů neotvírá. OUT používá stejný průchod jako běžný režim.
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
