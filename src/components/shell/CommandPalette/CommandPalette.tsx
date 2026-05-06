// CommandPalette — ⌘K dialog.
// Extracted from src/App.tsx (lines 35–44 type decls + 747–807 JSX) in
// plan 01-04. Owns its own input value (cmdkQ) and selection cursor (cmdkSel)
// — these were App.tsx local state that belongs internally.
// Quick task 260505-0hr — Task 7: classes migrated to commandPalette.module.css.
// `.kbd` and `.lbl` inside the palette stay on global classNames (matched by
// `:global()` descendant selectors in the module) until those primitives'
// own consumers migrate. The exported `CmdItem` / `CmdGroup` types stay so
// App.tsx can still `import type { CmdGroup }` from this path.

import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Icons } from '@/components/icons'
import s from './commandPalette.module.css'

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
    <div className={s.cmdkBack} onMouseDown={() => onOpenChange(false)}>
      <div className={s.cmdk} onMouseDown={(e) => e.stopPropagation()}>
        <div className={s.cmdkInput}>
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
        <div className={s.cmdkList}>
          {flat.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              No results
            </div>
          )}
          {flat.map((it, i) => (
            <div
              key={i}
              className={clsx(s.cmdkItem, i === sel && s.sel)}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                it.do?.()
                onOpenChange(false)
              }}
            >
              <span className={s.ic}>{it.ic}</span>
              <span>{it.label}</span>
              <span className={s.meta}>{it.group}{it.meta ? ' · ' + it.meta : ''}</span>
            </div>
          ))}
        </div>
        <div className={s.cmdkFoot}>
          <span><span className="kbd">↑↓</span>navigate</span>
          <span><span className="kbd">↵</span>run</span>
          <span><span className="kbd">esc</span>close</span>
          <span style={{ marginLeft: 'auto' }}>{flat.length} commands</span>
        </div>
      </div>
    </div>
  )
}
