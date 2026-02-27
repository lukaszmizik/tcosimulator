/**
 * Šablony a sestavy výtisků – SVG komponenty pro papírové výtisky tachografu.
 * Výtisky jsou vyvolávány z položek v menu (PRINT_24H_D1, PRINT_V_DIAGRAM, atd.).
 * Vzhled odpovídá tepelnému papíru 57 mm (tacho_parameters.json: paper_width_mm: 57).
 * Formát, typ a velikost fontu jsou globálně nastaveny v Constants.ts (stejné pro všechny výtisky jako V-diagram).
 */

import type { ReactNode } from 'react'
import { useLanguage } from './translations'
import type { ManualEntrySegment } from './TachoTypes'
import type { EventLogEntry } from './TachoTypes'
import type { SymbolMap } from './TachoTypes'
import type { SecondActivitySnapshot } from './TachoTypes'
import type { ActivityHistoryEntry } from './TachoTypes'
import { formatDurationHhMm } from './VDOCounter'
import type { VDODurationsMs } from './VDOCounter'
import { PRINT_FONT, PRINT_FONT_SIZE, PRINT_FONT_SIZE_PX, PRINT_LINE_HEIGHT, PRINT_SYMBOL_FONT } from './Constants'

/** Výška první sekce UTC (L1–L3) – pro odsazení obsahu pod ní */
export const PRINT_SECTION1_HEIGHT = 50
/** Výška první sekce Local (L1–L9) */
export const PRINT_SECTION1_LOCAL_HEIGHT = 120

export type PrintSection1UTCProps = {
  dateUtc: number
  symbolMap?: SymbolMap | null
  centerX: number
  headerFontSize?: number
}

/**
 * První sekce výtisku – detekce UTC času.
 * Zobrazuje L1 (pomlčky), L2 ((18) DD.MM.RRRR HH:MM UTC), L3 (pomlčky-symbol-pomlčky).
 * Stejný vzhled pro výtisky s/bez volby UTC – používají všichni výtisky.
 */
export function PrintSection1UTC(props: PrintSection1UTCProps) {
  const { dateUtc, symbolMap, centerX, headerFontSize = PRINT_FONT_SIZE } = props
  const symbol18 = symbolMap?.[18] ?? ''
  const mid18 = symbol18 || '(18)'
  const useSymbolFont = !!symbol18
  const dateStr = new Date(dateUtc).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const timeStr = new Date(dateUtc).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  const l2Text = `${mid18} ${dateStr} ${timeStr} UTC`
  const lineLen = l2Text.length
  const l1Dashes = '-'.repeat(lineLen + 3)
  const l3Total = lineLen - mid18.length + 3
  const l3Left = Math.floor(l3Total / 2)
  const l3Right = l3Total - l3Left

  return (
    <g id="print-header-section1">
      <text x={centerX} y={14} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {l1Dashes}
      </text>
      <text x={centerX} y={14 + headerFontSize * 1.2} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        <tspan fontFamily={useSymbolFont ? PRINT_SYMBOL_FONT : undefined}>{mid18}</tspan>
        <tspan dx={6}> {dateStr} {timeStr} UTC</tspan>
      </text>
      <text x={centerX} y={14 + headerFontSize * 2.4} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {'-'.repeat(l3Left)}
        <tspan fontFamily={useSymbolFont ? PRINT_SYMBOL_FONT : undefined}>{mid18}</tspan>
        <tspan>{'-'.repeat(l3Right)}</tspan>
      </text>
    </g>
  )
}

export type PrintSection1LocalProps = {
  /** UTC midnight začátku výtisku (den) */
  dateUtcStart: number
  /** UTC midnight konce výtisku (den + 24h) */
  dateUtcEnd: number
  symbolMap?: SymbolMap | null
  centerX: number
  /** Levý okraj pro zarovnání L4, L5, L6 vlevo */
  leftEdgeX?: number
  headerFontSize?: number
}

/** Vrací UTC offset v hodinách (např. 1 pro UTC+1, -1 pro UTC-1) podle systémového času */
function getUtcOffsetHours(): number {
  return -new Date().getTimezoneOffset() / 60
}

/** Přibližná šířka znaku v monospace pro výpočet levého okraje */
const MONOSPACE_CHAR_WIDTH = PRINT_FONT_SIZE * 0.6

/** Šířka textové oblasti výtisku v počtu znaků (pro linky ---(N)--- na celou šířku; 228 = šířka viewBox papíru) */
export const PRINT_TEXT_AREA_WIDTH_CHARS = Math.floor((228 - 24) / MONOSPACE_CHAR_WIDTH)

export type RenderPrintDashedLineWithSymbolOptions = {
  fontSize?: string
  fontFamily?: string
  headerFontSize?: number
}

/**
 * Vykreslí linku s pomlčkami na šířku textové oblasti a symbol (N) doprostřed.
 * Dorozumívací znak: „výtisk linka ---(N)---“ = tato linka.
 */
export function renderPrintDashedLineWithSymbol(
  symbolId: number,
  centerX: number,
  y: number,
  symbolMap: SymbolMap | null | undefined,
  options: RenderPrintDashedLineWithSymbolOptions = {}
): JSX.Element {
  const { fontSize = PRINT_FONT_SIZE_PX, fontFamily = PRINT_FONT } = options
  const symbol = symbolMap?.[symbolId] ?? ''
  const symbolText = symbol || `(${symbolId})`
  const useSymbolFont = !!symbol
  const totalChars = PRINT_TEXT_AREA_WIDTH_CHARS
  const totalDashes = totalChars - symbolText.length
  const leftDashes = Math.floor(totalDashes / 2)
  const rightDashes = totalDashes - leftDashes
  return (
    <text x={centerX} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontFamily={fontFamily}>
      {'-'.repeat(leftDashes)}
      <tspan fontFamily={useSymbolFont ? PRINT_SYMBOL_FONT : undefined}>{symbolText}</tspan>
      <tspan>{'-'.repeat(rightDashes)}</tspan>
    </text>
  )
}

export type RenderPrintUtcFirstLineOptions = {
  fontSize?: string
  fontFamily?: string
}

/**
 * Vykreslí první řádek jako na v-diagramu (L1) – linka samých pomlček se stejnou délkou jako řádek s UTC časem.
 * Dorozumívací znak: „vlož utc čas“ = vlož tento řádek.
 */
export function renderPrintUtcFirstLine(
  centerX: number,
  y: number,
  dateUtc: number,
  symbolMap: SymbolMap | null | undefined,
  options: RenderPrintUtcFirstLineOptions = {}
): JSX.Element {
  const { fontSize = PRINT_FONT_SIZE_PX, fontFamily = PRINT_FONT } = options
  const symbol18 = symbolMap?.[18] ?? ''
  const mid18 = symbol18 || '(18)'
  const dateStr = new Date(dateUtc).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const timeStr = new Date(dateUtc).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  const l2Text = `${mid18} ${dateStr} ${timeStr} UTC`
  const lineLen = l2Text.length
  const l1Dashes = '-'.repeat(lineLen + 2)
  return (
    <text x={centerX} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontFamily={fontFamily}>
      {l1Dashes}
    </text>
  )
}

/** Text řádku „typ karty“ – doprostřed výtisku. */
export const PRINT_CARD_TYPE_TEXT = 'GEN2 V2'

export type RenderPrintCardTypeLineOptions = {
  fontSize?: string
  fontFamily?: string
  /** Vlastní text místo výchozího "GEN2 V2". */
  text?: string
}

/**
 * Vykreslí další řádek s typem karty – text doprostřed („GEN2 V2“).
 * Dorozumívací znak: „další řádek vlož typ karty“ = tento řádek.
 */
export function renderPrintCardTypeLine(
  centerX: number,
  y: number,
  options: RenderPrintCardTypeLineOptions = {},
): JSX.Element {
  const { fontSize = PRINT_FONT_SIZE_PX, fontFamily = PRINT_FONT, text = PRINT_CARD_TYPE_TEXT } = options
  return (
    <text x={centerX} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontFamily={fontFamily}>
      {text}
    </text>
  )
}

export type RenderPrintMarkLineOptions = {
  fontSize?: string
  fontFamily?: string
  /** Text za symboly (např. „90 km/h“). */
  suffixText?: string
}

/**
 * Vykreslí řádek „značka výtisku“ – posloupnost symbolů (N)(N)… zarovnanou vlevo, za ní volitelný text.
 * Proměnná podle typu výtisku (pro „vys. rychlost“ např. (39)(39)(18) 90 km/h).
 */
export function renderPrintMarkLine(
  leftX: number,
  y: number,
  symbolIds: number[],
  symbolMap: SymbolMap | null | undefined,
  options: RenderPrintMarkLineOptions = {}
): JSX.Element {
  const { fontSize = PRINT_FONT_SIZE_PX, fontFamily = PRINT_FONT, suffixText } = options
  return (
    <text x={leftX} y={y} textAnchor="start" dominantBaseline="middle" fontSize={fontSize} fontFamily={fontFamily}>
      {symbolIds.map((id, i) => {
        const sym = symbolMap?.[id] ?? ''
        const text = sym || `(${id})`
        const useSymbolFont = !!sym
        return (
          <tspan key={i} fontFamily={useSymbolFont ? PRINT_SYMBOL_FONT : undefined}>
            {text}
          </tspan>
        )
      })}
      {suffixText != null && suffixText !== '' && <tspan dx={4}>{suffixText}</tspan>}
    </text>
  )
}

/** Údaje pro blok „vlož údaje o řidiči“ (příjmení, jméno, číslo karty, datum konce platnosti). */
export type PrintDriverDataBlockData = {
  surname: string
  firstName: string
  cardNumber: string
  dateOfExpiry: string
}

export type RenderPrintDriverDataBlockOptions = {
  fontSize?: string
  fontFamily?: string
  lineHeight?: number
}

/**
 * Vykreslí blok „vlož údaje o řidiči“ ve formátu:
 *   ---(2)---
 *   (2) Příjmení
 *     Jméno
 *   (2)(14)CZ / číslo karty uložené v paměti
 *   datum konce platnosti karty
 * Vrací pole elementů a novou y pozici (nextY).
 */
export function renderPrintDriverDataBlock(
  centerX: number,
  leftX: number,
  yStart: number,
  data: PrintDriverDataBlockData,
  symbolMap: SymbolMap | null | undefined,
  options: RenderPrintDriverDataBlockOptions = {}
): { elements: JSX.Element[]; nextY: number } {
  const { fontSize = PRINT_FONT_SIZE_PX, fontFamily = PRINT_FONT, lineHeight = PRINT_LINE_HEIGHT } = options
  const sym2 = symbolMap?.[2] ?? ''
  const sym14 = symbolMap?.[14] ?? ''
  const text2 = sym2 || '(2)'
  const text14 = sym14 || '(14)'
  const useSymbolFont2 = !!sym2
  const useSymbolFont14 = !!sym14
  const elements: JSX.Element[] = []
  let y = yStart

  // 1) ---(2)---
  elements.push(
    <g key="dashedLine">{renderPrintDashedLineWithSymbol(2, centerX, y, symbolMap, { fontSize, fontFamily })}</g>
  )
  y += lineHeight

  // 2) (2) Příjmení
  elements.push(
    <text key="surname" x={leftX} y={y} fontSize={fontSize} fontFamily={fontFamily} dominantBaseline="middle">
      <tspan fontFamily={useSymbolFont2 ? PRINT_SYMBOL_FONT : undefined}>{text2}</tspan>
      <tspan dx={4}> {data.surname}</tspan>
    </text>
  )
  y += lineHeight

  // 3) Jméno (odsazení na šířku "(2)" – 2 znaky)
  const indentChars = 2
  const indentX = leftX + indentChars * MONOSPACE_CHAR_WIDTH
  elements.push(
    <text key="firstName" x={indentX} y={y} fontSize={fontSize} fontFamily={fontFamily} dominantBaseline="middle">
      {data.firstName}
    </text>
  )
  y += lineHeight

  // 4) (2)(14)CZ / číslo karty
  elements.push(
    <text key="cardNumber" x={leftX} y={y} fontSize={fontSize} fontFamily={fontFamily} dominantBaseline="middle">
      <tspan fontFamily={useSymbolFont2 ? PRINT_SYMBOL_FONT : undefined}>{text2}</tspan>
      <tspan fontFamily={useSymbolFont14 ? PRINT_SYMBOL_FONT : undefined}>{text14}</tspan>
      <tspan>CZ / {data.cardNumber}</tspan>
    </text>
  )
  y += lineHeight

  // 5) datum konce platnosti karty
  elements.push(
    <text key="dateOfExpiry" x={leftX} y={y} fontSize={fontSize} fontFamily={fontFamily} dominantBaseline="middle">
      {data.dateOfExpiry}
    </text>
  )
  y += lineHeight

  return { elements, nextY: y }
}

/** Údaje pro blok „vlož data o vozidle“ (VIN, RZ). */
export type PrintVehicleDataBlockData = {
  vin: string
  registrationNumber: string
}

export type RenderPrintVehicleDataBlockOptions = {
  fontSize?: string
  fontFamily?: string
  lineHeight?: number
}

/**
 * Vykreslí blok „vlož data o vozidle“ ve formátu:
 *   ---(24)---
 *   (24) <vin>
 *    CZ / <RZ>
 *   (51)
 */
export function renderPrintVehicleDataBlock(
  centerX: number,
  leftX: number,
  yStart: number,
  data: PrintVehicleDataBlockData,
  symbolMap: SymbolMap | null | undefined,
  options: RenderPrintVehicleDataBlockOptions = {}
): { elements: JSX.Element[]; nextY: number } {
  const { fontSize = PRINT_FONT_SIZE_PX, fontFamily = PRINT_FONT, lineHeight = PRINT_LINE_HEIGHT } = options
  const sym24 = symbolMap?.[24] ?? ''
  const sym51 = symbolMap?.[51] ?? ''
  const text24 = sym24 || '(24)'
  const text51 = sym51 || '(51)'
  const useSymbolFont24 = !!sym24
  const useSymbolFont51 = !!sym51
  const elements: JSX.Element[] = []
  let y = yStart

  // 1) ---(24)---
  elements.push(
    <g key="dashedLine24">{renderPrintDashedLineWithSymbol(24, centerX, y, symbolMap, { fontSize, fontFamily })}</g>
  )
  y += lineHeight

  // 2) (24) <vin>
  elements.push(
    <text key="vin" x={leftX} y={y} fontSize={fontSize} fontFamily={fontFamily} dominantBaseline="middle">
      <tspan fontFamily={useSymbolFont24 ? PRINT_SYMBOL_FONT : undefined}>{text24}</tspan>
      <tspan dx={4}> {data.vin}</tspan>
    </text>
  )
  y += lineHeight

  // 3) CZ / RZ vozidla (odsazení 1 znak – „ CZ / RZ vozidla“)
  const indentRz = leftX + MONOSPACE_CHAR_WIDTH
  elements.push(
    <text key="rz" x={indentRz} y={y} fontSize={fontSize} fontFamily={fontFamily} dominantBaseline="middle">
      CZ / {data.registrationNumber}
    </text>
  )
  y += lineHeight

  // 4) (51)
  elements.push(
    <text key="symbol51" x={leftX} y={y} fontSize={fontSize} fontFamily={fontFamily} dominantBaseline="middle">
      <tspan fontFamily={useSymbolFont51 ? PRINT_SYMBOL_FONT : undefined}>{text51}</tspan>
    </text>
  )
  y += lineHeight

  return { elements, nextY: y }
}

/**
 * První sekce výtisku v místním čase (volba NE v menu).
 * L1–L9 dle specifikace.
 */
export function PrintSection1Local(props: PrintSection1LocalProps) {
  const { dateUtcStart, dateUtcEnd, symbolMap, centerX, leftEdgeX: propLeftEdgeX, headerFontSize = PRINT_FONT_SIZE } = props
  const symbol17 = symbolMap?.[17] ?? ''
  const symbol59 = symbolMap?.[59] ?? ''
  const symbol37 = symbolMap?.[37] ?? ''
  const symbol18 = symbolMap?.[18] ?? ''
  const s17 = symbol17 || '(17)'
  const s59 = symbol59 || '(59)'
  const s37 = symbol37 || '(37)'
  const s18 = symbol18 || '(18)'
  const useSymbolFont = (id: number) => !!symbolMap?.[id]

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDate = (ts: number) => {
    const d = new Date(ts)
    return {
      date: `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`,
      time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
      localDate: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
      localTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    }
  }
  const start = fmtDate(dateUtcStart)
  const end = fmtDate(dateUtcEnd)
  const nowLocal = new Date()
  const locFmt = fmtDate(nowLocal.getTime())

  const offsetHours = getUtcOffsetHours()
  const utcOffsetStr = `UTC ${offsetHours >= 0 ? '+' : ''}${offsetHours}`

  const l2Text = '!!! No legal printout!!!'
  const l1Dashes = '-'.repeat(l2Text.length + 2)
  const l8Text = `${s18} ${locFmt.localDate} ${locFmt.localTime} LOC`
  const targetWidth = Math.max(l1Dashes.length, l8Text.length + 2)
  const l9Dashes = '-'.repeat(targetWidth)
  const l7Total = targetWidth - s37.length
  const l7Left = Math.floor(l7Total / 2)
  const l7Right = l7Total - l7Left

  /* L4, L5, L6 začínají na stejném x jako L1 a L7 (levý okraj centrovaného bloku) */
  const leftEdgeX = propLeftEdgeX ?? (centerX - (targetWidth * MONOSPACE_CHAR_WIDTH) / 2)

  const lh = headerFontSize * 1.2
  const y = (i: number) => 14 + i * lh

  return (
    <g id="print-header-section1-local">
      {/* L1 */}
      <text x={centerX} y={y(0)} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {l1Dashes}
      </text>
      {/* L2 */}
      <text x={centerX} y={y(1)} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {l2Text}
      </text>
      {/* L3 */}
      <text x={centerX} y={y(2)} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {l1Dashes}
      </text>
      {/* L4 (17)(59) DD.MM.RRRR HH:MM – zarovnáno vlevo */}
      <text x={leftEdgeX} y={y(3)} textAnchor="start" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        <tspan fontFamily={useSymbolFont(17) ? PRINT_SYMBOL_FONT : undefined}>{s17}</tspan>
        <tspan fontFamily={useSymbolFont(59) ? PRINT_SYMBOL_FONT : undefined}>{s59}</tspan>
        <tspan dx={4}> {start.date} {start.time}</tspan>
      </text>
      {/* L5 (59)(17) DD.MM.RRRR HH:MM – zarovnáno vlevo */}
      <text x={leftEdgeX} y={y(4)} textAnchor="start" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        <tspan fontFamily={useSymbolFont(59) ? PRINT_SYMBOL_FONT : undefined}>{s59}</tspan>
        <tspan fontFamily={useSymbolFont(17) ? PRINT_SYMBOL_FONT : undefined}>{s17}</tspan>
        <tspan dx={4}> {end.date} {end.time}</tspan>
      </text>
      {/* L6 UTC +1 – zarovnáno vlevo */}
      <text x={leftEdgeX} y={y(5)} textAnchor="start" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {utcOffsetStr}
      </text>
      {/* L7 ---(37)--- */}
      <text x={centerX} y={y(6)} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {'-'.repeat(l7Left)}
        <tspan fontFamily={useSymbolFont(37) ? PRINT_SYMBOL_FONT : undefined}>{s37}</tspan>
        <tspan>{'-'.repeat(l7Right)}</tspan>
      </text>
      {/* L8 (18) DD.MM.RRRR HH:MM LOC */}
      <text x={centerX} y={y(7)} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        <tspan fontFamily={useSymbolFont(18) ? PRINT_SYMBOL_FONT : undefined}>{s18}</tspan>
        <tspan dx={4}> {locFmt.localDate} {locFmt.localTime} LOC</tspan>
      </text>
      {/* L9 */}
      <text x={centerX} y={y(8)} textAnchor="middle" dominantBaseline="middle" fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
        {l9Dashes}
      </text>
    </g>
  )
}

/** ID šablony výtisku – odpovídá akcím z menu_structure.json */
export type PrintTemplateId =
  | 'PRINT_24H_D1'
  | 'PRINT_24H_D2'
  | 'PRINT_24H_V'
  | 'PRINT_EVENT_D1'
  | 'PRINT_EVENT_D2'
  | 'PRINT_EVENT_V'
  | 'PRINT_ACT_D1'
  | 'PRINT_ACT_D2'
  | 'PRINT_V_DIAGRAM'
  | 'PRINT_SPEED_V'
  | 'PRINT_TECH_V'
  | 'PRINT_CARDS_V'
  | 'PRINT_STATUS'
  | 'PRINT_V_PROFILE'
  | 'PRINT_N_PROFILE'

/** Šířka papíru v mm (tepelné papíry DTCO 4.1) */
export const PAPER_WIDTH_MM = 57

/** Rozměry papírové komponenty – SVG viewBox a proporce */
export const PAPER_VIEWBOX = { width: 228, height: 1200 }

export type PaperStripProps = {
  children: ReactNode
  /** Převrácený poměr (papír je užší než výška) */
  aspectRatio?: 'portrait' | 'landscape'
}

/**
 * Papírová komponenta – obal pro výtisk simulující tepelný papír 57 mm.
 */
export function PaperStrip({ children }: PaperStripProps) {
  const { t } = useLanguage()
  const { width, height } = PAPER_VIEWBOX
  return (
    <svg
      className="print-paper-strip"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label={t.ui.printoutTitle}
    >
      <defs>
        <linearGradient id="print-paper-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fafafa" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f5f5f5" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="0"
        width={width - 4}
        height={height}
        fill="url(#print-paper-shine)"
        stroke="#ddd"
        strokeWidth="1"
        rx="2"
      />
      <g transform="translate(12, 24)">{children}</g>
    </svg>
  )
}

export type Print24hDriverProps = {
  title: string
  driverName: string
  cardId: string
  dateUtc: number
  manualEntries: ManualEntrySegment[]
  eventLog: EventLogEntry[]
  activityDurations?: VDODurationsMs
  symbolMap?: SymbolMap | null
  /** true = UTC výtisk, false = místní čas (volba NE) */
  isUtc?: boolean
}

/**
 * Šablona výtisku: 24h den – řidič 1 nebo 2
 */
export function Print24hDriverSVG(props: Print24hDriverProps) {
  const { title, driverName, cardId, dateUtc, manualEntries, eventLog, symbolMap, isUtc = true } = props
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date(dateUtc)
  const dateStr = `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
  const utcStr = d.toISOString().replace('T', ' ').slice(0, 19)
  const centerX = PAPER_VIEWBOX.width / 2 - 12
  const dateUtcStart = dateUtc
  const dateUtcEnd = dateUtc + 24 * 3600 * 1000
  const sectionHeight = isUtc ? PRINT_SECTION1_HEIGHT : PRINT_SECTION1_LOCAL_HEIGHT
  const baseY = sectionHeight

  let y = baseY
  const lineHeight = PRINT_LINE_HEIGHT
  const sectionGap = 12

  const addLine = (text: string, bold = false) => {
    y += lineHeight
    return (
      <text key={y} x="0" y={y} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT} fontWeight={bold ? 'bold' : 'normal'}>
        {text}
      </text>
    )
  }

  const lines: React.ReactNode[] = []
  if (isUtc) {
    lines.push(<PrintSection1UTC key="s1" dateUtc={dateUtc} symbolMap={symbolMap} centerX={centerX} />)
    lines.push(addLine(title, true))
    lines.push(addLine(`${dateStr} | UTC ${utcStr}`))
    y += sectionGap
    lines.push(addLine('Základní info', true))
    lines.push(addLine(`Jméno: ${driverName}`))
    lines.push(addLine(`Číslo karty: ${cardId}`))
    y += sectionGap
    lines.push(addLine('Manuální záznamy', true))
    const manualFiltered = manualEntries.filter((s) => s.activityId !== 'START_COUNTRY' && s.activityId !== 'END_COUNTRY')
    if (manualFiltered.length === 0) {
      lines.push(addLine('žádné'))
    } else {
      manualFiltered.forEach((seg) => {
        const fmt = (s: ManualEntrySegment) => `${pad(s.day)}.${pad(s.month)}. ${pad(s.hour)}:${pad(s.minute)}`
        lines.push(addLine(`${fmt(seg)} | ${seg.activityId}`))
      })
    }
    y += sectionGap
    lines.push(addLine('Události', true))
    const events = eventLog.filter((e) => e.type === 'DRIVING_WITHOUT_CARD' || e.type === 'DRIVING_WITHOUT_VALID_CARD')
    if (events.length === 0) {
      lines.push(addLine('žádná'))
    } else {
      events.forEach((e) => {
        const ed = new Date(e.startTime)
        const ts = `${pad(ed.getDate())}.${pad(ed.getMonth() + 1)}. ${pad(ed.getHours())}:${pad(ed.getMinutes())}`
        const label = e.type === 'DRIVING_WITHOUT_VALID_CARD' ? 'Jízda bez platné karty' : 'Jízda bez karty'
        lines.push(addLine(`${label}: ${ts}`))
      })
    }
  } else {
    lines.push(<PrintSection1Local key="s1" dateUtcStart={dateUtcStart} dateUtcEnd={dateUtcEnd} symbolMap={symbolMap} centerX={centerX} />)
  }

  return (
    <PaperStrip>
      <g>{lines}</g>
    </PaperStrip>
  )
}

export type Print24hVehicleProps = {
  dateUtc: number
  odometerKm: number
  secondHistory?: SecondActivitySnapshot[]
  symbolMap?: SymbolMap | null
  /** true = UTC výtisk, false = místní čas (volba NE) */
  isUtc?: boolean
}

/**
 * Šablona výtisku: 24h den – vozidlo
 */
export function Print24hVehicleSVG(props: Print24hVehicleProps) {
  const { dateUtc, symbolMap, isUtc = true } = props
  const centerX = PAPER_VIEWBOX.width / 2 - 12
  const dateUtcStart = dateUtc
  const dateUtcEnd = dateUtc + 24 * 3600 * 1000

  return (
    <PaperStrip>
      <g>
        {isUtc ? (
          <PrintSection1UTC dateUtc={dateUtc} symbolMap={symbolMap} centerX={centerX} />
        ) : (
          <PrintSection1Local dateUtcStart={dateUtcStart} dateUtcEnd={dateUtcEnd} symbolMap={symbolMap} centerX={centerX} />
        )}
      </g>
    </PaperStrip>
  )
}

/** Značka výtisku „vys. rychlost“ – (39)(39)(18). */
export const PRINT_MARK_EXCESS_SPEED = [39, 39, 18] as const

export type PrintSpeedVehicleSVGProps = {
  dateUtc: number
  symbolMap?: SymbolMap | null
  /** Značka výtisku – řádek pod typem karty (pro „vys. rychlost“ např. (39)(39)(18)). */
  printMarkSymbolIds?: readonly number[] | null
  /** Text za značkou výtisku (např. „90 km/h“). */
  printMarkSuffix?: string | null
  /** Blok „vlož údaje o řidiči“ (---(2)---, příjmení, jméno, číslo karty, platnost) – vykreslí se pod typem karty / značkou. */
  driverDataBlock?: PrintDriverDataBlockData | null
  /** Blok „vlož data o vozidle“ (---(24)---, VIN, CZ/RZ, (51)) – vykreslí se pod blokem řidiče (nebo pod typem karty). */
  vehicleDataBlock?: PrintVehicleDataBlockData | null
}

/**
 * Šablona výtisku: vozidlo – překročení rychlosti (vys. rychlost).
 * Na začátku stejný řádek jako první řádek na v-diagramu (vlož utc čas) – celá sekce UTC (L1, L2, L3).
 * Další řádek: typ karty (GEN2 V2) doprostřed.
 * Když je zadáno printMarkSymbolIds, vykreslí se řádek „značka výtisku“; pak případně bloky řidiče a vozidla.
 */
export function PrintSpeedVehicleSVG(props: PrintSpeedVehicleSVGProps) {
  const { dateUtc, symbolMap, printMarkSymbolIds, printMarkSuffix, driverDataBlock, vehicleDataBlock } = props
  const centerX = PAPER_VIEWBOX.width / 2 - 12
  const leftX = 0
  const yCardType = 14 + PRINT_FONT_SIZE * 1.2 * 3
  const hasPrintMark = printMarkSymbolIds != null && printMarkSymbolIds.length > 0
  const yAfterCardType = yCardType + PRINT_LINE_HEIGHT + (hasPrintMark ? PRINT_LINE_HEIGHT : 0)

  let yNext = yAfterCardType
  const driverElements =
    driverDataBlock != null
      ? (() => {
          const block = renderPrintDriverDataBlock(centerX, leftX, yNext, driverDataBlock, symbolMap)
          yNext = block.nextY
          return block.elements
        })()
      : null
  const vehicleElements =
    vehicleDataBlock != null
      ? (() => {
          const block = renderPrintVehicleDataBlock(centerX, leftX, yNext, vehicleDataBlock, symbolMap)
          return block.elements
        })()
      : null

  return (
    <PaperStrip>
      <g>
        <PrintSection1UTC dateUtc={dateUtc} symbolMap={symbolMap} centerX={centerX} />
        {renderPrintCardTypeLine(centerX, yCardType)}
        {hasPrintMark && renderPrintMarkLine(leftX, yCardType + PRINT_LINE_HEIGHT, [...printMarkSymbolIds], symbolMap, { suffixText: printMarkSuffix ?? undefined })}
        {driverElements}
        {vehicleElements}
      </g>
    </PaperStrip>
  )
}

export type PrintVDiagramSVGProps = {
  secondHistory: SecondActivitySnapshot[]
  dateUtc: number
  /** Výtisk v UTC čase – určuje zobrazení sekce 1 hlavičky */
  isUtc?: boolean
  symbolMap?: SymbolMap | null
}

/** Rozměry V-diagramu – přizpůsobené papíru 57 mm */
const VDIAGRAM_CONTENT_RATIO = 0.7
const VDIAGRAM_PAPER = {
  width: 228,
  height: 2100,
  /** 5 sekcí hlavičky + 1 sekce pod grafem */
  headerReserved: 120,
  footerReserved: 80,
  /** Font hlavičkových sekcí – jednotná velikost všech výtisků */
  headerFontSize: PRINT_FONT_SIZE,
  /** Marginy – obsah (text + graf) vycentrován na 70 % šířky (160px) */
  marginLeft: Math.round((228 - 228 * VDIAGRAM_CONTENT_RATIO) / 2),
  marginRight: Math.round((228 - 228 * VDIAGRAM_CONTENT_RATIO) / 2),
  chartWidth: Math.round(228 * VDIAGRAM_CONTENT_RATIO),
  chartHeight: 1850,
  /** Délka hlavní čárky (hodiny) vs. vedlejší (15 min) */
  tickMajorLen: 6,
  tickMinorLen: 3,
  /** Délka hlavní čárky rychlosti (30 km/h) vs. vedlejší (10 km/h) */
  speedTickMajorLen: 6,
  speedTickMinorLen: 3,
}

/**
 * Šablona výtisku: V-diagram (rychlost).
 * Převzato z původního VDiagram.tsx, rozměry přizpůsobeny papírové komponentě.
 * Rezervováno místo pro hlavičku a zápatí (budoucí rozšíření).
 */
export function PrintVDiagramSVG(props: PrintVDiagramSVGProps) {
  const { t } = useLanguage()
  const { secondHistory, dateUtc, isUtc = true, symbolMap } = props
  const {
    width,
    height,
    headerReserved,
    footerReserved,
    marginLeft,
    chartWidth,
    chartHeight,
    headerFontSize,
    tickMajorLen,
    tickMinorLen,
    speedTickMajorLen,
    speedTickMinorLen,
  } = VDIAGRAM_PAPER

  const chartTop = headerReserved
  const d = new Date(dateUtc)
  const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).getTime()
  const dayEnd = dayStart + 24 * 3600 * 1000

  const dayData = secondHistory
    .filter((s) => s.timestampUtc >= dayStart && s.timestampUtc < dayEnd)
    .sort((a, b) => a.timestampUtc - b.timestampUtc)

  const pad = (n: number) => String(n).padStart(2, '0')
  const speedToPx = (speed: number) =>
    marginLeft + (Math.min(125, Math.max(0, speed)) / 125) * chartWidth
  const timeToPx = (ms: number) =>
    ((ms - dayStart) / (24 * 3600 * 1000)) * chartHeight

  const speedMajorLines = [30, 60, 90, 120]
  const speedMinorLines = [10, 20, 40, 50, 70, 80, 100, 110]
  const dataPoints = dayData.map((s) => `${speedToPx(s.speed)},${timeToPx(s.timestampUtc)}`)
  const polyPoints =
    dataPoints.length > 0
      ? dataPoints.length === 1
        ? `${speedToPx(0)},${timeToPx(dayData[0].timestampUtc)} ${dataPoints[0]}`
        : dataPoints.join(' ')
      : ''

  return (
    <svg
      className="print-vdiagram-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMin meet"
      role="img"
      aria-label={t.ui.vDiagramTitle}
    >
      <defs>
        <linearGradient id="print-vdiagram-paper-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fafafa" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f5f5f5" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="0"
        width={width - 4}
        height={height}
        fill="url(#print-vdiagram-paper-shine)"
        stroke="#ddd"
        strokeWidth="1"
        rx="2"
      />

      {/* První sekce – detekce UTC (bez volby = jako V-diagram, s potvrzením UTC = stejně) */}
      <g id="vdiagram-header">
        {isUtc && <PrintSection1UTC dateUtc={dateUtc} symbolMap={symbolMap} centerX={width / 2} headerFontSize={headerFontSize} />}
      </g>

      {/* Grafická oblast – věrně podle originálu tachografu */}
      <g id="vdiagram-chart" transform={`translate(0, ${chartTop})`}>
        {/* Osa rychlosti 0 – nepřerušovaná čára */}
        <line
          x1={marginLeft}
          y1={0}
          x2={marginLeft}
          y2={chartHeight}
          stroke="#333"
          strokeWidth={0.8}
        />
        {/* Mřížka – vertikální (30, 60, …) a horizontální (čas) světle šedá */}
        {speedMajorLines.map((kmh) => (
          <line
            key={`v-major-${kmh}`}
            x1={speedToPx(kmh)}
            y1={0}
            x2={speedToPx(kmh)}
            y2={chartHeight}
            stroke="#ccc"
            strokeDasharray="2 2"
            strokeWidth={0.5}
          />
        ))}
        {speedMinorLines.map((kmh) => (
          <line
            key={`v-minor-${kmh}`}
            x1={speedToPx(kmh)}
            y1={0}
            x2={speedToPx(kmh)}
            y2={chartHeight}
            stroke="#e0e0e0"
            strokeDasharray="1 1"
            strokeWidth={0.3}
          />
        ))}
        {Array.from({ length: 25 }, (_, i) => (
          <line
            key={`h-major-${i}`}
            x1={marginLeft}
            y1={((i * 3600 * 1000) / (24 * 3600 * 1000)) * chartHeight}
            x2={marginLeft + chartWidth}
            y2={((i * 3600 * 1000) / (24 * 3600 * 1000)) * chartHeight}
            stroke="#ccc"
            strokeDasharray="2 2"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 24 }, (_, i) =>
          [15, 30, 45].map((min) => (
            <line
              key={`h-minor-${i}-${min}`}
              x1={marginLeft}
              y1={(((i * 60 + min) * 60 * 1000) / (24 * 3600 * 1000)) * chartHeight}
              x2={marginLeft + chartWidth}
              y2={(((i * 60 + min) * 60 * 1000) / (24 * 3600 * 1000)) * chartHeight}
              stroke="#e0e0e0"
              strokeDasharray="1 1"
              strokeWidth={0.3}
            />
          ))
        )}

        {/* Časová osa – odrážky vlevo od osy, nezasahují do grafu */}
        {Array.from({ length: 25 }, (_, i) => (
          <line
            key={`hour-${i}`}
            x1={marginLeft - tickMajorLen}
            y1={((i * 3600 * 1000) / (24 * 3600 * 1000)) * chartHeight}
            x2={marginLeft}
            y2={((i * 3600 * 1000) / (24 * 3600 * 1000)) * chartHeight}
            stroke="#000"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 24 }, (_, i) =>
          [15, 30, 45].map((min) => (
            <line
              key={`min-${i}-${min}`}
              x1={marginLeft - tickMinorLen}
              y1={(((i * 60 + min) * 60 * 1000) / (24 * 3600 * 1000)) * chartHeight}
              x2={marginLeft}
              y2={(((i * 60 + min) * 60 * 1000) / (24 * 3600 * 1000)) * chartHeight}
              stroke="#000"
              strokeWidth={0.5}
            />
          ))
        )}

        {/* Rychlost – odrážky nad grafem, nezasahují do grafu */}
        {speedMajorLines.map((kmh) => (
          <line
            key={`speed-major-${kmh}`}
            x1={speedToPx(kmh)}
            y1={-speedTickMajorLen}
            x2={speedToPx(kmh)}
            y2={0}
            stroke="#000"
            strokeWidth={0.5}
          />
        ))}
        {speedMinorLines.map((kmh) => (
          <line
            key={`speed-minor-${kmh}`}
            x1={speedToPx(kmh)}
            y1={-speedTickMinorLen}
            x2={speedToPx(kmh)}
            y2={0}
            stroke="#555"
            strokeWidth={0.4}
          />
        ))}

        {/* Časové štítky HH:MM (osa Y) – stejný font jako datum nad grafem */}
        {Array.from({ length: 25 }, (_, i) => {
          const labelX = marginLeft - tickMajorLen - 8
          const labelY = (i * 3600 * 1000) / (24 * 3600 * 1000) * chartHeight
          return (
            <text
              key={i}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="print-vdiagram-axis-time"
              fontFamily={PRINT_FONT}
              transform={`rotate(90, ${labelX}, ${labelY})`}
            >
              {pad(i)}:00
            </text>
          )
        })}

        {/* Hodnoty rychlosti 30, 60, 90, 120 – stejný font jako datum nad grafem */}
        {speedMajorLines.map((kmh) => {
          const labelY = -speedTickMajorLen - 8
          const px = speedToPx(kmh)
          return (
            <text
              key={kmh}
              x={px}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="print-vdiagram-axis-speed"
              fontFamily={PRINT_FONT}
              transform={`rotate(90, ${px}, ${labelY})`}
            >
              {kmh}
            </text>
          )
        })}

        {/* Křivka rychlosti */}
        {polyPoints && (
          <polyline
            points={polyPoints}
            fill="none"
            stroke="#333"
            strokeWidth={0.8}
          />
        )}
      </g>

      {/* Zápatí – rezervováno pro pozdější rozšíření */}
      <g id="vdiagram-footer">
        <rect
          x={2}
          y={height - footerReserved}
          width={width - 4}
          height={footerReserved - 2}
          fill="none"
        />
      </g>
    </svg>
  )
}

export type PrintEventsSVGProps = {
  title: string
  eventLog: EventLogEntry[]
  dateUtc?: number
  symbolMap?: SymbolMap | null
}

/**
 * Šablona výtisku: Události
 */
export function PrintEventsSVG(props: PrintEventsSVGProps) {
  const { title, eventLog, dateUtc, symbolMap } = props
  const pad = (n: number) => String(n).padStart(2, '0')
  const events = eventLog.filter((e) => e.type === 'DRIVING_WITHOUT_CARD' || e.type === 'DRIVING_WITHOUT_VALID_CARD')
  const centerX = PAPER_VIEWBOX.width / 2 - 12
  const baseY = dateUtc != null ? PRINT_SECTION1_HEIGHT : 0
  const lineHeight = PRINT_LINE_HEIGHT

  return (
    <PaperStrip>
      <g>
        {dateUtc != null && <PrintSection1UTC dateUtc={dateUtc} symbolMap={symbolMap} centerX={centerX} />}
        <text x="0" y={baseY + PRINT_LINE_HEIGHT} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT} fontWeight="bold">
          {title}
        </text>
        <text x="0" y={baseY + PRINT_LINE_HEIGHT * 2} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
          Události a závady
        </text>
        {events.length === 0 ? (
          <text x="0" y={baseY + PRINT_LINE_HEIGHT * 3.5} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT} fill="#666">
            žádná
          </text>
        ) : (
          events.map((e, i) => {
            const y = baseY + PRINT_LINE_HEIGHT * 3 + i * lineHeight
            const ed = new Date(e.startTime)
            const ts = `${pad(ed.getDate())}.${pad(ed.getMonth() + 1)}. ${pad(ed.getHours())}:${pad(ed.getMinutes())}`
            const label =
              e.type === 'DRIVING_WITHOUT_VALID_CARD'
                ? `Jízda bez platné karty${e.duringIncompleteManualEntry ? ' (nedokonč. 1M)' : ''}`
                : 'Jízda bez karty'
            return (
              <text key={e.id} x="0" y={y} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
                {ts} | {label}
              </text>
            )
          })
        )}
      </g>
    </PaperStrip>
  )
}

export type PrintActivitiesSVGProps = {
  title: string
  history: ActivityHistoryEntry[]
  slotIndex: 1 | 2
  dayStartUtc: number
  dayEndUtc: number
  durations?: VDODurationsMs
  symbolMap?: SymbolMap | null
}

/**
 * Šablona výtisku: Aktivity
 */
export function PrintActivitiesSVG(props: PrintActivitiesSVGProps) {
  const { title, durations, dayStartUtc, symbolMap } = props
  const d = durations ?? { driving: 0, rest: 0, otherWork: 0, availability: 0 }
  const centerX = PAPER_VIEWBOX.width / 2 - 12
  const baseY = PRINT_SECTION1_HEIGHT

  return (
    <PaperStrip>
      <g>
        <PrintSection1UTC dateUtc={dayStartUtc} symbolMap={symbolMap} centerX={centerX} />
        <text x="0" y={baseY + PRINT_LINE_HEIGHT} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT} fontWeight="bold">
          {title}
        </text>
        <text x="0" y={baseY + PRINT_LINE_HEIGHT * 2} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
          Řízení: {formatDurationHhMm(d.driving)}
        </text>
        <text x="0" y={baseY + PRINT_LINE_HEIGHT * 3} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
          Odpočinek: {formatDurationHhMm(d.rest)}
        </text>
        <text x="0" y={baseY + PRINT_LINE_HEIGHT * 4} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
          Práce: {formatDurationHhMm(d.otherWork)}
        </text>
        <text x="0" y={baseY + PRINT_LINE_HEIGHT * 5} fontSize={PRINT_FONT_SIZE_PX} fontFamily={PRINT_FONT}>
          Pohotovost: {formatDurationHhMm(d.availability)}
        </text>
      </g>
    </PaperStrip>
  )
}

/** Mapování akce z menu na ID šablony */
export const MENU_ACTION_TO_TEMPLATE: Record<string, PrintTemplateId> = {
  PRINT_24H_D1: 'PRINT_24H_D1',
  PRINT_24H_D2: 'PRINT_24H_D2',
  PRINT_24H_V: 'PRINT_24H_V',
  PRINT_EVENT_D1: 'PRINT_EVENT_D1',
  PRINT_EVENT_D2: 'PRINT_EVENT_D2',
  PRINT_EVENT_V: 'PRINT_EVENT_V',
  PRINT_ACT_D1: 'PRINT_ACT_D1',
  PRINT_ACT_D2: 'PRINT_ACT_D2',
  PRINT_V_DIAGRAM: 'PRINT_V_DIAGRAM',
  PRINT_SPEED_V: 'PRINT_SPEED_V',
  PRINT_TECH_V: 'PRINT_TECH_V',
  PRINT_CARDS_V: 'PRINT_CARDS_V',
  PRINT_STATUS: 'PRINT_STATUS',
  PRINT_V_PROFILE: 'PRINT_V_PROFILE',
  PRINT_N_PROFILE: 'PRINT_N_PROFILE',
}
