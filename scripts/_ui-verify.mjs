/**
 * Ověření průvodce, výtisku a grafů v Edge. Řídí jen běžná tlačítka.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const APP = 'http://127.0.0.1:5173/'
const OUT = join(process.cwd(), 'ui-evidence')
const PORT = 9333
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(message.error.message ?? JSON.stringify(message.error)))
        else resolve(message.result ?? {})
      }
    })
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const payload = { id, method, params }
      if (sessionId) payload.sessionId = sessionId
      this.ws.send(JSON.stringify(payload))
    })
  }
  close() { this.ws.close() }
}

async function launch() {
  const dir = await mkdtemp(join(tmpdir(), 'tco-ui-'))
  const child = spawn(EDGE, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${dir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,1100',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    'about:blank',
  ], { stdio: 'ignore' })
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (response.ok) {
        const version = await response.json()
        const ws = new WebSocket(version.webSocketDebuggerUrl)
        await new Promise((resolve, reject) => {
          ws.addEventListener('open', resolve)
          ws.addEventListener('error', reject)
        })
        return { cdp: new Cdp(ws), child, dir }
      }
    } catch { /* Edge ještě neposlouchá. */ }
    await sleep(200)
  }
  child.kill()
  throw new Error('Edge se nespustil')
}

async function openPage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false,
  }, sessionId)
  await cdp.send('Page.navigate', { url }, sessionId)
  await sleep(2500)
  return { targetId, sessionId }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId)
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'evaluate')
  return result.result?.value
}

async function lcd(cdp, sessionId) {
  const text = await evaluate(cdp, sessionId, `document.querySelector('.display-area')?.innerText?.replace(/\\s+/g, ' ').trim() ?? ''`)
  return String(text ?? '')
}

async function press(cdp, sessionId, which) {
  const index = { back: 0, up: 1, down: 2, ok: 3 }[which]
  await evaluate(cdp, sessionId, `document.querySelectorAll('.display-controls .btn-nav')[${index}]?.click()`)
  await sleep(400)
  return lcd(cdp, sessionId)
}

async function shot(cdp, sessionId, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId)
  const file = join(OUT, name)
  await writeFile(file, Buffer.from(data, 'base64'))
  return file
}

async function watch(cdp, sessionId, ms) {
  const started = Date.now()
  const changes = []
  let previous = ''
  while (Date.now() - started < ms) {
    const text = await lcd(cdp, sessionId)
    if (text !== previous) {
      changes.push({ ms: Date.now() - started, text })
      previous = text
    }
    await sleep(200)
  }
  return changes
}

async function insertZmizik(cdp, sessionId) {
  await evaluate(cdp, sessionId, `document.querySelector('button.start-key')?.click()`)
  await sleep(400)
  await evaluate(cdp, sessionId, `document.querySelectorAll('.slot-tap-controls button')[0]?.click()`)
  await sleep(400)
  const loaded = await evaluate(cdp, sessionId, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => /virtuál/i.test(item.textContent ?? ''))
    button?.click()
    return !!button
  })()`)
  await sleep(400)
  const inserted = await evaluate(cdp, sessionId, `(() => {
    const button = [...document.querySelectorAll('.card-insert-actions button')].find((item) => !item.disabled && /slotu 1/i.test(item.textContent ?? ''))
    button?.click()
    return button?.textContent ?? null
  })()`)
  return { loaded, inserted }
}

async function finishWizard(cdp, sessionId, report) {
  const observed = await watch(cdp, sessionId, 12000)
  report.wizardScreens = observed
  const removal = observed.find((item) => /vyjmutí|withdrawal/i.test(item.text))
  const after = removal ? observed.find((item) => item.ms > removal.ms && !/vyjmutí|withdrawal/i.test(item.text)) : null
  report.lastRemoval = removal
    ? {
      appearedMs: removal.ms,
      leftMs: after?.ms ?? null,
      heldMs: after ? after.ms - removal.ms : null,
      text: removal.text,
      next: after?.text ?? null,
      okPressed: false,
    }
    : null
  let text = await lcd(cdp, sessionId)
  for (let step = 0; step < 8 && !/doplnit/i.test(text); step++) {
    await sleep(500)
    text = await lcd(cdp, sessionId)
  }
  report.beforeDecision = text
  if (/doplnit/i.test(text)) {
    text = await press(cdp, sessionId, 'down')
    report.decisionAfterDown = text
    text = await press(cdp, sessionId, 'ok')
  }
  if (/ITS/i.test(text)) text = await press(cdp, sessionId, 'ok')
  if (/VDO/i.test(text)) text = await press(cdp, sessionId, 'ok')
  report.afterQuestions = text
  await sleep(12500)
  text = await lcd(cdp, sessionId)
  report.beforeMenu = text
  text = await press(cdp, sessionId, 'ok')
  if (/čekejte/i.test(text)) {
    report.menuTooEarly = text
    await sleep(4000)
    text = await press(cdp, sessionId, 'ok')
  }
  report.afterWizard = text
  return text
}

async function openByMenu(cdp, sessionId, target) {
  const steps = []
  let text = await lcd(cdp, sessionId)
  if (/jízda bez/i.test(text)) text = await press(cdp, sessionId, 'ok')
  if (!/výtisk|vozidlo|Karty|den-tisk|v-diagram/i.test(text)) text = await press(cdp, sessionId, 'ok')
  steps.push(text)
  for (let step = 0; step < 8 && !new RegExp(target, 'i').test(text); step++) {
    text = await press(cdp, sessionId, 'down')
    steps.push(text)
  }
  text = await press(cdp, sessionId, 'ok')
  steps.push(text)
  return { text, steps }
}

async function confirmPrintWizard(cdp, sessionId) {
  const steps = []
  let text = await lcd(cdp, sessionId)
  for (let step = 0; step < 4; step++) {
    const open = await evaluate(cdp, sessionId, `!!document.querySelector('.daily-card-print')`)
    if (open) return { text, steps, open: true }
    text = await press(cdp, sessionId, 'ok')
    steps.push(text)
  }
  for (let step = 0; step < 10; step++) {
    const open = await evaluate(cdp, sessionId, `!!document.querySelector('.daily-card-print')`)
    if (open) return { text, steps, open: true }
    await sleep(300)
  }
  return { text, steps, open: false }
}

async function paper(cdp, sessionId) {
  return evaluate(cdp, sessionId, `(() => {
    const node = document.querySelector('.daily-card-print-paper')
    if (!node) return ''
    return node.innerText.replace(/\\n/g, '').replace(/[ ]{2,}/g, ' ').trim()
  })()`)
}

async function closeOverlay(cdp, sessionId) {
  const attempts = []
  for (let step = 0; step < 5; step++) {
    const state = await evaluate(cdp, sessionId, `(() => {
      const graph = document.querySelector('.work-week-graph-overlay')
      const print = document.querySelector('.daily-card-print')
      const button = graph?.querySelector('.work-week-graph-close') ?? print?.querySelector('.print-overlay-close')
      if (button) button.click()
      else graph?.click()
      return { graph: !!graph, print: !!print, clicked: button?.className ?? (graph ? 'backdrop' : '') }
    })()`)
    attempts.push(state)
    await sleep(300)
    const gone = await evaluate(cdp, sessionId, `!document.querySelector('.work-week-graph-overlay, .daily-card-print')`)
    if (gone) return attempts
  }
  return attempts
}

async function ignitionOn(cdp, sessionId) {
  return evaluate(cdp, sessionId, `document.querySelector('button.start-key')?.getAttribute('aria-pressed') === 'true'`)
}

async function ensureIgnition(cdp, sessionId) {
  if (await ignitionOn(cdp, sessionId)) return 'already-on'
  await evaluate(cdp, sessionId, `document.querySelector('button.start-key')?.click()`)
  await sleep(400)
  return (await ignitionOn(cdp, sessionId)) ? 'started' : 'still-off'
}

async function setSpeed(cdp, sessionId, value) {
  const ignition = await ensureIgnition(cdp, sessionId)
  const outcome = await evaluate(cdp, sessionId, `(() => {
    const range = document.querySelector('.speed-module input[type=range]')
    if (!range || range.disabled) return range ? 'disabled' : 'missing'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(range, '${value}')
    range.dispatchEvent(new Event('input', { bubbles: true }))
    range.dispatchEvent(new Event('change', { bubbles: true }))
    return 'set:' + range.value
  })()`)
  return { ignition, outcome }
}

async function speedLabel(cdp, sessionId) {
  return evaluate(cdp, sessionId, `document.querySelector('.speedometer')?.getAttribute('aria-label') ?? ''`)
}

async function scenarioCards(cdp) {
  const pageA = await openPage(cdp, APP)
  const pageB = await openPage(cdp, APP)
  const inserted = await insertZmizik(cdp, pageA.sessionId)
  const clockAtInsert = await evaluate(cdp, pageA.sessionId, `document.querySelector('.dash-clock-utc b')?.textContent ?? ''`)
  const report = { inserted, clockAtInsert }
  await finishWizard(cdp, pageA.sessionId, report)
  const slot = await evaluate(cdp, pageA.sessionId, `document.querySelectorAll('.slot-tap-controls button')[0]?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''`)
  report.slotButton = slot
  const menu = await openByMenu(cdp, pageA.sessionId, 'vozidlo')
  report.vehicleMenu = menu
  const cards = await openByMenu(cdp, pageA.sessionId, 'Karty')
  report.cardsMenu = cards
  report.printWizard = await confirmPrintWizard(cdp, pageA.sessionId)
  await sleep(400)
  report.printText = await paper(cdp, pageA.sessionId)
  report.printShot = await shot(cdp, pageA.sessionId, 'inserted-cards-print.png')
  await evaluate(cdp, pageB.sessionId, `document.querySelector('button.reset-key')?.click()`)
  await sleep(600)
  report.printTextAfterOtherReset = await paper(cdp, pageA.sessionId)
  report.printStillOpen = await evaluate(cdp, pageA.sessionId, `!!document.querySelector('.daily-card-print')`)
  report.storageInsertions = await evaluate(cdp, pageA.sessionId, `localStorage.getItem('tcosimulator.vehicleCardInsertions')`)
  await cdp.send('Target.closeTarget', { targetId: pageA.targetId })
  await cdp.send('Target.closeTarget', { targetId: pageB.targetId })
  return report
}

async function scenarioDrive(cdp) {
  const page = await openPage(cdp, APP)
  await evaluate(cdp, page.sessionId, `document.querySelector('button.start-key')?.click()`)
  await sleep(300)
  const speeds = []
  const started = Date.now()
  await setSpeed(cdp, page.sessionId, 48)
  while (Date.now() - started < 14000) {
    speeds.push({ ms: Date.now() - started, label: await speedLabel(cdp, page.sessionId) })
    await sleep(400)
  }
  await setSpeed(cdp, page.sessionId, 0)
  let stopped = ''
  for (let step = 0; step < 30; step++) {
    stopped = await speedLabel(cdp, page.sessionId)
    speeds.push({ ms: Date.now() - started, label: stopped })
    if (/Rychlost 0 km/.test(stopped)) break
    await sleep(400)
  }
  const history = await evaluate(cdp, page.sessionId, `document.querySelector('[data-second-history-length]')?.getAttribute('data-second-history-length') ?? '0'`)
  let text = await lcd(cdp, page.sessionId)
  if (/jízda bez/i.test(text)) text = await press(cdp, page.sessionId, 'ok')
  const vehicle = await openByMenu(cdp, page.sessionId, 'vozidlo')
  const diagram = await openByMenu(cdp, page.sessionId, 'v-diagram')
  const wizard = await confirmPrintWizard(cdp, page.sessionId)
  await sleep(500)
  const path = await evaluate(cdp, page.sessionId, `[...document.querySelectorAll('.vdiagram-speed-line')].map((node) => node.getAttribute('d')).filter(Boolean)`)
  await evaluate(cdp, page.sessionId, `(() => {
    const line = [...document.querySelectorAll('.vdiagram-speed-line')].find((node) => (node.getAttribute('d') ?? '').includes('L'))
    line?.closest('svg')?.scrollIntoView({ block: 'center' })
  })()`)
  await sleep(300)
  const shotFile = await shot(cdp, page.sessionId, 'v-diagram.png')
  await cdp.send('Target.closeTarget', { targetId: page.targetId })
  return { speeds, stopped, history: Number(history), vehicle, diagram, wizard, path, shotFile, lcd: text }
}

async function scenarioTwoHours(cdp) {
  const page = await openPage(cdp, APP)
  const startClock = await evaluate(cdp, page.sessionId, `document.querySelector('.dash-clock-utc b')?.textContent ?? ''`)
  const inserted = await insertZmizik(cdp, page.sessionId)
  const report = { startClock, inserted }
  await finishWizard(cdp, page.sessionId, report)
  const parked = await evaluate(cdp, page.sessionId, `document.querySelector('.dash-clock-utc b')?.textContent ?? ''`)
  const hour = Number(String(parked).slice(0, 2))
  const hops = hour + 2 >= 24 ? (24 - hour) + 8 : 0
  for (let step = 0; step < hops; step++) {
    await evaluate(cdp, page.sessionId, `[...document.querySelectorAll('button')].find((item) => item.textContent.trim() === '+1 h')?.click()`)
    await sleep(120)
  }
  if (hops > 0) {
    await evaluate(cdp, page.sessionId, `document.querySelector('button.apply-time')?.click()`)
    await sleep(600)
  }
  report.parkedJump = { parked, hops, after: await evaluate(cdp, page.sessionId, `document.querySelector('.dash-clock-utc b')?.textContent ?? ''`) }
  report.speedSet = await setSpeed(cdp, page.sessionId, 40)
  let moving = ''
  for (let step = 0; step < 20; step++) {
    moving = await speedLabel(cdp, page.sessionId)
    if (/Rychlost ([1-9]|[1-9][0-9]|1[0-2][0-5]) km/.test(moving)) break
    await sleep(300)
  }
  report.moving = moving
  if (/Rychlost 0 km/.test(moving) || !moving.includes('km')) {
    report.speedFallback = []
    await ensureIgnition(cdp, page.sessionId)
    for (let step = 0; step < 8; step++) {
      const clicked = await evaluate(cdp, page.sessionId, `(() => {
        const button = document.querySelector('.speed-keys button:last-of-type')
        if (!button || button.disabled) return 'disabled'
        button.click()
        return button.parentElement?.innerText?.replace(/\\s+/g, ' ') ?? 'clicked'
      })()`)
      report.speedFallback.push(clicked)
      await sleep(200)
    }
    for (let step = 0; step < 15; step++) {
      moving = await speedLabel(cdp, page.sessionId)
      if (/Rychlost ([1-9]|[1-9][0-9]|1[0-2][0-5]) km/.test(moving)) break
      await sleep(300)
    }
    report.moving = moving
  }
  const beforeJump = await evaluate(cdp, page.sessionId, `document.querySelector('[data-second-history-length]')?.getAttribute('data-second-history-length') ?? '0'`)
  report.drivingBeforeJump = !/Rychlost 0 km/.test(String(moving)) && String(moving).includes('km')
  if (report.drivingBeforeJump) {
  await evaluate(cdp, page.sessionId, `[...document.querySelectorAll('button')].find((item) => item.textContent.trim() === '+1 h')?.click()`)
  await sleep(200)
  await evaluate(cdp, page.sessionId, `[...document.querySelectorAll('button')].find((item) => item.textContent.trim() === '+1 h')?.click()`)
  await sleep(200)
  await evaluate(cdp, page.sessionId, `document.querySelector('button.apply-time')?.click()`)
  }
  await sleep(800)
  report.afterJumpClock = await evaluate(cdp, page.sessionId, `document.querySelector('.dash-clock-utc b')?.textContent ?? ''`)
  report.samplesAfterJump = await evaluate(cdp, page.sessionId, `document.querySelector('[data-second-history-length]')?.getAttribute('data-second-history-length') ?? '0'`)
  report.samplesBeforeJump = beforeJump
  await setSpeed(cdp, page.sessionId, 0)
  for (let step = 0; step < 30; step++) {
    const label = await speedLabel(cdp, page.sessionId)
    if (/Rychlost 0 km/.test(label)) break
    await sleep(300)
  }
  report.clockBeforeApply = await evaluate(cdp, page.sessionId, `document.querySelector('.dash-clock-utc b')?.textContent ?? ''`)
  await evaluate(cdp, page.sessionId, `document.querySelector('button.show-card-data-key')?.click()`)
  await sleep(800)
  report.graphDays = await evaluate(cdp, page.sessionId, `(() => {
    const rows = [...document.querySelectorAll('.graph-day-row-hit')]
    const labels = rows.map((row) => row.getAttribute('aria-label'))
    const row = rows.find((item) => /26\\.11/.test(item.getAttribute('aria-label') ?? '')) ?? rows[rows.length - 1]
    if (row) {
      const box = row.getBoundingClientRect()
      row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: box.x + 8, clientY: box.y + 8, button: 0 }))
      row.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: box.x + 8, clientY: box.y + 8 }))
    }
    return labels
  })()`)
  await sleep(700)
  report.graphText = await evaluate(cdp, page.sessionId, `(() => {
    const overlay = document.querySelector('.work-week-graph-overlay')
    const block = document.querySelector('.work-week-graph-block')
    const empty = document.querySelector('.work-week-graph-empty')
    return {
      open: !!overlay,
      empty: empty?.textContent ?? '',
      text: (block?.innerText ?? overlay?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 1800),
    }
  })()`)
  report.graphShot = await shot(cdp, page.sessionId, 'daily-graph.png')
  report.graphClosed = await closeOverlay(cdp, page.sessionId)
  let text = await lcd(cdp, page.sessionId)
  if (!/výtisk/i.test(text)) text = await press(cdp, page.sessionId, 'ok')
  report.driverMenu = text
  text = await press(cdp, page.sessionId, 'ok')
  report.dayPrintMenu = text
  report.dayWizard = await confirmPrintWizard(cdp, page.sessionId)
  await sleep(500)
  report.dayPrint = await paper(cdp, page.sessionId)
  await evaluate(cdp, page.sessionId, `(() => {
    const row = [...document.querySelectorAll('.daily-card-print-row')].find((item) => /02h00|08:07/.test(item.innerText ?? ''))
    row?.scrollIntoView({ block: 'center' })
  })()`)
  await sleep(200)
  report.dayShot = await shot(cdp, page.sessionId, 'daily-print.png')
  await closeOverlay(cdp, page.sessionId)
  for (let step = 0; step < 6; step++) {
    const screen = await lcd(cdp, page.sessionId)
    if (/km\/h/.test(screen) && !/výtisk|den-tisk|aktivity/i.test(screen)) break
    await press(cdp, page.sessionId, 'back')
  }
  const vehicle = await openByMenu(cdp, page.sessionId, 'vozidlo')
  const diagram = await openByMenu(cdp, page.sessionId, 'v-diagram')
  const wizard = await confirmPrintWizard(cdp, page.sessionId)
  const path = await evaluate(cdp, page.sessionId, `[...document.querySelectorAll('.vdiagram-speed-line')].map((node) => node.getAttribute('d')).filter(Boolean)`)
  await evaluate(cdp, page.sessionId, `(() => {
    const line = [...document.querySelectorAll('.vdiagram-speed-line')].find((node) => (node.getAttribute('d') ?? '').includes('L'))
    line?.closest('svg')?.scrollIntoView({ block: 'center' })
  })()`)
  await sleep(300)
  report.jumpDiagram = { vehicle: vehicle.text, diagram: diagram.text, wizard, path }
  report.jumpDiagramShot = await shot(cdp, page.sessionId, 'v-diagram-after-jump.png')
  await cdp.send('Target.closeTarget', { targetId: page.targetId })
  return report
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await launch()
  const report = {}
  try {
    const only = process.argv[2]
    if (!only || only === 'cards') report.cards = await scenarioCards(browser.cdp)
    if (!only || only === 'drive') report.drive = await scenarioDrive(browser.cdp)
    if (!only || only === 'hours') report.twoHours = await scenarioTwoHours(browser.cdp)
    const outName = process.argv[2] ? `report-${process.argv[2]}.json` : 'report.json'
    await writeFile(join(OUT, outName), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({
      parked: report.twoHours?.parkedJump,
      moving: report.twoHours?.moving,
      start: report.twoHours?.startClock,
      after: report.twoHours?.afterJumpClock,
      samplesBefore: report.twoHours?.samplesBeforeJump,
      samplesAfter: report.twoHours?.samplesAfterJump,
      graphDays: report.twoHours?.graphDays,
      graph: report.twoHours?.graphText,
      graphClosed: report.twoHours?.graphClosed,
      print: String(report.twoHours?.dayPrint ?? '').slice(0, 900),
      path: report.twoHours?.jumpDiagram?.path,
      diagram: report.twoHours?.jumpDiagram?.diagram,
    }, null, 2))
  } finally {
    browser.cdp.close()
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(browser.child.pid), '/T', '/F'], { stdio: 'ignore' })
      killer.on('exit', resolve)
      setTimeout(resolve, 4000)
    })
    await sleep(500)
    await rm(browser.dir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
