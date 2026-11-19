import { useId, useRef, useState } from 'react'
import type { SymbolMap } from './TachoTypes'
import type { SupportedLanguage } from './translations/types'
import messageSymbols from './assets/dtco-message-symbols.svg'
import { searchKnowledge, type KnowledgeSection } from './data/knowledgeBase'
import pictogramAtlas from './assets/dtco-manual-pictograms.svg'
import './knowledgeBase.css'

const labels = {
  cs: {
    title: 'Znalostní báze', pictograms: 'Piktogramy', messages: 'Hlášení displeje',
    close: 'Zavřít', search: 'Hledat v přehledu', empty: 'Žádná shoda.', action: 'Co udělat',
    source: 'DTCO 4.1–4.1b · český návod, vydání 4',
  },
  en: {
    title: 'Knowledge base', pictograms: 'Pictograms', messages: 'Display messages',
    close: 'Close', search: 'Search the knowledge base', empty: 'No matches.', action: 'What to do',
    source: 'DTCO 4.1–4.1b · Czech manual, edition 4',
  },
  ru: {
    title: 'База знаний', pictograms: 'Пиктограммы', messages: 'Сообщения дисплея',
    close: 'Закрыть', search: 'Поиск по базе знаний', empty: 'Совпадений нет.', action: 'Что делать',
    source: 'DTCO 4.1–4.1b · руководство на чешском, издание 4',
  },
}

const sections = ['pictograms', 'messages'] as const
function renderSymbols(text: string) {
  return text.split(/([\uE000-\uF8FF])/u).map((part, index) => {
    if (!/^[\uE000-\uF8FF]$/u.test(part)) return part
    return <svg key={index} className="kb-message-icon" aria-hidden="true"><use href={`${messageSymbols}#g${part.charCodeAt(0).toString(16)}`} /></svg>
  })
}

export function KnowledgeBase({ language }: {
  language: SupportedLanguage
  symbolMap: SymbolMap | null
}) {
  const copy = labels[language]
  const dialog = useRef<HTMLDialogElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const title = useId()
  const [section, setSection] = useState<KnowledgeSection>('pictograms')
  const [query, setQuery] = useState('')
  const groups = searchKnowledge(section, query, language)

  function selectSection(next: KnowledgeSection) {
    setSection(next)
    setQuery('')
    if (results.current) results.current.scrollTop = 0
  }

  function openSection(next: KnowledgeSection) {
    selectSection(next)
    dialog.current?.showModal()
  }


  return (
    <section className="kb-launcher" lang={language} aria-label={copy.title}>
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
          </header>
          <div className="kb-results" ref={results} tabIndex={0}>
            {!groups.length && <p role="status">{copy.empty}</p>}
            {section === 'pictograms' ? (
              <div>
                <p className="kb-reference-source">{copy.source}</p>
                {groups.map(group => (
                  <table key={group.id} className="kb-reference">
                    <caption>{group.title}</caption>
                    <tbody>
                      {group.entries.map(entry => (
                        <tr key={entry.id}>
                          <td className="kb-reference-symbol">
                            {entry.pictogram ? (
                              <svg viewBox="0 0 36 12" aria-hidden="true">
                                <use href={`${pictogramAtlas}#${entry.pictogram}`} />
                              </svg>
                            ) : entry.symbol}
                          </td>
                          <th scope="row">{entry.label}</th>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            ) : (
              <div>
                {groups.map(group => (
                  <section key={group.id} className="kb-group">
                    <h3>{group.title}</h3>
                    <ul>
                      {group.entries.map(entry => (
                        <li key={entry.id}>
                          <div className="kb-display">
                            {entry.display?.map(line => line && <div key={line}>{renderSymbols(line)}</div>)}
                          </div>
                          <div className="kb-description">
                            {entry.label && <strong>{entry.label}</strong>}
                            {entry.meaning && <p>{renderSymbols(entry.meaning)}</p>}
                            {entry.action && <p><b>{copy.action}</b> {renderSymbols(entry.action)}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </dialog>
    </section>
  )
}
