/**
 * Pevné vstupy pro L1 VDO Counteru. Bez simulovaného času a bez prohlížeče.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from '../src/translations/index.ts'
import { TachoDisplay } from '../src/TachoDisplay.tsx'
import { drivingBreakDisplay, type DrivingBreakDisplay, type DrivingBreakInterval } from '../src/drivingBreakDisplay.ts'
import type { TachoState } from '../src/TachoTypes.ts'

const MINUTE = 60_000

function span(kind: DrivingBreakInterval['kind'], startMin: number, endMin: number): DrivingBreakInterval {
  return { kind, startMs: startMin * MINUTE, endMs: endMin * MINUTE }
}

const after230 = drivingBreakDisplay([span('driving', 0, 150)], 150 * MINUTE)

const upToSecondPart: DrivingBreakInterval[] = [
  span('driving', 0, 150),
  span('rest', 150, 165),
  span('driving', 165, 285),
]

const afterStart = drivingBreakDisplay(upToSecondPart, 285 * MINUTE)
const duringTen = drivingBreakDisplay([...upToSecondPart, span('rest', 285, 295)], 295 * MINUTE)
const afterThirty = drivingBreakDisplay([...upToSecondPart, span('rest', 285, 315)], 315 * MINUTE)

const symbolMap = { 2: 'S', 7: 'X', 8: 'Y', 10: '[', 9: 'Z', 58: 'w' }

function installCardHistory(entries: { minuteStartUtc: number; driver1: 'driving' }[]) {
  const store = new Map<string, string>([['card1_activity_history', JSON.stringify(entries)]])
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value) },
        removeItem: (key: string) => { store.delete(key) },
      },
      location: { search: '' },
    },
  })
}

function drivingMinutes(startMs: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    minuteStartUtc: startMs + index * MINUTE,
    driver1: 'driving' as const,
  }))
}

function lcdLine(
  display: DrivingBreakDisplay | null,
  activity: 'DRIVING' | 'REST',
  options?: { simulatedUtcTime?: number; drivingSinceLastBreakMs?: number },
): { text: string; second: string; icons: string; secondIcons: string; kind: string | null; drivingMs: string | null } {
  const tachoState: TachoState = {
    targetSpeed: activity === 'DRIVING' ? 80 : 0,
    currentSpeed: activity === 'DRIVING' ? 80 : 0,
    odometerKm: 0,
    ignitionOn: true,
    card1Inserted: true,
    card2Inserted: false,
    isMultiManning: false,
    leftActivityId: activity,
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
        localTime={new Date(0)}
        currentMenu={null}
        selectedItem={null}
        currentMenuId=""
        entryMenuId=""
        leftActivityId={activity}
        rightActivityId="REST"
        vdoCounterActive
        operatingScreenIndex={0}
        card1Data={{ templateId: 'zmizik' }}
        simulatedUtcTime={options?.simulatedUtcTime ?? 0}
        activityHistory={[]}
        drivingSinceLastBreakMsByDriver={{ 1: options?.drivingSinceLastBreakMs ?? 0, 2: 0 }}
        slot1DebugBreak={display}
      />
    </LanguageProvider>,
  )
  const rows = [...html.matchAll(/<div class="lcd-row lcd-row-vdo">([\s\S]*?)<\/div>/g)].map((match) => match[1])
  const textOf = (row: string) => row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const iconsOf = (row: string) => [...row.matchAll(/tacho-icon[^>]*>([^<]*)</g)].map((match) => match[1]).join('')
  const kind = html.match(/data-lcd-right-kind="([^"]*)"/)?.[1] ?? null
  const drivingMs = html.match(/data-lcd-driving-ms="([^"]*)"/)?.[1] ?? null
  return { text: textOf(rows[0] ?? ''), second: textOf(rows[1] ?? ''), icons: iconsOf(rows[0] ?? ''), secondIcons: iconsOf(rows[1] ?? ''), kind, drivingMs }
}

function expectLine(label: string, actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`${label}: LCD má „${actual}“, očekáváno „${expected}“`)
  }
}

export function main() {
  installCardHistory([])
  const plain230 = lcdLine(after230, 'DRIVING')
  const withoutDebug = lcdLine(null, 'DRIVING', { drivingSinceLastBreakMs: 150 * MINUTE })

  const wednesday = Date.UTC(2026, 0, 7, 8, 0, 0)
  installCardHistory([
    ...drivingMinutes(Date.UTC(2026, 0, 5), 9 * 60 + 1),
    ...drivingMinutes(Date.UTC(2026, 0, 6), 9 * 60 + 1),
    ...drivingMinutes(Date.UTC(2026, 0, 7), 8 * 60),
  ])
  const dailyCap = lcdLine(after230, 'DRIVING', { simulatedUtcTime: wednesday })
  installCardHistory([])

  const started = lcdLine(afterStart, 'DRIVING')
  const ten = lcdLine(duringTen, 'REST')
  const done = lcdLine(afterThirty, 'REST')

  expectLine('po 2:30 bez přestávky', plain230.text, 'VDO S 02:00')
  expectLine('denní strop se nebere ze starého součtu', dailyCap.text, 'VDO S 02:00')
  expectLine('bez diagnostiky', withoutDebug.text, 'VDO S ----')
  if (plain230.kind !== 'next' || dailyCap.kind !== 'next' || withoutDebug.kind !== 'missing') {
    throw new Error(`větve ${plain230.kind} / ${dailyCap.kind} / ${withoutDebug.kind}`)
  }

  expectLine('po rozjezdu', started.text, 'VDO S 00:00')
  expectLine('spodní řádek po rozjezdu', started.second, '[ 00:30')
  expectLine('10 minut druhé části', ten.text, 'VDO Y 00:00')
  expectLine('spodní řádek běžící přestávky', ten.second, '[ 00:20 S 04:30')
  expectLine('po 30 minutách ve stání', done.text, 'VDO Y 04:30')
  expectLine('spodní řádek po dokončení', done.second, '[ 00:00')
  if (started.icons !== 'S' || ten.icons !== 'Y' || done.icons !== 'Y' || started.secondIcons !== '[' || ten.secondIcons !== '[S' || done.secondIcons !== '[') {
    throw new Error(`piktogramy ${started.icons}${started.secondIcons} / ${ten.icons}${ten.secondIcons} / ${done.icons}${done.secondIcons}`)
  }

  console.log(JSON.stringify({
    calculation: { afterStart, duringTen, afterThirty },
    lcd: { plain230, dailyCap, withoutDebug, started, ten, done },
  }, null, 2))
}
