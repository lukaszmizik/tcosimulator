type Decision = { isFirstInsertion: boolean; itsConsent?: boolean; vdoConsent?: boolean }
export type VirtualCardDecisions = Record<string, Decision>
const storageKey = 'tcosimulator.virtualCardConsents'
const ids = ['zmizik', 'novak'] as const

export function loadVirtualCardConsents(): VirtualCardDecisions {
  const result: VirtualCardDecisions = {}
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    for (const id of ids) {
      const entry = saved?.[id]
      if (typeof entry?.itsConsent === 'boolean' && typeof entry?.vdoConsent === 'boolean') {
        result[id] = { isFirstInsertion: false, itsConsent: entry.itsConsent, vdoConsent: entry.vdoConsent }
      }
    }
  } catch { /* Use a fresh registration when storage is unavailable. */ }
  return result
}

export function saveVirtualCardConsents(value: VirtualCardDecisions) {
  try { localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Keep decisions for this session. */ }
}
