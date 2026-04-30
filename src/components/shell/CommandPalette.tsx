// CommandPalette — ⌘K dialog.
// Extracted from src/App.tsx (lines 35–44 type decls + 747–807 JSX) in
// plan 01-04. Owns its own input value (cmdkQ) and selection cursor (cmdkSel)
// — these were App.tsx local state that belongs internally.
// Visual contract: classNames must NOT change.

import { useEffect, useState, type ReactNode } from 'react'
import { Icons } from '@/components/icons'

export interface CmdItem {
  ic: ReactNode
  label: string
  meta?: string
  do?: () => void
}

export interface CmdGroup {
  group: string
  items: CmdItem[]
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  groups: CmdGroup[]
}

export function CommandPalette({ open, onOpenChange, groups }: CommandPaletteProps) {
  const [query, setQuery] = useState<string>('')
  const [sel, setSel] = useState<number>(0)

  // Reset query/selection whenever the palette is opened.
  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
    }
  }, [open])

  if (!open) return null

  const flat: (CmdItem & { group: string })[] = groups
    .flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })))
    .filter((i) => !query || i.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="cmdk-back" onMouseDown={() => onOpenChange(false)}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <Icons.Search size={14} />
          <input
            autoFocus
            placeholder="Search commands, files, codecs…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSel(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                setSel((s) => Math.min(flat.length - 1, s + 1))
                e.preventDefault()
              }
              if (e.key === 'ArrowUp') {
                setSel((s) => Math.max(0, s - 1))
                e.preventDefault()
              }
              if (e.key === 'Enter') {
                flat[sel]?.do?.()
                onOpenChange(false)
              }
            }}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-list">
          {flat.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              No results
            </div>
          )}
          {flat.map((it, i) => (
            <div
              key={i}
              className={'cmdk-item' + (i === sel ? ' sel' : '')}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                it.do?.()
                onOpenChange(false)
              }}
            >
              <span className="ic">{it.ic}</span>
              <span>{it.label}</span>
              <span className="meta">{it.group}{it.meta ? ' · ' + it.meta : ''}</span>
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↑↓</span>navigate</span>
          <span><span className="kbd">↵</span>run</span>
          <span><span className="kbd">esc</span>close</span>
          <span style={{ marginLeft: 'auto' }}>{flat.length} commands</span>
        </div>
      </div>
    </div>
  )
}
