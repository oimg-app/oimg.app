import { useState, useRef, useEffect } from 'react'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { fmtBytes, fmtPct } from '@/lib/format'
import { useFilesStore } from '@/stores'

interface CenterPaneProps {
  open: string | null
  setOpen: (v: string | null) => void
}

export function CenterPane({ open, setOpen }: CenterPaneProps) {
  const [split, setSplit] = useState(50)
  const [zoom, setZoom] = useState('Fit')
  const stageRef = useRef<HTMLDivElement | null>(null)

  const zoomSize = zoom === 'Fit' ? 'contain' : zoom

  const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)

  const [previewUrls, setPreviewUrls] = useState<{ orig: string | null; opt: string | null }>({ orig: null, opt: null })
  useEffect(() => {
    if (!selectedEntry) { setPreviewUrls({ orig: null, opt: null }); return }
    const origUrl = URL.createObjectURL(selectedEntry.sourceBlob)
    const optUrl = selectedEntry.optimizedBlob ? URL.createObjectURL(selectedEntry.optimizedBlob) : null
    setPreviewUrls({ orig: origUrl, opt: optUrl })
    return () => { URL.revokeObjectURL(origUrl); if (optUrl) URL.revokeObjectURL(optUrl) }
  }, [selectedEntry?.id, selectedEntry?.sourceBlob, selectedEntry?.optimizedBlob])

  const onSplitDrag = () => {
    const rect = stageRef.current?.querySelector<HTMLDivElement>('.image-frame')?.getBoundingClientRect()
    if (!rect) return
    const move = (ev: MouseEvent) => setSplit(Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100)))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const isPopOpen = (key: string) => open === key
  const togglePop = (key: string) => setOpen(open === key ? null : key)

  // Real data from FileEntry
  const name = selectedEntry?.name ?? '—'
  const format = selectedEntry?.format ?? '—'
  const origSize = selectedEntry?.sourceBlob.size ?? 0
  const optSize = selectedEntry?.optimizedBlob?.size ?? origSize
  const isDone = selectedEntry?.status === 'done' && selectedEntry?.optimizedBlob != null

  return (
    <div className="pane center">
      <div className="center-head">
        <div className="crumbs">
          <span>Queue</span><span className="sep">/</span><span className="cur">{name}</span>
          <span className="file-tag">{format.toUpperCase()}</span>
        </div>
        <div className="right">
          {isDone
            ? <span className="pill acc"><Icons.Check size={10} /> Optimized</span>
            : selectedEntry
              ? <span className="pill">{selectedEntry.status}</span>
              : null}
          <button className={'tbtn ghost' + (isPopOpen('zoom') ? ' open' : '')} style={{ height: 24, padding: '0 8px', position: 'relative' }} onClick={() => togglePop('zoom')}>
            <Icons.Eye size={12} /> {zoom} <Icons.ChevronDown size={9} />
            <Popover open={isPopOpen('zoom')} onClose={() => setOpen(null)} anchor="br">
              {['25%', '50%', '100%', '200%', 'Fit'].map((z) => (
                <div key={z} className={'pi check' + (z === zoom ? ' on' : '')} onClick={() => { setZoom(z); setOpen(null) }}><span>{z}</span></div>
              ))}
            </Popover>
          </button>
        </div>
      </div>
      <div className="compare" ref={stageRef}>
        <div className="compare-stage">
          <div className="image-frame" style={{ ['--split' as string]: split + '%' } as React.CSSProperties}>
            <div className="image-layer layer-orig" style={previewUrls.orig ? { background: `transparent url("${previewUrls.orig}") center/${zoomSize} no-repeat` } : undefined} />
            <div className="image-layer layer-opt" style={previewUrls.opt || previewUrls.orig ? { background: `transparent url("${previewUrls.opt ?? previewUrls.orig}") center/${zoomSize} no-repeat` } : undefined} />
            <div className="split-tag l"><span className="dot" />ORIGINAL · {fmtBytes(origSize)}</div>
            <div className="split-tag r"><span className="dot" />{format.toUpperCase()} · {fmtBytes(optSize)}</div>
            <div className="split-handle" role="slider" aria-label="Compare split position" aria-valuemin={2} aria-valuemax={98} aria-valuenow={Math.round(split)} tabIndex={0} style={{ left: split + '%' }}
              onMouseDown={(e) => { e.preventDefault(); onSplitDrag() }}
              onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit((s) => Math.max(2, s - 5)); if (e.key === 'ArrowRight') setSplit((s) => Math.min(98, s + 5)); if (e.key === 'Home') setSplit(2); if (e.key === 'End') setSplit(98) }}
            />
          </div>
        </div>
        <div className="delta-strip">
          <div className="delta"><span className="l">Original</span><span className="v">{fmtBytes(origSize)}</span><span className="sub">{format.toUpperCase()}</span></div>
          <div className="delta"><span className="l">Optimized</span><span className="v">{fmtBytes(optSize)}</span><span className="sub">{selectedEntry ? format.toUpperCase() : '—'}</span></div>
          <div className="delta savings"><span className="l">Saved</span><span className="v">−{fmtBytes(Math.max(0, origSize - optSize))}</span><span className="sub">{origSize > 0 ? fmtPct(origSize, optSize) + ' smaller' : '—'}</span></div>
        </div>
      </div>
    </div>
  )
}
