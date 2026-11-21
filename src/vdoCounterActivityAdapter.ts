/**
 * Most ze simulátorových intervalů Counteru na Activity[] pro cardviewer analysis.
 * Jediný vstupní adaptér – cardviewer se odsud dál nevolá přímo z App.
 */

import type { DrivingBreakInterval } from './drivingBreakDisplay'
import type { Activity, ActivityKind } from '../vendor/cardviewer/src/types/tacho.ts'

const MINUTE_MS = 60 * 1000

function toKind(kind: DrivingBreakInterval['kind']): ActivityKind {
  if (kind === 'driving') return 'driving'
  if (kind === 'work') return 'work'
  if (kind === 'availability') return 'availability'
  return 'rest'
}

/**
 * Spojí sousední intervaly stejného druhu a vytvoří Activity pro restIntervals / dailyRestChain.
 */
export function drivingBreakIntervalsToActivities(
  intervals: readonly DrivingBreakInterval[],
  slot: 1 | 2,
): Activity[] {
  const sorted = [...intervals]
    .filter((item) => item.endMs > item.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  const merged: DrivingBreakInterval[] = []
  for (const item of sorted) {
    const last = merged[merged.length - 1]
    if (last && last.kind === item.kind && item.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, item.endMs)
      continue
    }
    merged.push({ kind: item.kind, startMs: item.startMs, endMs: item.endMs })
  }

  return merged.map((item, index) => {
    const durationMs = item.endMs - item.startMs
    return {
      id: `slot${slot}-${item.startMs}-${index}`,
      kind: toKind(item.kind),
      startUtc: item.startMs,
      endUtc: item.endMs,
      durationMinutes: Math.max(1, Math.round(durationMs / MINUTE_MS)),
      slot,
    }
  })
}
