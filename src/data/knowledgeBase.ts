import type { SupportedLanguage } from '../translations/types'
import { getMessageGroups } from './knowledgeBaseMessages'
import { getPictogramGroups } from './knowledgeBasePictograms'

export type KnowledgeSection = 'pictograms' | 'messages'

export type KnowledgeEntry = {
  id: string
  label: string
  symbol?: string
  pictogram?: string
  page?: number
  display?: readonly string[]
  meaning?: string
  action?: string
}

type KnowledgeGroup = {
  id: string
  title: string
  entries: readonly KnowledgeEntry[]
}

function localizedKnowledge(section: KnowledgeSection, language: SupportedLanguage): readonly KnowledgeGroup[] {
  return section === 'pictograms' ? getPictogramGroups(language) : getMessageGroups(language)
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
