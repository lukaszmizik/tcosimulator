import assert from 'node:assert/strict'
import { appendWorkingMinutes, createDddCardRecord, type DddCardRecord } from '../src/dddCardSession.ts'
import {
  activitiesForApplyTime,
  clockAfterApplyTime,
  minuteLeftForSecondClock,
  planApplyTimeJump,
  type ApplyTimeJumpPlan,
  type ApplyTimeSlot,
} from '../src/applyTimeJump.ts'
import type { ActivityHistoryEntry } from '../src/TachoTypes.ts'
import type { DddParsedActivity } from '../src/types/tachoViewerDddMapper.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const SIM = Date.parse('2026-11-16T10:00:20.000Z')
const PLUS_60 = 60 * MINUTE

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function keys(entries: ActivityHistoryEntry[]): string[] {
  return entries.map((entry) => iso(entry.minuteStartUtc))
}

function ddd(cardNumber: string, activities: DddParsedActivity[] = []): DddCardRecord {
  return createDddCardRecord({
    cardNumber,
    firstName: 'Test',
    surname: 'Ridic',
    lastWithdrawalUtc: Date.parse('2026-11-16T08:00:00.000Z'),
    activities,
    locations: [],
  })
}

function slotDdd(cardNumber: string): ApplyTimeSlot {
  return { inserted: true, cardNumber }
}

function slotVirtual(templateId: 'zmizik' | 'novak'): ApplyTimeSlot {
  return { inserted: true, templateId }
}

function applySinks(
  plan: ApplyTimeJumpPlan,
  vehicle: ActivityHistoryEntry[],
  templates: Record<string, ActivityHistoryEntry[]>,
  cards: Record<string, DddCardRecord>,
) {
  const seen = new Set(vehicle.map((entry) => entry.minuteStartUtc))
  const added = plan.entries.filter((entry) => !seen.has(entry.minuteStartUtc))
  const nextVehicle = added.length > 0 ? [...vehicle, ...added] : vehicle
  const nextTemplates = { ...templates }
  for (const templateId of plan.templateIds) {
    const arr = nextTemplates[templateId] ?? []
    const have = new Set(arr.map((entry) => entry.minuteStartUtc))
    const extra = plan.entries.filter((entry) => !have.has(entry.minuteStartUtc))
    if (extra.length > 0) nextTemplates[templateId] = [...arr, ...extra]
  }
  const nextCards = plan.dddCardNumbers.reduce(
    (current, cardNumber) => appendWorkingMinutes(current, cardNumber, plan.entries),
    cards,
  )
  return { vehicle: nextVehicle, templates: nextTemplates, cards: nextCards }
}

function assertRange(entries: ActivityHistoryEntry[], from: string, to: string) {
  assert.equal(entries.length, 60)
  assert.equal(iso(entries[0].minuteStartUtc), from)
  assert.equal(iso(entries[entries.length - 1].minuteStartUtc), to)
  const unique = new Set(entries.map((entry) => entry.minuteStartUtc))
  assert.equal(unique.size, entries.length)
  for (let index = 1; index < entries.length; index += 1) {
    assert.equal(entries[index].minuteStartUtc - entries[index - 1].minuteStartUtc, MINUTE)
  }
}

export function main() {
  const originalActivity: DddParsedActivity = {
    kind: 'rest',
    startUtc: Date.parse('2026-11-15T22:00:00.000Z'),
    endUtc: Date.parse('2026-11-16T06:00:00.000Z'),
  }

  const driving = activitiesForApplyTime(80, 'REST', 'WORK')
  assert.deepEqual(driving, { driver1: 'driving', driver2: 'availability' })

  const dddSlot1 = ddd('C1', [originalActivity])
  const cards1: Record<string, DddCardRecord> = { C1: dddSlot1 }
  const plan1 = planApplyTimeJump({
    simulatedUtcMs: SIM,
    deltaMs: PLUS_60,
    existingMinuteStarts: [],
    driver1: driving.driver1,
    driver2: driving.driver2,
    slot1: slotDdd('C1'),
    slot2: slotVirtual('novak'),
  })
  assert.deepEqual(plan1.dddCardNumbers, ['C1'])
  assert.deepEqual(plan1.templateIds, ['novak'])
  assert.equal('secondHistory' in plan1, false)
  assertRange(plan1.entries, '2026-11-16T10:00:00.000Z', '2026-11-16T10:59:00.000Z')
  for (const entry of plan1.entries) {
    assert.equal(entry.driver1, 'driving')
    assert.equal(entry.driver2, 'availability')
    assert.equal(entry.driver1CardId, 'C1')
    assert.equal(entry.driver2CardId, 'novak')
  }
  const stored1 = applySinks(plan1, [], {}, cards1)
  assert.deepEqual(keys(stored1.vehicle), keys(plan1.entries))
  assert.deepEqual(keys(stored1.templates.novak), keys(plan1.entries))
  assert.equal(stored1.templates.zmizik, undefined)
  assert.equal(stored1.cards.C1.original, dddSlot1.original)
  assert.deepEqual(stored1.cards.C1.original.activities, [originalActivity])
  assert.deepEqual(keys(stored1.cards.C1.workingActivities), keys(plan1.entries))
  const again1 = applySinks(plan1, stored1.vehicle, stored1.templates, stored1.cards)
  assert.equal(again1.vehicle.length, 60)
  assert.equal(again1.templates.novak.length, 60)
  assert.equal(again1.cards.C1.workingActivities.length, 60)

  const dddSlot2 = ddd('C2', [originalActivity])
  const plan2 = planApplyTimeJump({
    simulatedUtcMs: SIM,
    deltaMs: PLUS_60,
    existingMinuteStarts: [],
    driver1: driving.driver1,
    driver2: driving.driver2,
    slot1: slotVirtual('zmizik'),
    slot2: slotDdd('C2'),
  })
  assert.deepEqual(plan2.dddCardNumbers, ['C2'])
  assert.deepEqual(plan2.templateIds, ['zmizik'])
  const stored2 = applySinks(plan2, [], {}, { C2: dddSlot2 })
  assert.equal(stored2.cards.C2.workingActivities[0].driver2, 'availability')
  assert.equal(stored2.cards.C2.workingActivities[0].driver2CardId, 'C2')
  assert.equal(stored2.cards.C2.workingActivities[0].driver1CardId, 'zmizik')
  assert.equal(stored2.templates.zmizik[0].driver1, 'driving')
  assert.deepEqual(stored2.cards.C2.original.activities, [originalActivity])
  assert.equal(stored2.cards.C1, undefined)

  const standing = activitiesForApplyTime(0, 'REST', 'WORK')
  assert.deepEqual(standing, { driver1: 'rest', driver2: 'otherWork' })
  const planStand = planApplyTimeJump({
    simulatedUtcMs: SIM,
    deltaMs: PLUS_60,
    existingMinuteStarts: [],
    driver1: standing.driver1,
    driver2: standing.driver2,
    slot1: slotDdd('C1'),
    slot2: slotVirtual('novak'),
  })
  assertRange(planStand.entries, '2026-11-16T10:00:00.000Z', '2026-11-16T10:59:00.000Z')
  for (const entry of planStand.entries) {
    assert.equal(entry.driver1, 'rest')
    assert.equal(entry.driver2, 'otherWork')
    assert.equal(entry.driver1CardId, 'C1')
    assert.equal(entry.driver2CardId, 'novak')
  }

  const existingFirst = Date.parse('2026-11-16T10:00:00.000Z')
  const planKept = planApplyTimeJump({
    simulatedUtcMs: SIM,
    deltaMs: PLUS_60,
    existingMinuteStarts: [existingFirst],
    driver1: driving.driver1,
    driver2: driving.driver2,
    slot1: slotDdd('C1'),
    slot2: slotVirtual('novak'),
  })
  assert.equal(planKept.entries.length, 59)
  assert.equal(iso(planKept.entries[0].minuteStartUtc), '2026-11-16T10:01:00.000Z')
  assert.equal(iso(planKept.entries[planKept.entries.length - 1].minuteStartUtc), '2026-11-16T10:59:00.000Z')
  assert.equal(planKept.entries.some((entry) => entry.minuteStartUtc === existingFirst), false)

  const offsetMs = 2 * HOUR
  const target = SIM + offsetMs + PLUS_60
  const shift = clockAfterApplyTime(SIM, offsetMs, target)
  assert.equal(shift.deltaMs, PLUS_60)
  assert.equal(iso(shift.nextSimulatedUtcMs), '2026-11-16T11:00:20.000Z')
  assert.equal(shift.nextTimeOffsetMs, offsetMs)
  const planOffset = planApplyTimeJump({
    simulatedUtcMs: SIM,
    deltaMs: shift.deltaMs,
    existingMinuteStarts: [existingFirst],
    driver1: driving.driver1,
    driver2: driving.driver2,
    slot1: slotDdd('C1'),
    slot2: slotDdd('C2'),
  })
  const leftForClock = minuteLeftForSecondClock(shift.nextSimulatedUtcMs)
  assert.equal(iso(leftForClock), '2026-11-16T11:00:00.000Z')
  assert.equal(planOffset.entries.some((entry) => entry.minuteStartUtc === leftForClock), false)
  assert.equal(planOffset.entries.some((entry) => entry.minuteStartUtc === existingFirst), false)
  assert.equal(iso(planOffset.entries[0].minuteStartUtc), '2026-11-16T10:01:00.000Z')
  assert.equal(iso(planOffset.entries[planOffset.entries.length - 1].minuteStartUtc), '2026-11-16T10:59:00.000Z')
  assert.deepEqual(planOffset.dddCardNumbers, ['C1', 'C2'])
  assert.deepEqual(planOffset.templateIds, [])
  const both = applySinks(planOffset, [{ minuteStartUtc: existingFirst, driver1: 'driving', driver2: 'availability', driver1CardId: 'C1', driver2CardId: 'C2' }], {}, {
    C1: ddd('C1', [originalActivity]),
    C2: ddd('C2', [originalActivity]),
  })
  assert.equal(both.vehicle.length, 60)
  assert.equal(both.vehicle.filter((entry) => entry.minuteStartUtc === existingFirst).length, 1)
  assert.equal(both.cards.C1.workingActivities.length, 59)
  assert.equal(both.cards.C2.workingActivities.length, 59)
  assert.equal(both.cards.C1.workingActivities.some((entry) => entry.minuteStartUtc === leftForClock), false)
  assert.deepEqual(both.cards.C1.original.activities, [originalActivity])
  assert.deepEqual(both.cards.C2.original.activities, [originalActivity])

  const zero = clockAfterApplyTime(SIM, 0, SIM + PLUS_60)
  assert.equal(iso(zero.nextSimulatedUtcMs), '2026-11-16T11:00:20.000Z')
  assert.equal(zero.nextTimeOffsetMs, 0)

  console.log(JSON.stringify({
    drivingDddSlot1: {
      minutes: [iso(plan1.entries[0].minuteStartUtc), iso(plan1.entries[plan1.entries.length - 1].minuteStartUtc)],
      count: plan1.entries.length,
      ddd: 'C1 driving',
      virtual: 'novak availability',
    },
    drivingDddSlot2: {
      minutes: [iso(plan2.entries[0].minuteStartUtc), iso(plan2.entries[plan2.entries.length - 1].minuteStartUtc)],
      ddd: 'C2 availability',
      virtual: 'zmizik driving',
    },
    standing: {
      slot1: 'C1 rest',
      slot2: 'novak otherWork',
      count: planStand.entries.length,
    },
    existingFirstMinute: {
      kept: iso(existingFirst),
      written: [iso(planKept.entries[0].minuteStartUtc), iso(planKept.entries[planKept.entries.length - 1].minuteStartUtc)],
      count: planKept.entries.length,
    },
    offsetPlus2h: {
      nextSimulatedUtc: iso(shift.nextSimulatedUtcMs),
      offsetMs: shift.nextTimeOffsetMs,
      written: [iso(planOffset.entries[0].minuteStartUtc), iso(planOffset.entries[planOffset.entries.length - 1].minuteStartUtc)],
      leftForSecondClock: iso(leftForClock),
    },
  }, null, 2))
}
