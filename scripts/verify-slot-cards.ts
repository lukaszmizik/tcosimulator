import assert from 'node:assert/strict'
import {
  IGNITION_CARD_WARNING_MS,
  drivingWithoutDriverCard,
  ignitionCardWarningVisible,
  keptDeferredAfterEject,
  showsReadyToDrive,
} from '../src/slotCardRules.ts'

assert.equal(IGNITION_CARD_WARNING_MS, 20_000)
assert.equal(showsReadyToDrive(1), true)
assert.equal(showsReadyToDrive(2), false)

assert.equal(drivingWithoutDriverCard(false), true)
assert.equal(drivingWithoutDriverCard(true), false)

const base = { ignitionOn: true, card1Inserted: false, dismissed: false, elapsedMs: 0 }
assert.equal(ignitionCardWarningVisible(base), true)
assert.equal(ignitionCardWarningVisible({ ...base, elapsedMs: IGNITION_CARD_WARNING_MS - 1 }), true)
assert.equal(ignitionCardWarningVisible({ ...base, elapsedMs: IGNITION_CARD_WARNING_MS }), false)
assert.equal(ignitionCardWarningVisible({ ...base, dismissed: true, elapsedMs: 0 }), false)
assert.equal(ignitionCardWarningVisible({ ...base, card1Inserted: true }), false)
assert.equal(ignitionCardWarningVisible({ ...base, ignitionOn: false }), false)

const deferred = {
  1: { withdrawalTime: 1, countryCode: 'CZ' },
  2: { withdrawalTime: 2, countryCode: 'SK' },
}
assert.deepEqual(keptDeferredAfterEject(deferred, 1), { 2: deferred[2] })
assert.deepEqual(keptDeferredAfterEject(deferred, 2), { 1: deferred[1] })
assert.deepEqual(keptDeferredAfterEject({ 2: deferred[2] }, 1), { 2: deferred[2] })
assert.deepEqual(keptDeferredAfterEject({}, 1), {})

console.log('slot cards ok')
