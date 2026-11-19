export type KnowledgeSection = 'pictograms' | 'messages'

export type KnowledgeEntry = {
  id: string
  label: string
  symbol?: string
  page: number
  display?: readonly [string, string?]
  meaning?: string
  action?: string
}

type KnowledgeGroup = {
  title: string
  entries: readonly KnowledgeEntry[]
}

const pictogram = (id: string, symbol: string, label: string, page: number): KnowledgeEntry =>
  ({ id, symbol, label, page })

const message = (
  id: string,
  label: string,
  page: number,
  display: KnowledgeEntry['display'],
  meaning: string,
  action: string,
): KnowledgeEntry => ({ id, label, page, display, meaning, action })

// DTCO 4.1–4.1b, BA00.1381.41 100 116, české vydání 4, 2025-03.
export const knowledgeBase: Record<KnowledgeSection, readonly KnowledgeGroup[]> = {
  pictograms: [
    {
      title: 'Činnosti a obsluha',
      entries: [
        pictogram('driving', '(2)', 'Řízení', 36),
        pictogram('work', '(9)', 'Jiná práce', 36),
        pictogram('availability', '(7)', 'Pohotovost', 36),
        pictogram('rest', '(8)', 'Přestávka a odpočinek', 36),
        pictogram('break', '(10)', 'Platné přerušení', 36),
        pictogram('unknown', '?', 'Neznámá činnost', 36),
        pictogram('card', '(14)', 'Načtená karta tachografu', 36),
        pictogram('entry', '(42)', 'Zadání', 36),
        pictogram('manual', 'M', 'Ruční zadání činností', 37),
        pictogram('print', '(18)', 'Tiskárna nebo výtisk', 36),
        pictogram('download', '(22)', 'Stahování dat', 36),
      ],
    },
    {
      title: 'Místa a zvláštní podmínky',
      entries: [
        pictogram('start-place', '(37)(36)', 'Místo začátku směny', 37),
        pictogram('end-place', '(41)(37)', 'Místo konce směny', 37),
        pictogram('border', '(43)', 'Překročení hranic', 37),
        pictogram('load', '(52)', 'Nakládka', 37),
        pictogram('unload', '(53)', 'Vykládka', 37),
        pictogram('load-unload', '(54)', 'Současná nakládka a vykládka', 37),
        pictogram('out', 'OUT', 'Režim OUT', 37),
        pictogram('ferry', '(49)', 'Trajekt nebo vlak', 37),
      ],
    },
    {
      title: 'Výtisky',
      entries: [
        pictogram('card-day-print', '24h(14)(18)', 'Denní aktivity z karty řidiče', 38),
        pictogram('vehicle-day-print', '24h(24)(18)', 'Denní aktivity z paměti vozidla', 38),
        pictogram('card-event-print', '(27)(34)(14)(18)', 'Události a poruchy z karty řidiče', 38),
        pictogram('vehicle-event-print', '(27)(34)(24)(18)', 'Události a poruchy vozidla', 38),
        pictogram('speed-print', '(39)(39)(18)', 'Překročení rychlosti', 38),
        pictogram('technical-print', '(5)(17)(18)', 'Technické údaje', 38),
        pictogram('activity-print', '(44)(14)(18)', 'Graf aktivit řidiče', 38),
        pictogram('v-diagram', '(44)v(18)', 'V-diagram', 38),
      ],
    },
    {
      title: 'Hlášení',
      entries: [
        pictogram('event', '(27)', 'Událost', 36),
        pictogram('fault', '(34)', 'Porucha', 36),
        pictogram('warning', '(35)', 'Upozornění nebo výstraha', 36),
        pictogram('no-card-event', '(27)(2)(14)', 'Jízda bez platné karty řidiče', 39),
        pictogram('power-loss', '(27)(26)', 'Přerušení napájení', 39),
        pictogram('printer-fault', '(34)(18)', 'Porucha tiskárny', 39),
      ],
    },
  ],
  messages: [
    {
      title: 'Události a hlášení související s kartou',
      entries: [
        message('no-card', 'Jízda bez platné karty řidiče', 113, ['(27)(2)(14) jízda bez', 'vložené karty xx'],
          'Jízda začala bez platné karty v šachtě řidiče.', 'Potvrďte hlášení. Zastavte a vložte platnou kartu do šachty řidiče.'),
        message('inserted-in-motion', 'Vložení karty za jízdy', 113, ['(27)(14)(2)1 vložena při', 'jízdě xx'],
          'Karta byla zasunuta až po rozjezdu.', 'Potvrďte hlášení. Kartu vkládejte při stojícím vozidle.'),
        message('time-conflict', 'Časový konflikt', 113, ['(27)(17) Čas. konflikt', 'xx'],
          'Čas tachografu a čas ze systému GNSS se rozcházejí.', 'Potvrďte hlášení.'),
        message('invalid-card', 'Neplatná karta', 113, ['(27)(14)1 neplatná', 'karta xx'],
          'Platnost karty ještě nezačala, skončila nebo systém kartu odmítl.', 'Potvrďte hlášení a ověřte platnost karty.'),
        message('card-expiry', 'Blížící se konec platnosti karty', 114, ['(47)(14)1 vyprší za', 'dní ??'],
          'Počet dnů na displeji upozorňuje na blížící se konec platnosti.', 'Potvrďte upozornění a včas si zajistěte výměnu karty.'),
      ],
    },
    {
      title: 'Poruchy',
      entries: [
        message('printer', 'Porucha tiskárny', 116, ['(34)(18) Porucha tiskárny', 'xx'],
          'Tiskárna hlásí závadu, například výpadek napájení nebo problém s teplotním čidlem.', 'Potvrďte hlášení. Zopakujte tisk, až bude tiskárna dostupná.'),
        message('data-download', 'Porucha stahování dat', 117, ['(34)(22) závada při', 'stahování dat xx'],
          'Přenos dat do externího zařízení se nezdařil.', 'Potvrďte hlášení a zopakujte stahování. Při opakování nechte zkontrolovat připojení nebo externí zařízení.'),
        message('card-fault', 'Závada karty', 117, ['(34)(14)1 závada karty', 'xx'],
          'Při čtení nebo zápisu na kartu nastal problém s komunikací.', 'Potvrďte hlášení a očistěte kontakty karty.'),
        message('its', 'Porucha ITS', 118, ['(34)(31) porucha ITS xx'],
          'Tachograf zjistil chybu ve své součásti Bluetooth.', 'Potvrďte hlášení a obraťte se na autorizovaný servis.'),
      ],
    },
    {
      title: 'Výstrahy pro dobu řízení',
      entries: [
        message('break-soon', 'Výstraha po 4 h 15 min řízení', 119, ['(35)(2)1 pauza!', '1(2)04h15 (10)00h15'],
          'Tachograf upozorňuje na blížící se mez nepřerušené doby řízení.', 'Potvrďte hlášení a naplánujte přestávku.'),
        message('break-now', 'Výstraha po 4 h 30 min řízení', 119, ['(35)(2)1 pauza!', '1(2)04h30 (10)00h15'],
          'Tachograf zaznamenal 4 h 30 min nepřerušené doby řízení.', 'Potvrďte hlášení, bezpečně zastavte a čerpejte přestávku.'),
      ],
    },
    {
      title: 'Upozornění a informace',
      entries: [
        message('entry-request', 'Výzva k ručnímu zadání', 121, ['(35)(42) prosím', 'zadání'],
          'Tachograf čeká na vstup při ručním doplňování údajů.', 'Stiskněte tlačítko a pokračujte v zadávání.'),
        message('no-paper', 'Chybí papír', 121, ['(35)(18)o není papír', 'xx'],
          'Došel papír nebo zásuvka tiskárny nedosedla.', 'Vyměňte roli nebo správně zasuňte zásuvku tiskárny.'),
        message('eject-blocked', 'Vysunutí karty není možné', 122, ['(35)(14) výhoz není', 'možný xx'],
          'Tachograf momentálně kartu neuvolní, například za jízdy nebo při práci s daty.', 'Odstraňte příčinu nebo vyčkejte. Potom o vysunutí požádejte znovu.'),
        message('no-data', 'Žádná data k dispozici', 124, ['(14) žádná data!'],
          'Vybranou funkci nelze vyvolat, například když chybí příslušná karta.', 'Pro danou funkci zkontrolujte, zda je vložena správná karta.'),
        message('entry-saved', 'Zadání uloženo', 124, ['zadání', 'uloženo'],
          'Tachograf uložil zadané údaje.', 'Pokračujte po zmizení hlášení.'),
        message('please-wait', 'Čekání na kartu', 124, ['prosím čekejte!'],
          'Karta se stále načítá a nabídka je dočasně nedostupná.', 'Vyčkejte na dokončení čtení.'),
      ],
    },
  ],
}

function searchKey(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function searchKnowledge(section: KnowledgeSection, query: string) {
  const terms = searchKey(query).split(/\s+/).filter(Boolean)
  return knowledgeBase[section].map(group => ({
    ...group,
    entries: group.entries.filter(entry => {
      const text = searchKey(
        [group.title, entry.label, entry.meaning, entry.action, entry.display?.join(' '), entry.symbol]
          .join(' ')
          .replace(/\(\d+\)/g, ' '),
      )
      return terms.every(term => text.includes(term))
    }),
  })).filter(group => group.entries.length)
}
