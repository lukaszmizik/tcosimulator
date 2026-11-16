/**
 * Čistý výpočet menu: viditelné položky, kurzor a cesta.
 * Stav a obsluha kláves zůstávají v App.tsx.
 */

import { ENTRY_MENU_ID, conditionSatisfied, type MenuItem } from '../MenuStructure'
import type { TachoState } from '../TachoTypes'

export type MenuCursor = {
  path: string[]
  index: number
}

export function visibleMenuItems(items: MenuItem[], state: TachoState): MenuItem[] {
  return items.filter((it) => conditionSatisfied(it.condition, state))
}

/** Cyklický posun. Nahoru z první položky přejde na poslední, dolů z poslední na první. */
export function stepMenuIndex(index: number, length: number, direction: 'up' | 'down'): number {
  if (direction === 'up') return index > 0 ? index - 1 : length - 1
  return index < length - 1 ? index + 1 : 0
}

/** Drží index v rozsahu po změně počtu položek. Záporný index nemění. */
export function clampMenuIndex(index: number, length: number): number {
  return Math.min(index, length - 1)
}

export function enterMenuRoot(): MenuCursor {
  return { path: [ENTRY_MENU_ID], index: 0 }
}

export function enterSubmenu(path: string[], submenuId: string): MenuCursor {
  return { path: [...path, submenuId], index: 0 }
}

export function leaveSubmenu(path: string[]): MenuCursor {
  return { path: path.slice(0, -1), index: 0 }
}
