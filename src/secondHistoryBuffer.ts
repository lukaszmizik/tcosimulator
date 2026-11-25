/**
 * Sekundové vzorky bez kopírování celého bufferu při každém zápisu.
 * Starší bloky zůstávají sdílené. Nový objekt má React vidět, pole vzorků se při renderu neskládá znovu.
 */

import type { SecondActivitySnapshot } from './TachoTypes'

export const SECOND_HISTORY_LIMIT = 86_400
const CHUNK_SIZE = 512

export type SecondSampleRead = Iterable<SecondActivitySnapshot> & {
  readonly length: number
}

type Node = {
  chunks: readonly (readonly SecondActivitySnapshot[])[]
  /** Kolik vzorků na začátku prvního bloku už nepatří do historie. */
  start: number
  length: number
}

export class SecondHistoryView implements Iterable<SecondActivitySnapshot> {
  constructor(readonly node: Node) {}

  get length(): number {
    return this.node.length
  }

  sampleAt(index: number): SecondActivitySnapshot | undefined {
    const resolved = index < 0 ? this.node.length + index : index
    if (resolved < 0 || resolved >= this.node.length) return undefined
    let cursor = resolved + this.node.start
    for (const chunk of this.node.chunks) {
      if (cursor < chunk.length) return chunk[cursor]
      cursor -= chunk.length
    }
    return undefined
  }

  [Symbol.iterator](): IterableIterator<SecondActivitySnapshot> {
    return iterateSamples(this.node)
  }
}

function* iterateSamples(node: Node): IterableIterator<SecondActivitySnapshot> {
  let skip = node.start
  let left = node.length
  for (const chunk of node.chunks) {
    let index = 0
    if (skip > 0) {
      if (skip >= chunk.length) {
        skip -= chunk.length
        continue
      }
      index = skip
      skip = 0
    }
    for (; index < chunk.length && left > 0; index += 1, left -= 1) {
      yield chunk[index]!
    }
    if (left <= 0) return
  }
}

function trim(node: Node): Node {
  const chunks = node.chunks.slice()
  let start = node.start
  let length = node.length
  while (length > SECOND_HISTORY_LIMIT && chunks.length > 0) {
    const overflow = length - SECOND_HISTORY_LIMIT
    const liveInFirst = chunks[0]!.length - start
    if (overflow >= liveInFirst) {
      length -= liveInFirst
      chunks.shift()
      start = 0
    } else {
      start += overflow
      length -= overflow
    }
  }
  return { chunks, start, length }
}

function nodeFromIterable(samples: Iterable<SecondActivitySnapshot>): Node {
  const chunks: SecondActivitySnapshot[][] = []
  let current: SecondActivitySnapshot[] | null = null
  let length = 0
  for (const sample of samples) {
    if (!current || current.length >= CHUNK_SIZE) {
      current = []
      chunks.push(current)
    }
    current.push(sample)
    length += 1
  }
  return trim({ chunks, start: 0, length })
}

function appendToNode(node: Node, extra: readonly SecondActivitySnapshot[]): Node {
  if (extra.length === 0) return node
  const chunks = node.chunks.slice()
  const start = node.start
  let length = node.length
  let pending = 0
  if (chunks.length > 0) {
    const last = chunks[chunks.length - 1]!
    const room = CHUNK_SIZE - last.length
    if (room > 0) {
      const take = Math.min(room, extra.length)
      chunks[chunks.length - 1] = last.concat(extra.slice(0, take))
      pending = take
      length += take
    }
  }
  while (pending < extra.length) {
    const take = Math.min(CHUNK_SIZE, extra.length - pending)
    chunks.push(extra.slice(pending, pending + take))
    pending += take
    length += take
  }
  return trim({ chunks, start, length })
}

export function emptySecondHistory(): SecondHistoryView {
  return new SecondHistoryView({ chunks: [], start: 0, length: 0 })
}

export function secondHistoryFrom(samples: readonly SecondActivitySnapshot[]): SecondHistoryView {
  return new SecondHistoryView(nodeFromIterable(samples))
}

export function appendSecondSamples(
  history: SecondSampleRead,
  extra: readonly SecondActivitySnapshot[],
): SecondSampleRead {
  if (extra.length === 0) return history
  if (history instanceof SecondHistoryView) {
    return new SecondHistoryView(appendToNode(history.node, extra))
  }
  return new SecondHistoryView(appendToNode(nodeFromIterable(history), extra))
}

export function secondSampleAt(
  samples: SecondSampleRead,
  index: number,
): SecondActivitySnapshot | undefined {
  if (samples instanceof SecondHistoryView) return samples.sampleAt(index)
  const list = samples as readonly SecondActivitySnapshot[]
  const resolved = index < 0 ? list.length + index : index
  return list[resolved]
}

/** Jen vzorky, které predikát pustí. Celý buffer se kvůli tomu neskládá do nového pole. */
export function filterSecondSamples(
  samples: Iterable<SecondActivitySnapshot>,
  predicate: (sample: SecondActivitySnapshot) => boolean,
): SecondActivitySnapshot[] {
  const matched: SecondActivitySnapshot[] = []
  for (const sample of samples) {
    if (predicate(sample)) matched.push(sample)
  }
  return matched
}
