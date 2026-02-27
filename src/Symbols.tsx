/**
 * Symboly a ikony pro tachograf - načítání symbolů.txt, parsování, ikonky
 */

import type { SymbolMap } from './TachoTypes'

/** Barvy aktivit – zesvětlené podklady pro symboly v infoboxu (zachován nádech původní barvy) */
export const SYMBOL_ID_TO_BG: Record<number, string> = {
  2: '#f0c4cc',   /* řízení – nádech červené */
  7: '#f5d8de',   /* pohotovost – nádech růžové */
  8: '#c8e6c9',   /* odpočinek, postýlka – nádech zelené */
  9: '#fff9c4',   /* jiná práce – nádech žluté/zlaté */
  11: '#e0e0e0',  /* neznámá činnost – světle šedá */
}
/** EditorActivityId → barva pro podklad symbolu v infoboxu */
export const ACTIVITY_ID_TO_BG: Record<string, string> = {
  REST: '#c8e6c9',      /* odpočinek, postýlka */
  WORK: '#fff9c4',      /* jiná práce */
  AVAILABILITY: '#f5d8de', /* pohotovost */
  UNKNOWN: '#e0e0e0',
  START_COUNTRY: '#e0e0e0',
  END_COUNTRY: '#e0e0e0',
}
const INFO_PANEL_SYMBOL_BG_DEFAULT = '#e0e0e0'

export function buildSymbolMapFromFile(content: string): SymbolMap {
  const map: SymbolMap = {}
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^(\d+)\s+U\+([0-9A-Fa-f]{4})/)
    if (!m) continue
    const id = Number(m[1])
    const codePoint = parseInt(m[2], 16)
    if (!Number.isFinite(id) || Number.isNaN(codePoint)) continue
    map[id] = String.fromCharCode(codePoint)
  }
  return map
}

/** Nahradí vzory typu (49)(59) za odpovídající znaky ze symbolové mapy. */
export function parseSymbols(
  text: string,
  symbolMap: SymbolMap | null | undefined,
  options?: { symbolBg?: boolean }
) {
  if (!text) return text
  if (!symbolMap || Object.keys(symbolMap).length === 0) return text
  const withBg = options?.symbolBg === true
  const parts: Array<string | JSX.Element> = []
  let lastIndex = 0
  const regex = /\((\d+)\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const index = match.index
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index))
    }
    const id = Number(match[1])
    const ch = symbolMap[id]
    if (ch) {
      const bg = withBg ? (SYMBOL_ID_TO_BG[id] ?? INFO_PANEL_SYMBOL_BG_DEFAULT) : undefined
      parts.push(
        <span
          key={parts.length}
          className={withBg ? 'tacho-icon info-panel-symbol-wrap' : 'tacho-icon'}
          style={bg ? { background: bg } : undefined}
        >
          {ch}
        </span>,
      )
    } else {
      parts.push(match[0])
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length === 0 ? text : parts
}

export const iconMap: Record<string, string> = {
  driving: '\uE010',
  DRIVING: '\uE010',
  work: '\uE011',
  WORK: '\uE011',
  availability: '\uE012',
  AVAILABILITY: '\uE012',
  rest: '\uE013',
  REST: '\uE013',
  '1': '\uE001',
  '2': '\uE002',
  '24h': '\uE020',
  '!x': '\uE021\uE022',
  '!': '\uE021',
  x: '\uE022',
  '?': '\uE030',
  UTC: '\uE040',
  OUT: '\uE041',
  $: '\uE050',
  v: '\uE051',
  D: '\uE052',
  '%v': '\uE053',
  '%n': '\uE054',
  VDO: '\uE060',
  print: '\uE070',
  display: '\uE071',
  input: '\uE072',
  settings: '\uE030',
  bluetooth: '\uE080',
  card: '\uE081',
  vehicle: '\uE082',
  clock: '\uE083',
  country: '\uE084',
  event: '\uE021',
  fault: '\uE022',
}

export const TACHO_FONT = 'TachoFont'

export function getIconChar(displayIcon: string | null): string {
  if (displayIcon == null || displayIcon === '') return ''
  const mapped = iconMap[displayIcon]
  if (mapped) return mapped
  return displayIcon
}

/** Komponenta pro vykreslení symbolu z fontu SymbolTacho1 (tachosymbol1). */
export function TachoIcon({ code, className }: { code: string; className?: string }) {
  return (
    <span className={className ?? 'lcd-icon'} style={{ fontFamily: 'SymbolTacho1' }}>
      {code}
    </span>
  )
}
