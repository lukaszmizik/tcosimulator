/**
 * Cesta DDD karty ve šachtě 1: vložení, potvrzení ručního zadání, minuty, LCD.
 * Časy jsou pevné. Denní zbytek bere TachoDisplay ze společné activityHistory.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from '../src/translations/index.ts'
import { TachoDisplay } from '../src/TachoDisplay.tsx'
import {
  appendWorkingMinutes,
  assessDddInsertion,
  createDddCardRecord,
  replaceWorkingManual,
  type DddCardRecord,
} from '../src/dddCardSession.ts'
import { buildSlot1DddDrivingBreak, buildSlot1DddDrivingBreakIntervals } from '../src/slot1DddDrivingBreak.ts'
import { slot1DddCalendarRemaining, slot1DddDailyRemaining } from '../src/slot1DddDailyRemaining.ts'
import { slot1CounterLcdProps, slot1DddCounterSelected, type Slot1DddCounterContext } from '../src/slot1DddCounter.ts'
import type { DrivingBreakDisplay } from '../src/drivingBreakDisplay.ts'
import type { ActivityHistoryEntry, ActivityKind, ManualEntrySegment, TachoState } from '../src/TachoTypes.ts'
import type { DddParsedCard } from '../src/types/tachoViewerDddMapper.ts'

const MINUTE = 60_000
const T0 = Date.UTC(2026, 0, 7, 0, 0, 0)

function at(minute: number): number {
  return T0 + minute * MINUTE
}

function card(cardNumber: string, activities: DddParsedCard['activities']): DddParsedCard {
  return {
    cardNumber,
    firstName: 'A',
    surname: 'Test',
    lastWithdrawalUtc: T0,
    activities,
    locations: [],
  }
}

function restPoint(ms: number): ManualEntrySegment {
  const date = new Date(ms)
  return {
    activityId: 'REST',
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    isManualEntry: true,
  }
}

function minutes(startMinute: number, count: number, kind: ActivityKind): ActivityHistoryEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    minuteStartUtc: at(startMinute + index),
    driver1: kind,
    driver2: 'none',
  }))
}

function sharedDriving(startMs: number, count: number): ActivityHistoryEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    minuteStartUtc: startMs + index * MINUTE,
    driver1: 'driving',
    driver2: 'none',
  }))
}

const symbolMap = { 2: 'S', 7: 'X', 8: 'Y', 10: '[', 9: 'Z', 58: 'w' }

function lcdLine(input: {
  display: DrivingBreakDisplay | null
  activity: 'DRIVING' | 'REST'
  simulatedUtcTime: number
  activityHistory?: ActivityHistoryEntry[]
  drivingSinceLastBreakMs?: number
  dailyRemainingMs?: number | null
  weeklyRemainingMs?: number | null
  fortnightRemainingMs?: number | null
  fortnightSumMs?: number | null
  named?: 'vdoCard'
}): { text: string; second: string; icons: string; kind: string | null; drivingMs: string | null; breakMs: string | null; afterMs: string | null } {
  const tachoState: TachoState = {
    targetSpeed: input.activity === 'DRIVING' ? 80 : 0,
    currentSpeed: input.activity === 'DRIVING' ? 80 : 0,
    odometerKm: 0,
    ignitionOn: true,
    card1Inserted: true,
    card2Inserted: false,
    isMultiManning: false,
    leftActivityId: input.activity,
    rightActivityId: 'REST',
    companyCardInserted: false,
    controlCardInserted: false,
    optionalFeatureEnabled: false,
    vdoLinkConnected: false,
    ferryTrainModeActive: false,
    outModeActive: false,
  }
  const html = renderToStaticMarkup(
    <LanguageProvider>
      <TachoDisplay
        symbolMap={symbolMap}
        cardInsertionState={null}
        cardWithdrawalState={null}
        drivingWithoutCardWarningActive={false}
        drivingWithoutValidCardWarningActive={false}
        breakWarningActive={null}
        displayMode="operating"
        isBlinking={false}
        isMultiManning={false}
        timeStr="00:00"
        currentSpeed={tachoState.currentSpeed}
        odometerKm={0}
        ignitionOn
        ignitionWarningActive={false}
        card1Inserted
        card2Inserted={false}
        tachoState={tachoState}
        countries={[]}
        spanishRegions={[]}
        lastEjectionTimeBySlot={{ 1: null, 2: null }}
        localTime={new Date(input.simulatedUtcTime)}
        currentMenu={null}
        selectedItem={null}
        currentMenuId=""
        entryMenuId=""
        leftActivityId={input.activity}
        rightActivityId="REST"
        vdoCounterActive
        operatingScreenIndex={0}
        vdoNamedScreen={input.named ?? null}
        card1Data={{ cardNumber: 'A' }}
        simulatedUtcTime={input.simulatedUtcTime}
        activityHistory={input.activityHistory ?? []}
        drivingSinceLastBreakMsByDriver={{ 1: input.drivingSinceLastBreakMs ?? 0, 2: 0 }}
        slot1DebugBreak={input.display}
        slot1DebugDailyRemainingMs={input.dailyRemainingMs}
        slot1DebugWeeklyRemainingMs={input.weeklyRemainingMs}
        slot1DebugFortnightRemainingMs={input.fortnightRemainingMs}
        slot1DebugFortnightSumMs={input.fortnightSumMs}
      />
    </LanguageProvider>,
  )
  const rows = [...html.matchAll(/<div class="lcd-row lcd-row-vdo">([\s\S]*?)<\/div>/g)]
  const textOf = (row: string | undefined) => (row ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const row = rows[0]?.[1] ?? ''
  const text = textOf(row)
  const icons = [...row.matchAll(/tacho-icon[^>]*>([^<]*)</g)].map((match) => match[1]).join('')
  return {
    text,
    second: textOf(rows[1]?.[1]),
    icons,
    kind: html.match(/data-lcd-right-kind="([^"]*)"/)?.[1] ?? null,
    drivingMs: html.match(/data-lcd-driving-ms="([^"]*)"/)?.[1] ?? null,
    breakMs: html.match(/data-lcd-break-ms="([^"]*)"/)?.[1] ?? null,
    afterMs: html.match(/data-lcd-after-ms="([^"]*)"/)?.[1] ?? null,
  }
}

const dddContext: Slot1DddCounterContext = {
  vdoCounterActive: true,
  operatingScreenIndex: 0,
  card1Inserted: true,
  isMultiManning: false,
  ferryTrainModeActive: false,
  outModeActive: false,
  templateId: null,
  cardNumber: 'A',
}

function throughCounter(input: {
  display: DrivingBreakDisplay | null
  daily: { remainingMs: number | null } | null
  calendar: { weeklyRemainingMs: number | null; fortnightRemainingMs: number | null; fortnightSumMs: number | null } | null
  activity: 'DRIVING' | 'REST'
  simulatedUtcTime: number
  activityHistory?: ActivityHistoryEntry[]
  drivingSinceLastBreakMs?: number
  diagnostics: boolean
  context?: Slot1DddCounterContext
  virtualDebugBreak?: DrivingBreakDisplay | null
  named?: 'vdoCard'
}) {
  const props = slot1CounterLcdProps({
    diagnostics: input.diagnostics,
    context: input.context ?? dddContext,
    dddBreak: input.display,
    daily: input.daily,
    calendar: input.calendar,
    virtualDebugBreak: input.virtualDebugBreak ?? null,
  })
  return lcdLine({
    display: props.slot1DebugBreak,
    activity: input.activity,
    simulatedUtcTime: input.simulatedUtcTime,
    activityHistory: input.activityHistory,
    drivingSinceLastBreakMs: input.drivingSinceLastBreakMs,
    dailyRemainingMs: props.slot1DebugDailyRemainingMs,
    weeklyRemainingMs: props.slot1DebugWeeklyRemainingMs,
    fortnightRemainingMs: props.slot1DebugFortnightRemainingMs,
    fortnightSumMs: props.slot1DebugFortnightSumMs,
    named: input.named,
  })
}

function expectLine(label: string, actual: string, expected: string) {
  if (actual !== expected) throw new Error(`${label}: LCD má „${actual}“, očekáváno „${expected}“`)
}

function inserted(record: DddCardRecord, nowMs: number) {
  const decision = assessDddInsertion({ record, simulatedNowMs: nowMs, otherSlotCardNumber: null })
  if (!decision.ok || decision.cardData.cardNumber !== record.cardNumber) {
    throw new Error('vložení DDD karty do šachty 1 neprošlo')
  }
  return decision
}

function shown(cards: Record<string, DddCardRecord>, cardNumber: string, nowMs: number) {
  const display = buildSlot1DddDrivingBreak({ cards, cardNumber, secondSamples: [], nowMs })
  const { intervals } = buildSlot1DddDrivingBreakIntervals({ cards, cardNumber, secondSamples: [], nowMs })
  return { display, daily: slot1DddDailyRemaining(intervals, nowMs) }
}

function span(kind: 'driving' | 'rest', startUtc: number, endUtc: number): DddParsedCard['activities'][number] {
  return { kind, startUtc, endUtc, slot: 1 }
}

const HOUR = 3_600_000

function driveChunks(startMs: number, totalMs: number) {
  const activities: DddParsedCard['activities'] = []
  let cursor = startMs
  let left = totalMs
  while (left > 0) {
    const piece = Math.min(4 * HOUR, left)
    activities.push(span('driving', cursor, cursor + piece))
    cursor += piece
    left -= piece
    if (left > 0) {
      activities.push(span('rest', cursor, cursor + 45 * MINUTE))
      cursor += 45 * MINUTE
    }
  }
  return { activities, endMs: cursor }
}

function withShortTail(startMs: number, bulkMs: number, shortMs: number) {
  const bulk = driveChunks(startMs, bulkMs)
  const restEnd = bulk.endMs + 11 * HOUR
  const nowMs = restEnd + shortMs
  return {
    activities: [...bulk.activities, span('rest', bulk.endMs, restEnd), span('driving', restEnd, nowMs)],
    nowMs,
  }
}

function fillGaps(activities: DddParsedCard['activities'], fromMs: number, toMs: number) {
  const sorted = [...activities].sort((left, right) => left.startUtc - right.startUtc || left.endUtc - right.endUtc)
  const closed: DddParsedCard['activities'] = []
  let cursor = fromMs
  for (const item of sorted) {
    if (item.endUtc <= fromMs || item.startUtc >= toMs) {
      closed.push(item)
      continue
    }
    const start = Math.max(item.startUtc, fromMs)
    if (start > cursor) closed.push(span('rest', cursor, start))
    closed.push(item)
    cursor = Math.max(cursor, item.endUtc)
  }
  if (cursor < toMs) closed.push(span('rest', cursor, toMs))
  return closed
}

function cutRange(activities: DddParsedCard['activities'], startMs: number, endMs: number, kind: 'unknown' | null) {
  const cut: DddParsedCard['activities'] = []
  for (const item of activities) {
    if (item.endUtc <= startMs || item.startUtc >= endMs) {
      cut.push(item)
      continue
    }
    if (item.startUtc < startMs) cut.push({ ...item, endUtc: startMs })
    if (kind === 'unknown') {
      cut.push({ kind: 'unknown', startUtc: Math.max(item.startUtc, startMs), endUtc: Math.min(item.endUtc, endMs), slot: 1 })
    }
    if (item.endUtc > endMs) cut.push({ ...item, startUtc: endMs })
  }
  return cut
}
function painted(
  activities: DddParsedCard['activities'],
  nowMs: number,
  activity: 'DRIVING' | 'REST',
  history: ActivityHistoryEntry[] = sharedDriving(Date.UTC(2026, 0, 5), 12 * 60),
) {
  const record = createDddCardRecord(card('A', activities))
  inserted(record, nowMs)
  const view = shown({ A: record }, 'A', nowMs)
  const { intervals } = buildSlot1DddDrivingBreakIntervals({
    cards: { A: record },
    cardNumber: 'A',
    secondSamples: [],
    nowMs,
  })
  const calendar = slot1DddCalendarRemaining(intervals, nowMs)
  return {
    view,
    calendar,
    lcd: lcdLine({
      display: view.display,
      activity,
      simulatedUtcTime: nowMs,
      dailyRemainingMs: view.daily.remainingMs,
      weeklyRemainingMs: calendar.weeklyRemainingMs,
      fortnightRemainingMs: calendar.fortnightRemainingMs,
      fortnightSumMs: calendar.fortnightSumMs,
      activityHistory: history,
    }),
    card: lcdLine({
      display: view.display,
      activity,
      simulatedUtcTime: nowMs,
      dailyRemainingMs: view.daily.remainingMs,
      weeklyRemainingMs: calendar.weeklyRemainingMs,
      fortnightRemainingMs: calendar.fortnightRemainingMs,
      fortnightSumMs: calendar.fortnightSumMs,
      activityHistory: history,
      named: 'vdoCard',
    }),
  }
}

function weekOnCard() {
  const hour = 3_600_000
  const monday = Date.UTC(2026, 0, 5)
  const tuesday = Date.UTC(2026, 0, 6)
  const mondayDriveEnd = monday + 9 * hour + MINUTE
  const mondayRestEnd = mondayDriveEnd + 11 * hour
  const tuesdayDriveEnd = tuesday + 9 * hour + MINUTE
  const tuesdayRestEnd = tuesdayDriveEnd + 11 * hour
  const prefix = [
    span('rest', Date.UTC(2026, 0, 4, 13, 0, 0), monday),
    span('driving', monday, mondayDriveEnd),
    span('rest', mondayDriveEnd, mondayRestEnd),
    span('driving', tuesday, tuesdayDriveEnd),
    span('rest', tuesdayDriveEnd, tuesdayRestEnd),
  ]
  const firstDriveEnd = Date.UTC(2026, 0, 7, 5, 30, 0)
  const secondDriveStart = Date.UTC(2026, 0, 7, 6, 15, 0)
  const eightEnd = Date.UTC(2026, 0, 7, 8, 45, 0)
  const eightHours = [
    ...prefix,
    span('driving', Date.UTC(2026, 0, 7), firstDriveEnd),
    span('rest', firstDriveEnd, secondDriveStart),
    span('driving', secondDriveStart, eightEnd),
  ]
  const nightStart = Date.UTC(2026, 0, 7, 22, 0, 0)
  const nightEnd = Date.UTC(2026, 0, 8, 3, 30, 0)
  const afterNight = Date.UTC(2026, 0, 8, 4, 15, 0)
  const midnightEnd = Date.UTC(2026, 0, 8, 6, 45, 0)
  const acrossMidnight = [
    ...prefix,
    span('driving', nightStart, nightEnd),
    span('rest', nightEnd, afterNight),
    span('driving', afterNight, midnightEnd),
  ]
  const dailyRestEnd = eightEnd + 11 * hour
  const afterDailyRest = [
    ...eightHours,
    span('rest', eightEnd, dailyRestEnd),
    span('driving', dailyRestEnd, dailyRestEnd + 150 * MINUTE),
  ]
  return { eightHours, acrossMidnight, afterDailyRest }
}

export function main() {
  const originalDriving = {
    kind: 'driving' as const,
    startUtc: at(0),
    endUtc: at(150),
    slot: 2 as const,
  }
  const parsed = card('A', [originalDriving])
  const record = createDddCardRecord(parsed)
  const other = createDddCardRecord(card('B', [{
    kind: 'driving',
    startUtc: at(0),
    endUtc: at(600),
    slot: 1,
  }]))
  let cards: Record<string, DddCardRecord> = { A: record, B: other }
  inserted(cards.A!, at(150))

  const after230 = shown(cards, 'A', at(150))
  const plain = lcdLine({
    display: after230.display,
    activity: 'DRIVING',
    simulatedUtcTime: at(150),
    dailyRemainingMs: after230.daily.remainingMs,
  })
  const withoutDebug = lcdLine({
    display: null,
    activity: 'DRIVING',
    simulatedUtcTime: at(150),
    drivingSinceLastBreakMs: 150 * MINUTE,
  })

  cards = replaceWorkingManual(cards, 'A', [restPoint(at(150)), restPoint(at(165))])
  if (cards.A!.workingManual.length !== 2 || cards.B!.workingManual.length !== 0) {
    throw new Error('potvrzené ruční zadání se neuložilo jen na vloženou kartu')
  }
  if (parsed.activities[0] !== originalDriving) throw new Error('původní výpis se změnil')

  cards = appendWorkingMinutes(cards, 'A', [
    ...minutes(165, 120, 'driving'),
    ...minutes(285, 10, 'rest'),
  ])
  const duringTen = shown(cards, 'A', at(295))
  const ten = lcdLine({
    display: duringTen.display,
    activity: 'REST',
    simulatedUtcTime: at(295),
    dailyRemainingMs: duringTen.daily.remainingMs,
  })
  const tenCalendar = slot1DddCalendarRemaining(
    buildSlot1DddDrivingBreakIntervals({ cards, cardNumber: 'A', secondSamples: [], nowMs: at(295) }).intervals,
    at(295),
  )
  const manualOff = throughCounter({
    display: duringTen.display,
    daily: duringTen.daily,
    calendar: tenCalendar,
    activity: 'REST',
    simulatedUtcTime: at(295),
    diagnostics: false,
  })
  const manualOn = throughCounter({
    display: duringTen.display,
    daily: duringTen.daily,
    calendar: tenCalendar,
    activity: 'REST',
    simulatedUtcTime: at(295),
    diagnostics: true,
  })

  cards = appendWorkingMinutes(cards, 'A', minutes(295, 20, 'rest'))
  const afterThirty = shown(cards, 'A', at(315))
  const done = lcdLine({
    display: afterThirty.display,
    activity: 'REST',
    simulatedUtcTime: at(315),
    dailyRemainingMs: afterThirty.daily.remainingMs,
    activityHistory: [
      ...sharedDriving(Date.UTC(2026, 0, 5), 9 * 60 + 1),
      ...sharedDriving(Date.UTC(2026, 0, 6), 9 * 60 + 1),
      ...sharedDriving(T0, 10 * 60),
    ],
  })

  const week = weekOnCard()
  const dailyNow = Date.UTC(2026, 0, 7, 8, 45, 0)
  const dailyCard = createDddCardRecord(card('A', week.eightHours))
  inserted(dailyCard, dailyNow)
  const dailyShown = shown({ A: dailyCard }, 'A', dailyNow)
  const foreignHistory = [
    ...sharedDriving(Date.UTC(2026, 0, 5), 9 * 60 + 1),
    ...sharedDriving(Date.UTC(2026, 0, 6), 9 * 60 + 1),
    ...sharedDriving(Date.UTC(2026, 0, 7), 8 * 60 + 45),
  ]
  const dailyInput = {
    display: dailyShown.display,
    activity: 'DRIVING' as const,
    simulatedUtcTime: dailyNow,
    dailyRemainingMs: dailyShown.daily.remainingMs,
  }
  const daily = lcdLine(dailyInput)
  const dailyForeign = lcdLine({ ...dailyInput, activityHistory: foreignHistory })

  const midnightNow = Date.UTC(2026, 0, 8, 6, 45, 0)
  const midnightCard = createDddCardRecord(card('A', week.acrossMidnight))
  inserted(midnightCard, midnightNow)
  const midnightShown = shown({ A: midnightCard }, 'A', midnightNow)
  const midnight = lcdLine({
    display: midnightShown.display,
    activity: 'DRIVING',
    simulatedUtcTime: midnightNow,
    dailyRemainingMs: midnightShown.daily.remainingMs,
    activityHistory: foreignHistory,
  })

  const separatedNow = Date.UTC(2026, 0, 7, 22, 15, 0)
  const separatedCard = createDddCardRecord(card('A', week.afterDailyRest))
  inserted(separatedCard, separatedNow)
  const separatedShown = shown({ A: separatedCard }, 'A', separatedNow)
  const separated = lcdLine({
    display: separatedShown.display,
    activity: 'DRIVING',
    simulatedUtcTime: separatedNow,
    dailyRemainingMs: separatedShown.daily.remainingMs,
    activityHistory: foreignHistory,
  })

  const week55 = withShortTail(Date.UTC(2026, 0, 12), 54 * HOUR + 30 * MINUTE, 30 * MINUTE)
  const fiftyFive = painted(
    fillGaps([...driveChunks(Date.UTC(2026, 0, 5), HOUR).activities, ...week55.activities], Date.UTC(2026, 0, 5), week55.nowMs),
    week55.nowMs,
    'DRIVING',
  )

  const fortnightTail = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const fortnightBase = fillGaps([
    ...driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR).activities,
    ...fortnightTail.activities,
  ], Date.UTC(2026, 0, 5), fortnightTail.nowMs)
  const fortnightDriving = painted(fortnightBase, fortnightTail.nowMs, 'DRIVING')
  const fortnightPlain = painted(fortnightBase, fortnightTail.nowMs, 'DRIVING', [])
  const duringBreak = fortnightTail.nowMs + 10 * MINUTE
  const afterBreak = fortnightTail.nowMs + 45 * MINUTE
  const fortnightDuring = painted(
    fillGaps([...fortnightBase, span('rest', fortnightTail.nowMs, duringBreak)], Date.UTC(2026, 0, 5), duringBreak),
    duringBreak,
    'REST',
  )
  const fortnightDone = painted(
    fillGaps([...fortnightBase, span('rest', fortnightTail.nowMs, afterBreak)], Date.UTC(2026, 0, 5), afterBreak),
    afterBreak,
    'REST',
  )

  const crossLater = withShortTail(Date.UTC(2026, 0, 19, 0, 30, 0), 54 * HOUR, 30 * MINUTE)
  const crossStart = Date.UTC(2026, 0, 18, 23, 30, 0)
  const splitWeek = painted(fillGaps([
    ...driveChunks(Date.UTC(2026, 0, 5), 40 * HOUR).activities,
    ...driveChunks(Date.UTC(2026, 0, 12), 19 * HOUR + 30 * MINUTE).activities,
    span('rest', crossStart - 11 * HOUR, crossStart),
    span('driving', crossStart, Date.UTC(2026, 0, 19, 0, 30, 0)),
    ...crossLater.activities,
  ], Date.UTC(2026, 0, 5), crossLater.nowMs), crossLater.nowMs, 'DRIVING')

  const mondayNow = Date.UTC(2026, 0, 19, 1, 0, 0)
  const sundayDrive = Date.UTC(2026, 0, 18, 22, 0, 0)
  const enteredWeek = painted(fillGaps([
    ...driveChunks(Date.UTC(2026, 0, 5), 50 * HOUR).activities,
    ...driveChunks(Date.UTC(2026, 0, 12), 54 * HOUR).activities,
    span('rest', sundayDrive - 11 * HOUR, sundayDrive),
    span('driving', sundayDrive, mondayNow),
  ], Date.UTC(2026, 0, 5), mondayNow), mondayNow, 'DRIVING')

  const onlyCurrent = withShortTail(Date.UTC(2026, 0, 12), 54 * HOUR + 30 * MINUTE, 30 * MINUTE)
  const missingPrevious = painted(onlyCurrent.activities, onlyCurrent.nowMs, 'DRIVING')
  const previousGap = painted(
    cutRange(
      fillGaps([...driveChunks(Date.UTC(2026, 0, 5), HOUR).activities, ...onlyCurrent.activities], Date.UTC(2026, 0, 5), onlyCurrent.nowMs),
      Date.UTC(2026, 0, 6),
      Date.UTC(2026, 0, 6, 1, 0, 0),
      null,
    ),
    onlyCurrent.nowMs,
    'DRIVING',
  )
  const currentGap = painted(
    cutRange(fortnightBase, Date.UTC(2026, 0, 13), Date.UTC(2026, 0, 13, 1, 0, 0), null),
    fortnightTail.nowMs,
    'DRIVING',
  )
  const currentUnknown = painted(
    cutRange(fortnightBase, Date.UTC(2026, 0, 13, 2, 0, 0), Date.UTC(2026, 0, 13, 3, 0, 0), 'unknown'),
    fortnightTail.nowMs,
    'DRIVING',
  )

  expectLine('po 2:30 bez přestávky', plain.text, 'VDO S 02:00')
  if (plain.second !== '[ 00:45') throw new Error(`přestávka ${plain.second}`)
  expectLine('15 + 10 a vyčerpaný blok', ten.text, 'VDO Y 00:00')
  if (ten.second !== '[ 00:20 S 04:30') throw new Error(`běžící přestávka ${ten.second}`)
  expectLine('druhá část 30 minut', done.text, 'VDO Y 04:30')
  if (done.second !== '[ 00:00') throw new Error(`dokončená přestávka ${done.second}`)
  expectLine('denní zbytek 01:00', daily.text, 'VDO S 01:00')
  expectLine('cizí jízda ve vozidle', dailyForeign.text, 'VDO S 01:00')
  expectLine('řízení přes půlnoc', midnight.text, 'VDO S 01:00')
  expectLine('po denním odpočinku', separated.text, 'VDO S 02:00')
  expectLine('55 h v týdnu', fiftyFive.lcd.text, 'VDO S 01:00')
  expectLine('45 h a 44:30', fortnightDriving.lcd.text, 'VDO S 00:30')
  if (!fortnightDriving.card.text.includes('89:30')) throw new Error(`součet ${fortnightDriving.card.text}`)
  if (fortnightDriving.lcd.text !== fortnightPlain.lcd.text || fortnightDriving.card.text !== fortnightPlain.card.text) {
    throw new Error(`cizí jízda změnila řádek ${fortnightPlain.lcd.text} / ${fortnightPlain.lcd.second} proti ${fortnightDriving.lcd.text} / ${fortnightDriving.lcd.second}`)
  }
  expectLine('mezera v předchozím týdnu', previousGap.lcd.text, 'VDO S 01:00')
  if (!previousGap.card.text.includes('----')) throw new Error(`předchozí mezera ${previousGap.card.text}`)
  expectLine('mezera v aktuálním týdnu', currentGap.lcd.text, 'VDO S 04:00')
  if (!currentGap.card.text.includes('----') || currentGap.calendar.weeklyRemainingMs !== null) {
    throw new Error(`aktuální mezera ${currentGap.card.text} ${JSON.stringify(currentGap.calendar)}`)
  }
  expectLine('unknown v aktuálním týdnu', currentUnknown.lcd.text, 'VDO S 04:00')
  if (!currentUnknown.card.text.includes('----') || currentUnknown.calendar.fortnightRemainingMs !== null) {
    throw new Error(`unknown ${currentUnknown.card.text} ${JSON.stringify(currentUnknown.calendar)}`)
  }
  expectLine('během přestávky strop 00:30', fortnightDuring.lcd.text, 'VDO Y 00:30')
  if (fortnightDuring.lcd.second !== '[ 00:35 S 00:30') throw new Error(`běžící přestávka ${fortnightDuring.lcd.second}`)
  expectLine('po dokončení přestávky', fortnightDone.lcd.text, 'VDO Y 00:30')
  if (fortnightDone.lcd.second !== '[ 00:00') throw new Error(`dokončená přestávka ${fortnightDone.lcd.second}`)
  expectLine('rozdělená jízda přes pondělí', splitWeek.lcd.text, 'VDO S 01:00')
  expectLine('po přechodu do nového týdne', enteredWeek.lcd.text, 'VDO S 01:30')
  expectLine('chybí předchozí týden', missingPrevious.lcd.text, 'VDO S 01:00')
  if (fiftyFive.card.text.includes('01:00')) throw new Error(`časy karty převzaly týdenní zbytek: ${fiftyFive.card.text}`)
  if (fiftyFive.calendar.weeklyRemainingMs !== HOUR || fiftyFive.calendar.fortnightRemainingMs !== 34 * HOUR) {
    throw new Error(`55 h týden ${JSON.stringify(fiftyFive.calendar)}`)
  }
  if (fortnightDriving.calendar.previousWeekDrivingMs !== 45 * HOUR || fortnightDriving.calendar.currentWeekDrivingMs !== 44 * HOUR + 30 * MINUTE) {
    throw new Error(`dvojice týdnů ${JSON.stringify(fortnightDriving.calendar)}`)
  }
  if (afterBreak >= Date.UTC(2026, 0, 19)) throw new Error('dokončení přestávky přešlo do dalšího týdne')
  if (splitWeek.calendar.currentWeekDrivingMs !== 55 * HOUR || splitWeek.calendar.previousWeekDrivingMs !== 20 * HOUR) {
    throw new Error(`neděle a pondělí ${JSON.stringify(splitWeek.calendar)}`)
  }
  if (enteredWeek.calendar.currentWeekDrivingMs !== HOUR || enteredWeek.calendar.previousWeekDrivingMs !== 56 * HOUR || enteredWeek.calendar.fortnightRemainingMs !== 33 * HOUR) {
    throw new Error(`nejstarší týden zůstal ve dvojici ${JSON.stringify(enteredWeek.calendar)}`)
  }
  if (missingPrevious.calendar.weeklyRemainingMs !== HOUR || missingPrevious.calendar.fortnightRemainingMs !== null || !missingPrevious.calendar.note?.includes('Dvoutýdenní zbytek neurčený')) {
    throw new Error(`chybějící týden ${JSON.stringify(missingPrevious.calendar)}`)
  }
  const vehicleDriving = sharedDriving(Date.UTC(2026, 0, 5), 12 * 60)
  const completeOff = throughCounter({
    display: fortnightDriving.view.display,
    daily: fortnightDriving.view.daily,
    calendar: fortnightDriving.calendar,
    activity: 'DRIVING',
    simulatedUtcTime: fortnightTail.nowMs,
    activityHistory: vehicleDriving,
    diagnostics: false,
  })
  const completeOn = throughCounter({
    display: fortnightDriving.view.display,
    daily: fortnightDriving.view.daily,
    calendar: fortnightDriving.calendar,
    activity: 'DRIVING',
    simulatedUtcTime: fortnightTail.nowMs,
    activityHistory: vehicleDriving,
    diagnostics: true,
  })
  const gapOff = throughCounter({
    display: previousGap.view.display,
    daily: previousGap.view.daily,
    calendar: previousGap.calendar,
    activity: 'DRIVING',
    simulatedUtcTime: onlyCurrent.nowMs,
    activityHistory: vehicleDriving,
    diagnostics: false,
  })
  const gapOn = throughCounter({
    display: previousGap.view.display,
    daily: previousGap.view.daily,
    calendar: previousGap.calendar,
    activity: 'DRIVING',
    simulatedUtcTime: onlyCurrent.nowMs,
    activityHistory: vehicleDriving,
    diagnostics: true,
  })
  const virtualContext: Slot1DddCounterContext = { ...dddContext, templateId: 'zmizik', cardNumber: null }
  const virtualAfter = throughCounter({
    display: null,
    daily: null,
    calendar: null,
    activity: 'DRIVING',
    simulatedUtcTime: fortnightTail.nowMs,
    drivingSinceLastBreakMs: 150 * MINUTE,
    diagnostics: false,
    context: virtualContext,
  })
  if (!slot1DddCounterSelected(dddContext) || !slot1DddCounterSelected(virtualContext)) {
    throw new Error('šachta 1 s jedním řidičem nemá nový Counter')
  }
  if (
    slot1DddCounterSelected({ ...dddContext, operatingScreenIndex: 1 })
    || slot1DddCounterSelected({ ...dddContext, isMultiManning: true })
    || slot1DddCounterSelected({ ...dddContext, ferryTrainModeActive: true })
    || slot1DddCounterSelected({ ...dddContext, outModeActive: true })
    || slot1DddCounterSelected({ ...dddContext, card1Inserted: false })
  ) {
    throw new Error('nový Counter se zapnul v nepřevedeném režimu')
  }
  expectLine('doplněná přestávka bez diagnostiky', manualOff.text, 'VDO Y 00:00')
  if (manualOff.text !== manualOn.text || manualOff.second !== manualOn.second) {
    throw new Error(`diagnostika změnila přestávku ${manualOn.text} / ${manualOn.second}`)
  }
  expectLine('úplná historie bez diagnostiky', completeOff.text, 'VDO S 00:30')
  const completeCard = throughCounter({
    display: fortnightDriving.view.display,
    daily: fortnightDriving.view.daily,
    calendar: fortnightDriving.calendar,
    activity: 'DRIVING',
    simulatedUtcTime: fortnightTail.nowMs,
    activityHistory: vehicleDriving,
    diagnostics: false,
    named: 'vdoCard',
  })
  if (completeOff.second !== '[ 00:45') throw new Error(`přestávka úplné historie ${completeOff.second}`)
  if (!completeCard.text.includes('89:30') || !completeCard.second.includes('00:00')) {
    throw new Error(`časy karty ${completeCard.text} / ${completeCard.second}`)
  }
  if (completeOff.text !== completeOn.text || completeOff.second !== completeOn.second) {
    throw new Error(`diagnostika změnila úplnou historii ${completeOn.text} / ${completeOn.second}`)
  }
  const gapCard = throughCounter({
    display: previousGap.view.display,
    daily: previousGap.view.daily,
    calendar: previousGap.calendar,
    activity: 'DRIVING',
    simulatedUtcTime: onlyCurrent.nowMs,
    activityHistory: vehicleDriving,
    diagnostics: false,
    named: 'vdoCard',
  })
  if (!gapCard.text.includes('----') || gapOff.text !== gapOn.text || gapOff.second !== gapOn.second) {
    throw new Error(`neúplná historie ${gapOff.text} / ${gapCard.text} proti ${gapOn.text} / ${gapOn.second}`)
  }
  expectLine('virtuální karta bez nového bloku', virtualAfter.text, 'VDO S ----')
  if (virtualAfter.text.includes('00:30') || virtualAfter.text.includes('02:00') || virtualAfter.second.includes('89:30')) {
    throw new Error(`virtuální karta převzala předchozí DDD ${virtualAfter.text} / ${virtualAfter.second}`)
  }
  expectLine('bez diagnostiky', withoutDebug.text, 'VDO S ----')
  if (daily.text !== dailyForeign.text) throw new Error('cizí activityHistory změnila LCD')
  if (dailyShown.daily.remainingMs !== 3_600_000 || dailyShown.daily.limitMs !== 9 * 3_600_000) {
    throw new Error(`denní výpočet ${JSON.stringify(dailyShown.daily)}`)
  }
  if (midnightShown.daily.drivenMs !== 8 * 3_600_000) {
    throw new Error(`přes půlnoc se období rozdělilo: ${midnightShown.daily.drivenMs}`)
  }
  if (separatedShown.daily.drivenMs !== 150 * MINUTE) {
    throw new Error(`denní odpočinek neoddělil předchozí řízení: ${separatedShown.daily.drivenMs}`)
  }
  if (afterThirty.daily.remainingMs !== null) throw new Error('krátká karta si denní zbytek domyslela')
  if (plain.kind !== 'next' || ten.kind !== 'until-break' || done.kind !== 'fulfilled' || daily.kind !== 'next' || withoutDebug.kind !== 'missing') {
    throw new Error(`větve ${plain.kind} / ${ten.kind} / ${done.kind} / ${daily.kind} / ${withoutDebug.kind}`)
  }
  if (ten.icons !== 'Y' || ten.second !== '[ 00:20 S 04:30') throw new Error(`piktogramy druhé části ${ten.icons} ${ten.second}`)

  console.log(JSON.stringify({
    path: 'assessDddInsertion → replaceWorkingManual → appendWorkingMinutes → buildSlot1DddDrivingBreak → slot1DddDailyRemaining → TachoDisplay',
    daily: {
      eightHours: dailyShown.daily,
      midnight: midnightShown.daily,
      separated: separatedShown.daily,
      splitWithoutDailyRest: afterThirty.daily,
    },
    lcd: { plain, ten, done, daily, dailyForeign, midnight, separated, withoutDebug, manualOff, manualOn, completeOff, completeOn, gapOff, gapOn, virtualAfter, fiftyFive: fiftyFive.lcd, fortnightDriving: fortnightDriving.lcd, fortnightDuring: fortnightDuring.lcd, fortnightDone: fortnightDone.lcd, splitWeek: splitWeek.lcd, enteredWeek: enteredWeek.lcd, missingPrevious: missingPrevious.lcd },
    calendar: {
      fiftyFive: fiftyFive.calendar,
      fortnight: fortnightDriving.calendar,
      splitWeek: splitWeek.calendar,
      enteredWeek: enteredWeek.calendar,
      missingPrevious: missingPrevious.calendar,
    },
  }, null, 2))
}
