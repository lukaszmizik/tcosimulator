import assert from 'node:assert/strict'
import type { CardData } from '../src/TachoTypes.ts'
import type { DddParsedCard } from '../src/types/tachoViewerDddMapper.ts'
import { buildInsertedCardsPrintRows } from '../src/print/insertedCardsPrintRows.ts'
import type { PrintRow } from '../src/print/driverCardPrintRows.ts'
import { applyPrintWizardKey, resolvePrintMenuAction } from '../src/print/printWizardHandling.ts'
import {
  INSERTED_CARDS_PRINT_LIMIT,
  appendVehicleCardInsertion,
  currentVehicleCardInsertion,
  loadVehicleCardInsertions,
  selectInsertedCardsForPrint,
  snapshotDriverInsertion,
  writeVehicleCardInsertions,
  type VehicleCardInsertion,
} from '../src/print/vehicleCardInsertions.ts'

const printedAt = Date.UTC(2026, 10, 22, 9, 0)

function line(row: PrintRow): string {
  return row.map((cell) => (typeof cell === 'number' ? `(${cell})` : cell)).join('')
}

function text(rows: readonly PrintRow[]): string {
  return rows.map(line).join('\n')
}

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

function entry(partial: Partial<VehicleCardInsertion> & Pick<VehicleCardInsertion, 'id' | 'insertedAtUtc' | 'slot'>): VehicleCardInsertion {
  return { cardType: 'driver', ...partial }
}

const menu = {
  line2: '(6)(14)(17)(18) Karty',
  requiresDate: false,
  requiresUtcConfirm: false,
  secondHistory: [],
  simulatedUtcTime: printedAt,
  currentMenuPath: ['ENTRY'],
}

assert.equal(resolvePrintMenuAction({ ...menu, action: 'DISP_CARDS_V' }), null)
assert.equal(resolvePrintMenuAction({ ...menu, action: 'DISP_CARDS_V', requiresDate: true }), null)
const opened = resolvePrintMenuAction({ ...menu, action: 'PRINT_CARDS_V' })
assert.equal(opened?.type, 'openInsertedCardsPrint')
if (opened?.type !== 'openInsertedCardsPrint') throw new Error('PRINT_CARDS_V')
assert.equal(opened.state.step, 'utc')
assert.equal(opened.state.utcYes, true)
assert.equal(opened.state.availableDatesUtc.length, 0)

let printedUtc: boolean | null = null
const effects = {
  setCurrentMenuPath() {},
  openPrintVDiagram() {},
  openPrintDriverCard() {},
  openPrintVehicle24h() {},
  openInsertedCardsPrint(isUtc: boolean) { printedUtc = isUtc },
}
assert.equal(applyPrintWizardKey(opened.state, 'down', effects)?.utcYes, false)
assert.equal(printedUtc, null)
assert.equal(applyPrintWizardKey(opened.state, 'back', effects), null)
assert.equal(applyPrintWizardKey({ ...opened.state, utcYes: false }, 'ok', effects), null)
assert.equal(printedUtc, false)

const virtual = snapshotDriverInsertion({
  insertedAtUtc: printedAt - 60_000,
  slot: 1,
  sequence: 0,
  card: { name: 'Lukas Zmizik', surname: 'Zmizik', lastWithdrawal: null, templateId: 'zmizik' },
})
assert.equal(virtual.cardIdentification, 'CZ1234567890AB12')
assert.equal(virtual.surnameOrOrganisation, 'Zmizik')
assert.equal(virtual.firstName, 'Lukas')
assert.equal(virtual.expiresLabel, '12.03.2027')
assert.equal(virtual.cardGeneration, undefined)
assert.equal(virtual.cardSerialNumber, undefined)
assert.equal(virtual.manufacturerCode, undefined)
assert.equal(virtual.cardType, 'driver')

const imported = {
  cardNumber: 'D123456789012345',
  firstName: 'Anna',
  surname: 'Nováková',
  issuingCountry: 'CZ',
  dateOfExpiry: '01.02.2030',
  generation: 'GEN2',
  lastWithdrawalUtc: 1,
  activities: [],
  locations: [],
  vehicleUses: [{ fromUtc: 1, toUtc: 2, registration: 'OLD-CAR', kilometers: null }],
} as DddParsedCard
const dddCard: CardData = { name: 'Anna', surname: 'Nováková', lastWithdrawal: 1, cardNumber: imported.cardNumber }
const fromFile = snapshotDriverInsertion({
  insertedAtUtc: printedAt - 120_000,
  slot: 2,
  sequence: 1,
  card: dddCard,
  imported,
})
assert.equal(fromFile.cardGeneration, 'GEN2')
assert.equal(fromFile.cardIdentification, 'D123456789012345')
assert.equal(fromFile.expiresLabel, '01.02.2030')
assert.equal(JSON.stringify(fromFile).includes('OLD-CAR'), false)
assert.notEqual(fromFile.id, virtual.id)

const again = snapshotDriverInsertion({ ...{ insertedAtUtc: virtual.insertedAtUtc, slot: 1 as const, sequence: 0, card: { name: 'Lukas Zmizik', surname: 'Zmizik', lastWithdrawal: null, templateId: 'zmizik' as const } } })
let history = appendVehicleCardInsertion([], virtual)
history = appendVehicleCardInsertion(history, again)
assert.equal(history.length, 1)
history = appendVehicleCardInsertion(history, fromFile)
assert.equal(history.length, 2)
assert.equal(currentVehicleCardInsertion(history, 1, virtual.cardIdentification)?.id, virtual.id)
assert.equal(currentVehicleCardInsertion(history, 1, undefined), null)

const empty = buildInsertedCardsPrintRows({
  printedAtUtc: printedAt,
  isUtc: true,
  localOffsetMs: 3_600_000,
  insertedNow: [],
  insertionHistory: [],
})
const emptyText = text(empty)
assert.equal(emptyText.includes('(18)'), true)
assert.equal(emptyText.includes('GEN2 v2'), true)
assert.equal(emptyText.includes('(6)(14)(17)(18)'), true)
assert.equal(emptyText.includes('Zmizik'), false)
assert.equal(emptyText.includes('CZ1234567890AB12'), false)
assert.equal(emptyText.includes('(12)'), false)
assert.equal(emptyText.includes('(UTC)'), true)
for (const row of empty) assert.ok(row.length <= 24, line(row))

const bothNow = buildInsertedCardsPrintRows({
  printedAtUtc: printedAt,
  isUtc: true,
  localOffsetMs: 0,
  insertedNow: [
    entry({ id: 'b', insertedAtUtc: printedAt - 1_000, slot: 2, surnameOrOrganisation: 'Milewski', firstName: 'Roman', cardIdentification: 'CZ9876543210CD34', issuingCountry: 'CZ' }),
    entry({ id: 'a', insertedAtUtc: printedAt - 2_000, slot: 1, surnameOrOrganisation: 'Zmizik', firstName: 'Lukas', cardIdentification: 'CZ1234567890AB12', issuingCountry: 'CZ', expiresLabel: '12.03.2027' }),
  ],
  insertionHistory: [
    entry({ id: 'a', insertedAtUtc: printedAt - 120_000, slot: 1, cardIdentification: 'CZ1234567890AB12', issuingCountry: 'CZ' }),
    entry({ id: 'a2', insertedAtUtc: printedAt - 60_000, slot: 1, cardIdentification: 'CZ1234567890AB12', issuingCountry: 'CZ' }),
  ],
})
const bothText = text(bothNow)
assert.ok(bothText.indexOf('Zmizik') < bothText.indexOf('Milewski'))
assert.ok(bothText.indexOf('22.11.2026 08:58') < bothText.indexOf('22.11.2026 08:59'))
assert.equal((bothText.match(/GEN2 v2/g) ?? []).length, 1)
assert.equal(bothText.includes('12.03.2027'), true)

const local = buildInsertedCardsPrintRows({
  printedAtUtc: printedAt,
  isUtc: false,
  localOffsetMs: 3_600_000,
  insertedNow: [],
  insertionHistory: [entry({ id: 'local', insertedAtUtc: printedAt - 3_600_000, slot: 1, cardIdentification: 'CZ1234567890AB12' })],
})
const localText = text(local)
assert.equal(localText.includes('!!! No legal printout!!!'), true)
assert.equal(localText.includes('(LOC)'), true)
assert.equal(localText.includes('(UTC)'), false)
assert.equal(localText.includes('22.11.2026 10:00'), true)
assert.equal(localText.includes('22.11.2026 09:00'), true)
assert.equal(localText.includes('UTC +01h00'), true)

const unknown = buildInsertedCardsPrintRows({
  printedAtUtc: printedAt,
  isUtc: true,
  localOffsetMs: 0,
  insertedNow: [entry({ id: 'bare', insertedAtUtc: printedAt, slot: 1, cardType: 'company', surnameOrOrganisation: 'Doprava s.r.o.' })],
  insertionHistory: [entry({ id: 'bare', insertedAtUtc: printedAt, slot: 1, cardType: 'company' })],
})
const unknownText = text(unknown)
assert.equal(unknownText.includes('(3)'), true)
assert.equal(unknownText.includes('Doprava s.r.o.'), true)
assert.equal(unknownText.includes('GEN1'), false)
assert.equal(unknownText.includes('GEN2 v2\n(3)'), false)
assert.equal(unknown.some((row) => row.length === 1 && row[0] === 3), true)

const longId = 'X'.repeat(40)
const wrapped = buildInsertedCardsPrintRows({
  printedAtUtc: printedAt,
  isUtc: true,
  localOffsetMs: 0,
  insertedNow: [],
  insertionHistory: [entry({ id: 'long', insertedAtUtc: printedAt, slot: 1, cardIdentification: longId, cardSerialNumber: 'SER-1', cardVersion: '01', manufacturerCode: 'VDO' })],
})
assert.equal(text(wrapped).replaceAll('\n', '').includes(longId), true)
assert.equal(text(wrapped).includes('SER-1'), true)
assert.equal(text(wrapped).includes('GEN2 01 VDO') || text(wrapped).includes('(2) GEN2 01 VDO'), false)
assert.equal(text(wrapped).includes('01 VDO'), true)
for (const row of wrapped) assert.ok(row.length <= 24, line(row))

const many: VehicleCardInsertion[] = Array.from({ length: 89 }, (_, index) => entry({
  id: `n${index + 1}`,
  insertedAtUtc: Date.UTC(2026, 0, 1, 0, index + 1),
  slot: 1,
  cardIdentification: `C${index + 1}`,
}))
const future = entry({ id: 'future', insertedAtUtc: printedAt + 60_000, slot: 1, cardIdentification: 'FUTURE' })
const selected = selectInsertedCardsForPrint([...many, future], Date.UTC(2026, 0, 1, 2, 0))
assert.equal(selected.length, INSERTED_CARDS_PRINT_LIMIT)
assert.equal(selected[0]?.id, 'n2')
assert.equal(selected.at(-1)?.id, 'n89')
const capped = text(buildInsertedCardsPrintRows({
  printedAtUtc: Date.UTC(2026, 0, 1, 2, 0),
  isUtc: true,
  localOffsetMs: 0,
  insertedNow: [],
  insertionHistory: [...many, future],
}))
assert.equal(capped.includes('00:01'), false)
assert.equal(capped.includes('00:02'), true)
assert.equal(capped.includes('01:29'), true)
assert.ok(capped.indexOf('00:02') < capped.indexOf('01:29'))
assert.equal(capped.includes('FUTURE'), false)

const storage = memoryStorage()
writeVehicleCardInsertions(storage, history)
assert.equal(loadVehicleCardInsertions(storage).length, 2)
writeVehicleCardInsertions(storage, [])
assert.deepEqual(loadVehicleCardInsertions(storage), [])
const storedKey = storage.key(0)
assert.ok(storedKey)
storage.setItem(storedKey, '{"cardGeneration":"GEN2 v2"}')
assert.deepEqual(loadVehicleCardInsertions(storage), [])

console.log('inserted cards print ok')
