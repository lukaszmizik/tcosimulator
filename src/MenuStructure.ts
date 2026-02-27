/**
 * Definice menu - struktura, položky, podmínky
 */

import menuStructureJson from './data/menu_structure.json'
import buttonsDefinitionJson from './data/buttons_definition.json'
import type { TachoState } from './TachoTypes'
import type { Translations } from './translations/types'

export type MenuItem = {
  id: string
  line1?: string
  line2: string
  condition?: number | null
  sub_menu?: string
  action?: string
  display_icon?: string | null
  requiresDate?: boolean
  requiresUtcConfirm?: boolean
}

export type MenuNode = {
  id?: string
  header_line1?: string
  items: MenuItem[]
}

type MenuHierarchy = {
  menu_hierarchy: Record<string, MenuNode>
}

type ButtonsDef = {
  buttons: Array<{
    button_name: string
    physical_symbol: string
    short_press_action: string
    long_press_action: string | null
    description: string
  }>
}

const menuData = menuStructureJson as unknown as MenuHierarchy
const buttonsData = buttonsDefinitionJson as ButtonsDef

export const menuDataExport = menuData
export const buttonsDataExport = buttonsData

export const ENTRY_MENU_ID = 'MAIN_LEVEL'

export function buildMenusById(): Record<string, MenuNode> {
  const out: Record<string, MenuNode> = {}
  const hierarchy = menuData.menu_hierarchy
  for (const key of Object.keys(hierarchy)) {
    const node = hierarchy[key] as MenuNode
    out[key] = { id: key, ...node }
  }
  return out
}

/** Aplikuje překlady na strukturu menu – vrací menu s přeloženými texty */
export function applyMenuTranslations(menus: Record<string, MenuNode>, t: Translations): Record<string, MenuNode> {
  const result: Record<string, MenuNode> = {}
  for (const menuId of Object.keys(menus)) {
    const node = menus[menuId]
    const header = t.menu.headers[menuId] ?? node.header_line1
    const items = (node.items ?? []).map((item) => {
      const tr = t.menu.items[item.id]
      return tr
        ? { ...item, line1: tr.line1 ?? item.line1, line2: tr.line2 }
        : item
    })
    result[menuId] = { ...node, header_line1: header, items }
  }
  return result
}

export function conditionSatisfied(condition: number | null | undefined, state: TachoState): boolean {
  if (condition == null || condition === undefined) return true
  switch (condition) {
    case 1: return state.optionalFeatureEnabled
    case 2: return state.companyCardInserted
    case 3: return state.companyCardInserted
    case 4: return state.card1Inserted
    case 5: return state.card2Inserted
    case 6: return state.controlCardInserted
    case 7: return state.vdoLinkConnected
    default: return true
  }
}

export function getButtonsData() {
  return buttonsData
}

export function getMenuData() {
  return menuData
}
