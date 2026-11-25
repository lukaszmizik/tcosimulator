/**
 * Společný časový základ intervalu a návratu na stránku.
 * visibilitychange samo o sobě sekundu nepřidá. Stejný úsek wall-clock se nezapočítá dvakrát.
 * Ruční skok simulace základ srovná a mezeru před skokem už nedohání.
 */

export type ClockSource = 'interval' | 'visibility'

export type ClockAnchor = {
  lastAccountedWallMs: number
  expectedSimUtc: number
}

export type ClockAction =
  | { type: 'none'; anchor: ClockAnchor }
  | { type: 'resync'; anchor: ClockAnchor }
  | { type: 'step'; anchor: ClockAnchor }
  | { type: 'catchup'; deltaMs: number; anchor: ClockAnchor }

export function nextSimulationClockAction(
  anchor: ClockAnchor,
  input: {
    nowMs: number
    simulatedUtcMs: number
    background: boolean
    source: ClockSource
  },
): ClockAction {
  if (input.simulatedUtcMs !== anchor.expectedSimUtc) {
    return {
      type: 'resync',
      anchor: {
        lastAccountedWallMs: input.nowMs,
        expectedSimUtc: input.simulatedUtcMs,
      },
    }
  }

  const elapsed = input.nowMs - anchor.lastAccountedWallMs
  if (elapsed < 1000) {
    if (elapsed < 0) {
      return {
        type: 'none',
        anchor: { ...anchor, lastAccountedWallMs: input.nowMs },
      }
    }
    return { type: 'none', anchor }
  }

  const wholeSecondsMs = Math.floor(elapsed / 1000) * 1000
  if (input.background && wholeSecondsMs >= 2000) {
    return {
      type: 'catchup',
      deltaMs: wholeSecondsMs,
      anchor: {
        lastAccountedWallMs: anchor.lastAccountedWallMs + wholeSecondsMs,
        expectedSimUtc: anchor.expectedSimUtc,
      },
    }
  }

  // Návrat na stránku sám sekundu nepřidá. Dopočet dlouhé mezery je jen se zapnutým během na pozadí.
  if (input.source === 'visibility') return { type: 'none', anchor }

  // Krátké zpoždění časovače nechá zbytek na další tik. Dlouhou mezeru při vypnutém pozadí už nedohání.
  return {
    type: 'step',
    anchor: {
      lastAccountedWallMs: wholeSecondsMs >= 2000 ? input.nowMs : anchor.lastAccountedWallMs + 1000,
      expectedSimUtc: anchor.expectedSimUtc,
    },
  }
}
