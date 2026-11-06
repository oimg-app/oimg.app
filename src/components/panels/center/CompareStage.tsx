// Phase 05 — CENTER-03: CompareStage compare view with CSS --split var
// Phase 09 — Plan 04: real original/encoded <img> via object URLs (T-9-URL: revoke on cleanup)
import {useEffect, useRef, useState} from 'react'
import {useStore} from '@nanostores/react'
import {setSplit, setZoom, uiAtom} from '@/stores/ui'
import {$selectedFile} from '@/stores/files'
import {fmtBytes} from '@/lib/format'
import {previewSource} from '@/lib/preview'

// Four selectable stage backgrounds — the swatches in CenterHeader mutate uiAtom.stageBg.
// checker-dark = current default (dark squares on darker base).
// checker-light = light squares on white base.
// black/white   = solid fills for hard-edge previews.
function stageBgStyle(bg: 'checker-dark' | 'checker-light' | 'black' | 'white'): React.CSSProperties {
  // Use the long-form `backgroundImage` — NOT the `background` shorthand — because writing to
  // the shorthand resets sub-properties (backgroundSize/backgroundPosition) to their initial
  // values, and React only re-applies keys that changed between renders. Switching square colors
  // (checker-dark → checker-light) would keep backgroundSize at 'auto' → one giant 100% tile.
  const checker = (square: string, base: string): React.CSSProperties => ({
    backgroundImage: [
      `linear-gradient(45deg, ${square} 25%, transparent 25%)`,
      `linear-gradient(-45deg, ${square} 25%, transparent 25%)`,
      `linear-gradient(45deg, transparent 75%, ${square} 75%)`,
      `linear-gradient(-45deg, transparent 75%, ${square} 75%)`,
    ].join(', '),
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
    backgroundColor: base,
  })
  switch (bg) {
    // Solid fills clear backgroundImage explicitly so switching from a checker mode to a solid
    // fill doesn't leave stale gradients on the element (React does clear removed keys, but
    // being explicit here documents intent + guards against future edits).
    case 'checker-light': return checker('#e5e5e5', '#ffffff')
    case 'black':         return { backgroundImage: 'none', backgroundColor: '#000000' }
    case 'white':         return { backgroundImage: 'none', backgroundColor: '#ffffff' }
    case 'checker-dark':
    default:              return checker('var(--color-bg-1)', 'var(--color-bg-0)')
  }
}

function parseDimRatio(dim: string): string {
  const [w, h] = dim.split('×').map(Number)
  return w > 0 && h > 0 ? `${w} / ${h}` : '4 / 3'
}

const MIN_SCALE = 0.05
const MAX_SCALE = 8
const WHEEL_FACTOR = 0.001

export function CompareStage() {
  const { split, zoom, stageBg } = useStore(uiAtom)
  const selectedFile = useStore($selectedFile)

  // Object URLs for original and encoded image layers (T-9-URL: revoke on cleanup)
  const [origSrc, setOrigSrc] = useState<string | null>(null)
  const [encodedSrc, setEncodedSrc] = useState<string | null>(null)

  // stageRef = the overflow-hidden viewport that captures events
  // frameRef = the image frame; also the CSS transform target and split-drag source
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  // View transform — lives in refs to avoid re-renders during interaction
  const vs         = useRef({ x: 0, y: 0, scale: 1 })
  const dragging   = useRef(false) // split handle drag active
  const panning    = useRef(false) // right-click pan active
  const fromScroll = useRef(false) // scroll originated the zoom change — skip effect reset

  const isFit = zoom === 'fit'
  const isSvg = selectedFile?.type === 'svg'                       // SOURCE is SVG → original layer is an iframe
  const isSvgOutput = selectedFile?.settings?.codec === 'SVG'      // OUTPUT codec is SVG → encoded layer is an iframe (else <img>)

  const optTarget = selectedFile?.settings?.codec.toUpperCase()

  const aspectRatio = parseDimRatio(selectedFile?.dim ?? '4×3')

  function applyTransform() {
    if (!frameRef.current) return
    const { x, y, scale } = vs.current
    frameRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }

  // change:deepen-preview-source — one effect per layer; lib/preview.ts decides data URI vs
  // object URL vs HEIC decode, and the returned revoke() runs on cleanup (T-9-URL). A stale
  // async result (selection changed mid-decode) is revoked instead of applied.
  useEffect(() => {
    const buf = selectedFile?.rawBuffer
    if (!buf) { setOrigSrc(null); return }
    let live = true
    let revoke = () => {}
    previewSource(buf, selectedFile.type).then(
      (p) => { if (live) { revoke = p.revoke; setOrigSrc(p.src) } else p.revoke() },
      () => { if (live) setOrigSrc(null) },
    )
    return () => { live = false; revoke() }
  }, [selectedFile?.rawBuffer, selectedFile?.type])

  // Encoded layer. Quick 260726-3cp: gate on `encodedCodec === settings.codec` — during the
  // 300 ms live-encode debounce `encodedBuffer` still holds the previous codec's bytes while the
  // output layer type has already flipped; rendering them trips <img onError> and leaves a
  // sticky placeholder if the re-encode fails. Any mismatch is "no bytes yet". Legacy entries
  // without encodedCodec (test fixtures) skip the gate.
  useEffect(() => {
    const buf = selectedFile?.encodedBuffer
    const currentCodec = selectedFile?.settings?.codec
    const producedBy = selectedFile?.encodedCodec
    if (!buf || (producedBy && currentCodec && producedBy !== currentCodec)) { setEncodedSrc(null); return }
    let live = true
    let revoke = () => {}
    previewSource(buf, producedBy ?? currentCodec ?? 'png').then(
      (p) => { if (live) { revoke = p.revoke; setEncodedSrc(p.src) } else p.revoke() },
      () => { if (live) setEncodedSrc(null) },
    )
    return () => { live = false; revoke() }
  }, [selectedFile?.encodedBuffer, selectedFile?.encodedCodec, selectedFile?.settings?.codec])

  // Zoom dropdown → reset pan + snap scale. Skip when scroll set the zoom (no-op guard).
  useEffect(() => {
    if (fromScroll.current) { fromScroll.current = false; return }
    vs.current = { x: 0, y: 0, scale: isFit ? 1 : zoom / 100 }
    applyTransform()
  }, [zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-to-zoom — must be non-passive so preventDefault() blocks page scroll
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = stage!.getBoundingClientRect()
      // cursor offset from stage centre (= transform-origin of frameRef)
      const cx = e.clientX - rect.left - rect.width  / 2
      const cy = e.clientY - rect.top  - rect.height / 2

      const oldScale = vs.current.scale
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
        oldScale * (1 - e.deltaY * WHEEL_FACTOR),
      ))
      const ratio = newScale / oldScale

      // Shift offset so the point under the cursor stays fixed
      vs.current.x = cx + (vs.current.x - cx) * ratio
      vs.current.y = cy + (vs.current.y - cy) * ratio
      vs.current.scale = newScale
      applyTransform()
      fromScroll.current = true
      setZoom(Math.round(newScale * 100))
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Split handle drag (left-click on the handle) ─────────────────────────
  function handleSplitMouseDown() {
    if (!frameRef.current) return
    // getBoundingClientRect reflects the scaled visual size — correct for split %
    const rect = frameRef.current.getBoundingClientRect()
    dragging.current = true

    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      setSplit(Math.min(98, Math.max(2, (e.clientX - rect.left) / rect.width * 100)))
    }
    function onUp() {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Right-click viewport pan ─────────────────────────────────────────────
  function handleStageMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 2 || !stageRef.current) return
    e.preventDefault()
    panning.current = true
    stageRef.current.style.cursor = 'grabbing'

    // anchor: mouse position minus current offset = constant during the drag
    const anchorX = e.clientX - vs.current.x
    const anchorY = e.clientY - vs.current.y

    function onMove(ev: MouseEvent) {
      if (!panning.current) return
      vs.current.x = ev.clientX - anchorX
      vs.current.y = ev.clientY - anchorY
      applyTransform()
    }
    function onUp() {
      panning.current = false
      if (stageRef.current) stageRef.current.style.cursor = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={stageRef}
      data-testid="compare-stage"
      className="flex-1 min-h-0 overflow-hidden flex items-center justify-center"
      style={stageBgStyle(stageBg)}
      onMouseDown={handleStageMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/*
        frameRef is both the transform target and the image frame.
        Fixed 640px width for non-fit — CSS scale handles zoom levels.
        transform-origin defaults to centre, matching where flex centres it.
      */}
      <div
        ref={frameRef}
        data-testid="compare-frame"
        className="relative border border-[var(--color-line)] overflow-hidden select-none"
        style={{
          '--split': split + '%',
          width: isFit ? '100%' : '640px',
          aspectRatio,
        } as React.CSSProperties}
      >
        {/* layer-orig — real original image via object URL (SVG via sandboxed iframe) */}
        {origSrc ? (
          isSvg ? (
            <iframe
              src={origSrc}
              title="Original SVG"
              sandbox="allow-scripts"
              scrolling="no"
              data-testid="compare-layer-orig"
              data-kind="svg"
              className="absolute inset-0 w-full h-full border-0 pointer-events-none"
              style={{ clipPath: 'inset(0 calc(100% - var(--split)) 0 0)' }}
            />
          ) : (
            <img
              src={origSrc}
              alt="Original"
              data-testid="compare-layer-orig"
              data-kind="raster"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ clipPath: 'inset(0 calc(100% - var(--split)) 0 0)' }}
              draggable={false}
              // WR-06: a format-mismatched/undecodable buffer would render a broken image; fall back
              // to the placeholder div by clearing the src so the (origSrc ? img : div) branch flips.
              onError={() => setOrigSrc(null)}
            />
          )
        ) : (
          <div
            data-testid="compare-layer-orig"
            data-kind="placeholder"
            className="absolute inset-0 bg-color-bg-2"
            style={{ clipPath: 'inset(0 calc(100% - var(--split)) 0 0)' }}
          />
        )}

        {/* layer-opt — encoded image; SVG output via sandboxed iframe, raster output via <img> */}
        {encodedSrc ? (
          isSvgOutput ? (
            <iframe
              src={encodedSrc}
              title="Optimized SVG"
              sandbox="allow-scripts"
              scrolling="no"
              data-testid="compare-layer-opt"
              data-kind="svg"
              className="absolute inset-0 w-full h-full border-0 pointer-events-none"
              style={{ clipPath: 'inset(0 0 0 var(--split))' }}
            />
          ) : (
            <img
              src={encodedSrc}
              alt="Optimized"
              data-testid="compare-layer-opt"
              data-kind="raster"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ clipPath: 'inset(0 0 0 var(--split))' }}
              draggable={false}
              // WR-06: e.g. an AVIF fallback returning original bytes of another format would render
              // broken; clear the src to drop back to the placeholder div rather than a broken image.
              onError={() => setEncodedSrc(null)}
            />
          )
        ) : (
          <div
            data-testid="compare-layer-opt"
            data-kind="placeholder"
            className="absolute inset-0 bg-color-bg-3"
            style={{ clipPath: 'inset(0 0 0 var(--split))' }}
          />
        )}

        {/* split-handle */}
        <div
          data-testid="compare-split-handle"
          className="absolute top-0 bottom-0 w-[1px] cursor-col-resize bg-color-accent"
          style={{ left: 'var(--split)', transform: 'translateX(-0.5px)' }}
          onMouseDown={handleSplitMouseDown}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-color-accent flex items-center justify-center">
            <span className="font-mono text-xs font-semibold text-[var(--color-accent-fg)] pointer-events-none select-none">
              ⇆
            </span>
          </div>
        </div>

        {/* split label left */}
        <div
          data-testid="compare-label-orig"
          className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-[4px] font-mono text-xs font-semibold text-[var(--color-fg-0)] bg-[var(--color-bg-0)]/70 backdrop-blur-sm pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--color-fg-3)] shrink-0" />
          ORIGINAL · {fmtBytes(selectedFile?.orig ?? null)}
        </div>

        {/* split label right */}
        <div
          data-testid="compare-label-opt"
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-[4px] font-mono text-xs font-semibold text-[var(--color-fg-0)] bg-[var(--color-bg-0)]/70 backdrop-blur-sm pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-color-accent shrink-0" />
          {optTarget ?? '—'} · {fmtBytes(selectedFile?.opt ?? null)}
        </div>
      </div>
    </div>
  )
}
