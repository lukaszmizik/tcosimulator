import { useLayoutEffect, useRef, useState } from 'react'

type Band = {
  left: number
  top: number
  width: number
  height: number
  issues: string[]
}

function measureRow(row: HTMLElement, overlay: HTMLElement): Band {
  const frame = overlay.getBoundingClientRect()
  const rect = row.getBoundingClientRect()
  const issues = []
  const count = Array.from((row.textContent ?? '').normalize('NFC')).length
  if (count > 16) issues.push(`${count}/16`)

  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
  let right = -Infinity
  let overlap = false
  let outside = false
  const range = document.createRange()
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent?.trim()) continue
    range.selectNodeContents(walker.currentNode)
    for (const box of range.getClientRects()) {
      if (!box.width) continue
      overlap ||= box.left < right - 1
      outside ||= box.left < rect.left - 1 || box.right > rect.right + 1
      right = Math.max(right, box.right)
    }
  }
  if (overlap) issues.push('překryv')
  if (outside) issues.push('přesah')
  return {
    left: 100 * (rect.left - frame.left) / frame.width,
    top: 100 * (rect.top - frame.top) / frame.height,
    width: 100 * rect.width / frame.width,
    height: 100 * rect.height / frame.height,
    issues,
  }
}

export function LcdDebugGrid() {
  const ref = useRef<HTMLDivElement>(null)
  const [bands, setBands] = useState<Band[]>([])
  useLayoutEffect(() => {
    const overlay = ref.current!
    const screen = overlay.parentElement!
    let active = true
    function update() {
      if (!active || !overlay.getBoundingClientRect().width) return
      setBands(Array.from(screen.querySelectorAll<HTMLElement>('.lcd-row'), row => measureRow(row, overlay)))
    }
    const observer = new MutationObserver(records => {
      if (records.some(record => !overlay.contains(record.target))) update()
    })
    observer.observe(screen, { subtree: true, childList: true, characterData: true, attributes: true })
    const resize = new ResizeObserver(update)
    resize.observe(screen)
    void document.fonts.ready.then(update)
    document.fonts.addEventListener('loadingdone', update)
    update()
    return () => {
      active = false
      resize.disconnect()
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', update)
    }
  }, [])
  return <div ref={ref} aria-hidden="true" className="lcd-debug-grid">
    {bands.map(({left, top, width, height, issues}, index) => (
      <div key={index} className="lcd-debug-band" data-warning={issues.length > 0}
        style={{left: left + '%', top: top + '%', width: width + '%', height: height + '%'}}>
        <small>{issues.length ? issues.join(' · ') : ''}</small>
      </div>
    ))}
  </div>
}
