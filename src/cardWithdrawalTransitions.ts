/**
 * Přechody průvodce vysunutím karty. Zápisy a odebrání karty zůstávají v App.tsx.
 */

import type { CardWithdrawalState } from './TachoTypes'

export const COUNTRY_CONFIRM_MS = 60_000
const BARGRAF_MS = 2000

export type CardWithdrawalKey = 'ok' | 'up' | 'down' | 'back'

export type CardWithdrawalKeyResult =
  | { type: 'state'; state: CardWithdrawalState }
  | { type: 'cancel' }
  | { type: 'ejectWithCountry' }

/** Po 2000 ms od začátku bargrafu přejde na výběr země. Jinak vrátí stejný stav. */
export function advanceWithdrawalBargraf(state: CardWithdrawalState, nowMs: number): CardWithdrawalState {
  if (state.phase !== 'bargraf') return state
  if (nowMs - state.phaseStartTime < BARGRAF_MS) return state
  return { ...state, phase: 'countrySelect', phaseStartTime: nowMs }
}

/** Šipky, OK a Zpět. Pokyn k vysunutí neprovádí zápis, jen ho oznámí volajícímu. */
export function applyCardWithdrawalKey(
  prev: CardWithdrawalState,
  action: CardWithdrawalKey,
  countryCount: number,
  nowMs = Date.now(),
): CardWithdrawalKeyResult {
  if (action === 'back') return { type: 'cancel' }
  if (prev.phase === 'bargraf') return { type: 'state', state: prev }
  if (prev.phase === 'countrySelect') {
    if (nowMs - prev.phaseStartTime >= COUNTRY_CONFIRM_MS) return { type: 'cancel' }
    if (action === 'up' || action === 'down') {
      const delta = action === 'up' ? 1 : -1
      const len = countryCount || 1
      const countryIndex = (prev.countryIndex + delta + len) % len
      return { type: 'state', state: { ...prev, countryIndex } }
    }
    if (action === 'ok' && prev.countryIndex >= 0 && prev.countryIndex < countryCount) {
      return {
        type: 'state',
        state: { ...prev, phase: 'print24hQuestion', phaseStartTime: nowMs, print24hYes: false },
      }
    }
  }
  if (prev.phase === 'print24hQuestion') {
    if (action === 'up' || action === 'down') {
      return { type: 'state', state: { ...prev, print24hYes: !(prev.print24hYes ?? false) } }
    }
    if (action === 'ok') return { type: 'ejectWithCountry' }
  }
  return { type: 'state', state: prev }
}
