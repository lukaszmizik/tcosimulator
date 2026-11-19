import type { SupportedLanguage } from '../translations/types'
import { knowledgeBaseLocales } from './knowledgeBaseLocales'
import { getPictogramGroups } from './knowledgeBasePictograms'

export type KnowledgeSection = 'pictograms' | 'messages'

export type KnowledgeEntry = {
  id: string
  label: string
  symbol?: string
  pictogram?: string
  page?: number
  display?: readonly [string, string?]
  meaning?: string
  action?: string
}

type KnowledgeGroup = {
  id: string
  title: string
  entries: readonly KnowledgeEntry[]
}

const message = <Id extends string>(
  id: Id,
  label: string,
  page: number,
  display: KnowledgeEntry['display'],
  meaning: string,
  action: string,
): KnowledgeEntry & { id: Id } => ({ id, label, page, display, meaning, action })

// DTCO 4.1–4.1b, BA00.1381.41 100 116, české vydání 4, 2025-03.
const knowledgeBase = {
  messages: [
    {
      id: 'card',
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
      id: 'faults',
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
      id: 'driving',
      title: 'Výstrahy pro dobu řízení',
      entries: [
        message('break-soon', 'Výstraha po 4 h 15 min řízení', 119, ['(35)(2)1 pauza!', '1(2)04h15 (10)00h15'],
          'Tachograf upozorňuje na blížící se mez nepřerušené doby řízení.', 'Potvrďte hlášení a naplánujte přestávku.'),
        message('break-now', 'Výstraha po 4 h 30 min řízení', 119, ['(35)(2)1 pauza!', '1(2)04h30 (10)00h15'],
          'Tachograf zaznamenal 4 h 30 min nepřerušené doby řízení.', 'Potvrďte hlášení, bezpečně zastavte a čerpejte přestávku.'),
      ],
    },
    {
      id: 'notices',
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
} as const satisfies { messages: readonly KnowledgeGroup[] }

type GroupId = (typeof knowledgeBase.messages)[number]['id']
type MessageId = (typeof knowledgeBase.messages)[number]['entries'][number]['id']

export type KnowledgeLocale = {
  groups: Record<GroupId, string>
  messages: Record<MessageId, [
    label: string, display: NonNullable<KnowledgeEntry['display']>, meaning: string, action: string,
  ]>
}

function localizedKnowledge(section: KnowledgeSection, language: SupportedLanguage): readonly KnowledgeGroup[] {
  if (section === 'pictograms') return getPictogramGroups(language)
  if (language === 'cs') return knowledgeBase.messages

  const locale = knowledgeBaseLocales[language]
  return knowledgeBase.messages.map(group => ({
    ...group,
    title: locale.groups[group.id],
    entries: group.entries.map(entry => {
      const [label, display, meaning, action] = locale.messages[entry.id]
      return { ...entry, label, display, meaning, action }
    }),
  }))
}

function searchKey(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function searchKnowledge(section: KnowledgeSection, query: string, language: SupportedLanguage) {
  const terms = searchKey(query).split(/\s+/).filter(Boolean)
  return localizedKnowledge(section, language).map(group => ({
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
