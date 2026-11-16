import { useRef, type ReactNode } from 'react'

export type CardPrep =
  | { kind: 'virtual'; templateId: 'zmizik' | 'novak' }
  | { kind: 'ddd'; cardNumber: string }

/**
 * Jedna nabídka pro přípravu karty. Horní i dolní místo používají tutéž komponentu.
 * Načtená karta tu zůstává, dokud ji uživatel nepřetáhne; šachtu určuje až puštění.
 */
export function CardPrepMenu({
  index,
  prepared,
  error,
  loadDddLabel,
  loadDddTitle,
  loadVirtualLabel,
  title,
  onDddFile,
  onLoadVirtual,
  onRemove,
  children,
}: {
  index: 0 | 1
  prepared: CardPrep | null
  error: string | null
  loadDddLabel: string
  loadDddTitle: string
  loadVirtualLabel: string
  title: string
  onDddFile: (file: File) => void
  onLoadVirtual: () => void
  onRemove: () => void
  children?: ReactNode
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="card-prep"
      data-card-prep={index}
      data-prep-kind={prepared?.kind ?? 'empty'}
      data-prep-template={prepared?.kind === 'virtual' ? prepared.templateId : ''}
      data-prep-card={prepared?.kind === 'ddd' ? prepared.cardNumber : ''}
    >
      <div className="card-prep-title">{title}</div>
      {prepared && (
        <button
          type="button"
          className="card-prep-remove"
          data-prep-remove={index}
          aria-label="Odebrat kartu"
          onClick={onRemove}
        >
          ×
        </button>
      )}
      {prepared ? (
        children
      ) : (
        <div className="card-prep-choices">
          <button
            type="button"
            className="card-prep-choice"
            data-prep-load="ddd"
            title={loadDddTitle}
            onClick={() => fileInputRef.current?.click()}
          >
            {loadDddLabel}
          </button>
          <button
            type="button"
            className="card-prep-choice"
            data-prep-load="virtual"
            onClick={onLoadVirtual}
          >
            {loadVirtualLabel}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ddd,.DDD,.esm,.561"
            className="work-week-file-input-hidden"
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              onDddFile(file)
            }}
          />
        </div>
      )}
      {error && <p className="ddd-load-error" role="alert">{error}</p>}
    </div>
  )
}
