#!/usr/bin/env python3
"""Minimal, guarded EN-only LCD corrections for VDO DTCO 4.1b simulator.

Reference: DTCO 4.1b EN, Edition 5 (2026-02), manual pages 56-57, 65,
71, 88-108, 119, 124. https://www.fleet.vdo.de/media/1wcfjdwk/ba00-1381-41-100-102_dtco_41b_en_web_2026-02-20.pdf

Usage, in repo root:
    py -3 apply_vdo_en_lcd.py --check   # validates that the patch can be applied
    py -3 apply_vdo_en_lcd.py --apply   # edits only EN LCD strings

No source is changed if any required replacement cannot be matched.
Idempotent: already-applied exact replacements are accepted.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import sys

Rule = tuple[str, str, str]
RULES: dict[str, list[Rule]] = {
    "src/translations/en.ts": [
        # Main menu, p. 88-89
        ("Main menu printout", "line1: 'print', line2:", "line1: 'printout', line2:"),
        ("Main menu entry", "line1: 'input', line2:", "line1: 'entry', line2:"),
        # Printer + display submenus, pp. 88-96, 107
        ("24h day printout D1/D2", "line2: '24h(14)(18) day-print'", "line2: '24h(14)(18) day'"),
        ("24h day printout V", "line2: '24h(24)(18) day-print'", "line2: '24h(24)(18) day'"),
        ("Technical printout", "line2: '(5)(17)(18) tech. data'", "line2: '(5)(17)(18) techn. data'"),
        ("Technical display", "line2: '(5)(17)(20) tech. data'", "line2: '(5)(17)(20) techn. data'"),
        ("Card printout", "line2: '(6)(14)(17)(18) Cards'", "line2: '(6)(14)(17)(18) cards'"),
        ("Card display", "line2: '(6)(14)(17)(20) Cards'", "line2: '(6)(14)(17)(20) cards'"),
        ("Speed profiles", "line2: '%v(18) v-profile'", "line2: '%v(18) v-profiles'"),
        ("RPM profiles", "line2: '%n(18) n-profile'", "line2: '%n(18) n-profiles'"),
        ("Display overspeed", "line2: '(39)(39)(20) excess speed'", "line2: '(39)(39)(20) overspeed'"),
        ("Display company", "line2: '(3)(14) owner'", "line2: '(3)(14) company'"),
        # Entry menus, pp. 88, 96-108
        ("Entry settings", "line2: '?(19) Settings'", "line2: '?(19) settings'"),
        ("Entry settings headers", "SUB_INPUT_D1_SETTINGS: '?(19) Settings'", "SUB_INPUT_D1_SETTINGS: '?(19) settings'"),
        ("Entry settings D2 header", "SUB_INPUT_D2_SETTINGS: '?(19) Settings'", "SUB_INPUT_D2_SETTINGS: '?(19) settings'"),
        ("Publish ITS LCD submenu", "ID1_ITS: { line2: 'Publish ITS' }", "ID1_ITS: { line1: '?(19) publish', line2: 'ITS data' }"),
        ("Publish VDO LCD submenu", "ID1_VDO: { line2: 'Publish VDO' }", "ID1_VDO: { line1: '?(19) publish', line2: 'VDO data' }"),
        ("Publish ITS LCD submenu D2", "ID2_ITS: { line2: 'Publish ITS' }", "ID2_ITS: { line1: '?(19) publish', line2: 'ITS data' }"),
        ("Publish VDO LCD submenu D2", "ID2_VDO: { line2: 'Publish VDO' }", "ID2_VDO: { line1: '?(19) publish', line2: 'VDO data' }"),
        ("Miscellaneous", "line2: 'Miscellaneous'", "line2: 'miscellaneous'"),
        ("Start OUT", "line2: 'OUT(59) start'", "line2: 'OUT(59) begin'"),
        ("Start ferry", "line2: '(49)(59) start'", "line2: '(49)(59) begin'"),
        ("Company time", "line2: '(3)(17) owner time'", "line2: '(3)(17) company time'"),
        ("Licence code", "line2: '(21) License code'", "line2: '(21) licence code'"),
        ("Centralised language", "line2: 'central language'", "line2: 'centr. language'"),
        ("In-vehicle pairing", "line2: '(1)(24) In-Vehicle Connection'", "line2: '(1)(24) in-vehiclepairing'"),
        ("Manage BT devices", "IV_BT_MGMT: { line2: '(1) Bluetooth Device management' }", "IV_BT_MGMT: { line1: '(1) Bluetooth', line2: 'manage devices' }"),
        ("BT configuration", "IV_BT_CONF: { line2: '(1) Bluetooth Configuration' }", "IV_BT_CONF: { line1: '(1) Bluetooth', line2: 'configuration' }"),
        ("Tolling menu", "M_TOLL: { line1: 'menu', line2: '(32) Toll' }", "M_TOLL: { line1: 'menu', line2: '(32) tolling' }"),
        ("Driver card save message", "inputSaved: 'saved', // 24", "inputSaved: 'entry stored', // 24"),
        ("Card busy entry", "input: 'input', // 20", "input: 'enter', // 20"),
        ("LCD printed in UTC", "printUtcLine1: 'print in'", "printUtcLine1: 'printout in'"),
        ("UTC time question", "printUtc: 'UTC time?'", "printUtc: 'UTC time'"),
        ("Printout start suffix", "printStarted: 'started...'", "printStarted: 'started ...'"),
        ("Overspeed warning", "excessSpeed: 'excess speed'", "excessSpeed: 'overspeed'"),
        ("Ejection blocked notification", "ejectionBlockedL2: 'possible'", "ejectionBlockedL2: 'possible xx'"),
        ("Display vehicle menu header", "SUB_DISPLAY_VEHICLE: 'vehicle'", "SUB_DISPLAY_VEHICLE: '(24)(20) vehicle'"),
    ],
    "src/TachoDisplay.tsx": [
        # Only EN: corrections to hand-coded messages; all CS/RU retain original rendering.
        ("Save confirmation of load/unload", """function LoadUnloadConfirmDisplay() {
  const { t } = useLanguage()
  return (
    <div className=\"lcd-two-rows lcd-card-insertion\">
      <div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.input}</div>
      <div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.saved}</div>
    </div>
  )
}""", """function LoadUnloadConfirmDisplay() {
  const { t, language } = useLanguage()
  return (
    <div className=\"lcd-two-rows lcd-card-insertion\">
      {language === 'en' ? (
        <><div className=\"lcd-row lcd-row-left\">entry stored</div><div className=\"lcd-row lcd-row-left\" /></>
      ) : (
        <><div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.input}</div><div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.saved}</div></>
      )}
    </div>
  )
}"""),
        ("Save confirmation of country", """  if (mc.phase === 'confirmSaved') {
    return (
      <div className=\"lcd-two-rows lcd-card-insertion\">
        <div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.input}</div>
        <div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.saved}</div>
      </div>
    )
  }""", """  if (mc.phase === 'confirmSaved') {
    return (
      <div className=\"lcd-two-rows lcd-card-insertion\">
        {language === 'en' ? (
          <><div className=\"lcd-row lcd-row-left\">entry stored</div><div className=\"lcd-row lcd-row-left\" /></>
        ) : (
          <><div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.input}</div><div className=\"lcd-row lcd-row-left\">{t.tachoDisplay.saved}</div></>
        )}
      </div>
    )
  }"""),
        ("Hardcoded Czech printout", """  const { t } = useLanguage()
  const l1 = parseSymbols('výtisk', symbolMap)""", """  const { t, language } = useLanguage()
  const l1 = parseSymbols(language === 'en' ? 'printout' : 'výtisk', symbolMap)"""),
        ("Nested EN Bluetooth two-line LCD", """function MenuDisplay(props: TachoDisplayProps) {
  const { symbolMap, currentMenu, selectedItem, currentMenuId, entryMenuId } = props
  if (!currentMenu) return null""", """function MenuDisplay(props: TachoDisplayProps) {
  const { symbolMap, currentMenu, selectedItem, currentMenuId, entryMenuId } = props
  const { language } = useLanguage()
  if (!currentMenu) return null"""),
        ("Nested EN Bluetooth override", """      : (currentMenu.header_line1 ?? '')
  const rawLine2 = item?.line2 ?? ''""", """      : (language === 'en' && item?.line1 ? item.line1 : (currentMenu.header_line1 ?? ''))
  const rawLine2 = item?.line2 ?? ''"""),
    ],
    "src/CardInsertionDisplay2.tsx": [
        ("VDO/ITS save confirmation", """  if (cs.phase === 'itsVdoConfirmSaved') {
    return (
      <div className=\"lcd-two-rows lcd-card-insertion\">
        <div className=\"lcd-row lcd-row-left\">{t.cardWizard.input}</div>
        <div className=\"lcd-row lcd-row-left\">{t.cardWizard.inputSaved}</div>
      </div>
    )
  }""", """  if (cs.phase === 'itsVdoConfirmSaved') {
    return (
      <div className=\"lcd-two-rows lcd-card-insertion\">
        {language === 'en' ? (
          <><div className=\"lcd-row lcd-row-left\">{t.cardWizard.inputSaved}</div><div className=\"lcd-row lcd-row-left\" /></>
        ) : (
          <><div className=\"lcd-row lcd-row-left\">{t.cardWizard.input}</div><div className=\"lcd-row lcd-row-left\">{t.cardWizard.inputSaved}</div></>
        )}
      </div>
    )
  }"""),
    ],
}


def run(root: Path, apply: bool) -> int:
    results: dict[Path, str] = {}
    summary: list[str] = []
    errors: list[str] = []
    for rel, tasks in RULES.items():
        p = root / rel
        if not p.is_file():
            errors.append(f"MISSING: {rel}")
            continue
        source = p.read_text(encoding='utf-8-sig')
        new = source
        for label, old, replacement in tasks:
            count = new.count(old)
            if count:
                new = new.replace(old, replacement)
                summary.append(f"{rel}: {label} ({count}x)")
            elif replacement in new:
                summary.append(f"{rel}: already applied: {label}")
            else:
                errors.append(f"MISMATCH: {rel}: {label}")
        results[p] = new
    if errors:
        print('PRECHECK FAILED: NO FILES MODIFIED')
        for err in errors:
            print('  ' + err)
        return 2
    for s in summary:
        print(s)
    if apply:
        for path, content in results.items():
            if content != path.read_text(encoding='utf-8-sig'):
                path.write_text(content, encoding='utf-8')
        print('APPLIED: EN LCD only; no git commit, push or deploy.')
    else:
        print('CHECK OK: no files modified; rerun with --apply to write.')
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--check', action='store_true')
    group.add_argument('--apply', action='store_true')
    parser.add_argument('--root', type=Path, default=Path.cwd())
    args = parser.parse_args()
    return run(args.root.resolve(), args.apply)

if __name__ == '__main__':
    sys.exit(main())
