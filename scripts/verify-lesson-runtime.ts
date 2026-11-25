import assert from 'node:assert/strict'
import { DRIVING_SYMBOL, getActivityCode } from '../src/CardLogic.ts'
import {
  CARD_LANGUAGE_STORAGE_KEY,
  clearSessionCardLanguages,
  discardPersistedLessonIdentity,
  recalledLanguage,
  rememberLanguage,
} from '../src/firstLevelDisplay.ts'
import {
  VEHICLE_CARD_INSERTIONS_STORAGE_KEY,
} from '../src/print/vehicleCardInsertions.ts'
import {
  appendSecondSamples,
  emptySecondHistory,
  filterSecondSamples,
  SECOND_HISTORY_LIMIT,
  secondHistoryFrom,
  secondSampleAt,
} from '../src/secondHistoryBuffer.ts'
import { nextSimulationClockAction, type ClockAnchor } from '../src/simulationClock.ts'
import type { SecondActivitySnapshot } from '../src/TachoTypes.ts'
import {
  activityDurationDelta,
  activityDurationMinuteKey,
  publishedSpeed,
} from '../src/useDrivingInterval.ts'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear() { data.clear() },
    getItem(key: string) { return data.get(key) ?? null },
    key(index: number) { return [...data.keys()][index] ?? null },
    removeItem(key: string) { data.delete(key) },
    setItem(key: string, value: string) { data.set(key, value) },
  }
}

function sample(timestampUtc: number, speed = 0): SecondActivitySnapshot {
  return { timestampUtc, driver1: 'rest', driver2: 'rest', speed }
}

function applyClock(
  anchor: ClockAnchor,
  sim: number,
  input: { nowMs: number; background: boolean; source: 'interval' | 'visibility' },
) {
  const action = nextSimulationClockAction(anchor, { ...input, simulatedUtcMs: sim })
  let nextSim = sim
  if (action.type === 'step') nextSim += 1000
  else if (action.type === 'catchup') nextSim += action.deltaMs
  const nextAnchor = action.type === 'step' || action.type === 'catchup'
    ? { ...action.anchor, expectedSimUtc: nextSim }
    : action.anchor
  return { action, anchor: nextAnchor, sim: nextSim }
}

clearSessionCardLanguages()
const storage = memoryStorage()
storage.setItem('simulator.printVehicleProfile', '{"companyName":"Firma","registration":"1A2 3456"}')
storage.setItem('tcosimulator.clockOffsets', '{"localOffsetMs":3600000,"ownerOffsetMs":0}')
storage.setItem('tcosimulator.virtualCardNames', '{"zmizik":"Alois Nebel","novak":"Albert Einstein"}')
storage.setItem(VEHICLE_CARD_INSERTIONS_STORAGE_KEY, JSON.stringify([{
  id: 'synthetic',
  insertedAtUtc: 1,
  slot: 1,
  cardType: 'driver',
  cardIdentification: 'SYNTH-DDD-001',
  surnameOrOrganisation: 'Synthetic Driver',
  firstName: 'Lesson',
}]))
storage.setItem(CARD_LANGUAGE_STORAGE_KEY, JSON.stringify([
  { card: 'zmizik', language: 'en' },
  { card: 'CZ1234567890AB12', language: 'ru' },
  { card: 'SYNTH-DDD-001', language: 'cs' },
  { card: 'Synthetic Driver', language: 'cs' },
  { card: 'novak', language: 'cs' },
]))
discardPersistedLessonIdentity(storage)
const storedLanguages = storage.getItem(CARD_LANGUAGE_STORAGE_KEY) ?? ''
assert.equal(storage.getItem(VEHICLE_CARD_INSERTIONS_STORAGE_KEY), null)
assert.equal(storedLanguages.includes('SYNTH-DDD-001'), false)
assert.equal(storedLanguages.includes('Synthetic Driver'), false)
assert.equal(storedLanguages.includes('CZ1234567890AB12'), false)
assert.equal(storedLanguages.includes('CZ9876543210CD34'), false)
assert.equal(storedLanguages.includes('"zmizik"'), true)
assert.equal(storedLanguages.includes('"novak"'), true)
assert.equal(storage.getItem('simulator.printVehicleProfile'), '{"companyName":"Firma","registration":"1A2 3456"}')
assert.equal(storage.getItem('tcosimulator.clockOffsets'), '{"localOffsetMs":3600000,"ownerOffsetMs":0}')
assert.equal(storage.getItem('tcosimulator.virtualCardNames'), '{"zmizik":"Alois Nebel","novak":"Albert Einstein"}')
assert.equal(recalledLanguage('zmizik', storage), 'en')
assert.equal(recalledLanguage('novak', storage), 'cs')

rememberLanguage('SYNTH-DDD-001', 'ru', storage)
assert.equal(recalledLanguage('SYNTH-DDD-001', storage), 'ru')
assert.equal((storage.getItem(CARD_LANGUAGE_STORAGE_KEY) ?? '').includes('SYNTH-DDD-001'), false)
assert.equal(recalledLanguage('SYNTH-DDD-001', storage), 'ru')
clearSessionCardLanguages()
assert.equal(recalledLanguage('SYNTH-DDD-001', storage), undefined)
assert.equal(recalledLanguage('zmizik', storage), 'en')
const numberOnly = memoryStorage()
numberOnly.setItem(CARD_LANGUAGE_STORAGE_KEY, JSON.stringify([
  { card: 'CZ9876543210CD34', language: 'en' },
  { card: 'Synthetic Driver', language: 'cs' },
]))
discardPersistedLessonIdentity(numberOnly)
const remapped = numberOnly.getItem(CARD_LANGUAGE_STORAGE_KEY) ?? ''
assert.equal(remapped.includes('CZ9876543210CD34'), false)
assert.equal(remapped.includes('Synthetic Driver'), false)
assert.equal(remapped.includes('"novak"'), true)
assert.equal(recalledLanguage('novak', numberOnly), 'en')
storage.setItem(CARD_LANGUAGE_STORAGE_KEY, '{')
discardPersistedLessonIdentity(storage)
assert.equal(storage.getItem(CARD_LANGUAGE_STORAGE_KEY), null)
assert.equal(storage.getItem('tcosimulator.virtualCardNames'), '{"zmizik":"Alois Nebel","novak":"Albert Einstein"}')

const kept = appendSecondSamples(emptySecondHistory(), [sample(1), sample(2)])
const extended = appendSecondSamples(kept, [sample(3)])
assert.equal(kept.length, 2)
assert.equal(extended.length, 3)
assert.equal(secondSampleAt(extended, 0), secondSampleAt(kept, 0))
assert.deepEqual([...extended].map((item) => item.timestampUtc), [1, 2, 3])
assert.equal(filterSecondSamples(extended, (item) => item.timestampUtc > 1).length, 2)

const capped = secondHistoryFrom(Array.from({ length: SECOND_HISTORY_LIMIT + 5 }, (_, index) => sample(index)))
assert.equal(capped.length, SECOND_HISTORY_LIMIT)
assert.equal(secondSampleAt(capped, 0)?.timestampUtc, 5)
assert.equal(secondSampleAt(capped, SECOND_HISTORY_LIMIT - 1)?.timestampUtc, SECOND_HISTORY_LIMIT + 4)
const rolled = appendSecondSamples(capped, [sample(SECOND_HISTORY_LIMIT + 5)])
assert.equal(rolled.length, SECOND_HISTORY_LIMIT)
assert.equal(capped.length, SECOND_HISTORY_LIMIT)
assert.equal(secondSampleAt(capped, 0)?.timestampUtc, 5)
assert.equal(secondSampleAt(rolled, 0)?.timestampUtc, 6)
assert.equal(secondSampleAt(rolled, rolled.length - 1)?.timestampUtc, SECOND_HISTORY_LIMIT + 5)
for (const index of [0, 511, 512, rolled.length - 1]) {
  assert.equal([...rolled][index]?.timestampUtc, secondSampleAt(rolled, index)?.timestampUtc)
}

const minute = 1_700_000_000_000
let clock = applyClock(
  { lastAccountedWallMs: 0, expectedSimUtc: minute + 59_000 },
  minute + 59_000,
  { nowMs: 400, background: true, source: 'visibility' },
)
assert.equal(clock.action.type, 'none')
assert.equal(clock.sim, minute + 59_000)
clock = applyClock(clock.anchor, clock.sim, { nowMs: 1000, background: true, source: 'interval' })
assert.equal(clock.action.type, 'step')
assert.equal(clock.sim, minute + 60_000)
clock = applyClock(clock.anchor, clock.sim, { nowMs: 1005, background: true, source: 'visibility' })
assert.equal(clock.action.type, 'none')
assert.equal(clock.sim, minute + 60_000)

let jumped = applyClock(
  { lastAccountedWallMs: 0, expectedSimUtc: 1_000 },
  5_000_000,
  { nowMs: 30_000, background: true, source: 'visibility' },
)
assert.equal(jumped.action.type, 'resync')
assert.equal(jumped.sim, 5_000_000)
assert.equal('samples' in jumped.action, false)
jumped = applyClock(jumped.anchor, jumped.sim, { nowMs: 30_000, background: true, source: 'interval' })
assert.equal(jumped.action.type, 'none')
assert.equal(jumped.sim, 5_000_000)

let hidden = applyClock(
  { lastAccountedWallMs: 0, expectedSimUtc: 10_000 },
  10_000,
  { nowMs: 10_000, background: true, source: 'visibility' },
)
assert.equal(hidden.action.type, 'catchup')
assert.equal(hidden.action.type === 'catchup' ? hidden.action.deltaMs : 0, 10_000)
assert.equal(hidden.sim, 20_000)
hidden = applyClock(hidden.anchor, hidden.sim, { nowMs: 10_004, background: true, source: 'interval' })
assert.equal(hidden.action.type, 'none')
assert.equal(hidden.sim, 20_000)

let paused = applyClock(
  { lastAccountedWallMs: 0, expectedSimUtc: 10_000 },
  10_000,
  { nowMs: 60_000, background: false, source: 'visibility' },
)
assert.equal(paused.action.type, 'none')
assert.equal(paused.sim, 10_000)
paused = applyClock(paused.anchor, paused.sim, { nowMs: 60_000, background: false, source: 'interval' })
assert.equal(paused.action.type, 'step')
assert.equal(paused.sim, 11_000)
assert.equal(paused.anchor.lastAccountedWallMs, 60_000)
paused = applyClock(paused.anchor, paused.sim, { nowMs: 60_500, background: false, source: 'interval' })
assert.equal(paused.action.type, 'none')
assert.equal(paused.sim, 11_000)

let steady = applyClock(
  { lastAccountedWallMs: 0, expectedSimUtc: 0 },
  0,
  { nowMs: 990, background: false, source: 'interval' },
)
assert.equal(steady.action.type, 'none')
assert.equal(steady.sim, 0)
steady = applyClock(steady.anchor, steady.sim, { nowMs: 1990, background: false, source: 'interval' })
assert.equal(steady.action.type, 'step')
assert.equal(steady.sim, 1000)
assert.equal(steady.anchor.lastAccountedWallMs, 1000)
steady = applyClock(steady.anchor, steady.sim, { nowMs: 2990, background: false, source: 'interval' })
assert.equal(steady.action.type, 'step')
assert.equal(steady.sim, 2000)
assert.equal(steady.anchor.lastAccountedWallMs, 2000)

let durations = { driving: 0, rest: 0, otherWork: 0, availability: 0 }
let minuteKey = activityDurationMinuteKey(durations)
let durationPublishes = 0
for (let step = 0; step < 2 * 3600 * 10; step += 1) {
  const delta = activityDurationDelta(DRIVING_SYMBOL, 100)
  durations = {
    driving: durations.driving + delta.driving,
    rest: durations.rest + delta.rest,
    otherWork: durations.otherWork + delta.otherWork,
    availability: durations.availability + delta.availability,
  }
  const nextKey = activityDurationMinuteKey(durations)
  if (nextKey !== minuteKey) {
    durationPublishes += 1
    minuteKey = nextKey
  }
}
assert.equal(durations.driving, 2 * 3600 * 1000)
assert.equal(durationPublishes, 120)

const driving = activityDurationDelta(DRIVING_SYMBOL, 1000)
const availability = activityDurationDelta(getActivityCode('AVAILABILITY'), 1000)
const work = activityDurationDelta(getActivityCode('WORK'), 1000)
const rest = activityDurationDelta(getActivityCode('REST'), 1000)
assert.equal(driving.driving, 1000)
assert.equal(availability.availability, 1000)
assert.equal(work.otherWork, 1000)
assert.equal(rest.rest, 1000)
assert.equal(work.rest, 0)
assert.equal(rest.otherWork, 0)
const bothWhileDriving = {
  driving: driving.driving + availability.driving,
  availability: driving.availability + availability.availability,
}
assert.equal(bothWhileDriving.driving, 1000)
assert.equal(bothWhileDriving.availability, 1000)
const bothAtRest = {
  rest: rest.rest + rest.rest,
  otherWork: work.otherWork,
}
assert.equal(bothAtRest.rest, 2000)
assert.equal(bothAtRest.otherWork, 1000)
assert.equal(publishedSpeed(false, 0), 0)
assert.equal(publishedSpeed(false, 8), 8)
assert.equal(publishedSpeed(true, 0), 0)
assert.equal(publishedSpeed(true, 0.4), 0)
assert.notEqual(publishedSpeed(false, 8), publishedSpeed(true, 0))

console.log('lesson runtime ok')
