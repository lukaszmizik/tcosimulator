import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { drivingBreakDisplay } from '../src/drivingBreakDisplay.ts'
import { formatWorkWarning } from '../src/data/warnings.ts'
import { useInfoPanelItems } from '../src/InfoPanel.tsx'
import { getTranslations, LanguageProvider } from '../src/translations/index.ts'
import {
  confirmWorkWarning,
  nextWorkWarning,
  WORK_LIMIT_MS,
  WORK_PREWARNING_MS,
  workingTimeDisplay,
  type WorkWarningDismissed,
} from '../src/workingTimeDisplay.ts'

const H = 60 * 60 * 1000
const M = 60 * 1000
const NOW = Date.UTC(2026, 0, 8, 18, 0, 0)
const fresh: WorkWarningDismissed = { prewarning: false, limit: false }

type Kind = 'driving' | 'work' | 'availability' | 'rest'

function shown(parts: Array<[Kind, number]>, undetermined?: { startMs: number; endMs: number }[]) {
  const total = parts.reduce((sum, [, ms]) => sum + ms, 0)
  const restEnd = NOW - total
  const intervals: Array<{ kind: Kind; startMs: number; endMs: number }> = [
    { kind: 'rest', startMs: restEnd - 11 * H, endMs: restEnd },
  ]
  let cursor = restEnd
  for (const [kind, ms] of parts) {
    intervals.push({ kind, startMs: cursor, endMs: cursor + ms })
    cursor += ms
  }
  return workingTimeDisplay(intervals, NOW, { undetermined })
}

const six = shown([['work', 5 * H + 30 * M], ['driving', 30 * M]])
assert.equal(six.currentWithoutRestMs, 6 * H)
assert.equal(six.sinceDailyOrWeeklyRestMs, 6 * H)
assert.equal(six.availabilityMs, 0)
assert.equal(six.breaksInPeriodMs, 0)
assert.equal(six.requiredBreakMs, 0)
assert.equal(nextWorkWarning(six.currentWithoutRestMs, fresh).level, '600')

const withAvailability = shown([['work', 4 * H], ['availability', H], ['work', 2 * H]])
assert.equal(withAvailability.currentWithoutRestMs, 6 * H)
assert.equal(withAvailability.sinceDailyOrWeeklyRestMs, 6 * H)
assert.equal(withAvailability.availabilityMs, H)
assert.equal(withAvailability.breaksInPeriodMs, 0)
assert.equal(withAvailability.requiredBreakMs, 0)

const shortRest = shown([['work', 5 * H + 50 * M], ['rest', 5 * M], ['work', 15 * M]])
assert.equal(shortRest.currentWithoutRestMs, 6 * H + 5 * M)
assert.equal(shortRest.sinceDailyOrWeeklyRestMs, 6 * H + 5 * M)
assert.equal(shortRest.breaksInPeriodMs, 0)
assert.equal(shortRest.requiredBreakMs, 30 * M)
assert.equal(nextWorkWarning(shortRest.currentWithoutRestMs, fresh).level, '600')

const fourteen = shown([['work', 5 * H + 50 * M], ['rest', 14 * M], ['work', 10 * M]])
assert.equal(fourteen.currentWithoutRestMs, 6 * H)
assert.equal(fourteen.breaksInPeriodMs, 0)

const interrupted = shown([['work', 5 * H + 50 * M], ['rest', 15 * M], ['work', H]])
assert.equal(interrupted.currentWithoutRestMs, H)
assert.equal(interrupted.sinceDailyOrWeeklyRestMs, 6 * H + 50 * M)
assert.equal(interrupted.breaksInPeriodMs, 15 * M)
assert.equal(interrupted.requiredBreakMs, 30 * M)
assert.ok((interrupted.breaksInPeriodMs ?? 0) < (interrupted.requiredBreakMs ?? 0))
assert.equal(nextWorkWarning(interrupted.currentWithoutRestMs, { prewarning: true, limit: true }).level, null)
assert.deepEqual(nextWorkWarning(interrupted.currentWithoutRestMs, { prewarning: true, limit: true }).dismissed, fresh)

const split = shown([
  ['work', 2 * H],
  ['rest', 15 * M],
  ['work', 3 * H],
  ['rest', 15 * M],
  ['work', 2 * H],
])
assert.equal(split.currentWithoutRestMs, 2 * H)
assert.equal(split.sinceDailyOrWeeklyRestMs, 7 * H)
assert.equal(split.breaksInPeriodMs, 30 * M)
assert.equal(split.requiredBreakMs, 30 * M)

const overNine = shown([['work', 4 * H], ['rest', 15 * M], ['work', 6 * H]])
assert.equal(overNine.sinceDailyOrWeeklyRestMs, 10 * H)
assert.equal(overNine.currentWithoutRestMs, 6 * H)
assert.equal(overNine.breaksInPeriodMs, 15 * M)
assert.equal(overNine.requiredBreakMs, 45 * M)
assert.ok((overNine.breaksInPeriodMs ?? 0) < (overNine.requiredBreakMs ?? 0))

const fullFortyFive = shown([
  ['work', 3 * H],
  ['rest', 15 * M],
  ['work', 3 * H],
  ['rest', 15 * M],
  ['work', 4 * H],
  ['rest', 15 * M],
])
assert.equal(fullFortyFive.sinceDailyOrWeeklyRestMs, 10 * H)
assert.equal(fullFortyFive.breaksInPeriodMs, 45 * M)
assert.equal(fullFortyFive.requiredBreakMs, 45 * M)
assert.equal(fullFortyFive.currentWithoutRestMs, 0)

const touching = shown([['work', 2 * H], ['rest', 10 * M], ['rest', 5 * M], ['work', 30 * M]])
assert.equal(touching.currentWithoutRestMs, 30 * M)
assert.equal(touching.breaksInPeriodMs, 15 * M)

const gap = workingTimeDisplay([
  { kind: 'rest', startMs: NOW - 20 * H, endMs: NOW - 9 * H },
  { kind: 'driving', startMs: NOW - 2 * H, endMs: NOW },
], NOW)
assert.equal(gap.currentWithoutRestMs, null)
assert.equal(gap.sinceDailyOrWeeklyRestMs, null)
assert.equal(gap.breaksInPeriodMs, null)
assert.equal(gap.availabilityMs, null)
assert.equal(gap.requiredBreakMs, null)
assert.equal(gap.calendarWeekMs, null)

const unknown = shown([['work', 6 * H]], [{ startMs: NOW - 2 * H, endMs: NOW - H }])
assert.equal(unknown.currentWithoutRestMs, null)
assert.equal(unknown.sinceDailyOrWeeklyRestMs, null)
assert.equal(unknown.breaksInPeriodMs, null)
assert.equal(unknown.requiredBreakMs, null)

const reset = workingTimeDisplay([], NOW)
assert.equal(reset.currentWithoutRestMs, null)
assert.equal(nextWorkWarning(null, fresh).level, null)

const monday = Date.UTC(2026, 0, 5, 14, 0, 0)
const week = workingTimeDisplay([
  { kind: 'rest', startMs: Date.UTC(2026, 0, 5), endMs: Date.UTC(2026, 0, 5, 11) },
  { kind: 'work', startMs: Date.UTC(2026, 0, 5, 11), endMs: Date.UTC(2026, 0, 5, 13) },
  { kind: 'availability', startMs: Date.UTC(2026, 0, 5, 13), endMs: monday },
], monday)
assert.equal(week.calendarWeekMs, 2 * H)
assert.equal(week.availabilityMs, H)
assert.equal(week.sinceDailyOrWeeklyRestMs, 2 * H)
assert.equal(week.currentWithoutRestMs, 2 * H)

const restEnd = NOW - 3 * H
const preserved = workingTimeDisplay([
  { kind: 'rest', startMs: restEnd - 11 * H, endMs: restEnd },
  { kind: 'driving', startMs: restEnd, endMs: restEnd + 2 * H },
  { kind: 'rest', startMs: restEnd + 2 * H, endMs: restEnd + 2 * H + 30 * M },
  { kind: 'work', startMs: restEnd + 2 * H + 30 * M, endMs: NOW },
], NOW)
assert.equal(preserved.currentWithoutRestMs, 30 * M)
assert.equal(preserved.sinceDailyOrWeeklyRestMs, 2 * H + 30 * M)
assert.equal(preserved.breaksInPeriodMs, 30 * M)
assert.equal(preserved.calendarWeekMs, null)
const resting = workingTimeDisplay([
  { kind: 'rest', startMs: NOW - 12 * H, endMs: NOW - H },
  { kind: 'driving', startMs: NOW - H, endMs: NOW - 30 * M },
  { kind: 'rest', startMs: NOW - 30 * M, endMs: NOW },
], NOW)
assert.equal(resting.currentWithoutRestMs, 0)
assert.equal(resting.sinceDailyOrWeeklyRestMs, 30 * M)
assert.equal(resting.breaksInPeriodMs, 30 * M)

const driving = drivingBreakDisplay([
  { kind: 'driving', startMs: NOW - 4 * H, endMs: NOW },
], NOW)
assert.equal(driving.phase, 'driving')
if (driving.phase === 'driving') {
  assert.equal(driving.remainingDrivingMs, 30 * M)
  assert.equal(driving.requiredBreakMs, 45 * M)
}
const drivingAfterFive = drivingBreakDisplay([
  { kind: 'driving', startMs: NOW - (4 * H + 25 * M), endMs: NOW - 25 * M },
  { kind: 'rest', startMs: NOW - 25 * M, endMs: NOW - 20 * M },
  { kind: 'driving', startMs: NOW - 20 * M, endMs: NOW },
], NOW)
assert.equal(drivingAfterFive.phase, 'driving')
if (drivingAfterFive.phase === 'driving') {
  assert.equal(drivingAfterFive.remainingDrivingMs, 10 * M)
  assert.equal(drivingAfterFive.requiredBreakMs, 45 * M)
}

let dismissed = fresh
let step = nextWorkWarning(5 * H + 50 * M, dismissed)
assert.equal(step.level, '545')
step = nextWorkWarning(5 * H + 50 * M + 1000, step.dismissed)
assert.equal(step.level, '545')
dismissed = confirmWorkWarning('545', step.dismissed)
step = nextWorkWarning(5 * H + 51 * M, dismissed)
assert.equal(step.level, null)
step = nextWorkWarning(WORK_LIMIT_MS, step.dismissed)
assert.equal(step.level, '600')
dismissed = confirmWorkWarning('600', step.dismissed)
for (let second = 1; second <= 5; second += 1) {
  step = nextWorkWarning(WORK_LIMIT_MS + second * 1000, dismissed)
  assert.equal(step.level, null)
}
step = nextWorkWarning(0, dismissed)
assert.deepEqual(step.dismissed, fresh)
step = nextWorkWarning(WORK_LIMIT_MS, step.dismissed)
assert.equal(step.level, '600')

const jumped = nextWorkWarning(WORK_LIMIT_MS, fresh)
assert.equal(jumped.level, '600')
assert.equal(nextWorkWarning(WORK_PREWARNING_MS, fresh).level, '545')
assert.equal(nextWorkWarning(WORK_PREWARNING_MS - 1, fresh).level, null)
const kept = nextWorkWarning(null, confirmWorkWarning('600', fresh))
assert.equal(kept.level, null)
assert.equal(kept.dismissed.limit, true)
assert.equal(nextWorkWarning(WORK_LIMIT_MS, kept.dismissed).level, null)

const text = formatWorkWarning('cs', 1, WORK_LIMIT_MS)
assert.equal(text.line1, '(35)(9)1 doba práce')
assert.equal(text.line2, '(9) 06h00')
assert.equal(text.line1.includes('04h15'), false)
assert.equal(text.line2.includes('04h15'), false)
assert.equal(formatWorkWarning('cs', 1, WORK_PREWARNING_MS).line2, '(9) 05h45')
assert.equal(formatWorkWarning('en', 2, WORK_LIMIT_MS).line1, '(35)(9)2 work time')
assert.equal(formatWorkWarning('ru', 1, 3 * H + 20 * M).line1, '(35)(9)1 раб. время')
assert.equal(formatWorkWarning('ru', 1, 3 * H + 20 * M).line2, '(9) 03h20')
assert.equal(formatWorkWarning('mn', 2, WORK_LIMIT_MS).line1, '(35)(9)2 work time')
assert.equal(formatWorkWarning('mn', 2, WORK_LIMIT_MS).line2, '(9) 06h00')
const mn = getTranslations('mn')
assert.match(mn.ui.remoteDataDownloadActive, /Ө/)
assert.match(mn.ui.slotOccupied, /[үҮ]/)
assert.equal(mn.tachoDisplay, getTranslations('en').tachoDisplay)
assert.equal(mn.menu, getTranslations('en').menu)

function bubbleText(level: '545' | '600' | null): string {
  function Probe() {
    const items = useInfoPanelItems({
      ignitionOn: true,
      card1Inserted: true,
      drivingWithoutCardWarningActive: false,
      breakWarningActive: null,
      workWarningActive: level,
      cardInsertionState: null,
      lastEjectionTimeBySlot: { 1: null, 2: null },
    })
    return createElement('pre', null, items.map((item) => `${item.id}\n${item.message}`).join('\n'))
  }
  return renderToStaticMarkup(createElement(LanguageProvider, null, createElement(Probe)))
}

const prewarning = bubbleText('545')
assert.match(prewarning, /work-545/)
assert.match(prewarning, /2002\/15\/ES/)
assert.match(prewarning, /pohotovost/)
assert.match(prewarning, /15 minut/)
assert.doesNotMatch(prewarning, /work-600/)

const limit = bubbleText('600')
assert.match(limit, /work-600/)
assert.match(limit, /30 minut/)
assert.match(limit, /45 minut/)
assert.doesNotMatch(limit, /work-545/)
assert.doesNotMatch(bubbleText(null), /work-54/)

for (const language of ['en', 'ru'] as const) {
  const copy = getTranslations(language).infoPanel
  assert.match(copy.work545, /2002\/15/)
  assert.match(copy.work545, /15/)
  assert.match(copy.work600, /30/)
  assert.match(copy.work600, /45/)
}

console.log('working time ok')
