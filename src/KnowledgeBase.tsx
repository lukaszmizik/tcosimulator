import { useId, useRef, useState } from 'react'
import type { SymbolMap } from './TachoTypes'
import type { SupportedLanguage } from './translations/types'
import { parseSymbols } from './Symbols'
import { searchKnowledge, type KnowledgeSection } from './data/knowledgeBase'
import './knowledgeBase.css'

const labels = {
  cs: {
    title: 'Znalostní báze', pictograms: 'Piktogramy', messages: 'Hlášení displeje',
    close: 'Zavřít', search: 'Hledat v přehledu', empty: 'Žádná shoda.',
    source: 'Český návod DTCO 4.1–4.1b · vydání 4 · březen 2025',
  },
  en: {
    title: 'Knowledge base', pictograms: 'Pictograms', messages: 'Display messages',
    close: 'Close', search: 'Search the Czech reference', empty: 'No matches.',
    source: 'Czech DTCO 4.1–4.1b manual · edition 4 · March 2025',
  },
  ru: {
    title: 'База знаний', pictograms: 'Пиктограммы', messages: 'Сообщения дисплея',
    close: 'Закрыть', search: 'Поиск по справочнику на чешском', empty: 'Совпадений нет.',
    source: 'Руководство DTCO 4.1–4.1b на чешском · издание 4 · март 2025',
  },
}

const sections = ['pictograms', 'messages'] as const
const stripSymbolIds = (text: string) => text.replace(/\(\d+\)/g, '').trimStart()

export function KnowledgeBase({ language, symbolMap }: {
  language: SupportedLanguage
  symbolMap: SymbolMap | null
}) {
  const copy = labels[language]
  const dialog = useRef<HTMLDialogElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const title = useId()
  const [section, setSection] = useState<KnowledgeSection>('pictograms')
  const [query, setQuery] = useState('')
  const groups = searchKnowledge(section, query)

  function selectSection(next: KnowledgeSection) {
    setSection(next)
    setQuery('')
    if (results.current) results.current.scrollTop = 0
  }

  function openSection(next: KnowledgeSection) {
    selectSection(next)
    dialog.current?.showModal()
  }

  const renderSymbols = (text: string) => (
    symbolMap && Object.keys(symbolMap).length ? parseSymbols(text, symbolMap) : stripSymbolIds(text)
  )

  return (
    <section className="kb-launcher" aria-label={copy.title}>
      <h2>{copy.title}</h2>
      <div className="kb-actions">
        {sections.map(item => (
          <button key={item} type="button" aria-haspopup="dialog" onClick={() => openSection(item)}>
            {copy[item]}
          </button>
        ))}
      </div>

      <dialog ref={dialog} className="kb-dialog" aria-labelledby={title}
        onKeyDown={event => event.stopPropagation()}>
        <div className="kb-dialog-body">
          <header className="kb-header">
            <div className="kb-title-row">
              <h2 id={title}>{copy.title}</h2>
              <button type="button" onClick={() => dialog.current?.close()}>{copy.close}</button>
            </div>
            <div className="kb-actions">
              {sections.map(item => (
                <button key={item} type="button" aria-pressed={item === section}
                  onClick={() => selectSection(item)}>
                  {copy[item]}
                </button>
              ))}
            </div>
            <label className="kb-search">
              {copy.search}
              <input type="search" value={query} onChange={event => {
                setQuery(event.currentTarget.value)
                if (results.current) results.current.scrollTop = 0
              }} />
            </label>
            <p className="kb-source">{copy.source}</p>
          </header>
          <div className="kb-results" ref={results} tabIndex={0}>
            {!groups.length && <p role="status">{copy.empty}</p>}
            <div lang="cs">
              {groups.map(group => (
                <section key={group.title} className="kb-group">
                  <h3>{group.title}</h3>
                  <ul>
                    {group.entries.map(entry => (
                      <li key={entry.id} className={entry.display ? 'kb-message' : 'kb-pictogram'}>
                        <div className={entry.display ? 'kb-display' : 'kb-symbol'}
                          aria-hidden={entry.symbol ? true : undefined}>
                          {entry.symbol && renderSymbols(entry.symbol)}
                          {entry.display?.map(line => line && <div key={line}>{renderSymbols(line)}</div>)}
                        </div>
                        <div className="kb-description">
                          <strong>{entry.label}</strong>
                          {entry.meaning && <p>{entry.meaning}</p>}
                          {entry.action && <p><b>Co udělat</b> {entry.action}</p>}
                        </div>
                        <small className="kb-page">str. {entry.page}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </section>
  )
}
