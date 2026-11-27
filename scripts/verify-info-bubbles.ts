import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { drivingBreakDisplay, recognizedBreakAdvice } from '../src/drivingBreakDisplay.ts'
import {
  finalConfirmChoiceApplies,
  formatTachographMinute,
  nextFirstStopHint,
  useInfoPanelItems,
} from '../src/InfoPanel.tsx'
import { LanguageProvider } from '../src/translations/index.ts'
import type { CardInsertionState, SecondActivitySnapshot } from '../src/TachoTypes.ts'
import { evaluatePreDepartureWork } from '../src/vehiclePreDepartureCheck.ts'

const H = 60 * 60 * 1000
const M = 60 * 1000
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0)

assert.equal(formatTachographMinute(Date.UTC(2026, 5, 15, 10, 0), 2 * H), '15.06.2026 12:00')
assert.equal(formatTachographMinute(Date.UTC(2026, 5, 15, 0, 30), -60 * M), '14.06.2026 23:30')

let stop = nextFirstStopHint({ sinceMs: null, phase: 'wait' }, {
  speed: 0, nowMs: 0, cardInserted: true, wizardOpen: false,
})
assert.equal(stop.show, false)
stop = nextFirstStopHint(stop, { speed: 10, nowMs: 1000, cardInserted: true, wizardOpen: false })
stop = nextFirstStopHint(stop, { speed: 0, nowMs: 2000, cardInserted: true, wizardOpen: false })
assert.equal(stop.show, false)
assert.equal(stop.phase, 'wait')
stop = nextFirstStopHint(stop, { speed: 40, nowMs: 3000, cardInserted: true, wizardOpen: false })
stop = nextFirstStopHint(stop, { speed: 0, nowMs: 7000, cardInserted: true, wizardOpen: false })
assert.equal(stop.show, true)
assert.equal(stop.phase, 'shown')
stop = nextFirstStopHint(stop, { speed: 30, nowMs: 8000, cardInserted: true, wizardOpen: false })
stop = nextFirstStopHint(stop, { speed: 0, nowMs: 20000, cardInserted: true, wizardOpen: false })
assert.equal(stop.show, false)

const plain = drivingBreakDisplay([{ kind: 'driving', startMs: NOW - 4 * H, endMs: NOW }], NOW)
assert.equal(plain.phase, 'driving')
assert.equal(recognizedBreakAdvice(plain), 'full')
const split = drivingBreakDisplay([
  { kind: 'driving', startMs: NOW - (4 * H + 15 * M), endMs: NOW - (2 * H + 15 * M) },
  { kind: 'rest', startMs: NOW - (2 * H + 15 * M), endMs: NOW - 2 * H },
  { kind: 'driving', startMs: NOW - 2 * H, endMs: NOW },
], NOW)
assert.equal(recognizedBreakAdvice(split), 'second')
assert.equal(recognizedBreakAdvice({
  phase: 'break',
  drivingIfStartNowMs: 0,
  remainingBreakMs: 10 * M,
  drivingAfterBreakMs: 0,
}), 'neutral')

assert.equal(finalConfirmChoiceApplies('finalConfirm'), true)
assert.equal(finalConfirmChoiceApplies('manualEditor'), false)
assert.equal(finalConfirmChoiceApplies(undefined), false)

const missing = evaluatePreDepartureWork('card', 0, 1000, [], [])
assert.deepEqual(missing, { result: 'warning', workMs: 0 })
const shortSamples: SecondActivitySnapshot[] = []
for (let timestampUtc = 1000; timestampUtc <= 2 * M; timestampUtc += 1000) {
  shortSamples.push({ timestampUtc, driver1: 'otherWork', driver2: 'rest', speed: 0, driver1CardId: 'card' })
}
const short = evaluatePreDepartureWork('card', 0, 3 * M, [], shortSamples)
assert.equal(short.result, 'info')
assert.ok(short.workMs > 0 && short.workMs < 4 * M)

function bubble(input: Parameters<typeof useInfoPanelItems>[0]): string {
  function Probe() {
    const items = useInfoPanelItems(input)
    return createElement('div', null, items.map((item) => createElement(
      'section',
      { key: item.id, 'data-id': item.id },
      item.message,
    )))
  }
  return renderToStaticMarkup(createElement(LanguageProvider, null, createElement(Probe)))
}

const common = {
  ignitionOn: true,
  card1Inserted: true,
  drivingWithoutCardWarningActive: false,
  breakWarningActive: null as '415' | '430' | null,
  cardInsertionState: null,
  lastEjectionTimeBySlot: { 1: null, 2: null },
}

const at415 = bubble({
  ...common,
  breakWarningActive: '415',
  drivingSinceBreakMs: 4 * H + 15 * M,
  breakAdvice: 'full',
})
assert.match(at415, /break-415/)
assert.match(at415, /15 min/)
assert.match(at415, /45 minut/)
assert.doesNotMatch(at415, /Překročil/)

const at415Split = bubble({
  ...common,
  breakWarningActive: '415',
  drivingSinceBreakMs: 4 * H + 20 * M,
  breakAdvice: 'second',
})
assert.match(at415Split, /10 min/)
assert.match(at415Split, /30 minut/)

const reached = bubble({
  ...common,
  breakWarningActive: '430',
  drivingSinceBreakMs: 4 * H + 30 * M + 500,
  breakAdvice: 'full',
})
assert.match(reached, /Dosáhl jsi 4 h 30 min řízení/)
assert.doesNotMatch(reached, /Překročil/)

const over = bubble({
  ...common,
  breakWarningActive: '430',
  drivingSinceBreakMs: 4 * H + 31 * M,
  breakAdvice: 'neutral',
})
assert.match(over, /Překročil jsi 4 h 30 min řízení/)
assert.match(over, /Udělej přestávku v řízení/)
assert.doesNotMatch(over, /Dosáhl/)

const pending = bubble({
  ...common,
  breakWarningActive: '415',
  drivingSinceBreakMs: 0,
  breakAdvice: 'neutral',
})
assert.match(pending, /Blížíš se limitu/)
assert.doesNotMatch(pending, /\{remaining\}|\{advice\}/)

const moving = bubble({
  ...common,
  card1Inserted: false,
  currentSpeed: 30,
})
assert.doesNotMatch(moving, /insert-card|wizard-/)

const insertion = {
  slot: 1,
  phase: 'lastRemoval',
  lastWithdrawal: Date.UTC(2026, 5, 15, 8, 0),
  firstManualEntryStartUtc: undefined,
} as CardInsertionState
const removal = bubble({
  ...common,
  card1Inserted: false,
  currentSpeed: 0,
  timeOffsetMs: 2 * H,
  cardInsertionState: insertion,
})
assert.match(removal, /wizard-last-removal/)
assert.match(removal, /15\.06\.2026 10:00/)
assert.doesNotMatch(removal, /insert-card/)
assert.match(removal, /naposledy vyjmuta/)

const firstCard = bubble({
  ...common,
  cardInsertionState: {
    ...insertion,
    phase: 'decision1M',
    lastWithdrawal: null,
    firstManualEntryStartUtc: Date.UTC(2026, 5, 1, 6, 0),
  } as CardInsertionState,
  timeOffsetMs: 2 * H,
})
assert.match(firstCard, /wizard-decision/)
assert.match(firstCard, /01\.06\.2026 08:00/)
assert.match(firstCard, /Volbou ANO/)
assert.doesNotMatch(firstCard, /wizard-last-removal|wizard-final/)

const editor = bubble({
  ...common,
  cardInsertionState: { ...insertion, phase: 'manualEditor', selectingCountryForStamp: false } as CardInsertionState,
})
assert.match(editor, /blikající údaj/)
assert.doesNotMatch(editor, /wizard-final|ANO zadání potvrdí/)

const confirm = bubble({
  ...common,
  cardInsertionState: {
    ...insertion,
    phase: 'finalConfirm',
    manualEntryBuffer: [],
    manualEntryStartIndex: 0,
  } as CardInsertionState,
})
assert.match(confirm, /ANO zadání potvrdí/)
assert.doesNotMatch(confirm, /blikající údaj/)

const stoppedRest = bubble({ ...common, currentSpeed: 0, stoppedActivityId: 'REST' })
assert.match(stoppedRest, /tlačítko 1 nemačkej/)
assert.doesNotMatch(stoppedRest, /Krátkými stisky/)

const stoppedWork = bubble({ ...common, currentSpeed: 0, stoppedActivityId: 'WORK' })
assert.match(stoppedWork, /zkřížená kladívka/)
assert.match(stoppedWork, /Krátkými stisky/)

const hold = bubble({ ...common, currentSpeed: 0, endShiftButton: 1 })
assert.match(hold, /podrž tlačítko 1/)
const noHold = bubble({ ...common, currentSpeed: 0, endShiftButton: null })
assert.doesNotMatch(noHold, /podrž tlačítko/)

const country = bubble({ ...common, withdrawalCountrySlot: 2 })
assert.match(country, /slotu 2/)
assert.match(country, /Zpět výhoz zrušíš/)
const gone = bubble({ ...common, withdrawalCountrySlot: null })
assert.doesNotMatch(gone, /withdrawal-country|Zpět výhoz/)

console.log('info bubbles ok')
