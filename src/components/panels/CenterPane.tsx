import {useEffect, useRef, useState, CSSProperties} from 'react'
import {Icons} from '@/components/icons'
import {Popover} from '@/components/ui/Popover'
import {fmtBytes, fmtPct} from '@/lib/format'
import {useFilesStore} from '@/stores'

interface ImageFrameProps {
    zoom: string
    split: number
    origUrl: string | null
    origSize: number
    origParams: string
    optUrl: string | null
    optSize: number
    optParams: string
    format: string
    onSplitDrag: () => void
    onSplit: (v: number) => void
}

function ImageFrame(props: ImageFrameProps) {
    const {zoom, split, origSize, optSize, origUrl, optUrl, origParams, optParams, format, onSplit, onSplitDrag} = props

    const frameStyle = (): CSSProperties => {
        if (zoom === 'Fit') return {width: 'min(78%, 96%)', maxWidth: 'min(78%, 96%)'}
        const w = zoom === '25%' ? '25%' : zoom === '50%' ? '50%' : zoom === '100%' ? 'calc(100% - 32px)' : '160%'
        return {width: w, maxWidth: w}
    }

    return (
        <div className="image-frame"
             style={{['--split' as string]: split + '%', ...frameStyle()} as CSSProperties}>
            <div className="image-layer layer-orig"
                 style={origUrl ? {background: `transparent url("${origUrl}") center/contain no-repeat`} : undefined}/>
            <div className="image-layer layer-opt"
                 style={optUrl || origUrl ? {background: `transparent url("${optUrl ?? origUrl}") center/contain no-repeat`} : undefined}/>

            <div className="orig-tag">{origParams}</div>
            <div className="opt-tag">{optParams}</div>
            <div className="split-tag l"><span className="dot"/>ORIGINAL · {fmtBytes(origSize)}</div>
            <div className="split-tag r"><span className="dot"/>{format.toUpperCase()} · {fmtBytes(optSize)}</div>
            <div className="split-handle" role="slider" aria-label="Compare split position" aria-valuemin={2}
                 aria-valuemax={98} aria-valuenow={Math.round(split)} tabIndex={0} style={{left: split + '%'}}
                 onMouseDown={(e) => {
                     e.preventDefault();
                     onSplitDrag()
                 }}
                 onKeyDown={(e) => {
                     if (e.key === 'ArrowLeft') onSplit(Math.max(2, split - 5));
                     if (e.key === 'ArrowRight') onSplit(Math.min(98, split + 5));
                     if (e.key === 'Home') onSplit(2);
                     if (e.key === 'End') onSplit(98)
                 }}
            />
        </div>
    )
}

const CenterBreadcrumbs = ({name, format}: { name: string, format: string }) => {
    return (
        <div className="crumbs">
            <span>Queue</span><span className="sep">/</span><span className="cur">{name}</span>
            <span className="file-tag">{format.toUpperCase()}</span>
        </div>
    )
}

type CenterDeltaProps = {
    origSize: number
    optSize: number
    format: string
    isSelected: boolean
}

const CenterDelta = (props: CenterDeltaProps) => {
    const {origSize, optSize, format, isSelected } = props

    return (
        <div className="delta-strip">
            <div className="delta"><span className="l">Original</span><span
                className="v">{fmtBytes(origSize)}</span><span className="sub">{format.toUpperCase()}</span>
            </div>
            <div className="delta"><span className="l">Optimized</span><span
                className="v">{fmtBytes(optSize)}</span><span
                className="sub">{isSelected ? format.toUpperCase() : '—'}</span></div>
            <div className="delta savings"><span className="l">Saved</span><span
                className="v">−{fmtBytes(Math.max(0, origSize - optSize))}</span><span
                className="sub">{origSize > 0 ? fmtPct(origSize, optSize) + ' smaller' : '—'}</span></div>
        </div>
    )
}

type ZoomControlsProps = {
    zoom: string
    onZoom: (v: string) => void
}

const ZoomControls = (props: ZoomControlsProps) => {
    const { zoom, onZoom } = props
    const [open, setOpen] = useState<string | null>(null)
    const isPopOpen = (key: string) => open === key
    const togglePop = (key: string) => setOpen(open === key ? null : key)
    const zoomLevels = ['25%', '50%', '100%', '200%', 'Fit']

    return (
        <button className={'tbtn ghost' + (isPopOpen('zoom') ? ' open' : '')}
                style={{height: 24, padding: '0 8px', position: 'relative'}}
                onClick={() => togglePop('zoom')}>
            <Icons.Eye size={12}/> {zoom} <Icons.ChevronDown size={9}/>
            <Popover open={isPopOpen('zoom')} onClose={() => setOpen(null)} anchor="br">
                {zoomLevels.map((z) => (
                    <div key={z} className={'pi check' + (z === zoom ? ' on' : '')} onClick={() => {
                        onZoom(z);
                        setOpen(null)
                    }}><span>{z}</span></div>
                ))}
            </Popover>
        </button>
    )
}

const OptimizeStatus = () => {
    const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)
    const isDone = selectedEntry?.status === 'done' && selectedEntry?.optimizedBlob != null

    return isDone
        ? <span className="pill acc"><Icons.Check size={10}/> Optimized</span>
        : selectedEntry
            ? <span className="pill">{selectedEntry.status}</span>
            : null
}

export function CenterPane() {
    const [split, setSplit] = useState(50)
    const [zoom, setZoom] = useState('Fit')
    const stageRef = useRef<HTMLDivElement | null>(null)

    const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)

    const [previewUrls, setPreviewUrls] = useState<{ orig: string | null; opt: string | null }>({orig: null, opt: null})

    useEffect(() => {
        if (!selectedEntry) {
            setPreviewUrls({orig: null, opt: null});
            return
        }
        const origUrl = URL.createObjectURL(selectedEntry.sourceBlob)
        const optUrl = selectedEntry.optimizedBlob ? URL.createObjectURL(selectedEntry.optimizedBlob) : null
        setPreviewUrls({orig: origUrl, opt: optUrl})
        return () => {
            URL.revokeObjectURL(origUrl);
            if (optUrl) URL.revokeObjectURL(optUrl)
        }
    }, [selectedEntry?.id, selectedEntry?.sourceBlob, selectedEntry?.optimizedBlob])

    const onSplitDrag = () => {
        const rect = stageRef.current?.querySelector<HTMLDivElement>('.image-frame')?.getBoundingClientRect()
        if (!rect) return
        const move = (ev: MouseEvent) => setSplit(Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100)))
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    // Real data from FileEntry
    const name = selectedEntry?.name ?? '—'
    const format = selectedEntry?.format ?? '—'
    const origSize = selectedEntry?.sourceBlob.size ?? 0
    const origProfile = selectedEntry?.sourceMeta.profile
    const origRes = [selectedEntry?.sourceMeta.width, selectedEntry?.sourceMeta.height].filter(Boolean).join(' × ')
    const optSize = selectedEntry?.optimizedBlob?.size ?? origSize
    const optRes = [selectedEntry?.optimizedMeta.width, selectedEntry?.optimizedMeta.height].filter(Boolean).join(' × ')
    const optFormat = selectedEntry?.optimizedMeta.format
    // const isDone = selectedEntry?.status === 'done' && selectedEntry?.optimizedBlob != null

    const origParams = [`ORIGINAL`, origRes, origProfile].filter(Boolean).join(' · ')
    const optParams = [`OPTIMIZED`, optFormat, optRes].filter(Boolean).join(' · ')

    return (
        <div className="pane center">
            <div className="center-head">
                <CenterBreadcrumbs name={name} format={format} />
                <div className="right">
                    <OptimizeStatus />
                    <ZoomControls zoom={zoom} onZoom={setZoom} />
                </div>
            </div>
            <div className="compare" ref={stageRef}>
                <div className="compare-stage">
                    <ImageFrame
                        zoom={zoom}
                        split={split}
                        origSize={origSize}
                        optSize={optSize}
                        origUrl={previewUrls.orig}
                        optUrl={previewUrls.opt}
                        origParams={origParams}
                        optParams={optParams}
                        format={format}
                        onSplit={setSplit}
                        onSplitDrag={onSplitDrag}
                    />
                </div>
                <CenterDelta
                    origSize={origSize}
                    optSize={optSize}
                    format={format}
                    isSelected={!!selectedEntry}
                />
            </div>
        </div>
    )
}
