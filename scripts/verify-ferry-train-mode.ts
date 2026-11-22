import assert from 'node:assert/strict'
import { SIM_DT_MS } from '../src/Constants.ts'
import {
  FERRY_CONTINUOUS_DRIVING_LIMIT_MS,
  accumulateFerryDriving,
  appendFerryEvent,
  ferryCardWithdrawn,
} from '../src/ferryTrainMode.ts'

function drive(ms: number, from = 0) {
  let drivingMs = from
  let ended = false
  for (let left = ms; left > 0; left -= SIM_DT_MS) {
    const step = accumulateFerryDriving(drivingMs, true, Math.min(SIM_DT_MS, left))
    drivingMs = step.drivingMs
    ended = step.ended
    if (ended) break
  }
  return { drivingMs, ended }
}

assert.equal(drive(30_000).ended, false)
assert.equal(drive(59_000).ended, false)
assert.equal(drive(FERRY_CONTINUOUS_DRIVING_LIMIT_MS).ended, false)
assert.equal(drive(FERRY_CONTINUOUS_DRIVING_LIMIT_MS + SIM_DT_MS).ended, true)

const interrupted = drive(30_000)
const afterStop = accumulateFerryDriving(interrupted.drivingMs, false, SIM_DT_MS)
assert.equal(afterStop.drivingMs, 0)
assert.equal(afterStop.ended, false)
assert.equal(drive(30_000, afterStop.drivingMs).ended, false)

assert.equal(ferryCardWithdrawn({ slot1: true, slot2: true }, { slot1: false, slot2: true }), true)
assert.equal(ferryCardWithdrawn({ slot1: true, slot2: true }, { slot1: true, slot2: false }), true)
assert.equal(ferryCardWithdrawn({ slot1: true, slot2: false }, { slot1: false, slot2: false }), true)
assert.equal(ferryCardWithdrawn({ slot1: false, slot2: false }, { slot1: false, slot2: false }), false)
assert.equal(ferryCardWithdrawn({ slot1: false, slot2: false }, { slot1: true, slot2: false }), false)

const at = Date.UTC(2026, 10, 22, 8, 0, 30)
let events = appendFerryEvent([], 'activation', at, 'Ostrava')
events = appendFerryEvent(events, 'activation', at + 10_000, 'Ostrava')
assert.equal(events.length, 1)
events = appendFerryEvent(events, 'deactivation', at + 20_000, 'Ostrava')
assert.deepEqual(events.map((event) => event.type), ['activation', 'deactivation'])
events = appendFerryEvent(events, 'deactivation', at + 20_000, 'Ostrava')
assert.equal(events.length, 2)

assert.equal(accumulateFerryDriving(0, false, 120_000).ended, false)

console.log('ferry train mode ok')
