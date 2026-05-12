// Phase 10 plan 10-03 — FilePanel extracts the left-pane queue from App.tsx.
// App.tsx cleanup (removing duplicate left-pane JSX and wiring FilePanel) is
// done in Plan 10-05. Do NOT modify App.tsx in this plan.

import { useState, useMemo } from 'react'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { ContextMenu } from '@/components/file-row/ContextMenu'
import { useFilesStore } from '@/stores'
import { useFilePicker } from '@/hooks/useFilePicker'
import { fmtBytes, fmtPct } from '@/lib/format'
import type { MockFile } from '@/types'

// SVG · PNG · JPEG · WEBP · AVIF · JXL
const SUPPORTED_FORMATS = ['svg', 'png', 'jpeg', 'webp', 'avif', 'jxl']

function FilesDropzone() {
  // D-03: file picker hook owns fileInputRef + drag/drop handlers.
  const { fileInputRef, handleFilePick, handleDrop, handleDragOver, handleDragLeave, handleFileInputChange } =
      useFilePicker()

  return (
      <>
        {/* Hidden file picker — opened by "Add files" button or dropzone click.
          Value reset after change so re-picking the same file fires onChange. */}
        <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/svg+xml,image/jpeg,image/webp,image/avif,.png,.svg,.jpg,.jpeg,.webp,.avif"
            style={{display: 'none'}}
            onChange={(e) => {
              const files = e.target.files
              if (files) handleFileInputChange(files)
              e.target.value = ''
            }}
        />
        <div
            className="dropzone"
            role="button"
            tabIndex={0}
            aria-label="Drop or click to add images"
            style={{cursor: 'pointer'}}
            onClick={handleFilePick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleFilePick()
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
          <span className="big">Drop images to optimize</span>
          <span>or click to browse · max 200 files</span>
          <div className="formats">{SUPPORTED_FORMATS.map(n => n.toUpperCase()).join(' · ')}</div>
        </div>
      </>

  )
}

function AddFilesPlusButton() {
  // D-03: file picker hook owns fileInputRef + drag/drop handlers.
  const { fileInputRef, handleFilePick, handleFileInputChange } =
      useFilePicker()

  return (
      <>
        <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/svg+xml,image/jpeg,image/webp,image/avif,.png,.svg,.jpg,.jpeg,.webp,.avif"
            style={{display: 'none'}}
            onChange={(e) => {
              const files = e.target.files
              if (files) handleFileInputChange(files)
              e.target.value = ''
            }}
        />
        <button
            className="iconbtn"
            title="Add files from device"
            onClick={handleFilePick}
        >
          <Icons.Plus size={12}/>
        </button>
      </>

  )
}

function SortFilesButton() {
  const [sortBy, setSortBy] = useState<string>('queue order')
  const [open, setOpen] = useState<string | null>(null)
  const isPopOpen = (key: string) => open === key
  const togglePop = (key: string) => setOpen(open === key ? null : key)
  const filesState = useFilesStore()
  const onSort = (s: string) => {
    setSortBy(s)
    filesState.setSort(s)
  }


  return (
      <>
        <button
            className={'iconbtn' + (isPopOpen('sort') ? ' on' : '')}
            onClick={() => togglePop('sort')}
            title="Sort"
        >
          <Icons.Filter size={12}/>
        </button>
        <Popover open={isPopOpen('sort')} onClose={() => setOpen(null)} anchor="br" style={{minWidth: 200}}>
          <div className="lbl">Sort by</div>
          {['queue order', 'file size', 'savings %', 'name', 'format'].map((s) => (
              <div
                  key={s}
                  className={'pi check' + (sortBy === s ? ' on' : '')}
                  onClick={() => {
                    onSort(s);
                    setOpen(null)
                  }}
              >
                <span>{s}</span>
              </div>
          ))}
        </Popover>
      </>
  )
}

type FileRowProps = {
  file: MockFile
  selectedId: string | null
  onSelect: (id: string) => void
}

const FileRow = (props: FileRowProps) => {
    const {file, selectedId, onSelect} = props

    const f = file

    const sanitizedStatus = (() => {
        const n = f?.sanitizedCount

        if (n === undefined || n <= 0) return null

        return (
            <span
                className="pill warn sm"
                aria-label={`${n} element${n === 1 ? '' : 's'} removed by sanitizer`}
                title={`${n} dangerous element${n === 1 ? '' : 's'} removed by DOMPurify`}
                style={{marginLeft: 2}}
            >sanitized · {n}</span>
        )
    })()

    const name = <div className="file-name">{f.name}</div>

    const stats = (
        <div className="file-stat">
            <span>{fmtBytes(f.orig)}</span>
            <span className="arrow">→</span>
            <span>{fmtBytes(f.opt)}</span>
            <span className={'save' + (((f.orig - f.opt) / f.orig) < 0.3 ? ' warn' : '')}>
                    {fmtPct(f.orig, f.opt)}
                  </span>
            {/* Phase 3 (D-03) — sanitized badge: DOMPurify removed N
                      dangerous elements/attrs. Reads FileEntry.sanitizedCount
                      directly from filesById (MockFile view-model doesn't carry it). */}
            {sanitizedStatus}
        </div>
    )

    const processing = f.status === 'processing' ? <div className="progbar">
        <div/>
    </div> : null

    return (
        <div
            key={f.id}
            id={`file-${f.id}`}
            role="option"
            aria-selected={selectedId === f.id}
            tabIndex={selectedId === f.id ? 0 : -1}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(f.id)
                }
            }}
            className={
                'file-row' +
                (selectedId === f.id ? ' selected' : '')
            }
            onClick={() => onSelect(f.id)}
            onContextMenu={(e) => {
                e.preventDefault()
                onSelect(f.id)
            }}
            style={{position: 'relative'}}
        >
            <div className={'thumb ' + f.type}>{f.type.toUpperCase().slice(0, 3)}</div>
            <div className="file-meta">
                {name}
                {stats}
                {processing}
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <ContextMenu file={f}/>
                <div className={'file-status ' + f.status} title={f.status}/>
            </div>
        </div>
    )
}

interface FilePanelProps {
    selectedId: string | null
  onSelect: (id: string) => void
  onOptimize: () => void
  onCancel: () => void
}

export function FilesPane({selectedId, onSelect, onOptimize: _onOptimize, onCancel: _onCancel}: FilePanelProps) {
  const [filterQuery, _setFilterQuery] = useState<string>('')
  // Narrow store selectors — one per field to minimise re-renders.
  const filesById = useFilesStore((s) => s.byId)
  const filesOrder = useFilesStore((s) => s.order)

  // Derive a MockFile array from the store. Status maps from FileEntry's wider
  // FileStatus to the narrower visual MockFile status set ('idle' → 'queued').
  // WR-02: flatMap + early-bail drops stale ids defensively (concurrent React 19
  // render may see an id in `order` whose entry is gone from `byId`).
  const SHELL_FILES: MockFile[] = useMemo(() => {
    const fmtToType = (fmt: string): MockFile['type'] =>
        fmt === 'jpeg' ? 'jpg' : (fmt as MockFile['type'])

    return filesOrder.flatMap((id) => {
      const entry = filesById[id]
      if (!entry) return []
      const status: MockFile['status'] =
          entry.status === 'idle' ? 'queued' : (entry.status as MockFile['status'])

      return [{
        id: entry.id,
        name: entry.name,
        type: fmtToType(entry.format),
        orig: entry.originalSize,
        opt: entry.optimizedSize ?? entry.originalSize,
        status,
        target: fmtToType(entry.format),
        dim: '—',
        q: null,
          sanitizedCount: entry.sanitizedCount
      }]
    })
  }, [filesById, filesOrder])

  const filteredFiles = useMemo(() => {
    const fq = filterQuery.trim().toLowerCase()
    if (!fq) return SHELL_FILES
    return SHELL_FILES.filter((f) => f.name.toLowerCase().includes(fq))
  }, [SHELL_FILES, filterQuery])

  return (
      <div className="pane">
        <div className="pane-hd">
          <span>Queue · {filteredFiles.length} files</span>
          <div className="actions" style={{position: 'relative'}}>
            <SortFilesButton/>
            <AddFilesPlusButton/>
          </div>
        </div>

        <FilesDropzone />

        <div className="pane-body" style={{borderTop: '1px solid var(--line)'}}>
          <div
              className="filelist"
              role="listbox"
              aria-label="Files"
              aria-activedescendant={selectedId ? `file-${selectedId}` : undefined}
          >
            {filteredFiles.map((f) => (
                <FileRow
                    key={f.id}
                    file={f}
                    selectedId={selectedId}
                    onSelect={onSelect}
                />
          ))}
        </div>
      </div>
    </div>
  )
}

