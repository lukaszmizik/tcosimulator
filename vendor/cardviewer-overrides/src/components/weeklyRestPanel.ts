import { findRestIntervals } from '../analysis/restIntervals.ts'
import { classifyRestCandidates } from '../analysis/restCandidates.ts'
import { classifyWeeklyRestCandidates } from '../analysis/weeklyRest.ts'
import { buildWeeklyRestAssignment, type WeeklyAssignmentNode } from '../analysis/weeklyRestAssignment.ts'
import type { CompensationFulfillmentStatus } from '../analysis/weeklyRestCompensationTaken.ts'
import { assessWeeklyRestCompensationTaken, type ObligationFulfillment } from '../analysis/weeklyRestCompensationTaken.ts'
import { addDays, formatClockDateTime, type ClockMode } from '../lib/clock.ts'
import type { Activity } from '../types/tacho.ts'
import { cs, fill, formatDuration, type WeeklyRestText } from '../translations.ts'

const NINE_HOURS = 9 * 60 * 60 * 1000

export type WeeklyRestPanelCompensation = {
  requiredText: string
  deadlineText: string | null
  status: CompensationFulfillmentStatus
  statusText: string
  takenLines: string[]
  uncertaintyText: string | null
}

export type WeeklyRestPanelRest = {
  sourceNodeId: string
  summary: string
  assignmentText: string | null
  compensation: WeeklyRestPanelCompensation | null
  noCompensationText: string | null
}

export type WeeklyRestPanelSnapshotItem = {
  obligationId: string
  summary: string
  requiredText: string
  deadlineText: string | null
  status: CompensationFulfillmentStatus
  statusText: string
}

export type WeeklyRestPanelOutlook = {
  remainingText: string
  nearestDeadlineText: string | null
  attachmentText: string
  combinationText: string | null
  cautionText: string
}

export type WeeklyRestPanel = {
  title: string
  basisText: string
  historyNote: string
  rests: WeeklyRestPanelRest[]
  emptyRestsText: string | null
  snapshotTitle: string
  snapshotNote: string
  snapshotItems: WeeklyRestPanelSnapshotItem[]
  snapshotEmptyText: string | null
  outlookTitle: string
  outlook: WeeklyRestPanelOutlook | null
}

function statusText(status: CompensationFulfillmentStatus, text: WeeklyRestText): string {
  if (status === 'taken') return text.statusTaken
  if (status === 'open') return text.statusOpen
  if (status === 'missed') return text.statusMissed
  return text.statusUndecided
}

function uncertaintyText(reason: string, text: WeeklyRestText): string {
  if (reason === 'record_incomplete') return text.recordIncomplete
  if (reason === 'alternative_outcomes') return text.alternativeOutcomes
  if (reason === 'obligation_not_unique') return text.obligationNotUnique
  return text.uncertainResult
}

/**
 * Sestaví texty panelu. Právní výpočet neopakuje.
 * Stav k závěru týdne bere jen odpočinky, které před tímto okamžikem celé skončily.
 */
export function buildWeeklyRestPanel(input: {
  activities: readonly Activity[]
  displayedWeekStartUtc: number
  clockMode: ClockMode
  text?: WeeklyRestText
  hourUnit?: string
  minuteUnit?: string
}): WeeklyRestPanel {
  const text = input.text ?? cs.workWeek.weeklyRest
  const hourUnit = input.hourUnit ?? cs.workWeek.hourUnit
  const minuteUnit = input.minuteUnit ?? cs.workWeek.minuteUnit
  const weekStart = input.displayedWeekStartUtc
  const weekEnd = addDays(weekStart, 7, input.clockMode)
  const history = assessRecord(input.activities, null)
  const snapshot = assessRecord(input.activities, weekEnd)
  const historyAssignment = buildWeeklyRestAssignment(history.input)
  const nodes = new Map(historyAssignment.nodes.map((node) => [node.id, node]))
  const fulfillments = new Map(history.report.fulfillments.map((item) => [item.obligationId, item]))
  const decisiveIds = new Set<string>([
    ...history.report.compensation.obligations.map((item) => item.sourceNodeId),
    ...history.report.compensation.notRequired.filter((item) => item.reason === 'regular_length').map((item) => item.sourceNodeId),
  ])
  const rests = [...decisiveIds]
    .map((id) => nodes.get(id))
    .filter((node): node is WeeklyAssignmentNode => node != null && relatesToWeek(node, weekStart, weekEnd))
    .sort((left, right) => left.startUtc - right.startUtc || left.endUtc - right.endUtc)
    .map((node) => restRow(node, history.report.compensation.obligations.find((item) => item.sourceNodeId === node.id) ?? null, fulfillments, input.clockMode, text, hourUnit, minuteUnit))

  const open = snapshot.report.fulfillments.filter((item) => item.status === 'open')
  const snapshotItems = snapshot.report.compensation.obligations
    .map((obligation) => snapshotItem(obligation, snapshot.report.fulfillments.find((item) => item.obligationId === obligation.id) ?? null, input.clockMode, text, hourUnit, minuteUnit))
    .filter((item): item is WeeklyRestPanelSnapshotItem => item != null)
    .sort((left, right) => (left.deadlineText ?? '').localeCompare(right.deadlineText ?? '') || left.summary.localeCompare(right.summary))

  return {
    title: text.title,
    basisText: text.basisText,
    historyNote: text.historyNote,
    rests,
    emptyRestsText: rests.length === 0 ? text.emptyRests : null,
    snapshotTitle: text.snapshotTitle,
    snapshotNote: fill(text.snapshotNote, { time: formatWhen(weekEnd, input.clockMode) }),
    snapshotItems,
    snapshotEmptyText: snapshotItems.length === 0 ? text.snapshotEmpty : null,
    outlookTitle: text.outlookTitle,
    outlook: outlookFor(open, snapshot.report.compensation.obligations, input.clockMode, text, hourUnit, minuteUnit),
  }
}

function assessRecord(activities: readonly Activity[], cutoff: number | null) {
  const candidates = classifyRestCandidates(findRestIntervals(activities))
  const lastEnd = activities.reduce((end, activity) => Math.max(end, activity.endUtc), Number.NEGATIVE_INFINITY)
  const recordEndUtc = cutoff == null ? (Number.isFinite(lastEnd) ? lastEnd : null) : Math.min(cutoff, Number.isFinite(lastEnd) ? lastEnd : cutoff)
  const visible = candidates.filter((candidate) => recordEndUtc == null || candidate.endUtc < recordEndUtc)
  const unknownIntervals = activities
    .filter((activity) => activity.kind === 'unknown' && activity.endUtc > activity.startUtc && (recordEndUtc == null || activity.startUtc < recordEndUtc))
    .map((activity) => ({
      startUtc: activity.startUtc,
      endUtc: recordEndUtc == null ? activity.endUtc : Math.min(activity.endUtc, recordEndUtc),
    }))
    .filter((interval) => interval.endUtc > interval.startUtc)
  const input = {
    candidates: classifyWeeklyRestCandidates(visible),
    rests: visible,
    unknownIntervals,
    recordEndUtc,
  }
  return { input, report: assessWeeklyRestCompensationTaken(input) }
}

function relatesToWeek(node: WeeklyAssignmentNode, weekStart: number, weekEnd: number): boolean {
  if (overlaps(node.startUtc, node.endUtc, weekStart, weekEnd)) return true
  return node.possibleWeeks.some((week) => week.attachment !== 'covered_slice' && overlaps(week.startUtc, week.endUtc, weekStart, weekEnd))
}

function restRow(
  node: WeeklyAssignmentNode,
  obligation: { id: string; compensationMs: number; deadlineUtc: number | null; certainty: 'determined' | 'ambiguous'; alternatives: { weekStartUtc: number }[] } | null,
  fulfillments: ReadonlyMap<string, ObligationFulfillment>,
  clockMode: ClockMode,
  text: WeeklyRestText,
  hourUnit: string,
  minuteUnit: string,
): WeeklyRestPanelRest {
  const label = node.lengthClass === 'regular' ? text.regular : text.reduced
  const fulfillment = obligation == null ? null : fulfillments.get(obligation.id) ?? null
  const duration = (ms: number) => formatDuration(ms, hourUnit, minuteUnit)
  return {
    sourceNodeId: node.id,
    summary: `${label}, ${duration(node.durationMs)}, ${formatRange(node.startUtc, node.endUtc, clockMode)}`,
    assignmentText: assignmentText(node, text),
    compensation:
      obligation == null || fulfillment == null
        ? null
        : {
            requiredText: requirementText(obligation.compensationMs, obligation.deadlineUtc, obligation.certainty, clockMode, text, duration),
            deadlineText: deadlineText(obligation.deadlineUtc, clockMode, text),
            status: fulfillment.status,
            statusText: statusText(fulfillment.status, text),
            takenLines: fulfillment.status === 'taken' ? takenLines(fulfillment, clockMode, text, duration) : [],
            uncertaintyText: fulfillment.status === 'undecided' ? uncertaintyText(fulfillment.reason, text) : null,
          },
    noCompensationText: obligation == null ? text.noCompensation : null,
  }
}

function snapshotItem(
  obligation: { id: string; compensationMs: number; deadlineUtc: number | null; restStartUtc: number; restEndUtc: number; restMs: number; certainty: 'determined' | 'ambiguous' },
  fulfillment: ObligationFulfillment | null,
  clockMode: ClockMode,
  text: WeeklyRestText,
  hourUnit: string,
  minuteUnit: string,
): WeeklyRestPanelSnapshotItem | null {
  if (fulfillment == null) return null
  const duration = (ms: number) => formatDuration(ms, hourUnit, minuteUnit)
  const range = formatRange(obligation.restStartUtc, obligation.restEndUtc, clockMode)
  return {
    obligationId: obligation.id,
    summary: fill(text.reducedSummary, { duration: duration(obligation.restMs), range }),
    requiredText: requirementText(obligation.compensationMs, obligation.deadlineUtc, obligation.certainty, clockMode, text, duration),
    deadlineText: deadlineText(obligation.deadlineUtc, clockMode, text),
    status: fulfillment.status,
    statusText: statusText(fulfillment.status, text),
  }
}

function outlookFor(
  open: readonly ObligationFulfillment[],
  obligations: readonly { id: string; compensationMs: number; deadlineUtc: number | null }[],
  clockMode: ClockMode,
  text: WeeklyRestText,
  hourUnit: string,
  minuteUnit: string,
): WeeklyRestPanelOutlook | null {
  const items = open
    .map((item) => obligations.find((obligation) => obligation.id === item.obligationId))
    .filter((item): item is { id: string; compensationMs: number; deadlineUtc: number | null } => item != null && item.deadlineUtc != null)
  if (items.length === 0) return null
  const nearest = [...items].sort((left, right) => left.deadlineUtc! - right.deadlineUtc!)[0]!
  const duration = (ms: number) => formatDuration(ms, hourUnit, minuteUnit)
  const remaining = items.reduce((total, item) => total + item.compensationMs, 0)
  return {
    remainingText: fill(text.remaining, { duration: duration(remaining) }),
    nearestDeadlineText: fill(text.nearestDeadline, { deadline: deadlineText(nearest.deadlineUtc, clockMode, text) ?? '' }),
    attachmentText: text.attachment,
    combinationText: fill(text.combination, {
      compensation: duration(nearest.compensationMs),
      total: duration(nearest.compensationMs + NINE_HOURS),
    }),
    cautionText: text.caution,
  }
}

function assignmentText(node: WeeklyAssignmentNode, text: WeeklyRestText): string | null {
  const weeks = node.possibleWeeks.filter((week) => week.attachment !== 'covered_slice')
  if (node.weekChoice !== 'needs_controller' || weeks.length < 2) return null
  const labels = weeks.map((week) => formatWhen(week.startUtc, 'utc'))
  return fill(text.assignWeek, { weeks: labels.join(text.weekJoiner) })
}

function requirementText(
  compensationMs: number,
  deadlineUtc: number | null,
  certainty: 'determined' | 'ambiguous',
  clockMode: ClockMode,
  text: WeeklyRestText,
  duration: (ms: number) => string,
): string {
  if (certainty !== 'determined' || deadlineUtc == null) return fill(text.compensationUndated, { duration: duration(compensationMs) })
  return fill(text.compensationUntil, { duration: duration(compensationMs), deadline: deadlineText(deadlineUtc, clockMode, text) ?? '' })
}

function deadlineText(deadlineUtc: number | null, clockMode: ClockMode, text: WeeklyRestText): string | null {
  if (deadlineUtc == null) return null
  const utc = `${formatClockDateTime(deadlineUtc, 'utc')} UTC`
  if (clockMode === 'utc') return utc
  return fill(text.localTimeHint, { utc, local: formatClockDateTime(deadlineUtc, 'local') })
}

function takenLines(fulfillment: ObligationFulfillment, clockMode: ClockMode, text: WeeklyRestText, duration: (ms: number) => string): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const reading of fulfillment.readings) {
    if (!reading.onTime || !reading.assignsObligation) continue
    for (const allocation of reading.allocations) {
      for (const slice of allocation.slices) {
        if (slice.role !== 'compensation' || slice.obligationId !== fulfillment.obligationId) continue
        const key = `${slice.startUtc}:${slice.endUtc}`
        if (seen.has(key)) continue
        seen.add(key)
        lines.push(fill(text.takenLine, { duration: duration(slice.durationMs), range: formatRange(slice.startUtc, slice.endUtc, clockMode) }))
      }
    }
  }
  return lines
}

function formatRange(startUtc: number, endUtc: number, clockMode: ClockMode): string {
  return `${formatWhen(startUtc, clockMode)}–${formatWhen(endUtc, clockMode)}`
}

function formatWhen(utc: number, clockMode: ClockMode): string {
  return formatClockDateTime(utc, clockMode)
}

function overlaps(startUtc: number, endUtc: number, otherStart: number, otherEnd: number): boolean {
  return startUtc < otherEnd && otherStart < endUtc
}
