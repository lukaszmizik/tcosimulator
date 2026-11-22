/**
 * Pevné časy: denní zbytek 03:00, blok 02:00, bez ?debug=1.
 * Šipka dolů otevře VDO24h, šipka nahoru vrátí hlavní Counter.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from '../src/translations/index.ts'
import { TachoDisplay } from '../src/TachoDisplay.tsx'
import { appendWorkingMinutes, assessDddInsertion, createDddCardRecord, replaceWorkingManual, type DddCardRecord } from '../src/dddCardSession.ts'
import { advanceConfirmedCapToMinute, floorToMinute, localMsToSegment, localSegmentToUtcForBuffer, segmentToMsUtc, utcMsToSegment } from '../src/CardLogic.ts'
import { drivingBreakDisplay, type DrivingBreakInterval } from '../src/drivingBreakDisplay.ts'
import { evaluateRecordedOut } from '../src/outDrivingEvaluation.ts'
import { ferryDailyRestRemaining, intervalsWithRecognizedFerryRest } from '../src/ferryRestEvaluation.ts'
import { buildSlot1VirtualCounterIntervals } from '../src/slot1DrivingBreak.ts'
import { buildSlot1DddDrivingBreak, buildSlot1DddDrivingBreakIntervals, buildSlot1DddOutSources, describeSlot1WeekCoverage } from '../src/slot1DddDrivingBreak.ts'
import { slot1DddCalendarRemaining, slot1DddDailyRemaining } from '../src/slot1DddDailyRemaining.ts'
import { WEEKLY_DRIVING_LIMIT_MS } from '../src/VDOCounter.ts'
import { workingTimeDisplay } from '../src/workingTimeDisplay.ts'
import { MULTI_MANNING_ONE_HOUR_MS } from '../src/Constants.ts'
import {
  slot1CounterLcdProps,
  slot1DddCounterSelected,
  slot2OnlyCounterSelected,
  crewOffPairCounterSelected,
  crewPairCounterSelected,
  counterCardSlot,
  counterIndexAfterCardRemoval,
  normalInsertedCardCounter,
  vdoCounterClosesWithoutCard,
  vdo24hEntryAvailable,
  vdoScreenAfterDown,
  vdoScreenAfterUp,
  type VdoNamedScreen,
} from '../src/slot1DddCounter.ts'
import { NO_CARD, type ActivityHistoryEntry, type TachoState } from '../src/TachoTypes.ts'
import type { DddParsedCard } from '../src/types/tachoViewerDddMapper.ts'

const MINUTE = 60_000
const HOUR = 3_600_000
const NOW = Date.UTC(2026, 0, 6, 12, 0, 0)
const symbolMap = { 2: 'S', 7: 'X', 8: 'Y', 9: 'Z', 10: '[', 12: ']', 13: '^', 17: 'b', 41: 'z', 47: 'i', 57: 't', 58: 'w' }

function card(activities: DddParsedCard['activities']): DddParsedCard {
  return {
    cardNumber: 'A',
    firstName: 'A',
    surname: 'Test',
    lastWithdrawalUtc: NOW,
    activities,
    locations: [],
  }
}

function span(kind: 'driving' | 'rest', startUtc: number, endUtc: number): DddParsedCard['activities'][number] {
  return { kind, startUtc, endUtc, slot: 1 }
}

function textOf(row: string | undefined): string {
  // Blikající „h“ je ve vlastním spanu. Mezi číslicemi to na displeji není mezera.
  return (row ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(\d) h (\d)/g, '$1h$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function renderLcd(input: {
  activity: 'WORK' | 'AVAILABILITY'
  named: VdoNamedScreen | null
  breakDisplay: NonNullable<ReturnType<typeof buildSlot1DddDrivingBreak>>
  dailyRemainingMs: number | null
  weeklyRemainingMs: number | null
  fortnightRemainingMs: number | null
  fortnightSumMs: number | null
  extensionsRemaining?: number | null
  slot?: 1 | 2
  foreignHistory?: ActivityHistoryEntry[]
  card2TemplateId?: string
  crew?: boolean
  card1Inserted?: boolean
  card2Inserted?: boolean
  otherWorkMs?: number | null
  legacy?: boolean
  leftActivityId?: 'DRIVING' | 'WORK' | 'AVAILABILITY' | 'REST'
  rightActivityId?: 'WORK' | 'AVAILABILITY' | 'REST'
  ferry?: boolean
  outMode?: boolean
  drivingKnown?: boolean
  noCard?: boolean
  drivingSinceLastBreakMs?: number
  ferryRestMs?: number | null
  ferryRestConditional?: boolean
}) {
  const slot2 = input.slot === 2
  const crew = input.crew === true
  const card1On = input.noCard ? false : (input.card1Inserted ?? (crew || !slot2))
  const card2On = input.noCard ? false : (input.card2Inserted ?? (crew || slot2))
  const leftActivity = input.leftActivityId ?? (slot2 ? 'REST' : input.activity)
  const rightActivity = input.rightActivityId ?? (slot2 ? input.activity : 'REST')
  const tachoState: TachoState = {
    targetSpeed: 0,
    currentSpeed: 0,
    odometerKm: 0,
    ignitionOn: true,
    card1Inserted: card1On,
    card2Inserted: card2On,
    isMultiManning: crew && card1On && card2On,
    leftActivityId: leftActivity,
    rightActivityId: rightActivity,
    companyCardInserted: false,
    controlCardInserted: false,
    optionalFeatureEnabled: false,
    vdoLinkConnected: false,
    ferryTrainModeActive: input.ferry === true,
    outModeActive: input.outMode === true,
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
        isMultiManning={crew && card1On && card2On}
        timeStr="12:00"
        currentSpeed={0}
        odometerKm={0}
        ignitionOn
        ignitionWarningActive={false}
        card1Inserted={card1On}
        card2Inserted={card2On}
        tachoState={tachoState}
        countries={[]}
        spanishRegions={[]}
        lastEjectionTimeBySlot={{ 1: null, 2: null }}
        localTime={new Date(NOW)}
        currentMenu={null}
        selectedItem={null}
        currentMenuId=""
        entryMenuId=""
        leftActivityId={leftActivity}
        rightActivityId={rightActivity}
        vdoCounterActive
        operatingScreenIndex={slot2 ? 1 : 0}
        vdoNamedScreen={input.named}
        card1Data={card1On ? { cardNumber: 'A' } : null}
        card2Data={card2On ? { cardNumber: 'B', templateId: input.card2TemplateId as 'zmizik' | undefined } : null}
        simulatedUtcTime={NOW}
        activityHistory={input.foreignHistory ?? []}
        drivingSinceLastBreakMsByDriver={{ 1: input.drivingSinceLastBreakMs ?? 0, 2: 0 }}
        slot1DebugBreak={input.legacy ? null : input.breakDisplay}
        slot1DebugDailyRemainingMs={input.legacy ? undefined : input.dailyRemainingMs}
        slot1DebugWeeklyRemainingMs={input.legacy ? undefined : input.weeklyRemainingMs}
        slot1DebugFortnightRemainingMs={input.legacy ? undefined : input.fortnightRemainingMs}
        slot1DebugFortnightSumMs={input.legacy ? undefined : input.fortnightSumMs}
        slot1DebugDailyExtensionsRemaining={input.legacy ? undefined : input.extensionsRemaining}
        slot1DebugOtherWorkMs={input.legacy ? undefined : input.otherWorkMs}
        slot1DebugDrivingKnown={input.drivingKnown}
        slot1DebugFerryRestMs={input.ferry ? input.ferryRestMs : undefined}
        slot1DebugFerryRestConditional={input.ferryRestConditional === true}
      />
    </LanguageProvider>,
  )
  const rows = [...html.matchAll(/<div class="lcd-row lcd-row-vdo">([\s\S]*?)<\/div>/g)].map((match) => textOf(match[1]))
  return {
    screen: html.match(/data-vdo-screen="([^"]*)"/)?.[1] ?? (rows.length > 0 ? 'counter' : 'operating'),
    first: rows[0] ?? '',
    second: rows[1] ?? '',
    ferryRest: html.match(/data-lcd-ferry-rest="([^"]*)"/)?.[1] ?? '',
  }
}

function assertWorkingTime() {
  const now = Date.UTC(2026, 0, 7, 12, 0, 0)
  const restEnd = now - 3 * HOUR
  const shown = workingTimeDisplay([
    { kind: 'rest', startMs: restEnd - 11 * HOUR, endMs: restEnd },
    { kind: 'driving', startMs: restEnd, endMs: restEnd + 2 * HOUR },
    { kind: 'rest', startMs: restEnd + 2 * HOUR, endMs: restEnd + 2 * HOUR + 30 * MINUTE },
    { kind: 'work', startMs: restEnd + 2 * HOUR + 30 * MINUTE, endMs: now },
  ], now)
  if (shown.currentWithoutRestMs !== 30 * MINUTE) throw new Error(`aktuální pracovní doba ${shown.currentWithoutRestMs}`)
  if (shown.sinceDailyOrWeeklyRestMs !== 2 * HOUR + 30 * MINUTE) throw new Error(`od denního odpočinku ${shown.sinceDailyOrWeeklyRestMs}`)
  if (shown.breaksInPeriodMs !== 30 * MINUTE) throw new Error(`přestávky ${shown.breaksInPeriodMs}`)
  if (shown.calendarWeekMs !== null) throw new Error('týden bez pokrytí od pondělí nemá být číslo')
  const gap = workingTimeDisplay([
    { kind: 'rest', startMs: now - 20 * HOUR, endMs: now - 9 * HOUR },
    { kind: 'driving', startMs: now - 2 * HOUR, endMs: now },
  ], now)
  if (gap.currentWithoutRestMs !== null || gap.sinceDailyOrWeeklyRestMs !== null || gap.breaksInPeriodMs !== null) {
    throw new Error('mezera v pracovní době má zůstat nedoložená')
  }
  const resting = workingTimeDisplay([
    { kind: 'rest', startMs: now - 12 * HOUR, endMs: now - HOUR },
    { kind: 'driving', startMs: now - HOUR, endMs: now - 30 * MINUTE },
    { kind: 'rest', startMs: now - 30 * MINUTE, endMs: now },
  ], now)
  if (resting.currentWithoutRestMs !== 0 || resting.sinceDailyOrWeeklyRestMs !== 30 * MINUTE || resting.breaksInPeriodMs !== 30 * MINUTE) {
    throw new Error(`probíhající odpočinek ${resting.currentWithoutRestMs} / ${resting.sinceDailyOrWeeklyRestMs} / ${resting.breaksInPeriodMs}`)
  }
}

export function main() {
  assertWorkingTime()
  const driveTailStart = NOW - (2 * HOUR + 30 * MINUTE)
  const breakEnd = driveTailStart
  const breakStart = breakEnd - 45 * MINUTE
  const firstDriveEnd = breakStart
  const firstDriveStart = firstDriveEnd - (3 * HOUR + 30 * MINUTE)
  const restEnd = firstDriveStart
  const restStart = restEnd - 11 * HOUR
  const record = createDddCardRecord(card([
    span('rest', restStart, restEnd),
    span('driving', firstDriveStart, firstDriveEnd),
    span('rest', breakStart, breakEnd),
    span('driving', driveTailStart, NOW),
  ]))
  const decision = assessDddInsertion({ record, simulatedNowMs: NOW, otherSlotCardNumber: null })
  if (!decision.ok) throw new Error('vložení DDD karty neprošlo')
  const cards: Record<string, DddCardRecord> = { A: record }
  const breakDisplay = buildSlot1DddDrivingBreak({ cards, cardNumber: 'A', secondSamples: [], nowMs: NOW })
  const { intervals } = buildSlot1DddDrivingBreakIntervals({ cards, cardNumber: 'A', secondSamples: [], nowMs: NOW })
  const daily = slot1DddDailyRemaining(intervals, NOW)
  const calendar = slot1DddCalendarRemaining(intervals, NOW)
  if (daily.remainingMs !== 3 * HOUR) throw new Error(`denní zbytek ${daily.remainingMs}`)
  if (!breakDisplay || breakDisplay.phase !== 'driving' || breakDisplay.remainingDrivingMs !== 2 * HOUR) {
    throw new Error(`blok ${JSON.stringify(breakDisplay)}`)
  }
  const lcdProps = slot1CounterLcdProps({
    diagnostics: false,
    context: {
      vdoCounterActive: true,
      operatingScreenIndex: 0,
      card1Inserted: true,
      isMultiManning: false,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId: null,
      cardNumber: 'A',
    },
    dddBreak: breakDisplay,
    daily,
    calendar,
    virtualDebugBreak: null,
  })
  if (lcdProps.slot1DebugDailyRemainingMs !== 3 * HOUR) throw new Error('denní zbytek se na LCD nepředal')

  const shown: Record<string, { counter: string; vdo24h: { first: string; second: string }; back: string }> = {}
  for (const activity of ['WORK', 'AVAILABILITY'] as const) {
    const entry = {
      vdoCounterActive: true,
      operatingScreenIndex: 0,
      card1Inserted: true,
      isMultiManning: false,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId: null,
      cardNumber: 'A',
      card2Inserted: false,
      speed: 0,
      leftActivityId: activity,
    }
    if (!vdo24hEntryAvailable(entry) || vdoScreenAfterDown(null, true, true) !== 'vdoCard' || vdoScreenAfterDown('vdoCard', true, true) !== 'vdo24h') {
      throw new Error(`${activity} neotevřela časy karty a VDO24h`)
    }
    const counter = renderLcd({
      activity,
      named: null,
      breakDisplay,
      dailyRemainingMs: lcdProps.slot1DebugDailyRemainingMs ?? null,
      weeklyRemainingMs: lcdProps.slot1DebugWeeklyRemainingMs ?? null,
      fortnightRemainingMs: lcdProps.slot1DebugFortnightRemainingMs ?? null,
      fortnightSumMs: lcdProps.slot1DebugFortnightSumMs ?? null,
    })
    if (counter.first !== `VDO ${activity === 'WORK' ? 'Z' : 'X'} S z 02h00` || counter.second !== 'Y z 00h45') throw new Error(`${activity} Counter má „${counter.first}“ / „${counter.second}“`)
    const opened = renderLcd({ ...argumentsOf(counter, activity, 'vdo24h', breakDisplay, lcdProps) })
    if (opened.screen !== 'vdo24h' || !opened.first.includes('03:00') || opened.first.includes('02:00')) {
      throw new Error(`${activity} VDO24h má „${opened.first}“`)
    }
    if (vdoScreenAfterUp('vdo24h', true) !== 'vdoCard' || vdoScreenAfterUp('vdoCard', true) !== null) throw new Error('šipka nahoru nevrací Counter přes časy karty')
    const back = renderLcd({ ...argumentsOf(counter, activity, null, breakDisplay, lcdProps) })
    if (back.first !== counter.first) throw new Error(`${activity} návrat má „${back.first}“`)
    shown[activity] = { counter: counter.first, vdo24h: { first: opened.first, second: opened.second }, back: back.first }
  }

  const week = weekLcd(false)
  const gap = weekLcd(true)
  const walked = ['WORK', 'AVAILABILITY'].map((activity) => {
    const entryAvailable = vdo24hEntryAvailable({
      vdoCounterActive: true,
      operatingScreenIndex: 0,
      card1Inserted: true,
      isMultiManning: false,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId: null,
      cardNumber: 'A',
      card2Inserted: false,
      speed: 0,
      leftActivityId: activity,
    })
    const toCard = vdoScreenAfterDown(null, entryAvailable, true)
    const to24 = vdoScreenAfterDown(toCard === 'index' ? null : toCard, entryAvailable, true)
    const toWeek = vdoScreenAfterDown(to24 === 'index' ? null : to24, entryAvailable, true)
    const back24 = vdoScreenAfterUp(toWeek === 'index' ? null : toWeek, true)
    const backCard = vdoScreenAfterUp(back24 === 'index' ? null : back24, true)
    const backCounter = vdoScreenAfterUp(backCard === 'index' ? null : backCard, true)
    if (toCard !== 'vdoCard' || to24 !== 'vdo24h' || toWeek !== 'vdoWeek' || back24 !== 'vdo24h' || backCard !== 'vdoCard' || backCounter !== null) {
      throw new Error(`${activity} průchod ${toCard} → ${to24} → ${toWeek} → ${back24} → ${String(backCard)} → ${String(backCounter)}`)
    }
    const counter = renderLcd({ ...argumentsOf({ first: '' }, activity, null, week.breakDisplay, week.lcdProps) })
    const daily = renderLcd({ ...argumentsOf({ first: '' }, activity, 'vdo24h', week.breakDisplay, week.lcdProps) })
    const weekly = renderLcd({ ...argumentsOf({ first: '' }, activity, 'vdoWeek', week.breakDisplay, week.lcdProps) })
    const returned = renderLcd({ ...argumentsOf({ first: '' }, activity, 'vdo24h', week.breakDisplay, week.lcdProps) })
    const home = renderLcd({ ...argumentsOf({ first: '' }, activity, null, week.breakDisplay, week.lcdProps) })
    if (!counter.first.startsWith('VDO ') || !counter.first.endsWith('00h30') || counter.second !== 'Y z 00h45' || home.first !== counter.first) {
      throw new Error(`${activity} týdenní průchod Counter ${counter.first} / ${home.first}`)
    }
    if (!weekly.first.includes('11:30') || weekly.first.includes('00:30')) {
      throw new Error(`${activity} týdenní obrazovka ${weekly.first}`)
    }
    if (returned.screen !== 'vdo24h') throw new Error(`${activity} návrat z týdne není VDO24h`)
    return { activity, counter: counter.first, vdo24h: daily.first, week: { first: weekly.first, second: weekly.second }, back24: returned.first, home: home.first }
  })
  const gapWeek = renderLcd({ ...argumentsOf({ first: '' }, 'WORK', 'vdoWeek', gap.breakDisplay, gap.lcdProps) })
  if (!gapWeek.first.includes('----') || gapWeek.first.includes('11:30')) {
    throw new Error(`mezera v aktuálním týdnu ${gapWeek.first} / ${gapWeek.second}`)
  }

  const sameCard = sameHistoryLcd()
  const noLegacy = noLegacyFallbackLcd()
  const outMode = outSequenceLcd()
  const ferryRest = ferrySequenceLcd()
  const slot2 = slot2OnlyLcd()
  const crew = crewBeforeDepartureLcd()
  const moved = ejectAndSwapLcd()
  const crewOff = crewOffPairLcd()
  const manualWeek = manualRestWeek()
  const vdoi = vdoiLcd()
  console.log(JSON.stringify({ diagnostics: false, shown, walked, gapWeek, manualWeek, vdoi, sameCard, slot2, crew, moved, crewOff, noLegacy, outMode, ferryRest }, null, 2))
}

function weekLcd(currentGap: boolean) {
  const previous = driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR)
  const current = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const filled = fillGaps([...previous.activities, ...current.activities], Date.UTC(2026, 0, 5), current.nowMs)
  const activities = currentGap
    ? cutRange(filled, Date.UTC(2026, 0, 13), Date.UTC(2026, 0, 13, 1, 0, 0))
    : filled
  const record = createDddCardRecord(card(activities))
  const decision = assessDddInsertion({ record, simulatedNowMs: current.nowMs, otherSlotCardNumber: null })
  if (!decision.ok) throw new Error('vložení týdenní karty neprošlo')
  const cards: Record<string, DddCardRecord> = { A: record }
  const breakDisplay = buildSlot1DddDrivingBreak({ cards, cardNumber: 'A', secondSamples: [], nowMs: current.nowMs })
  const { intervals } = buildSlot1DddDrivingBreakIntervals({ cards, cardNumber: 'A', secondSamples: [], nowMs: current.nowMs })
  const daily = slot1DddDailyRemaining(intervals, current.nowMs)
  const calendar = slot1DddCalendarRemaining(intervals, current.nowMs)
  if (!breakDisplay) throw new Error('týdenní karta nemá blok')
  if (!currentGap && calendar.weeklyRemainingMs !== 11 * HOUR + 30 * MINUTE) {
    throw new Error(`týdenní zbytek ${calendar.weeklyRemainingMs}`)
  }
  if (currentGap && calendar.weeklyRemainingMs !== null) throw new Error('mezera ponechala týdenní zbytek')
  return {
    breakDisplay,
    lcdProps: slot1CounterLcdProps({
      diagnostics: false,
      context: {
        vdoCounterActive: true,
        operatingScreenIndex: 0,
        card1Inserted: true,
        isMultiManning: false,
        ferryTrainModeActive: false,
        outModeActive: false,
        templateId: null,
        cardNumber: 'A',
      },
      dddBreak: breakDisplay,
      daily,
      calendar,
      virtualDebugBreak: null,
    }),
  }
}

function vdoiLcd() {
  const nowMs = Date.UTC(2026, 0, 7, 12, 0, 0)
  const monday = Date.UTC(2026, 0, 5)
  const two = extensionCard(nowMs, monday, 0)
  const one = extensionCard(nowMs, monday, 1)
  const none = extensionCard(nowMs, monday, 2)
  const incomplete = extensionCard(nowMs, monday, 0, Date.UTC(2026, 0, 6), Date.UTC(2026, 0, 6, 1))
  if (two.extensions !== 2 || one.extensions !== 1 || none.extensions !== 0 || incomplete.extensions !== null) {
    throw new Error(`prodloužení ${two.extensions} ${one.extensions} ${none.extensions} ${String(incomplete.extensions)}`)
  }
  const rows = [two, one, none, incomplete].map((item) => renderWeekExtensions(item))
  const [twoLcd, oneLcd, noneLcd, incompleteLcd] = rows
  if (!twoLcd || !oneLcd || !noneLcd || !incompleteLcd) throw new Error('VDOi se nevykreslilo')
  for (const row of rows) {
    if (!row.first.includes('VDOi') || !row.first.includes('9h') || !row.first.includes('----')) {
      throw new Error(`řádek zkrácených odpočinků ${row.first}`)
    }
    if (!row.second.startsWith('----') || !row.second.includes('10h')) {
      throw new Error(`řádek kompenzace ${row.second}`)
    }
  }
  if (!twoLcd.second.includes('10h 2') || twoLcd.second.includes('10h ----')) throw new Error(`zbývají 2: ${twoLcd.second}`)
  if (!oneLcd.second.includes('10h 1')) throw new Error(`zbývá 1: ${oneLcd.second}`)
  if (!noneLcd.second.includes('10h 0')) throw new Error(`zbývá 0: ${noneLcd.second}`)
  if (!incompleteLcd.second.includes('10h ----')) throw new Error(`neúplná historie ${incompleteLcd.second}`)
  for (const activity of ['WORK', 'AVAILABILITY'] as const) {
    const entryAvailable = vdo24hEntryAvailable({
      vdoCounterActive: true,
      operatingScreenIndex: 0,
      card1Inserted: true,
      isMultiManning: false,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId: null,
      cardNumber: 'A',
      card2Inserted: false,
      speed: 0,
      leftActivityId: activity,
    })
    const opened = vdoScreenAfterDown('vdoWeek', entryAvailable)
    const back = vdoScreenAfterUp(opened === 'index' ? null : opened)
    if (opened !== 'vdoi' || back !== 'vdoWeek') throw new Error(`${activity} ${opened} → ${String(back)}`)
    if (vdoScreenAfterDown('vdoWeek', false) !== 'vdoWeek') throw new Error('bez podmínek se VDOi neotevře')
    const shown = renderWeekExtensions(two, activity, 'vdoi')
    const returned = renderWeekExtensions(two, activity, 'vdoWeek')
    if (shown.screen !== 'vdoi' || returned.screen !== 'vdoWeek') {
      throw new Error(`${activity} obrazovky ${shown.screen} / ${returned.screen}`)
    }
  }
  return {
    two: { first: twoLcd.first, second: twoLcd.second },
    one: { first: oneLcd.first, second: oneLcd.second },
    zero: { first: noneLcd.first, second: noneLcd.second },
    incomplete: { first: incompleteLcd.first, second: incompleteLcd.second },
  }
}

function extensionCard(nowMs: number, monday: number, used: number, gapStart?: number, gapEnd?: number) {
  const drive = 9 * HOUR + MINUTE
  const rest9 = 9 * HOUR
  const activities: DddParsedCard['activities'] = [span('rest', monday - 11 * HOUR, monday)]
  let cursor = monday
  for (let index = 0; index < used; index += 1) {
    activities.push(span('driving', cursor, cursor + drive))
    cursor += drive
    activities.push(span('rest', cursor, cursor + rest9))
    cursor += rest9
  }
  if (used === 0) {
    activities.push(span('driving', cursor, cursor + 4 * HOUR))
  }
  let filled = fillGaps(activities, monday - 11 * HOUR, nowMs)
  if (gapStart != null && gapEnd != null) filled = cutRange(filled, gapStart, gapEnd)
  const record = createDddCardRecord({ ...card(filled), lastWithdrawalUtc: nowMs })
  const cards = { A: record }
  const breakDisplay = buildSlot1DddDrivingBreak({ cards, cardNumber: 'A', secondSamples: [], nowMs })
  const { intervals } = buildSlot1DddDrivingBreakIntervals({ cards, cardNumber: 'A', secondSamples: [], nowMs })
  if (!breakDisplay) throw new Error('karta prodloužení nemá blok')
  const daily = slot1DddDailyRemaining(intervals, nowMs)
  return { breakDisplay, extensions: daily.extensionsRemaining, calendar: slot1DddCalendarRemaining(intervals, nowMs) }
}

function renderWeekExtensions(
  input: { breakDisplay: NonNullable<ReturnType<typeof buildSlot1DddDrivingBreak>>; extensions: number | null; calendar: ReturnType<typeof slot1DddCalendarRemaining> },
  activity: 'WORK' | 'AVAILABILITY' = 'WORK',
  named: VdoNamedScreen = 'vdoi',
) {
  return renderLcd({
    activity,
    named,
    breakDisplay: input.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: input.calendar.weeklyRemainingMs,
    fortnightRemainingMs: input.calendar.fortnightRemainingMs,
    fortnightSumMs: input.calendar.fortnightSumMs,
    extensionsRemaining: input.extensions,
  })
}

function slot2OnlyLcd() {
  const nowMs = Date.UTC(2026, 0, 7, 12, 0, 0)
  const start = nowMs - 150 * MINUTE
  const half = start + 75 * MINUTE
  const activities = [
    { ...span('driving', start, half), slot: 1 as const },
    { ...span('driving', half, nowMs), slot: 2 as const },
  ]
  const slot1 = dddShown(activities, nowMs, 'A', 1)
  const foreign = createDddCardRecord({ ...card([span('driving', start, start + 8 * HOUR)]), cardNumber: 'B', lastWithdrawalUtc: nowMs })
  const slot2Cards = {
    A: createDddCardRecord({ ...card(activities), cardNumber: 'A', lastWithdrawalUtc: nowMs }),
    B: foreign,
  }
  const slot2Break = buildSlot1DddDrivingBreak({ cards: slot2Cards, cardNumber: 'A', secondSamples: [], nowMs, recordedDriver: 2 })
  const slot2Intervals = buildSlot1DddDrivingBreakIntervals({ cards: slot2Cards, cardNumber: 'A', secondSamples: [], nowMs, recordedDriver: 2 }).intervals
  if (!slot2Break || !slot1.breakDisplay) throw new Error('šachta 2 nemá blok')
  if (slot2Break.phase !== 'driving' || slot1.breakDisplay.phase !== 'driving') throw new Error('blok není jízda')
  if (slot2Break.remainingDrivingMs !== slot1.breakDisplay.remainingDrivingMs || slot2Break.remainingDrivingMs !== 2 * HOUR) {
    throw new Error(`časy šachet ${slot1.breakDisplay.remainingDrivingMs} / ${slot2Break.remainingDrivingMs}`)
  }
  const daily = slot1DddDailyRemaining(slot2Intervals, nowMs)
  const calendar = slot1DddCalendarRemaining(slot2Intervals, nowMs)
  const alone = buildSlot1DddDrivingBreakIntervals({
    cards: { A: slot2Cards.A },
    cardNumber: 'A',
    secondSamples: [],
    nowMs,
    recordedDriver: 2,
  }).intervals
  if (JSON.stringify(alone) !== JSON.stringify(slot2Intervals)) throw new Error('cizí karta změnila intervaly šachty 2')
  const vehicle = minutesBetween(start, start + 12 * HOUR, 'driving')
  const slot2Lcd = renderLcd({
    activity: 'DRIVING',
    named: null,
    breakDisplay: slot2Break,
    dailyRemainingMs: daily.remainingMs,
    weeklyRemainingMs: calendar.weeklyRemainingMs,
    fortnightRemainingMs: calendar.fortnightRemainingMs,
    fortnightSumMs: calendar.fortnightSumMs,
    extensionsRemaining: daily.extensionsRemaining,
    slot: 2,
  })
  const slot2Foreign = renderLcd({
    activity: 'DRIVING',
    named: null,
    breakDisplay: slot2Break,
    dailyRemainingMs: daily.remainingMs,
    weeklyRemainingMs: calendar.weeklyRemainingMs,
    fortnightRemainingMs: calendar.fortnightRemainingMs,
    fortnightSumMs: calendar.fortnightSumMs,
    extensionsRemaining: daily.extensionsRemaining,
    slot: 2,
    foreignHistory: vehicle,
    card2TemplateId: 'zmizik',
  })
  const slot1Lcd = renderLcd({
    activity: 'DRIVING',
    named: null,
    breakDisplay: slot1.breakDisplay,
    dailyRemainingMs: slot1.daily.remainingMs,
    weeklyRemainingMs: slot1.calendar.weeklyRemainingMs,
    fortnightRemainingMs: slot1.calendar.fortnightRemainingMs,
    fortnightSumMs: slot1.calendar.fortnightSumMs,
    extensionsRemaining: slot1.daily.extensionsRemaining,
  })
  const slot1Card = renderLcd({
    activity: 'DRIVING',
    named: 'vdoCard',
    breakDisplay: slot1.breakDisplay,
    dailyRemainingMs: slot1.daily.remainingMs,
    weeklyRemainingMs: slot1.calendar.weeklyRemainingMs,
    fortnightRemainingMs: slot1.calendar.fortnightRemainingMs,
    fortnightSumMs: slot1.calendar.fortnightSumMs,
    extensionsRemaining: slot1.daily.extensionsRemaining,
  })
  const slot2Card = renderLcd({
    activity: 'DRIVING',
    named: 'vdoCard',
    breakDisplay: slot2Break,
    dailyRemainingMs: daily.remainingMs,
    weeklyRemainingMs: calendar.weeklyRemainingMs,
    fortnightRemainingMs: calendar.fortnightRemainingMs,
    fortnightSumMs: calendar.fortnightSumMs,
    extensionsRemaining: daily.extensionsRemaining,
    slot: 2,
  })
  if (slot1Lcd.first !== slot2Lcd.first || !slot1Card.first.startsWith('] ') || !slot2Card.first.startsWith('^ ') || slot1Card.first.slice(1) !== slot2Card.first.slice(1)) {
    throw new Error(`označení šachet ${slot1Lcd.first} / ${slot2Lcd.first} / ${slot1Card.first} / ${slot2Card.first}`)
  }
  if (slot2Foreign.first !== slot2Lcd.first || slot2Foreign.second !== slot2Lcd.second) {
    throw new Error(`paměť vozidla ${slot2Foreign.first} / ${slot2Foreign.second}`)
  }

  const openNow = nowMs + 30_000
  const history = minutesBetween(start, nowMs, 'driving').map((entry) => ({ ...entry, driver1: 'rest' as const, driver2: 'driving' as const }))
  const samples = Array.from({ length: 30 }, (_, index) => ({
    timestampUtc: nowMs + (index + 1) * 1000,
    driver1: 'rest' as const,
    driver2: 'driving' as const,
    speed: 0,
  }))
  const fromSlot2 = buildSlot1VirtualCounterIntervals({
    cardHistory: history,
    manual: [],
    secondSamples: samples,
    nowMs: openNow,
    driverSlot: 2,
  })
  const shownSlot2 = drivingBreakDisplay(fromSlot2, openNow)
  if (shownSlot2.phase !== 'driving' || shownSlot2.remainingDrivingMs !== 2 * HOUR - 30_000) {
    throw new Error(`otevřená minuta šachty 2 četla jiného řidiče ${JSON.stringify(shownSlot2)}`)
  }
  const wrongDriver = buildSlot1VirtualCounterIntervals({
    cardHistory: history,
    manual: [],
    secondSamples: samples,
    nowMs: openNow,
  })
  const shownWrong = drivingBreakDisplay(wrongDriver, openNow)
  if (shownWrong.phase === 'driving' && shownWrong.remainingDrivingMs === shownSlot2.remainingDrivingMs) {
    throw new Error('činnost šachty 1 se započítala jako šachta 2')
  }

  const restStart = nowMs - 10 * MINUTE
  const manual = [
    { ...utcMsToSegment(restStart), activityId: 'REST' as const, isManualEntry: true as const },
    { ...utcMsToSegment(nowMs), activityId: 'WORK' as const, isManualEntry: true as const },
  ]
  const manualCards = replaceWorkingManual(
    { A: createDddCardRecord({ ...card([]), cardNumber: 'A', lastWithdrawalUtc: nowMs }), B: foreign },
    'A',
    manual,
  )
  const manualBreak = buildSlot1DddDrivingBreak({ cards: manualCards, cardNumber: 'A', secondSamples: [], nowMs, recordedDriver: 2 })
  const virtualManual = drivingBreakDisplay(buildSlot1VirtualCounterIntervals({
    cardHistory: [],
    manual,
    secondSamples: [],
    nowMs,
    driverSlot: 2,
  }), nowMs)
  if (!manualBreak || manualBreak.phase !== 'break' || manualBreak.remainingBreakMs !== 35 * MINUTE || virtualManual.phase !== 'break' || virtualManual.remainingBreakMs !== 35 * MINUTE) {
    throw new Error(`ruční doplnění šachty 2 ${JSON.stringify(manualBreak)} / ${JSON.stringify(virtualManual)}`)
  }

  const previous = driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR)
  const current = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const tagged = fillGaps([...previous.activities, ...current.activities], Date.UTC(2026, 0, 5), current.nowMs)
    .map((activity, index) => ({ ...activity, slot: (index % 2 === 0 ? 1 : 2) as 1 | 2 }))
  const limits1 = dddShown(tagged, current.nowMs, 'A', 1)
  const limits2 = dddShown(tagged, current.nowMs, 'A', 2)
  const limitsLcd = (source: typeof limits1, slot: 1 | 2, named: VdoNamedScreen | null, activity: 'WORK' | 'AVAILABILITY' | 'DRIVING') => renderLcd({
    activity,
    named,
    breakDisplay: source.breakDisplay,
    dailyRemainingMs: source.daily.remainingMs,
    weeklyRemainingMs: source.calendar.weeklyRemainingMs,
    fortnightRemainingMs: source.calendar.fortnightRemainingMs,
    fortnightSumMs: source.calendar.fortnightSumMs,
    extensionsRemaining: source.daily.extensionsRemaining,
    slot,
    foreignHistory: slot === 2 ? minutesBetween(current.nowMs - 12 * HOUR, current.nowMs, 'driving') : [],
  })
  const limitsSlot1 = limitsLcd(limits1, 1, null, 'DRIVING')
  const limitsSlot2 = limitsLcd(limits2, 2, null, 'DRIVING')
  const cardSlot1 = limitsLcd(limits1, 1, 'vdoCard', 'DRIVING')
  const cardSlot2 = limitsLcd(limits2, 2, 'vdoCard', 'DRIVING')
  if (limitsSlot1.first !== 'VDO S S z 00h30' || limitsSlot2.first !== 'VDO S S z 00h30' || limitsSlot1.second !== 'Y z 00h45' || !cardSlot1.second.includes('] S w 89h30') || !cardSlot2.second.includes('^ S w 89h30')) {
    throw new Error(`stejná historie ${limitsSlot1.first} ${limitsSlot1.second} / ${cardSlot1.first} / ${cardSlot2.first}`)
  }
  const slot2Minutes = activitiesToMinutes(tagged).map((entry) => ({ ...entry, driver1: 'rest' as const, driver2: entry.driver1 }))
  const virtualIntervals = buildSlot1VirtualCounterIntervals({
    cardHistory: slot2Minutes,
    manual: [],
    secondSamples: [],
    nowMs: current.nowMs,
    driverSlot: 2,
  })
  const virtualLimits = drivingBreakDisplay(virtualIntervals, current.nowMs)
  const virtualCalendar = slot1DddCalendarRemaining(virtualIntervals, current.nowMs)
  if (virtualLimits.phase !== 'driving' || virtualLimits.remainingDrivingMs !== limits2.breakDisplay.remainingDrivingMs || virtualCalendar.fortnightSumMs !== limits2.calendar.fortnightSumMs) {
    throw new Error('virtuální šachta 2 nedala stejné časy jako DDD')
  }

  const walked = ['WORK', 'AVAILABILITY'].map((activity) => {
    const entry = vdo24hEntryAvailable({
      vdoCounterActive: true,
      operatingScreenIndex: 1,
      card1Inserted: false,
      card2Inserted: true,
      isMultiManning: false,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId: null,
      cardNumber: null,
      slot2TemplateId: 'zmizik',
      slot2CardNumber: null,
      speed: 0,
      leftActivityId: 'REST',
      rightActivityId: activity,
    })
    const toCard = vdoScreenAfterDown(null, entry, true)
    const to24 = vdoScreenAfterDown(toCard === 'index' ? null : toCard, entry, true)
    const toWeek = vdoScreenAfterDown(to24 === 'index' ? null : to24, entry, true)
    const toI = vdoScreenAfterDown(toWeek === 'index' ? null : toWeek, entry, true)
    const backWeek = vdoScreenAfterUp(toI === 'index' ? null : toI, true)
    const back24 = vdoScreenAfterUp(backWeek === 'index' ? null : backWeek, true)
    const backCard = vdoScreenAfterUp(back24 === 'index' ? null : back24, true)
    const backCounter = vdoScreenAfterUp(backCard === 'index' ? null : backCard, true)
    if (!entry || toCard !== 'vdoCard' || to24 !== 'vdo24h' || toWeek !== 'vdoWeek' || toI !== 'vdoi' || backWeek !== 'vdoWeek' || back24 !== 'vdo24h' || backCard !== 'vdoCard' || backCounter !== null) {
      throw new Error(`${activity} šachta 2 ${toCard} → ${to24} → ${toWeek} → ${toI}`)
    }
    const counter = limitsLcd(limits2, 2, null, activity)
    const vdo24h = limitsLcd(limits2, 2, 'vdo24h', activity)
    const week = limitsLcd(limits2, 2, 'vdoWeek', activity)
    const vdoi = limitsLcd(limits2, 2, 'vdoi', activity)
    const slot1Week = limitsLcd(limits1, 1, 'vdoWeek', activity)
    const slot1Day = limitsLcd(limits1, 1, 'vdo24h', activity)
    const mark = activity === 'WORK' ? 'Z' : 'X'
    if (counter.first !== `VDO ${mark} S z 00h30` || counter.second !== 'Y z 00h45' || vdo24h.first !== slot1Day.first || week.first !== 'VDO t S 11:30' || week.first !== slot1Week.first || !vdoi.second.includes('10h')) {
      throw new Error(`${activity} obrazovky ${counter.first} / ${vdo24h.first} / ${week.first} / ${vdoi.second}`)
    }
    return { activity, counter: counter.first, vdo24h: vdo24h.first, week: week.first, vdoi: vdoi.second }
  })
  const blocked = slot2OnlyCounterSelected({
    vdoCounterActive: true,
    operatingScreenIndex: 1,
    card1Inserted: true,
    card2Inserted: true,
    isMultiManning: false,
    ferryTrainModeActive: false,
    outModeActive: false,
    slot2CardNumber: 'B',
  }) || slot2OnlyCounterSelected({
    vdoCounterActive: true,
    operatingScreenIndex: 1,
    card1Inserted: false,
    card2Inserted: true,
    isMultiManning: true,
    ferryTrainModeActive: false,
    outModeActive: false,
    slot2CardNumber: 'B',
  })
  if (blocked) throw new Error('nový Counter se zapnul mimo samotnou šachtu 2')
  return {
    slot1: slot1Lcd.first,
    slot2: slot2Lcd.first,
    second: slot2Lcd.second,
    foreign: slot2Foreign.first,
    walked,
  }
}

function dddShown(activities: DddParsedCard['activities'], nowMs: number, cardNumber: string, recordedDriver: 1 | 2) {
  const record = createDddCardRecord({ ...card(activities), cardNumber, lastWithdrawalUtc: nowMs })
  const cards = { [cardNumber]: record }
  const breakDisplay = buildSlot1DddDrivingBreak({ cards, cardNumber, secondSamples: [], nowMs, recordedDriver })
  const intervals = buildSlot1DddDrivingBreakIntervals({ cards, cardNumber, secondSamples: [], nowMs, recordedDriver }).intervals
  if (!breakDisplay) throw new Error('karta nemá blok')
  return { breakDisplay, daily: slot1DddDailyRemaining(intervals, nowMs), calendar: slot1DddCalendarRemaining(intervals, nowMs) }
}

function crewBeforeDepartureLcd() {
  const nowMs = Date.UTC(2026, 0, 7, 12, 0, 20)
  const minute = Math.floor(nowMs / 60_000) * 60_000
  const start = minute - 150 * MINUTE
  const shared = minutesBetween(start, minute, 'driving').map((entry) => ({
    ...entry,
    driver1: 'driving' as const,
    driver2: 'availability' as const,
    isCrew: true,
  }))
  const samples = Array.from({ length: 20 }, (_, index) => ({
    timestampUtc: minute + (index + 1) * 1000,
    driver1: 'driving' as const,
    driver2: 'availability' as const,
    speed: 80,
  }))
  let cards = {
    A: createDddCardRecord({ ...card([]), cardNumber: 'A', lastWithdrawalUtc: nowMs }),
    B: createDddCardRecord({ ...card([span('driving', start - 4 * HOUR, start)]), cardNumber: 'B', lastWithdrawalUtc: nowMs }),
  }
  cards = appendWorkingMinutes(cards, 'A', shared)
  cards = appendWorkingMinutes(cards, 'B', shared)
  const shownA = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards, cardNumber: 'A', secondSamples: samples, nowMs, recordedDriver: 1,
  }).intervals, nowMs)
  const shownB = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards, cardNumber: 'B', secondSamples: samples, nowMs, recordedDriver: 2,
  }).intervals, nowMs)
  if (shownA.phase !== 'driving' || shownA.remainingDrivingMs !== 2 * HOUR - 20_000) {
    throw new Error(`šachta 1 v osádce ${JSON.stringify(shownA)}`)
  }
  if (shownB.phase !== 'driving' || shownB.remainingDrivingMs !== 30 * MINUTE) {
    throw new Error(`řízení šachty 1 se připsalo šachtě 2 ${JSON.stringify(shownB)}`)
  }
  const manualA = [
    { ...utcMsToSegment(minute - 10 * MINUTE), activityId: 'REST' as const, isManualEntry: true as const },
    { ...utcMsToSegment(minute), activityId: 'WORK' as const, isManualEntry: true as const },
  ]
  const virtualB = drivingBreakDisplay(buildSlot1VirtualCounterIntervals({
    cardHistory: shared,
    manual: [],
    secondSamples: samples,
    nowMs,
    driverSlot: 2,
  }), nowMs)
  const virtualAManual = drivingBreakDisplay(buildSlot1VirtualCounterIntervals({
    cardHistory: [],
    manual: manualA,
    secondSamples: [],
    nowMs: minute,
    driverSlot: 1,
  }), minute)
  if (virtualB.phase !== 'driving' || virtualB.remainingDrivingMs !== 4.5 * HOUR) {
    throw new Error(`virtuální šachta 2 četla řízení šachty 1 ${JSON.stringify(virtualB)}`)
  }
  if (virtualAManual.phase !== 'break' || virtualAManual.remainingBreakMs !== 35 * MINUTE) {
    throw new Error(`ruční doplnění šachty 1 ${JSON.stringify(virtualAManual)}`)
  }

  const previous = driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR)
  const current = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const cardAActivities = fillGaps([...previous.activities, ...current.activities], Date.UTC(2026, 0, 5), current.nowMs)
  const cardBActivities = fillGaps([span('driving', current.nowMs - HOUR, current.nowMs)], Date.UTC(2026, 0, 5), current.nowMs)
  const limitsA = dddShown(cardAActivities, current.nowMs, 'A', 1)
  const limitsB = dddShown(cardBActivities, current.nowMs, 'B', 2)
  const vehicle = minutesBetween(current.nowMs - 12 * HOUR, current.nowMs, 'driving')
  const paint = (
    source: typeof limitsA,
    slot: 1 | 2,
    named: VdoNamedScreen | null,
    activity: 'WORK' | 'AVAILABILITY',
    inserted: { card1?: boolean; card2?: boolean } = {},
  ) => renderLcd({
    activity,
    named,
    breakDisplay: source.breakDisplay,
    dailyRemainingMs: source.daily.remainingMs,
    weeklyRemainingMs: source.calendar.weeklyRemainingMs,
    fortnightRemainingMs: source.calendar.fortnightRemainingMs,
    fortnightSumMs: source.calendar.fortnightSumMs,
    extensionsRemaining: source.daily.extensionsRemaining,
    slot,
    crew: inserted.card1 === false || inserted.card2 === false ? false : true,
    card1Inserted: inserted.card1,
    card2Inserted: inserted.card2,
    otherWorkMs: inserted.card1 === false || inserted.card2 === false ? undefined : null,
    foreignHistory: vehicle,
    card2TemplateId: 'zmizik',
  })
  const firstA = paint(limitsA, 1, null, 'WORK')
  const firstB = paint(limitsB, 2, null, 'AVAILABILITY')
  const cardA = paint(limitsA, 1, 'vdoCard', 'WORK')
  const cardB = paint(limitsB, 2, 'vdoCard', 'AVAILABILITY')
  if (firstA.first !== 'VDO Z S z 00h30' || firstA.second !== 'Y z 00h45' || !cardA.second.includes('] S w 89h30') || !cardA.second.endsWith('--h--')) {
    throw new Error(`osádka šachta 1 ${firstA.first} / ${firstA.second} / ${cardA.first} ${cardA.second}`)
  }
  if (firstB.first !== 'VDO X S z 03h30' || firstB.second !== 'Y z 00h45' || !cardB.second.includes('^ S w 01h00') || !cardB.second.endsWith('--h--')) {
    throw new Error(`osádka šachta 2 ${firstB.first} / ${firstB.second} / ${cardB.first} ${cardB.second}`)
  }
  const walked = ['WORK', 'AVAILABILITY'].map((activity) => {
    const context = {
      vdoCounterActive: true,
      operatingScreenIndex: 0,
      card1Inserted: true,
      card2Inserted: true,
      isMultiManning: true,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId: null,
      cardNumber: 'A',
      slot2TemplateId: 'zmizik',
      slot2CardNumber: null,
      speed: 0,
      leftActivityId: activity,
      rightActivityId: activity,
    }
    const slot1Entry = vdo24hEntryAvailable(context)
    const slot2Entry = vdo24hEntryAvailable({ ...context, operatingScreenIndex: 1 })
    const toCard = vdoScreenAfterDown(null, slot1Entry, true)
    const to24 = vdoScreenAfterDown(toCard === 'index' ? null : toCard, slot1Entry, true)
    const toWeek = vdoScreenAfterDown(to24 === 'index' ? null : to24, slot1Entry, true)
    const toI = vdoScreenAfterDown(toWeek === 'index' ? null : toWeek, slot1Entry, true)
    const backCard = vdoScreenAfterUp(vdoScreenAfterUp(toI === 'index' ? null : toI, true) === 'index' ? null : vdoScreenAfterUp(toI, true), true)
    if (!slot1Entry || !slot2Entry || toCard !== 'vdoCard' || to24 !== 'vdo24h' || toWeek !== 'vdoWeek' || toI !== 'vdoi' || backCard !== 'vdo24h') {
      throw new Error(`${activity} osádka ${toCard} → ${to24} → ${toWeek} → ${toI}`)
    }
    if (vdoScreenAfterDown(null, slot2Entry, true) === 'index') throw new Error('navigace osádky zaměnila řidiče')
    const day = paint(limitsA, 1, 'vdo24h', activity)
    const week = paint(limitsA, 1, 'vdoWeek', activity)
    const info = paint(limitsA, 1, 'vdoi', activity)
    const dayB = paint(limitsB, 2, 'vdo24h', activity)
    const weekB = paint(limitsB, 2, 'vdoWeek', activity)
    const infoB = paint(limitsB, 2, 'vdoi', activity)
    if (day.first !== 'VDO24h S 09:30' || day.second !== 'Y ---- b ----' || week.first !== 'VDO t S 11:30' || week.second !== 'Y ---- b ----' || !info.first.startsWith('VDOi') || !info.second.includes('10h')) {
      throw new Error(`obrazovky šachty 1 ${day.first} ${day.second} / ${week.first} / ${info.first} ${info.second}`)
    }
    if (dayB.first === day.first || weekB.first === week.first || infoB.second === info.second) {
      throw new Error(`šachta 2 nemá vlastní obrazovky ${dayB.first} / ${weekB.first} / ${infoB.second}`)
    }
    return { activity, slot1: firstA.first, slot2: firstB.first, day: day.first, dayB: dayB.first, week: week.first, weekB: weekB.first, vdoi: info.second, vdoiB: infoB.second }
  })
  if (vdo24hEntryAvailable({
    vdoCounterActive: true,
    operatingScreenIndex: 1,
    card1Inserted: true,
    card2Inserted: true,
    isMultiManning: true,
    ferryTrainModeActive: false,
    outModeActive: false,
    templateId: null,
    cardNumber: 'A',
    slot2CardNumber: 'B',
    speed: 0,
    leftActivityId: 'WORK',
    rightActivityId: 'REST',
  })) {
    throw new Error('šachta 2 se otevřela podle činnosti šachty 1')
  }
  const ejectedContext = {
    vdoCounterActive: true,
    operatingScreenIndex: 1,
    card1Inserted: true,
    card2Inserted: false,
    isMultiManning: false,
    ferryTrainModeActive: false,
    outModeActive: false,
    templateId: null,
    cardNumber: 'A',
    slot2TemplateId: null,
    slot2CardNumber: null,
  }
  const ejectedProps = slot1CounterLcdProps({
    diagnostics: false,
    context: ejectedContext,
    dddBreak: limitsA.breakDisplay,
    daily: limitsA.daily,
    calendar: limitsA.calendar,
    virtualDebugBreak: null,
  })
  if (counterCardSlot(1, true, false) !== 1 || ejectedProps.slot1DebugBreak !== limitsA.breakDisplay) {
    throw new Error('po vysunutí šachty 2 nezůstal řidič 1')
  }
  const ejected = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: limitsA.breakDisplay,
    dailyRemainingMs: limitsA.daily.remainingMs,
    weeklyRemainingMs: limitsA.calendar.weeklyRemainingMs,
    fortnightRemainingMs: limitsA.calendar.fortnightRemainingMs,
    fortnightSumMs: limitsA.calendar.fortnightSumMs,
    extensionsRemaining: limitsA.daily.extensionsRemaining,
    slot: 2,
    card1Inserted: true,
    card2Inserted: false,
    leftActivityId: 'WORK',
    rightActivityId: 'REST',
  })
  if (ejected.first !== firstA.first) throw new Error(`po vysunutí ${ejected.first}`)
  const hiddenCard2 = slot1CounterLcdProps({
    diagnostics: false,
    context: { ...ejectedContext, operatingScreenIndex: 0, card1Inserted: false, card2Inserted: true, cardNumber: null, slot2CardNumber: 'B' },
    dddBreak: limitsB.breakDisplay,
    daily: limitsB.daily,
    calendar: limitsB.calendar,
    virtualDebugBreak: null,
  })
  if (hiddenCard2.slot1DebugBreak) throw new Error('vysunutá šachta 1 dostala výpočet druhé karty')
  const emptyCard1 = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: limitsB.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    legacy: true,
    card1Inserted: false,
    card2Inserted: true,
    slot: 1,
  })
  if (emptyCard1.first === firstA.first || emptyCard1.first === firstB.first) {
    throw new Error(`vysunutá šachta 1 nechala staré hodnoty ${emptyCard1.first}`)
  }
  if (crewPairCounterSelected({ ...ejectedContext, card2Inserted: true, isMultiManning: true, ferryTrainModeActive: true, slot2CardNumber: 'B' })) {
    throw new Error('trajekt při osádce zapnul nový Counter')
  }
  if (slot1DddCounterSelected({ ...ejectedContext, card2Inserted: true, isMultiManning: true, operatingScreenIndex: 0 })) {
    throw new Error('původní výběr šachty 1 začal platit pro osádku')
  }
  return { slot1: firstA.first, slot2: firstB.first, second1: firstA.second, second2: firstB.second, walked, ejected: ejected.first, withoutCard1: emptyCard1.first }
}

function ejectAndSwapLcd() {
  if (counterIndexAfterCardRemoval({ index: 0, card1Inserted: false, card2Inserted: true }) !== 1) {
    throw new Error('Counter po vysunutí šachty 1 nepřešel na šachtu 2')
  }
  if (counterIndexAfterCardRemoval({ index: 1, card1Inserted: true, card2Inserted: false }) !== 1) {
    throw new Error('vysunutí šachty 2 změnilo index')
  }
  const previous = driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR)
  const current = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const cardAActivities = fillGaps([...previous.activities, ...current.activities], Date.UTC(2026, 0, 5), current.nowMs)
  const cardBActivities = fillGaps([span('driving', current.nowMs - HOUR, current.nowMs)], Date.UTC(2026, 0, 5), current.nowMs)
  const limitsA = dddShown(cardAActivities, current.nowMs, 'A', 1)
  const limitsB = dddShown(cardBActivities, current.nowMs, 'B', 2)
  const paint = (
    source: typeof limitsA,
    slot: 1 | 2,
    named: VdoNamedScreen | null,
    inserted: { card1: boolean; card2: boolean },
    activity: 'WORK' | 'AVAILABILITY' = 'WORK',
  ) => renderLcd({
    activity,
    named,
    breakDisplay: source.breakDisplay,
    dailyRemainingMs: source.daily.remainingMs,
    weeklyRemainingMs: source.calendar.weeklyRemainingMs,
    fortnightRemainingMs: source.calendar.fortnightRemainingMs,
    fortnightSumMs: source.calendar.fortnightSumMs,
    extensionsRemaining: source.daily.extensionsRemaining,
    slot,
    card1Inserted: inserted.card1,
    card2Inserted: inserted.card2,
    card2TemplateId: 'zmizik',
    leftActivityId: slot === 1 || !inserted.card2 ? activity : 'REST',
    rightActivityId: slot === 2 && inserted.card2 ? activity : 'REST',
  })
  const onlyB = [null, 'vdo24h', 'vdoWeek', 'vdoi'] as const
  const afterSlot1Gone = onlyB.map((named) => paint(limitsB, 2, named, { card1: false, card2: true }))
  if (afterSlot1Gone[0]?.first !== 'VDO Z S z 03h30' || afterSlot1Gone[0]?.second !== 'Y z 00h45' || afterSlot1Gone[1]?.first !== 'VDO24h S 09:00' || afterSlot1Gone[2]?.first !== 'VDO t S 55:00' || afterSlot1Gone[3]?.second !== '---- S 10h 2') {
    throw new Error(`po vysunutí šachty 1 ${afterSlot1Gone.map((row) => `${row.first} / ${row.second}`).join(' | ')}`)
  }
  const onlyA = [null, 'vdo24h', 'vdoWeek', 'vdoi'] as const
  const afterSlot2Gone = onlyA.map((named) => paint(limitsA, 2, named, { card1: true, card2: false }))
  if (afterSlot2Gone[0]?.first !== 'VDO Z S z 00h30' || afterSlot2Gone[0]?.second !== 'Y z 00h45' || afterSlot2Gone[1]?.first !== 'VDO24h S 09:30' || afterSlot2Gone[2]?.first !== 'VDO t S 11:30' || afterSlot2Gone[3]?.second !== '---- S 10h 1') {
    throw new Error(`po vysunutí šachty 2 ${afterSlot2Gone.map((row) => `${row.first} / ${row.second}`).join(' | ')}`)
  }

  const nowMs = Date.UTC(2026, 0, 7, 12, 0, 20)
  const minute = Math.floor(nowMs / 60_000) * 60_000
  const start = minute - 150 * MINUTE
  const recorded = minutesBetween(start, minute, 'driving').map((entry) => ({
    ...entry,
    driver1: 'driving' as const,
    driver2: 'availability' as const,
    driver1CardId: 'A',
    driver2CardId: 'B',
  }))
  const samples = Array.from({ length: 20 }, (_, index) => ({
    timestampUtc: minute + (index + 1) * 1000,
    driver1: 'driving' as const,
    driver2: 'availability' as const,
    driver1CardId: 'A',
    driver2CardId: 'B',
    speed: 80,
  }))
  let cards = {
    A: createDddCardRecord({ ...card([]), cardNumber: 'A', lastWithdrawalUtc: nowMs }),
    B: createDddCardRecord({ ...card([]), cardNumber: 'B', lastWithdrawalUtc: nowMs }),
  }
  cards = appendWorkingMinutes(cards, 'A', recorded)
  cards = appendWorkingMinutes(cards, 'B', recorded)
  const beforeA = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards, cardNumber: 'A', secondSamples: samples, nowMs, recordedDriver: 1,
  }).intervals, nowMs)
  const beforeB = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards, cardNumber: 'B', secondSamples: samples, nowMs, recordedDriver: 2,
  }).intervals, nowMs)
  const afterA = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards, cardNumber: 'A', secondSamples: samples, nowMs, recordedDriver: 2,
  }).intervals, nowMs)
  const afterB = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards, cardNumber: 'B', secondSamples: samples, nowMs, recordedDriver: 1,
  }).intervals, nowMs)
  if (beforeA.phase !== 'driving' || beforeA.remainingDrivingMs !== 2 * HOUR - 20_000 || afterA.phase !== 'driving' || afterA.remainingDrivingMs !== beforeA.remainingDrivingMs) {
    throw new Error(`jízda karty A se po prohození ztratila ${JSON.stringify(beforeA)} / ${JSON.stringify(afterA)}`)
  }
  if (beforeB.phase !== 'driving' || beforeB.remainingDrivingMs !== 4.5 * HOUR || afterB.phase !== 'driving' || afterB.remainingDrivingMs !== beforeB.remainingDrivingMs) {
    throw new Error(`jízda karty A se připsala kartě B ${JSON.stringify(beforeB)} / ${JSON.stringify(afterB)}`)
  }
  const virtualAfterA = drivingBreakDisplay(buildSlot1VirtualCounterIntervals({
    cardHistory: recorded,
    manual: [],
    secondSamples: samples,
    nowMs,
    driverSlot: 2,
    cardId: 'A',
  }), nowMs)
  const virtualAfterB = drivingBreakDisplay(buildSlot1VirtualCounterIntervals({
    cardHistory: recorded,
    manual: [],
    secondSamples: samples,
    nowMs,
    driverSlot: 1,
    cardId: 'B',
  }), nowMs)
  if (virtualAfterA.phase !== 'driving' || virtualAfterA.remainingDrivingMs !== afterA.remainingDrivingMs || virtualAfterB.remainingDrivingMs !== afterB.remainingDrivingMs) {
    throw new Error(`virtuální prohození ${JSON.stringify(virtualAfterA)} / ${JSON.stringify(virtualAfterB)}`)
  }
  const swappedA = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: afterA,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    slot: 2,
    crew: true,
    card2TemplateId: 'zmizik',
  })
  const swappedB = renderLcd({
    activity: 'AVAILABILITY',
    named: null,
    breakDisplay: afterB,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    slot: 1,
    crew: true,
  })
  if (swappedB.first !== 'VDO X S z 04h30' || swappedB.second !== 'Y z 00h45' || swappedA.first !== 'VDO Z S z 02h00' || swappedA.second !== 'Y z 00h45') {
    throw new Error(`LCD po prohození ${swappedB.first} / ${swappedA.first}`)
  }
  return {
    ejectedSlot1: afterSlot1Gone.map((row) => row.first),
    ejectedSlot1Vdoi: afterSlot1Gone[3]?.second,
    ejectedSlot2: afterSlot2Gone.map((row) => row.first),
    ejectedSlot2Vdoi: afterSlot2Gone[3]?.second,
    swappedSlot1: swappedB.first,
    swappedSlot2: swappedA.first,
  }
}

function crewStaysOn(input: {
  card1: boolean
  card2: boolean
  interrupted: boolean
  drivingStart: number | null
  card2At: number | null
}) {
  if (!input.card1 || !input.card2) return false
  if (input.interrupted) return false
  if (input.drivingStart === null) return true
  if (input.card2At === null) return true
  return input.card2At <= input.drivingStart + MULTI_MANNING_ONE_HOUR_MS
}

function crewOffPairLcd() {
  const drivingStart = Date.UTC(2026, 0, 7, 10, 0, 0)
  const insertedAt = drivingStart + 61 * MINUTE
  const stoppedAt = insertedAt + 10 * MINUTE
  if (crewStaysOn({ card1: true, card2: true, interrupted: false, drivingStart, card2At: insertedAt })) {
    throw new Error('61 minut po rozjezdu zapnulo osádku')
  }
  if (!crewStaysOn({ card1: true, card2: true, interrupted: false, drivingStart, card2At: drivingStart + MULTI_MANNING_ONE_HOUR_MS })) {
    throw new Error('vložení do hodiny osádku vypnulo')
  }
  if (crewStaysOn({ card1: true, card2: true, interrupted: true, drivingStart, card2At: drivingStart })) {
    throw new Error('přerušení osádky se zrušilo')
  }
  if (crewStaysOn({ card1: true, card2: false, interrupted: false, drivingStart: null, card2At: null })) {
    throw new Error('chybějící karta zapnula osádku')
  }
  if (!crewStaysOn({ card1: true, card2: true, interrupted: false, drivingStart: null, card2At: insertedAt })) {
    throw new Error('obě karty před rozjezdem osádku nezapnuly')
  }

  const solo = minutesBetween(drivingStart, insertedAt, 'driving').map((entry) => ({
    ...entry,
    driver1: 'driving' as const,
    driver2: 'availability' as const,
    isCrew: false,
    driver1CardId: 'A',
    driver2CardId: NO_CARD,
  }))
  const together = minutesBetween(insertedAt, stoppedAt, 'driving').map((entry) => ({
    ...entry,
    driver1: 'driving' as const,
    driver2: 'availability' as const,
    isCrew: false,
    driver1CardId: 'A',
    driver2CardId: 'B',
  }))
  const recorded = [...solo, ...together]
  let lateCards = {
    A: createDddCardRecord({ ...card([]), cardNumber: 'A', lastWithdrawalUtc: stoppedAt }),
    B: createDddCardRecord({ ...card([]), cardNumber: 'B', lastWithdrawalUtc: stoppedAt }),
  }
  lateCards = appendWorkingMinutes(lateCards, 'A', recorded)
  lateCards = appendWorkingMinutes(lateCards, 'B', recorded)
  const drivenA = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards: lateCards, cardNumber: 'A', secondSamples: [], nowMs: stoppedAt, recordedDriver: 1,
  }).intervals, stoppedAt)
  const drivenB = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards: lateCards, cardNumber: 'B', secondSamples: [], nowMs: stoppedAt, recordedDriver: 2,
  }).intervals, stoppedAt)
  const expectedA = 4.5 * HOUR - (61 + 10) * MINUTE
  if (drivenA.phase !== 'driving' || drivenA.remainingDrivingMs !== expectedA) {
    throw new Error(`jízda karty A po pozdním vložení ${JSON.stringify(drivenA)}`)
  }
  if (drivenB.phase !== 'driving' || drivenB.remainingDrivingMs !== 4.5 * HOUR) {
    throw new Error(`jízda karty A se připsala kartě B ${JSON.stringify(drivenB)}`)
  }
  const virtualA = drivingBreakDisplay(buildSlot1VirtualCounterIntervals({
    cardHistory: recorded, manual: [], secondSamples: [], nowMs: stoppedAt, driverSlot: 1, cardId: 'A',
  }), stoppedAt)
  const virtualB = drivingBreakDisplay(buildSlot1VirtualCounterIntervals({
    cardHistory: recorded, manual: [], secondSamples: [], nowMs: stoppedAt, driverSlot: 2, cardId: 'B',
  }), stoppedAt)
  if (virtualA.remainingDrivingMs !== drivenA.remainingDrivingMs || virtualB.remainingDrivingMs !== drivenB.remainingDrivingMs) {
    throw new Error('virtuální karty bez osádky přečetly jinou šachtu')
  }

  const previous = driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR)
  const current = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const limitsA = dddShown(fillGaps([...previous.activities, ...current.activities], Date.UTC(2026, 0, 5), current.nowMs), current.nowMs, 'A', 1)
  const limitsB = dddShown(fillGaps([span('driving', current.nowMs - HOUR, current.nowMs)], Date.UTC(2026, 0, 5), current.nowMs), current.nowMs, 'B', 2)
  const context = {
    vdoCounterActive: true,
    operatingScreenIndex: 0,
    card1Inserted: true,
    card2Inserted: true,
    isMultiManning: false,
    ferryTrainModeActive: false,
    outModeActive: false,
    templateId: null as string | null,
    cardNumber: 'A' as string | null,
    slot2TemplateId: 'zmizik' as string | null,
    slot2CardNumber: 'B' as string | null,
  }
  if (!crewOffPairCounterSelected(context) || !crewOffPairCounterSelected({ ...context, operatingScreenIndex: 1 })) {
    throw new Error('dvě karty bez osádky nezapnuly nový Counter')
  }
  if (crewOffPairCounterSelected({ ...context, isMultiManning: true }) || crewOffPairCounterSelected({ ...context, ferryTrainModeActive: true }) || crewOffPairCounterSelected({ ...context, outModeActive: true })) {
    throw new Error('vypnutá osádka změnila podmínky trajektu, OUT nebo zapnuté osádky')
  }
  if (slot2OnlyCounterSelected(context) || slot1DddCounterSelected({ ...context, isMultiManning: true })) {
    throw new Error('původní výběr samotné šachty se rozšířil')
  }
  const propsB = slot1CounterLcdProps({
    diagnostics: false,
    context: { ...context, operatingScreenIndex: 1 },
    dddBreak: limitsB.breakDisplay,
    daily: limitsB.daily,
    calendar: limitsB.calendar,
    virtualDebugBreak: null,
  })
  if (propsB.slot1DebugBreak !== limitsB.breakDisplay || propsB.slot1DebugFortnightSumMs !== limitsB.calendar.fortnightSumMs || propsB.slot1DebugOtherWorkMs !== undefined) {
    throw new Error('šachta 2 bez osádky nedostala vlastní blok')
  }
  const paint = (
    source: typeof limitsA,
    slot: 1 | 2,
    named: VdoNamedScreen | null,
    activity: 'WORK' | 'AVAILABILITY',
    inserted: { card1: boolean; card2: boolean } = { card1: true, card2: true },
  ) => renderLcd({
    activity,
    named,
    breakDisplay: source.breakDisplay,
    dailyRemainingMs: source.daily.remainingMs,
    weeklyRemainingMs: source.calendar.weeklyRemainingMs,
    fortnightRemainingMs: source.calendar.fortnightRemainingMs,
    fortnightSumMs: source.calendar.fortnightSumMs,
    extensionsRemaining: source.daily.extensionsRemaining,
    slot,
    crew: false,
    card1Inserted: inserted.card1,
    card2Inserted: inserted.card2,
    card2TemplateId: 'zmizik',
    leftActivityId: slot === 2 && inserted.card2 ? 'REST' : activity,
    rightActivityId: slot === 2 && inserted.card2 ? activity : 'REST',
  })
  const firstA = paint(limitsA, 1, null, 'WORK')
  const firstB = paint(limitsB, 2, null, 'WORK')
  const cardA = paint(limitsA, 1, 'vdoCard', 'WORK')
  const cardB = paint(limitsB, 2, 'vdoCard', 'WORK')
  if (firstA.first !== 'VDO Z S z 00h30' || firstA.second !== 'Y z 00h45' || !cardA.second.includes('] S w 89h30') || !cardA.second.includes('Z')) {
    throw new Error(`bez osádky šachta 1 ${firstA.first} / ${cardA.first} ${cardA.second}`)
  }
  if (firstB.first !== 'VDO Z S z 03h30' || firstB.second !== 'Y z 00h45' || !cardB.second.includes('^ S w 01h00') || !cardB.second.includes('Z')) {
    throw new Error(`bez osádky šachta 2 ${firstB.first} / ${cardB.first} ${cardB.second}`)
  }
  const walked = ['WORK', 'AVAILABILITY'].map((activity) => {
    const slot1Entry = vdo24hEntryAvailable({ ...context, speed: 0, leftActivityId: activity, rightActivityId: 'REST' })
    const slot2Entry = vdo24hEntryAvailable({ ...context, operatingScreenIndex: 1, speed: 0, leftActivityId: 'REST', rightActivityId: activity })
    const toCard = vdoScreenAfterDown(null, slot1Entry, true)
    const slot2Card = vdoScreenAfterDown(null, slot2Entry, true)
    const to24 = vdoScreenAfterDown(toCard === 'index' ? null : toCard, slot1Entry, true)
    const toWeek = vdoScreenAfterDown(to24 === 'index' ? null : to24, slot1Entry, true)
    const toI = vdoScreenAfterDown(toWeek === 'index' ? null : toWeek, slot1Entry, true)
    if (!slot1Entry || !slot2Entry || toCard !== 'vdoCard' || slot2Card !== 'vdoCard' || to24 !== 'vdo24h' || toWeek !== 'vdoWeek' || toI !== 'vdoi') {
      throw new Error(`${activity} bez osádky ${toCard} → ${to24} → ${toWeek} → ${toI}`)
    }
    const day = paint(limitsA, 1, 'vdo24h', activity)
    const week = paint(limitsA, 1, 'vdoWeek', activity)
    const info = paint(limitsA, 1, 'vdoi', activity)
    const dayB = paint(limitsB, 2, 'vdo24h', activity)
    const weekB = paint(limitsB, 2, 'vdoWeek', activity)
    const infoB = paint(limitsB, 2, 'vdoi', activity)
    if (day.first !== 'VDO24h S 09:30' || week.first !== 'VDO t S 11:30' || info.second !== '---- S 10h 1') {
      throw new Error(`obrazovky šachty 1 ${day.first} / ${week.first} / ${info.second}`)
    }
    if (dayB.first !== 'VDO24h S 09:00' || weekB.first !== 'VDO t S 55:00' || infoB.second !== '---- S 10h 2') {
      throw new Error(`obrazovky šachty 2 ${dayB.first} / ${weekB.first} / ${infoB.second}`)
    }
    return { activity, slot1: firstA.first, slot2: firstB.first, day: day.first, dayB: dayB.first, week: week.first, weekB: weekB.first, vdoi: info.second, vdoiB: infoB.second }
  })
  if (vdo24hEntryAvailable({ ...context, operatingScreenIndex: 1, speed: 0, leftActivityId: 'WORK', rightActivityId: 'REST' })) {
    throw new Error('šachta 2 se otevřela podle jiné práce šachty 1')
  }
  if (vdo24hEntryAvailable({ ...context, speed: 10, leftActivityId: 'WORK', rightActivityId: 'WORK' })) {
    throw new Error('za jízdy se obrazovky bez osádky otevřely')
  }
  if (counterIndexAfterCardRemoval({ index: 0, card1Inserted: false, card2Inserted: true }) !== 1) {
    throw new Error('vysunutí vybrané šachty 1 nepřešlo na šachtu 2')
  }
  const ejectedSlot1 = (['vdo24h', 'vdoWeek', 'vdoi'] as const).map((named) => paint(limitsB, 2, named, 'WORK', { card1: false, card2: true }))
  const ejectedCounter = paint(limitsB, 2, null, 'WORK', { card1: false, card2: true })
  if (ejectedCounter.first !== firstB.first || ejectedSlot1[0]?.first !== 'VDO24h S 09:00' || ejectedSlot1[1]?.first !== 'VDO t S 55:00' || ejectedSlot1[2]?.second !== '---- S 10h 2') {
    throw new Error(`po vysunutí vybrané šachty 1 ${ejectedCounter.first} / ${ejectedSlot1.map((row) => row.first).join(' / ')}`)
  }
  const ejectedSlot2 = paint(limitsA, 2, null, 'WORK', { card1: true, card2: false })
  const ejectedSlot2Day = paint(limitsA, 2, 'vdo24h', 'WORK', { card1: true, card2: false })
  if (counterIndexAfterCardRemoval({ index: 1, card1Inserted: true, card2Inserted: false }) !== 1 || ejectedSlot2.first !== firstA.first || ejectedSlot2Day.first !== 'VDO24h S 09:30') {
    throw new Error(`po vysunutí vybrané šachty 2 ${ejectedSlot2.first} / ${ejectedSlot2Day.first}`)
  }
  return {
    crewOff: true,
    drivingA: firstA.first,
    drivingB: firstB.first,
    secondA: firstA.second,
    secondB: firstB.second,
    walked,
    ejectedSlot1: ejectedCounter.first,
    ejectedSlot2: ejectedSlot2.first,
    lateDrivingAMs: drivenA.remainingDrivingMs,
    lateDrivingBMs: drivenB.remainingDrivingMs,
  }
}

function drivingTotal(intervals: readonly DrivingBreakInterval[]): number {
  return intervals.reduce((sum, interval) => sum + (interval.kind === 'driving' ? interval.endMs - interval.startMs : 0), 0)
}

function outSequenceLcd() {
  const now = Date.UTC(2026, 0, 7, 11, 30, 0)
  const outEnd = now - 30 * MINUTE
  const outStart = outEnd - HOUR
  const driveStart = outStart - 2 * HOUR
  const prevMonday = Date.UTC(2025, 11, 29)
  const activities = [
    span('rest', prevMonday, driveStart),
    span('driving', driveStart, outStart),
    span('driving', outStart, outEnd),
    span('driving', outEnd, now),
  ]
  const storedActivities = JSON.stringify(activities)
  const conditions = [
    { kind: 'out', atUtc: outStart },
    { kind: 'out_end', atUtc: outEnd },
  ]
  const record = createDddCardRecord({ ...card(activities), specificConditions: conditions, lastWithdrawalUtc: now })
  const raw = buildSlot1DddDrivingBreakIntervals({
    cards: { A: record },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: now,
  }).intervals
  const fromCard = (source: DddCardRecord, atMs: number, vehicleEvents: { minuteStartUtc: number; type: 'activation' | 'deactivation' }[] = []) => evaluateRecordedOut({
    ...buildSlot1DddOutSources({ cards: { A: source }, cardNumber: 'A', secondSamples: [], nowMs: atMs }),
    cardConditions: source.original.specificConditions,
    vehicleEvents,
    nowMs: atMs,
  })
  const evaluatedResult = fromCard(record, now)
  const evaluated = evaluatedResult.intervals
  if (evaluatedResult.undetermined.length !== 0) throw new Error('uzavřený OUT označil jízdu za nedoloženou')
  if (JSON.stringify(record.original.activities) !== storedActivities || record.original.activities.filter((item) => item.kind === 'driving').length !== 3) {
    throw new Error('vyhodnocení OUT změnilo původní jízdu na kartě')
  }
  const ignoredOtherCard = evaluateRecordedOut({ imported: raw, vehicle: [], nowMs: now }).intervals
  if (drivingTotal(ignoredOtherCard) !== drivingTotal(raw)) {
    throw new Error('hranice jiné karty se připočetly vybrané kartě')
  }
  const duringActivities = activities.slice(0, 3)
  const duringRecord = createDddCardRecord({
    ...card(duringActivities),
    specificConditions: [{ kind: 'out', atUtc: outStart }],
    lastWithdrawalUtc: outEnd,
  })
  const duringRaw = buildSlot1DddDrivingBreakIntervals({
    cards: { A: duringRecord },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: outEnd,
  }).intervals
  const duringResult = fromCard(duringRecord, outEnd)
  const during = duringResult.intervals
  if (duringResult.undetermined.length !== 0) throw new Error('souvislý otevřený OUT bez mezery je nedoložený')
  const outSlice = (intervals: readonly DrivingBreakInterval[]) => intervals.filter((interval) => interval.startMs < outEnd && interval.endMs > outStart)
  if (outSlice(during).some((interval) => interval.kind !== 'work') || outSlice(evaluated).some((interval) => interval.kind !== 'work')) {
    throw new Error('po vypnutí OUT se doložený úsek vyhodnotil jinak')
  }
  if (drivingTotal(during) !== 2 * HOUR || drivingTotal(evaluated) !== 2 * HOUR + 30 * MINUTE) {
    throw new Error(`součet řízení ${drivingTotal(during)} / ${drivingTotal(evaluated)}`)
  }
  const plain = drivingBreakDisplay(raw, now)
  const afterBreak = drivingBreakDisplay(evaluated, now)
  const duringBreak = drivingBreakDisplay(during, outEnd)
  if (!plain || plain.phase !== 'driving' || plain.remainingDrivingMs !== HOUR) throw new Error(`bez hranic ${JSON.stringify(plain)}`)
  if (!duringBreak || duringBreak.phase !== 'driving' || duringBreak.remainingDrivingMs !== 2 * HOUR + 30 * MINUTE || duringBreak.requiredBreakMs !== 45 * MINUTE) {
    throw new Error(`jízda v OUT ${JSON.stringify(duringBreak)}`)
  }
  if (!afterBreak || afterBreak.phase !== 'driving' || afterBreak.remainingDrivingMs !== 2 * HOUR || afterBreak.requiredBreakMs !== 45 * MINUTE) {
    throw new Error(`po OUT ${JSON.stringify(afterBreak)}`)
  }
  const liveHistory = [
    ...minutesBetween(driveStart, outStart, 'driving'),
    ...minutesBetween(outStart, outEnd, 'driving'),
    ...minutesBetween(outEnd, now, 'driving'),
  ]
  const storedLive = JSON.stringify(liveHistory)
  const vehicleEvents = [
    { minuteStartUtc: outStart, type: 'activation' as const },
    { minuteStartUtc: outEnd, type: 'deactivation' as const },
  ]
  const live = evaluateRecordedOut({
    imported: [],
    vehicle: buildSlot1VirtualCounterIntervals({ cardHistory: liveHistory, manual: [], secondSamples: [], nowMs: now }),
    vehicleEvents,
    nowMs: now,
  }).intervals
  if (JSON.stringify(liveHistory) !== storedLive || liveHistory.some((entry) => entry.driver1 !== 'driving')) {
    throw new Error('živý záznam jízdy se přepsal na jinou práci')
  }
  if (drivingTotal(live) !== drivingTotal(evaluated)) throw new Error(`živá simulace ${drivingTotal(live)} a DDD ${drivingTotal(evaluated)}`)
  const before = drivingBreakDisplay(buildSlot1DddDrivingBreakIntervals({
    cards: { A: createDddCardRecord({ ...card(activities.slice(0, 2)), lastWithdrawalUtc: outStart }) },
    cardNumber: 'A',
    secondSamples: [],
    nowMs: outStart,
  }).intervals, outStart)
  const calendar = slot1DddCalendarRemaining(evaluated, now)
  const plainCalendar = slot1DddCalendarRemaining(raw, now)
  if (calendar.fortnightSumMs !== 2 * HOUR + 30 * MINUTE || plainCalendar.fortnightSumMs !== 3 * HOUR + 30 * MINUTE) {
    throw new Error(`dvoutýdenní součet ${calendar.fortnightSumMs} / ${plainCalendar.fortnightSumMs}`)
  }
  const paintOut = (display: NonNullable<typeof afterBreak>, sum: number | null, atOut: boolean) => renderLcd({
    activity: 'DRIVING',
    named: null,
    breakDisplay: display,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: sum,
    outMode: atOut,
  })
  const beforeLcd = paintOut(before!, null, false)
  const duringLcd = paintOut(duringBreak, null, true)
  const afterLcd = paintOut(afterBreak, null, false)
  const cardLcd = renderLcd({
    activity: 'DRIVING',
    named: 'vdoCard',
    breakDisplay: afterBreak,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: calendar.fortnightRemainingMs,
    fortnightSumMs: calendar.fortnightSumMs,
    outMode: false,
  })
  const plainLcd = paintOut(plain, null, false)
  if (beforeLcd.first !== 'VDO S S z 02h30' || beforeLcd.second !== 'Y z 00h45') throw new Error(`běžná jízda ${beforeLcd.first} / ${beforeLcd.second}`)
  if (duringLcd.first !== 'VDO S S z 02h30' || duringLcd.second !== 'Y z 00h45' || duringLcd.first.includes('Z')) throw new Error(`jízda v OUT ${duringLcd.first} / ${duringLcd.second}`)
  if (afterLcd.first !== 'VDO S S z 02h00' || afterLcd.second !== 'Y z 00h45' || afterLcd.first !== paintOut(afterBreak, null, true).first) {
    throw new Error(`po vypnutí OUT ${afterLcd.first} / ${afterLcd.second}`)
  }
  if (plainLcd.first !== 'VDO S S z 01h00' || !cardLcd.second.includes('] S w 02h30')) {
    throw new Error(`součet ${plainLcd.first} / ${cardLcd.first}`)
  }
  const olderImport = createDddCardRecord({
    ...card([span('rest', prevMonday, driveStart), span('driving', driveStart, outStart)]),
    lastWithdrawalUtc: now,
  })
  const withVehicleMinutes = appendWorkingMinutes(
    { A: olderImport },
    'A',
    minutesBetween(outStart, outEnd, 'driving'),
  )
  const vehicleOnImported = evaluateRecordedOut({
    ...buildSlot1DddOutSources({ cards: withVehicleMinutes, cardNumber: 'A', secondSamples: [], nowMs: now }),
    vehicleEvents,
    nowMs: now,
  })
  const importedSlice = vehicleOnImported.intervals.filter((interval) => interval.startMs < outStart && interval.endMs > driveStart)
  const vehicleSlice = vehicleOnImported.intervals.filter((interval) => interval.startMs < outEnd && interval.endMs > outStart)
  if (importedSlice.some((interval) => interval.kind !== 'driving') || vehicleSlice.some((interval) => interval.kind !== 'work')) {
    throw new Error(`hranice vozidla změnila import ${importedSlice.map((interval) => interval.kind).join(',')} / vozidlo ${vehicleSlice.map((interval) => interval.kind).join(',')}`)
  }
  const gapStart = outEnd
  const gapEnd = gapStart + HOUR
  const afterGapEnd = gapEnd + HOUR
  const openRecord = createDddCardRecord({
    ...card([
      span('rest', prevMonday, driveStart),
      span('driving', driveStart, outStart),
      span('driving', outStart, gapStart),
      span('driving', gapEnd, afterGapEnd),
    ]),
    specificConditions: [{ kind: 'out', atUtc: outStart }],
    lastWithdrawalUtc: afterGapEnd,
  })
  const openGap = fromCard(openRecord, afterGapEnd)
  const continuousOut = openGap.intervals.filter((interval) => interval.startMs < gapStart && interval.endMs > outStart)
  const afterGap = openGap.intervals.filter((interval) => interval.startMs < afterGapEnd && interval.endMs > gapEnd)
  if (continuousOut.some((interval) => interval.kind !== 'work') || afterGap.some((interval) => interval.kind === 'work')) {
    throw new Error(`otevřený OUT přešel mezeru ${continuousOut.map((interval) => interval.kind).join(',')} / ${afterGap.map((interval) => interval.kind).join(',')}`)
  }
  if (openGap.undetermined.length !== 1 || openGap.undetermined[0]?.startMs !== gapEnd || openGap.undetermined[0]?.endMs !== afterGapEnd) {
    throw new Error(`nedoložený úsek ${JSON.stringify(openGap.undetermined)}`)
  }
  const gapBreak = drivingBreakDisplay(openGap.intervals, afterGapEnd)
  const gapLcd = renderLcd({
    activity: 'DRIVING',
    named: null,
    breakDisplay: gapBreak,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    drivingKnown: false,
  })
  const gapCard = renderLcd({
    activity: 'DRIVING',
    named: 'vdoCard',
    breakDisplay: gapBreak,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    drivingKnown: false,
  })
  if (gapLcd.first !== 'VDO S S z ----' || gapLcd.second !== 'Y z 00h45' || !gapCard.second.includes('S w --h--')) {
    throw new Error(`nedoložený rozsah ${gapLcd.first} / ${gapLcd.second} / ${gapCard.first}`)
  }
  const overlapped = evaluateRecordedOut({
    imported: [{ kind: 'driving', startMs: outStart, endMs: outEnd }],
    vehicle: [{ kind: 'driving', startMs: outStart, endMs: outEnd }],
    vehicleEvents,
    nowMs: now,
  })
  if (overlapped.intervals.some((interval) => interval.kind !== 'driving')) {
    throw new Error(`hranice vozidla přepsaly import ${overlapped.intervals.map((interval) => interval.kind).join(',')}`)
  }
  const liveNotEntered = evaluateRecordedOut({
    imported: buildSlot1DddOutSources({ cards: { A: openRecord }, cardNumber: 'A', secondSamples: [], nowMs: afterGapEnd + 30 * MINUTE }).imported,
    vehicle: [{ kind: 'driving', startMs: afterGapEnd, endMs: afterGapEnd + 30 * MINUTE }],
    cardConditions: openRecord.original.specificConditions,
    nowMs: afterGapEnd + 30 * MINUTE,
  })
  if (liveNotEntered.intervals.some((interval) => interval.startMs >= afterGapEnd && interval.kind !== 'driving')) {
    throw new Error('otevřený OUT z DDD přešel do živé simulace')
  }
  if (!normalInsertedCardCounter({
    vdoCounterActive: true,
    operatingScreenIndex: 0,
    card1Inserted: true,
    isMultiManning: false,
    ferryTrainModeActive: false,
    outModeActive: true,
    cardNumber: 'A',
  })) {
    throw new Error('OUT nezůstal na novém Counteru')
  }
  return {
    before: beforeLcd.first,
    beforeSecond: beforeLcd.second,
    during: duringLcd.first,
    duringSecond: duringLcd.second,
    after: afterLcd.first,
    afterSecond: afterLcd.second,
    card: cardLcd.first,
    plain: plainLcd.first,
    liveDrivingMs: drivingTotal(live),
    dddDrivingMs: drivingTotal(evaluated),
    vehicleOwn: vehicleSlice.map((interval) => interval.kind).join(','),
    importedUntouched: overlapped.intervals.every((interval) => interval.kind === 'driving'),
    gap: gapLcd.first,
    gapSecond: gapLcd.second,
    gapCard: gapCard.first,
  }
}

function ferrySequenceLcd() {
  const now = Date.UTC(2026, 0, 8, 12, 0, 0)
  const restStart = now - 3 * HOUR
  const continuous: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: restStart - 2 * HOUR, endMs: restStart },
    { kind: 'rest', startMs: restStart, endMs: now },
  ]
  const uninterrupted = ferryDailyRestRemaining({
    imported: continuous,
    vehicle: [],
    cardConditions: [{ kind: 'ferry', atUtc: restStart }],
    nowMs: now,
  })
  if (uninterrupted.accumulatedMs !== 3 * HOUR || uninterrupted.remainingMs !== 8 * HOUR || uninterrupted.conditional) {
    throw new Error(`nepřerušený odpočinek ${uninterrupted.accumulatedMs} / ${uninterrupted.remainingMs}`)
  }
  const show = (
    intervals: DrivingBreakInterval[],
    atMs: number,
    ferry: boolean,
    ferryRestMs: number | null,
    activity: 'DRIVING' | 'REST' | 'WORK',
    ferryRestConditional = false,
  ) => renderLcd({
    activity: 'WORK',
    leftActivityId: activity,
    named: null,
    breakDisplay: drivingBreakDisplay(intervals, atMs),
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    ferry,
    ferryRestMs,
    ferryRestConditional,
  })
  const calm = show(continuous, now, true, uninterrupted.remainingMs, 'REST', false)
  if (calm.first !== 'VDO Y S z 04h30' || calm.second !== 'Y z 08h00' || calm.ferryRest !== 'recorded') {
    throw new Error(`nepřerušený displej ${calm.first} / ${calm.second} / ${calm.ferryRest}`)
  }

  const workStart = now - 2 * HOUR
  const workEnd = workStart + 20 * MINUTE
  const firstRest = workStart - 2 * HOUR
  const interrupted: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: firstRest - 2 * HOUR, endMs: firstRest },
    { kind: 'rest', startMs: firstRest, endMs: workStart },
    { kind: 'work', startMs: workStart, endMs: workEnd },
    { kind: 'rest', startMs: workEnd, endMs: now },
  ]
  const joined = ferryDailyRestRemaining({
    imported: interrupted,
    vehicle: [],
    cardConditions: [
      { kind: 'ferry', atUtc: firstRest },
      { kind: 'ferry_end', atUtc: now },
    ],
    nowMs: now,
  })
  const joinedRest = 2 * HOUR + (now - workEnd)
  if (joined.accumulatedMs !== joinedRest || joined.remainingMs !== 11 * HOUR - joinedRest || !joined.conditional) {
    throw new Error(`přerušení ${joined.accumulatedMs} / ${joined.remainingMs} / ${joined.conditional}`)
  }
  const joinedLcd = show(interrupted, now, true, joined.remainingMs, 'REST', true)
  if (joinedLcd.first !== 'VDO Y S z 04h30' || joinedLcd.second !== 'Y z 07h20' || joinedLcd.ferryRest !== 'conditional') {
    throw new Error(`přerušení displej ${joinedLcd.first} / ${joinedLcd.second} / ${joinedLcd.ferryRest}`)
  }
  const duringIntervals = interrupted
    .filter((item) => item.startMs < workEnd)
    .map((item) => (item.endMs > workEnd ? { ...item, endMs: workEnd } : item))
  const during = ferryDailyRestRemaining({
    imported: duringIntervals,
    vehicle: [],
    cardConditions: [
      { kind: 'ferry', atUtc: firstRest },
      { kind: 'ferry_end', atUtc: now },
    ],
    nowMs: workEnd,
  })
  if (during.accumulatedMs !== 2 * HOUR || during.remainingMs !== 9 * HOUR) {
    throw new Error(`nalodění ${during.accumulatedMs} / ${during.remainingMs}`)
  }
  const vehicleDoesNotJoin = ferryDailyRestRemaining({
    imported: interrupted,
    vehicle: [],
    vehicleEvents: [
      { minuteStartUtc: firstRest, type: 'activation' },
      { minuteStartUtc: now, type: 'deactivation' },
    ],
    nowMs: now,
  })
  if (vehicleDoesNotJoin.accumulatedMs !== now - workEnd) {
    throw new Error(`hranice vozidla přepsaly DDD ${vehicleDoesNotJoin.accumulatedMs}`)
  }

  const twoAt = Date.UTC(2026, 0, 8, 19, 0, 0)
  const twoFirst = twoAt - 11 * HOUR
  const twoWorkA = twoFirst + 4 * HOUR
  const twoRestB = twoWorkA + 30 * MINUTE
  const twoWorkB = twoRestB + 4 * HOUR
  const twoRestC = twoWorkB + 30 * MINUTE
  const twoIntervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: twoFirst - 2 * HOUR, endMs: twoFirst },
    { kind: 'rest', startMs: twoFirst, endMs: twoWorkA },
    { kind: 'work', startMs: twoWorkA, endMs: twoRestB },
    { kind: 'rest', startMs: twoRestB, endMs: twoWorkB },
    { kind: 'work', startMs: twoWorkB, endMs: twoRestC },
    { kind: 'rest', startMs: twoRestC, endMs: twoAt },
  ]
  const two = ferryDailyRestRemaining({
    imported: twoIntervals,
    vehicle: [],
    cardConditions: [
      { kind: 'ferry', atUtc: twoFirst },
      { kind: 'ferry_end', atUtc: twoAt },
    ],
    nowMs: twoAt,
  })
  if (two.accumulatedMs !== 10 * HOUR || two.remainingMs !== HOUR || !two.conditional) {
    throw new Error(`dvě přerušení po 30 min ${two.accumulatedMs} / ${two.remainingMs}`)
  }
  const twoLcd = show(twoIntervals, twoAt, true, two.remainingMs, 'REST', true)
  if (twoLcd.first !== 'VDO Y S z 04h30' || twoLcd.second !== 'Y z 01h00' || twoLcd.ferryRest !== 'conditional') {
    throw new Error(`dvě přerušení displej ${twoLcd.first} / ${twoLcd.second} / ${twoLcd.ferryRest}`)
  }

  const longWorkEnd = twoWorkB + 31 * MINUTE
  const longNow = longWorkEnd + 2 * HOUR
  const longIntervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: twoFirst - 2 * HOUR, endMs: twoFirst },
    { kind: 'rest', startMs: twoFirst, endMs: twoWorkA },
    { kind: 'work', startMs: twoWorkA, endMs: twoRestB },
    { kind: 'rest', startMs: twoRestB, endMs: twoWorkB },
    { kind: 'work', startMs: twoWorkB, endMs: longWorkEnd },
    { kind: 'rest', startMs: longWorkEnd, endMs: longNow },
  ]
  const tooLong = ferryDailyRestRemaining({
    imported: longIntervals,
    vehicle: [],
    cardConditions: [
      { kind: 'ferry', atUtc: twoFirst },
      { kind: 'ferry_end', atUtc: longNow },
    ],
    nowMs: longNow,
  })
  if (tooLong.accumulatedMs !== 2 * HOUR || tooLong.remainingMs !== 9 * HOUR || tooLong.conditional || tooLong.completed.length !== 0) {
    throw new Error(`61 minut ${tooLong.accumulatedMs} / ${tooLong.remainingMs} / ${tooLong.completed.length}`)
  }
  const tooLongLcd = show(longIntervals, longNow, true, tooLong.remainingMs, 'REST', false)
  if (tooLongLcd.first !== 'VDO Y S z 04h30' || tooLongLcd.second !== 'Y z 09h00' || tooLongLcd.ferryRest !== 'recorded') {
    throw new Error(`61 minut displej ${tooLongLcd.first} / ${tooLongLcd.second} / ${tooLongLcd.ferryRest}`)
  }

  const thirdAt = Date.UTC(2026, 0, 8, 16, 30, 0)
  const thirdStart = thirdAt - (8 * HOUR + 30 * MINUTE)
  const thirdPieces: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: thirdStart - 2 * HOUR, endMs: thirdStart },
  ]
  let thirdCursor = thirdStart
  for (let index = 0; index < 4; index += 1) {
    const restEnd = thirdCursor + 2 * HOUR
    thirdPieces.push({ kind: 'rest', startMs: thirdCursor, endMs: restEnd })
    thirdCursor = restEnd
    if (index < 3) {
      thirdPieces.push({ kind: 'work', startMs: thirdCursor, endMs: thirdCursor + 10 * MINUTE })
      thirdCursor += 10 * MINUTE
    }
  }
  if (thirdCursor !== thirdAt) throw new Error(`tři přerušení čas ${thirdCursor - thirdAt}`)
  const three = ferryDailyRestRemaining({
    imported: thirdPieces,
    vehicle: [],
    cardConditions: [
      { kind: 'ferry', atUtc: thirdStart },
      { kind: 'ferry_end', atUtc: thirdAt },
    ],
    nowMs: thirdAt,
  })
  if (three.accumulatedMs !== 2 * HOUR || three.remainingMs !== 9 * HOUR || three.conditional) {
    throw new Error(`tři přerušení ${three.accumulatedMs} / ${three.remainingMs}`)
  }
  const threeLcd = show(thirdPieces, thirdAt, true, three.remainingMs, 'REST', false)
  if (threeLcd.first !== 'VDO Y S z 04h30' || threeLcd.second !== 'Y z 09h00') {
    throw new Error(`tři přerušení displej ${threeLcd.first} / ${threeLcd.second}`)
  }

  const gapStart = now - 2 * HOUR
  const gapEnd = now - HOUR
  const ambiguousIntervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: gapStart - 4 * HOUR, endMs: gapStart - 2 * HOUR },
    { kind: 'rest', startMs: gapStart - 2 * HOUR, endMs: gapStart },
    { kind: 'rest', startMs: gapEnd, endMs: now },
  ]
  const ambiguous = ferryDailyRestRemaining({
    imported: ambiguousIntervals,
    vehicle: [],
    cardConditions: [{ kind: 'ferry', atUtc: gapStart - 2 * HOUR }],
    nowMs: now,
  })
  if (ambiguous.remainingMs !== null) throw new Error('otevřený trajekt přešel mezeru')
  const ambiguousLcd = show(ambiguousIntervals, now, true, ambiguous.remainingMs, 'REST')
  if (ambiguousLcd.first !== 'VDO Y S z 04h30' || ambiguousLcd.second !== 'Y z ----') {
    throw new Error(`nejednoznačný displej ${ambiguousLcd.first} / ${ambiguousLcd.second}`)
  }
  const empty = ferryDailyRestRemaining({
    imported: [],
    vehicle: [],
    cardConditions: [{ kind: 'ferry', atUtc: now - HOUR }],
    nowMs: now,
  })
  if (empty.remainingMs !== null || empty.conditional) throw new Error('symbol trajektu založil odpočinek')

  const ferryEnd = now - 30 * MINUTE
  const afterIntervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: ferryEnd - 5 * HOUR, endMs: ferryEnd - 3 * HOUR },
    { kind: 'rest', startMs: ferryEnd - 3 * HOUR, endMs: ferryEnd },
    { kind: 'driving', startMs: ferryEnd, endMs: now },
  ]
  const afterRest = ferryDailyRestRemaining({
    imported: afterIntervals,
    vehicle: [],
    cardConditions: [
      { kind: 'ferry', atUtc: ferryEnd - 3 * HOUR },
      { kind: 'ferry_end', atUtc: ferryEnd },
    ],
    nowMs: now,
  })
  if (afterRest.remainingMs !== null) throw new Error('uzavřený odpočinek zůstal na běžné jízdě')
  const returned = show(afterIntervals, now, false, null, 'DRIVING')
  if (returned.first !== 'VDO S S z 04h00' || returned.second !== 'Y z 00h45' || returned.ferryRest !== '') {
    throw new Error(`návrat ${returned.first} / ${returned.second} / ${returned.ferryRest}`)
  }

  const doneEnd = Date.UTC(2026, 0, 8, 18, 0, 0)
  const doneNow = doneEnd + 30 * MINUTE
  const doneWorkEnd = doneEnd - 6 * HOUR
  const doneWorkStart = doneWorkEnd - 30 * MINUTE
  const doneRestStart = doneWorkStart - 5 * HOUR
  const doneIntervals: DrivingBreakInterval[] = [
    { kind: 'driving', startMs: doneRestStart - 2 * HOUR, endMs: doneRestStart },
    { kind: 'rest', startMs: doneRestStart, endMs: doneWorkStart },
    { kind: 'work', startMs: doneWorkStart, endMs: doneWorkEnd },
    { kind: 'rest', startMs: doneWorkEnd, endMs: doneEnd },
    { kind: 'driving', startMs: doneEnd, endMs: doneNow },
  ]
  const done = ferryDailyRestRemaining({
    imported: doneIntervals,
    vehicle: [],
    cardConditions: [
      { kind: 'ferry', atUtc: doneRestStart },
      { kind: 'ferry_end', atUtc: doneEnd },
    ],
    nowMs: doneNow,
  })
  if (done.remainingMs !== null || done.completed.length !== 1 || done.completed[0]?.endMs !== doneEnd || done.completed[0]?.conditional !== true) {
    throw new Error(`dokončený odpočinek ${JSON.stringify(done.completed)}`)
  }
  const unrecognized = slot1DddDailyRemaining(doneIntervals, doneNow)
  if (unrecognized.remainingMs !== null) throw new Error('samotné úseky pod 9 h ukončily denní období')
  const recognizedIntervals = intervalsWithRecognizedFerryRest(doneIntervals, done.completed)
  if (recognizedIntervals.length !== doneIntervals.length) throw new Error('syntetický interval přidal odpočinek')
  for (let index = 0; index < doneIntervals.length; index += 1) {
    const left = recognizedIntervals[index]!
    const right = doneIntervals[index]!
    if (left.kind !== right.kind || left.startMs !== right.startMs || left.endMs !== right.endMs) {
      throw new Error('syntetický interval přepsal přerušení')
    }
  }
  const recognizedDaily = slot1DddDailyRemaining(
    recognizedIntervals,
    doneNow,
    done.completed.map((item) => item.endMs),
  )
  if (recognizedDaily.remainingMs !== 9 * HOUR - 30 * MINUTE) {
    throw new Error(`uznaný odpočinek ${recognizedDaily.remainingMs}`)
  }
  const doneCounter = show(doneIntervals, doneNow, false, null, 'DRIVING', true)
  const doneDay = renderLcd({
    activity: 'DRIVING',
    leftActivityId: 'DRIVING',
    named: 'vdo24h',
    breakDisplay: drivingBreakDisplay(doneIntervals, doneNow),
    dailyRemainingMs: recognizedDaily.remainingMs,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
  })
  if (doneCounter.first !== 'VDO S S z 04h00' || doneCounter.second !== 'Y z 00h45' || doneCounter.ferryRest !== 'conditional' || doneDay.first !== 'VDO24h S 08:30') {
    throw new Error(`návrat po 11 h ${doneCounter.first} / ${doneCounter.second} / ${doneCounter.ferryRest} / ${doneDay.first}`)
  }
  return {
    uninterrupted: `${calm.first} / ${calm.second}`,
    interrupted: `${joinedLcd.first} / ${joinedLcd.second} / ${joinedLcd.ferryRest}`,
    twoInterruptions: `${twoLcd.first} / ${twoLcd.second} / ${twoLcd.ferryRest}`,
    sixtyOne: `${tooLongLcd.first} / ${tooLongLcd.second}`,
    three: `${threeLcd.first} / ${threeLcd.second}`,
    ambiguous: `${ambiguousLcd.first} / ${ambiguousLcd.second}`,
    returned: `${returned.first} / ${returned.second}`,
    recognized: `${doneCounter.first} / ${doneCounter.second}`,
    recognizedDay: doneDay.first,
    recognizedBunk: 'conditional',
  }
}

function noLegacyFallbackLcd() {
  const previous = driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR)
  const current = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const limits = dddShown(fillGaps([...previous.activities, ...current.activities], Date.UTC(2026, 0, 5), current.nowMs), current.nowMs, 'A', 1)
  const complete = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: limits.daily.remainingMs,
    weeklyRemainingMs: limits.calendar.weeklyRemainingMs,
    fortnightRemainingMs: limits.calendar.fortnightRemainingMs,
    fortnightSumMs: limits.calendar.fortnightSumMs,
    extensionsRemaining: limits.daily.extensionsRemaining,
  })
  const completeCard = renderLcd({
    activity: 'WORK',
    named: 'vdoCard',
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: limits.daily.remainingMs,
    weeklyRemainingMs: limits.calendar.weeklyRemainingMs,
    fortnightRemainingMs: limits.calendar.fortnightRemainingMs,
    fortnightSumMs: limits.calendar.fortnightSumMs,
    extensionsRemaining: limits.daily.extensionsRemaining,
  })
  if (complete.first !== 'VDO Z S z 00h30' || complete.second !== 'Y z 00h45' || !completeCard.second.includes('] S w 89h30') || !completeCard.second.includes('Z --h--')) {
    throw new Error(`úplná historie ${complete.first} / ${complete.second} / ${completeCard.first} ${completeCard.second}`)
  }
  const zero = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: { phase: 'driving', remainingDrivingMs: 0, requiredBreakMs: 0 },
    dailyRemainingMs: 0,
    weeklyRemainingMs: 0,
    fortnightRemainingMs: 0,
    fortnightSumMs: 0,
    extensionsRemaining: 0,
  })
  if (zero.first !== 'VDO Z S z 00h00' || zero.second !== 'Y z 00h00') {
    throw new Error(`skutečná nula ${zero.first} / ${zero.second}`)
  }
  const partialCounter = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: limits.daily.remainingMs,
    weeklyRemainingMs: limits.calendar.weeklyRemainingMs,
    fortnightRemainingMs: limits.calendar.fortnightRemainingMs,
    fortnightSumMs: null,
  })
  const partial = renderLcd({
    activity: 'WORK',
    named: 'vdoCard',
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: limits.daily.remainingMs,
    weeklyRemainingMs: limits.calendar.weeklyRemainingMs,
    fortnightRemainingMs: limits.calendar.fortnightRemainingMs,
    fortnightSumMs: null,
  })
  if (partialCounter.first !== complete.first || partialCounter.second !== complete.second || !partial.second.includes('S w --h--') || !partial.second.includes('Z --h--')) {
    throw new Error(`platný blok a neznámý součet ${partialCounter.first} / ${partial.first} ${partial.second}`)
  }
  const missing = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    legacy: true,
  })
  const missingSlot2 = renderLcd({
    activity: 'WORK',
    named: null,
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    legacy: true,
    slot: 2,
    card1Inserted: false,
    card2TemplateId: 'zmizik',
  })
  const missingCard = renderLcd({
    activity: 'WORK',
    named: 'vdoCard',
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    legacy: true,
  })
  const missingSlot2Card = renderLcd({
    activity: 'WORK',
    named: 'vdoCard',
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    legacy: true,
    slot: 2,
    card1Inserted: false,
    card2TemplateId: 'zmizik',
  })
  if (missing.first !== 'VDO Z S z ----' || missing.second !== 'Y z ----' || !missingCard.second.includes('] S w --h--') || !missingCard.second.includes('Z --h--')) {
    throw new Error(`chybějící blok ${missing.first} / ${missing.second} / ${missingCard.first} ${missingCard.second}`)
  }
  if (missingSlot2.first !== 'VDO Z S z ----' || !missingSlot2Card.second.includes('^ S w --h--')) {
    throw new Error(`chybějící blok šachty 2 ${missingSlot2.first} / ${missingSlot2Card.first}`)
  }
  if (missing.first.includes('02:00') || missing.first.includes('00:15') || missing.first.includes('04:30')) {
    throw new Error(`chybějící blok použil původní Counter ${missing.first}`)
  }
  const ferry = renderLcd({
    activity: 'DRIVING',
    named: null,
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    legacy: true,
    ferry: true,
    drivingSinceLastBreakMs: 150 * MINUTE,
  })
  const outMode = renderLcd({
    activity: 'DRIVING',
    named: null,
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: null,
    fortnightRemainingMs: null,
    fortnightSumMs: null,
    legacy: true,
    outMode: true,
    drivingSinceLastBreakMs: 150 * MINUTE,
  })
  if (ferry.first !== 'VDO S S z ----' || ferry.second !== 'Y z ----' || ferry.first.includes('00:15')) {
    throw new Error(`trajekt bez doloženého odpočinku ${ferry.first} / ${ferry.second}`)
  }
  if (outMode.first !== 'VDO S S z ----' || outMode.second !== 'Y z ----' || outMode.first.includes('00:15')) {
    throw new Error(`OUT bez doložené historie ${outMode.first} / ${outMode.second}`)
  }
  if (!vdoCounterClosesWithoutCard(false, false) || vdoCounterClosesWithoutCard(true, false) || vdoCounterClosesWithoutCard(false, true)) {
    throw new Error('zavření Counteru neodpovídá poslední kartě')
  }
  if (!normalInsertedCardCounter({
    vdoCounterActive: true,
    operatingScreenIndex: 0,
    card1Inserted: true,
    isMultiManning: false,
    ferryTrainModeActive: true,
    outModeActive: false,
    cardNumber: 'A',
  })) {
    throw new Error('trajekt zůstal na původní větvi')
  }
  const ejected = renderLcd({
    activity: 'WORK',
    named: 'vdo24h',
    breakDisplay: limits.breakDisplay,
    dailyRemainingMs: limits.daily.remainingMs,
    weeklyRemainingMs: limits.calendar.weeklyRemainingMs,
    fortnightRemainingMs: limits.calendar.fortnightRemainingMs,
    fortnightSumMs: limits.calendar.fortnightSumMs,
    noCard: true,
  })
  if (ejected.screen !== 'operating' || ejected.first !== '' || ejected.second !== '') {
    throw new Error(`po poslední kartě zůstal Counter ${ejected.screen} ${ejected.first} ${ejected.second}`)
  }
  return {
    complete: complete.first,
    completeSecond: complete.second,
    zero: zero.first,
    zeroSecond: zero.second,
    partial: partial.second,
    missing: missing.first,
    missingSecond: missing.second,
    missingSlot2: missingSlot2.first,
    ferry: ferry.first,
    ferrySecond: ferry.second,
    ejected: ejected.screen,
  }
}

function sameHistoryLcd() {
  const nowMs = Date.UTC(2026, 0, 7, 12, 0, 0)
  const start = nowMs - 150 * MINUTE
  const block = paired(nowMs, [span('driving', start, nowMs)], minutesBetween(start, nowMs, 'driving'), [])
  if (block.ddd.first !== 'VDO S S z 02h00' || block.ddd.second !== 'Y z 00h45' || block.virtual.first !== block.ddd.first || block.virtual.second !== block.ddd.second) {
    throw new Error(`2:30 ${block.ddd.first} / ${block.virtual.first} | ${block.ddd.second} / ${block.virtual.second}`)
  }
  if (!block.ddd.card.second.includes('--h--') || block.ddd.card.second !== block.virtual.card.second) throw new Error(`chybějící historie ${block.ddd.card.second}`)
  const overlapped = virtualFrom(minutesBetween(start, nowMs, 'driving'), [
    { ...utcMsToSegment(start), activityId: 'REST' as const, isManualEntry: true as const },
    { ...utcMsToSegment(nowMs), activityId: 'REST' as const, isManualEntry: true as const },
  ], nowMs)
  if (overlapped.breakDisplay.phase !== 'driving' || overlapped.breakDisplay.remainingDrivingMs !== 2 * HOUR) {
    throw new Error('stejný úsek se započítal dvakrát')
  }

  const splitNow = start + 150 * MINUTE + 15 * MINUTE + 2 * HOUR + 10 * MINUTE
  const splitActivities = [
    span('driving', start, start + 150 * MINUTE),
    span('rest', start + 150 * MINUTE, start + 165 * MINUTE),
    span('driving', start + 165 * MINUTE, start + 165 * MINUTE + 2 * HOUR),
    span('rest', start + 165 * MINUTE + 2 * HOUR, splitNow),
  ]
  const split = paired(splitNow, splitActivities, activitiesToMinutes(splitActivities), [])
  if (split.ddd.first !== 'VDO S S z 00h00' || split.ddd.second !== 'Y z 00h20' || split.virtual.first !== split.ddd.first || split.virtual.second !== split.ddd.second) {
    throw new Error(`dělená přestávka ${split.ddd.first} / ${split.virtual.first}`)
  }

  const previous = driveChunks(Date.UTC(2026, 0, 5), 45 * HOUR)
  const current = withShortTail(Date.UTC(2026, 0, 12), 44 * HOUR, 30 * MINUTE)
  const filled = fillGaps([...previous.activities, ...current.activities], Date.UTC(2026, 0, 5), current.nowMs)
  const limits = paired(current.nowMs, filled, activitiesToMinutes(filled), [])
  if (limits.ddd.first !== 'VDO S S z 00h30' || limits.ddd.second !== 'Y z 00h45' || limits.virtual.first !== limits.ddd.first || limits.virtual.second !== limits.ddd.second) {
    throw new Error(`56/90 ${limits.ddd.first} ${limits.ddd.second} / ${limits.virtual.first} ${limits.virtual.second}`)
  }
  if (!limits.ddd.card.second.includes('89h30') || limits.ddd.card.second !== limits.virtual.card.second) throw new Error(`součet 90 h ${limits.ddd.card.second}`)
  const dddWeek = renderWeekExtensions({ ...limits.dddSource, extensions: limits.dddSource.daily.extensionsRemaining }, 'WORK', 'vdoWeek')
  const virtualWeek = renderWeekExtensions({ ...limits.virtualSource, extensions: limits.virtualSource.daily.extensionsRemaining }, 'WORK', 'vdoWeek')
  if (dddWeek.first !== 'VDO t S 11:30' || virtualWeek.first !== dddWeek.first) {
    throw new Error(`týdenní obrazovka ${dddWeek.first} / ${virtualWeek.first}`)
  }

  const walked = ['WORK', 'AVAILABILITY'].map((activity) => {
    const entry = vdo24hEntryAvailable({
      vdoCounterActive: true,
      operatingScreenIndex: 0,
      card1Inserted: true,
      isMultiManning: false,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId: 'zmizik',
      cardNumber: null,
      card2Inserted: false,
      speed: 0,
      leftActivityId: activity,
    })
    const toCard = vdoScreenAfterDown(null, entry, true)
    const to24 = vdoScreenAfterDown(toCard === 'index' ? null : toCard, entry, true)
    const toWeek = vdoScreenAfterDown(to24 === 'index' ? null : to24, entry, true)
    const toI = vdoScreenAfterDown(toWeek === 'index' ? null : toWeek, entry, true)
    const backWeek = vdoScreenAfterUp(toI === 'index' ? null : toI, true)
    const back24 = vdoScreenAfterUp(backWeek === 'index' ? null : backWeek, true)
    const backCard = vdoScreenAfterUp(back24 === 'index' ? null : back24, true)
    const backCounter = vdoScreenAfterUp(backCard === 'index' ? null : backCard, true)
    if (toCard !== 'vdoCard' || to24 !== 'vdo24h' || toWeek !== 'vdoWeek' || toI !== 'vdoi' || backWeek !== 'vdoWeek' || back24 !== 'vdo24h' || backCard !== 'vdoCard' || backCounter !== null) {
      throw new Error(`${activity} ${toCard} → ${to24} → ${toWeek} → ${toI} → ${String(backWeek)} → ${String(back24)} → ${String(backCard)} → ${String(backCounter)}`)
    }
    return activity
  })
  if (vdo24hEntryAvailable({
    vdoCounterActive: true,
    operatingScreenIndex: 0,
    card1Inserted: true,
    isMultiManning: false,
    ferryTrainModeActive: false,
    outModeActive: false,
    templateId: 'zmizik',
    cardNumber: null,
    card2Inserted: false,
    speed: 10,
    leftActivityId: 'WORK',
  })) {
    throw new Error('za jízdy se pojmenované obrazovky otevřely')
  }

  return {
    block: { ddd: block.ddd, virtual: block.virtual },
    split: { ddd: split.ddd.first, virtual: split.virtual.first },
    limits: { ddd: limits.ddd, virtual: limits.virtual, week: dddWeek.first },
    walked,
    originalModes: ['trajekt', 'součet jiné práce na obrazovce časů karty při vypnuté osádce'],
  }
}

function paired(
  nowMs: number,
  activities: DddParsedCard['activities'],
  history: ActivityHistoryEntry[],
  manual: Parameters<typeof buildSlot1VirtualCounterIntervals>[0]['manual'],
) {
  const record = createDddCardRecord({ ...card(activities), lastWithdrawalUtc: nowMs })
  const cards = { A: record }
  const dddBreak = buildSlot1DddDrivingBreak({ cards, cardNumber: 'A', secondSamples: [], nowMs })
  const dddIntervals = buildSlot1DddDrivingBreakIntervals({ cards, cardNumber: 'A', secondSamples: [], nowMs }).intervals
  const virtual = virtualFrom(history, manual, nowMs)
  if (!dddBreak) throw new Error('DDD karta nemá blok')
  const dddSource = {
    breakDisplay: dddBreak,
    daily: slot1DddDailyRemaining(dddIntervals, nowMs),
    calendar: slot1DddCalendarRemaining(dddIntervals, nowMs),
  }
  const virtualSource = virtual
  return {
    ddd: renderPair(dddSource, 'A', null),
    virtual: renderPair(virtualSource, null, 'zmizik'),
    dddSource,
    virtualSource,
  }
}

function virtualFrom(history: ActivityHistoryEntry[], manual: Parameters<typeof buildSlot1VirtualCounterIntervals>[0]['manual'], nowMs: number) {
  const intervals = buildSlot1VirtualCounterIntervals({ cardHistory: history, manual, secondSamples: [], nowMs })
  const breakDisplay = drivingBreakDisplay(intervals, nowMs)
  return {
    breakDisplay,
    daily: slot1DddDailyRemaining(intervals, nowMs),
    calendar: slot1DddCalendarRemaining(intervals, nowMs),
  }
}

function renderPair(
  source: { breakDisplay: NonNullable<ReturnType<typeof buildSlot1DddDrivingBreak>>; daily: ReturnType<typeof slot1DddDailyRemaining>; calendar: ReturnType<typeof slot1DddCalendarRemaining> },
  cardNumber: string | null,
  templateId: string | null,
) {
  const props = slot1CounterLcdProps({
    diagnostics: false,
    context: {
      vdoCounterActive: true,
      operatingScreenIndex: 0,
      card1Inserted: true,
      isMultiManning: false,
      ferryTrainModeActive: false,
      outModeActive: false,
      templateId,
      cardNumber,
    },
    dddBreak: source.breakDisplay,
    daily: source.daily,
    calendar: source.calendar,
    virtualDebugBreak: null,
  })
  const values = {
    activity: 'DRIVING' as const,
    breakDisplay: source.breakDisplay,
    dailyRemainingMs: props.slot1DebugDailyRemainingMs ?? null,
    weeklyRemainingMs: props.slot1DebugWeeklyRemainingMs ?? null,
    fortnightRemainingMs: props.slot1DebugFortnightRemainingMs ?? null,
    fortnightSumMs: props.slot1DebugFortnightSumMs ?? null,
    extensionsRemaining: props.slot1DebugDailyExtensionsRemaining ?? null,
  }
  return { ...renderLcd({ ...values, named: null }), card: renderLcd({ ...values, named: 'vdoCard' }) }
}

function minutesBetween(startMs: number, endMs: number, kind: 'driving' | 'rest'): ActivityHistoryEntry[] {
  const entries: ActivityHistoryEntry[] = []
  for (let minute = startMs; minute + MINUTE <= endMs; minute += MINUTE) {
    entries.push({ minuteStartUtc: minute, driver1: kind, driver2: 'none' })
  }
  return entries
}

function activitiesToMinutes(activities: DddParsedCard['activities']): ActivityHistoryEntry[] {
  return activities.flatMap((item) => minutesBetween(item.startUtc, item.endUtc, item.kind === 'driving' ? 'driving' : 'rest'))
}

function manualRestWeek() {
  const nowMs = Date.UTC(2026, 0, 7, 15, 20, 20)
  const capMs = floorToMinute(nowMs) - 3 * MINUTE
  const startMs = Date.UTC(2025, 9, 1, 8, 0, 0)
  const staleBuffer = [
    localSegmentToUtcForBuffer({ ...localMsToSegment(startMs), activityId: 'REST' }),
    localSegmentToUtcForBuffer({ ...localMsToSegment(capMs), activityId: 'REST' }),
    { ...utcMsToSegment(capMs), activityId: 'START_COUNTRY' as const, countryCode: 'CZ', isManualEntry: true as const },
  ]
  const stale = readCard('A', startMs, staleBuffer, nowMs)
  if (stale.calendar.weeklyRemainingMs !== null) throw new Error('starý strop omylem pokryl týden')
  if (stale.coverage.manualRests[0]?.endMs !== capMs) throw new Error('konec potvrzeného odpočinku se při převodu ztratil')
  if (stale.coverage.hole?.startMs !== capMs || stale.coverage.hole.reason !== 'gap') {
    throw new Error(`očekávaná díra za stropem ${JSON.stringify(stale.coverage.hole)}`)
  }

  const committed = advanceConfirmedCapToMinute(staleBuffer, capMs, nowMs)
  if (segmentToMsUtc(committed[1]!) !== floorToMinute(nowMs)) throw new Error('konec se na minutu potvrzení neposunul')
  let cards = {
    A: createDddCardRecord(emptyCard('A', startMs)),
    B: createDddCardRecord(emptyCard('B', startMs)),
  }
  cards = replaceWorkingManual(cards, 'A', committed)
  if (cards.B?.workingManual.length !== 0) throw new Error('ruční odpočinek se zapsal na jinou kartu')
  const covered = readCard('A', startMs, cards.A!.workingManual, nowMs, cards)
  if (covered.calendar.weeklyRemainingMs !== WEEKLY_DRIVING_LIMIT_MS) {
    throw new Error(`pokrytý týden ${covered.calendar.weeklyRemainingMs}`)
  }
  if (covered.coverage.cardNumber !== 'A' || covered.coverage.hole) {
    throw new Error(`pokrytá karta ${JSON.stringify(covered.coverage)}`)
  }
  const coveredLcd = renderWeek(covered, 'WORK')
  if (!coveredLcd.first.includes('56:00') || coveredLcd.first.includes('----')) {
    throw new Error(`plné pokrytí ${coveredLcd.first} / ${coveredLcd.second}`)
  }
  if (!coveredLcd.second.includes('----')) throw new Error(`spodní řádek ${coveredLcd.second}`)

  const wrong = readCard('B', startMs, cards.B!.workingManual, nowMs, cards)
  if (wrong.calendar.weeklyRemainingMs !== null || wrong.coverage.manualRests.length !== 0) {
    throw new Error('výpočet použil odpočinek jiné karty')
  }

  const gapStart = Date.UTC(2026, 0, 7, 10, 0, 0)
  const gapEnd = Date.UTC(2026, 0, 7, 11, 0, 0)
  const gapBuffer = [
    point(startMs, 'REST'),
    { ...utcMsToSegment(gapStart), activityId: 'END_COUNTRY' as const, isManualEntry: true as const },
    point(gapEnd, 'REST'),
    point(floorToMinute(nowMs), 'REST'),
  ]
  const unknownBuffer = [
    point(startMs, 'REST'),
    point(gapStart, 'UNKNOWN'),
    point(gapEnd, 'UNKNOWN'),
    point(gapEnd, 'REST'),
    point(floorToMinute(nowMs), 'REST'),
  ]
  const gap = readCard('A', startMs, gapBuffer, nowMs)
  const gapLcd = renderWeek(gap, 'WORK')
  if (gap.coverage.hole?.reason !== 'gap' || !gapLcd.first.includes('----') || gapLcd.first.includes('56:00')) {
    throw new Error(`mezera ${gapLcd.first} / ${JSON.stringify(gap.coverage.hole)}`)
  }
  if (gapLcd.second !== coveredLcd.second) throw new Error(`spodní řádek mezery ${gapLcd.second}`)

  const unknownCard = createDddCardRecord({
    ...emptyCard('A', startMs),
    activities: [{ kind: 'unknown', startUtc: gapStart, endUtc: gapEnd, slot: 1 }],
  })
  unknownCard.workingManual = unknownBuffer
  const unknown = readCard('A', startMs, unknownBuffer, nowMs, { A: unknownCard })
  const unknownLcd = renderWeek(unknown, 'AVAILABILITY')
  if (unknown.coverage.hole?.reason !== 'unknown' || !unknownLcd.first.includes('----') || unknownLcd.second !== coveredLcd.second) {
    throw new Error(`unknown ${unknownLcd.first} / ${JSON.stringify(unknown.coverage.hole)}`)
  }

  const open = readCard('A', startMs, [point(startMs, 'REST')], nowMs)
  if (open.coverage.manualRests[0]?.endMs != null || open.calendar.weeklyRemainingMs !== null) {
    throw new Error('odpočinek bez konce se protáhl do teď')
  }

  const confirmMinute = floorToMinute(nowMs)
  const afterCloseMs = confirmMinute + MINUTE + 20_000
  let continued = { A: createDddCardRecord(emptyCard('A', startMs)) }
  continued = replaceWorkingManual(continued, 'A', committed)
  continued = appendWorkingMinutes(continued, 'A', [{
    minuteStartUtc: confirmMinute,
    driver1: 'rest',
    driver2: 'none',
  }])
  const afterClose = readCard('A', startMs, committed, afterCloseMs, continued)
  const afterCloseLcd = renderWeek(afterClose, 'WORK')
  if (afterClose.coverage.hole || afterClose.calendar.weeklyRemainingMs !== WEEKLY_DRIVING_LIMIT_MS || !afterCloseLcd.first.includes('56:00')) {
    throw new Error(`po uzavření minuty ${afterCloseLcd.first} / ${JSON.stringify(afterClose.coverage.hole)}`)
  }
  const droppedMinute = readCard('A', startMs, committed, afterCloseMs)
  const droppedLcd = renderWeek(droppedMinute, 'WORK')
  if (!droppedMinute.coverage.hole || droppedMinute.coverage.hole.startMs !== confirmMinute || !droppedLcd.first.includes('----')) {
    throw new Error(`chybějící minuta nemá být pokrytá ${droppedLcd.first}`)
  }

  return {
    weekStartUtc: new Date(covered.coverage.weekStartMs).toISOString(),
    nowUtc: new Date(nowMs).toISOString(),
    storedBefore: isoRest(stale.coverage.manualRests[0]),
    holeBefore: stale.coverage.hole ? `${stale.coverage.hole.reason} ${new Date(stale.coverage.hole.startMs).toISOString()} – ${new Date(stale.coverage.hole.endMs).toISOString()}` : 'žádný',
    storedAfter: isoRest(covered.coverage.manualRests[0]),
    holeAfter: covered.coverage.hole ? 'je' : 'žádný',
    card: covered.coverage.cardNumber,
    covered: { first: coveredLcd.first, second: coveredLcd.second },
    afterMinuteClose: { first: afterCloseLcd.first, second: afterCloseLcd.second, nowUtc: new Date(afterCloseMs).toISOString() },
    missingMinute: { first: droppedLcd.first, second: droppedLcd.second },
    gap: { first: gapLcd.first, second: gapLcd.second },
    unknown: { first: unknownLcd.first, second: unknownLcd.second },
  }
}

function isoRest(rest: { startMs: number; endMs: number | null } | undefined) {
  if (!rest) return 'není uložený'
  return `${new Date(rest.startMs).toISOString()} – ${rest.endMs == null ? 'bez konce' : new Date(rest.endMs).toISOString()}`
}

function point(ms: number, activityId: 'REST' | 'UNKNOWN') {
  return { ...utcMsToSegment(ms), activityId, isManualEntry: true as const }
}

function emptyCard(cardNumber: string, lastWithdrawalUtc: number): DddParsedCard {
  return { cardNumber, firstName: 'A', surname: 'Test', lastWithdrawalUtc, activities: [], locations: [] }
}

function readCard(
  cardNumber: string,
  lastWithdrawalUtc: number,
  manual: DddCardRecord['workingManual'],
  nowMs: number,
  cards?: Record<string, DddCardRecord>,
) {
  const record = cards?.[cardNumber] ?? createDddCardRecord(emptyCard(cardNumber, lastWithdrawalUtc))
  if (!cards) record.workingManual = manual
  const used = cards ?? { [cardNumber]: record }
  const breakDisplay = buildSlot1DddDrivingBreak({ cards: used, cardNumber, secondSamples: [], nowMs })
  const { intervals } = buildSlot1DddDrivingBreakIntervals({ cards: used, cardNumber, secondSamples: [], nowMs })
  const card = used[cardNumber]
  if (!breakDisplay || !card) throw new Error(`karta ${cardNumber} nevstoupila do výpočtu`)
  return {
    breakDisplay,
    calendar: slot1DddCalendarRemaining(intervals, nowMs),
    coverage: describeSlot1WeekCoverage({ card, intervals, nowMs }),
  }
}

function renderWeek(
  input: { breakDisplay: NonNullable<ReturnType<typeof buildSlot1DddDrivingBreak>>; calendar: ReturnType<typeof slot1DddCalendarRemaining> },
  activity: 'WORK' | 'AVAILABILITY',
) {
  return renderLcd({
    activity,
    named: 'vdoWeek',
    breakDisplay: input.breakDisplay,
    dailyRemainingMs: null,
    weeklyRemainingMs: input.calendar.weeklyRemainingMs,
    fortnightRemainingMs: input.calendar.fortnightRemainingMs,
    fortnightSumMs: input.calendar.fortnightSumMs,
  })
}

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

function cutRange(activities: DddParsedCard['activities'], startMs: number, endMs: number) {
  const cut: DddParsedCard['activities'] = []
  for (const item of activities) {
    if (item.endUtc <= startMs || item.startUtc >= endMs) {
      cut.push(item)
      continue
    }
    if (item.startUtc < startMs) cut.push({ ...item, endUtc: startMs })
    if (item.endUtc > endMs) cut.push({ ...item, startUtc: endMs })
  }
  return cut
}

function argumentsOf(
  _counter: { first: string },
  activity: 'WORK' | 'AVAILABILITY',
  named: VdoNamedScreen | null,
  breakDisplay: NonNullable<ReturnType<typeof buildSlot1DddDrivingBreak>>,
  lcdProps: ReturnType<typeof slot1CounterLcdProps>,
) {
  return {
    activity,
    named,
    breakDisplay,
    dailyRemainingMs: lcdProps.slot1DebugDailyRemainingMs ?? null,
    weeklyRemainingMs: lcdProps.slot1DebugWeeklyRemainingMs ?? null,
    fortnightRemainingMs: lcdProps.slot1DebugFortnightRemainingMs ?? null,
    fortnightSumMs: lcdProps.slot1DebugFortnightSumMs ?? null,
  }
}
