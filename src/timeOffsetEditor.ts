/**
 * Posun místního času a času sídla firmy vůči simulovanému UTC.
 * timeOffsetMs na displeji je místní posun. Skok z ovládacího panelu ho dál
 * přepisuje sám; uložení místního času jen posune panel o stejný rozdíl,
 * aby rozpracovaný skok nezměnil simulatedUtcTime.
 */

export const TIME_OFFSET_STEP_MS = 30 * 60 * 1000
export const TIME_OFFSET_LIMIT_MS = 23 * 60 * 60 * 1000 + TIME_OFFSET_STEP_MS
const STORAGE_KEY = 'tcosimulator.clockOffsets'

export type ClockOffsetKind = 'local' | 'owner'

export type ClockOffsets = {
  localOffsetMs: number
  ownerOffsetMs: number
}

export type TimeOffsetEditorState = {
  kind: ClockOffsetKind
  draftOffsetMs: number
}

/**  místo = symbol 37,  firma = symbol 3. */
export function timeOffsetSymbol(kind: ClockOffsetKind): number {
  return kind === 'local' ? 37 : 3
}

export function stepTimeOffset(offsetMs: number, direction: 1 | -1): number {
  const next = offsetMs + direction * TIME_OFFSET_STEP_MS
  if (Math.abs(next) > TIME_OFFSET_LIMIT_MS && Math.abs(next) >= Math.abs(offsetMs)) return offsetMs
  return next
}

export function shownInstant(simulatedUtcMs: number, offsetMs: number): number {
  return simulatedUtcMs + offsetMs
}

export function formatTachographClock(utcMs: number): { date: string; time: string } {
  const value = new Date(utcMs)
  const pad = (part: number) => String(part).padStart(2, '0')
  return {
    date: `${pad(value.getUTCDate())}.${pad(value.getUTCMonth() + 1)}.${String(value.getUTCFullYear()).slice(-2)}`,
    time: `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`,
  }
}

/** Uložení změní jen zvolený posun. Zpět vrací původní dvojici a nulový posun panelu. */
export function commitClockOffsets(
  current: ClockOffsets,
  editor: TimeOffsetEditorState,
  save: boolean,
): { offsets: ClockOffsets; panelDeltaMs: number } {
  if (!save) return { offsets: current, panelDeltaMs: 0 }
  if (editor.kind === 'owner') {
    return {
      offsets: { ...current, ownerOffsetMs: editor.draftOffsetMs },
      panelDeltaMs: 0,
    }
  }
  return {
    offsets: { ...current, localOffsetMs: editor.draftOffsetMs },
    panelDeltaMs: editor.draftOffsetMs - current.localOffsetMs,
  }
}

function saneOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  if (Math.abs(value) > 48 * 60 * 60 * 1000) return 0
  return value
}

export function browserClockOffsetStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadClockOffsets(storage: Pick<Storage, 'getItem'> | null): ClockOffsets {
  const empty = { localOffsetMs: 0, ownerOffsetMs: 0 }
  if (!storage) return empty
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as Partial<ClockOffsets> | null
    if (!parsed || typeof parsed !== 'object') return empty
    return {
      localOffsetMs: saneOffset(parsed.localOffsetMs),
      ownerOffsetMs: saneOffset(parsed.ownerOffsetMs),
    }
  } catch {
    return empty
  }
}

export function writeClockOffsets(storage: Pick<Storage, 'setItem'> | null, offsets: ClockOffsets): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      localOffsetMs: offsets.localOffsetMs,
      ownerOffsetMs: offsets.ownerOffsetMs,
    }))
  } catch {
    // Plná paměť prohlížeče nesmí shodit nastavení na displeji.
  }
}
