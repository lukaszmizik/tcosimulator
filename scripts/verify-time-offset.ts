import assert from 'node:assert/strict'
import {
  TIME_OFFSET_LIMIT_MS,
  TIME_OFFSET_STEP_MS,
  commitClockOffsets,
  formatTachographClock,
  loadClockOffsets,
  shownInstant,
  stepTimeOffset,
  timeOffsetSymbol,
  writeClockOffsets,
  type ClockOffsets,
} from '../src/timeOffsetEditor.ts'

const step = TIME_OFFSET_STEP_MS
const utc = Date.UTC(2026, 10, 22, 23, 50)
const base: ClockOffsets = { localOffsetMs: 60 * 60 * 1000, ownerOffsetMs: -2 * step }

assert.equal(timeOffsetSymbol('local'), 37)
assert.equal(timeOffsetSymbol('owner'), 3)
assert.equal(stepTimeOffset(0, 1), step)
assert.equal(stepTimeOffset(step, -1), 0)
assert.equal(stepTimeOffset(TIME_OFFSET_LIMIT_MS, 1), TIME_OFFSET_LIMIT_MS)
assert.equal(stepTimeOffset(-TIME_OFFSET_LIMIT_MS, -1), -TIME_OFFSET_LIMIT_MS)
assert.equal(stepTimeOffset(TIME_OFFSET_LIMIT_MS, -1), TIME_OFFSET_LIMIT_MS - step)

const utcClock = formatTachographClock(utc)
const afterMidnight = formatTachographClock(shownInstant(utc, step))
assert.equal(`${utcClock.date} ${utcClock.time}`, '22.11.26 23:50')
assert.equal(`${afterMidnight.date} ${afterMidnight.time}`, '23.11.26 00:20')
assert.equal(formatTachographClock(utc).time, '23:50')

const localDraft = { kind: 'local' as const, draftOffsetMs: base.localOffsetMs + step }
const savedLocal = commitClockOffsets(base, localDraft, true)
assert.equal(savedLocal.offsets.localOffsetMs, base.localOffsetMs + step)
assert.equal(savedLocal.offsets.ownerOffsetMs, base.ownerOffsetMs)
assert.equal(savedLocal.panelDeltaMs, step)

const savedOwner = commitClockOffsets(base, { kind: 'owner', draftOffsetMs: 3 * step }, true)
assert.equal(savedOwner.offsets.localOffsetMs, base.localOffsetMs)
assert.equal(savedOwner.offsets.ownerOffsetMs, 3 * step)
assert.equal(savedOwner.panelDeltaMs, 0)

const cancelled = commitClockOffsets(base, localDraft, false)
assert.deepEqual(cancelled.offsets, base)
assert.equal(cancelled.panelDeltaMs, 0)

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

const storage = memoryStorage()
writeClockOffsets(storage, savedLocal.offsets)
const loaded = loadClockOffsets(storage)
assert.deepEqual(loaded, savedLocal.offsets)
storage.setItem(storage.key(0)!, '{"localOffsetMs":1,"ownerOffsetMs":"x"}')
assert.deepEqual(loadClockOffsets(storage), { localOffsetMs: 1, ownerOffsetMs: 0 })

console.log('time offset ok')
