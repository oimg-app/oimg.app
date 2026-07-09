// Phase 05 — CENTER-03: CompareStage compare view with CSS --split var
// Phase 09 — Plan 04: real original/encoded <img> via object URLs (T-9-URL: revoke on cleanup)
import {useEffect, useRef, useState} from 'react'
import {useStore} from '@nanostores/react'
import {setSplit, setZoom, uiAtom} from '@/stores/ui'
import {$selectedFile} from '@/stores/files'
import {fmtBytes} from '@/lib/format'

const CHECKER_BG: React.CSSProperties = {
  background: [
    'linear-gradient(45deg, var(--color-bg-1) 25%, transparent 25%)',
    'linear-gradient(-45deg, var(--color-bg-1) 25%, transparent 25%)',
    'linear-gradient(45deg, transparent 75%, var(--color-bg-1) 75%)',
    'linear-gradient(-45deg, transparent 75%, var(--color-bg-1) 75%)',
  ].join(', '),
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  backgroundColor: 'var(--color-bg-0)',
}

function parseDimRatio(dim: string): string {
  const [w, h] = dim.split('×').map(Number)
  return w > 0 && h > 0 ? `${w} / ${h}` : '4 / 3'
}

// SVG layers render inside a sandboxed <iframe> (sandbox="allow-scripts", no allow-same-origin)
// so script-bearing/untrusted SVG is isolated from the app origin. The iframe src must be a
// real document — a blob: object URL is unreliable here (a sandboxed opaque-origin frame is
// blocked from fetching the parent's blob URL), so encode inline as a data URI.
//
// The iframe body wraps the SVG in an <img> with object-fit: contain so oversize SVGs
// (e.g. 800x800) fit the stage viewport regardless of viewBox or intrinsic dimensions.
// object-fit on the iframe itself has no effect (iframe hosts a separate document).
function svgDataUri(buf: ArrayBuffer): string {
  const text = new TextDecoder('utf-8').decode(buf)
  const svgSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}' +
    'img{display:block;width:100%;height:100%;object-fit:contain}' +
    '</style></head><body><img src="' + svgSrc + '"></body></html>'
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

async function heicDataArr(buf: ArrayBuffer) {
  const { heicDecode } = (await import('@/lib/heic/decode'))

  return await heicDecode(buf)
}

const MIN_SCALE = 0.05
const MAX_SCALE = 8
const WHEEL_FACTOR = 0.001

export function CompareStage() {
  const { split, zoom } = useStore(uiAtom)
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
  const isHeic = selectedFile?.type === 'heic'

  const optTarget = selectedFile?.settings?.codec.toUpperCase()

  const aspectRatio = parseDimRatio(selectedFile?.dim ?? '4×3')

  function applyTransform() {
    if (!frameRef.current) return
    const { x, y, scale } = vs.current
    frameRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }

  // Build object URL for original layer — revoke on cleanup (T-9-URL)
  useEffect(() => {
    if (!selectedFile?.rawBuffer) {
      setOrigSrc(null)
      return
    }
    // SVG → data URI (rendered in a sandboxed iframe); raster → revocable object URL
    if (isSvg) {
      setOrigSrc(svgDataUri(selectedFile.rawBuffer))
      return
    }
    const blob = new Blob([selectedFile.rawBuffer])
    const url = URL.createObjectURL(blob)
    setOrigSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile?.rawBuffer, isSvg])

  useEffect(() => {
    if (!selectedFile?.rawBuffer) {
      setOrigSrc(null)
      return
    }
    // Only the HEIC source path runs here — otherwise this effect would clobber the
    // origSrc set by the SVG/raster effect above (e.g. overwrite the SVG data URI).
    if (!isHeic) return

    if (isHeic) {
      heicDataArr(selectedFile.rawBuffer).then(decoded => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return null
        }

        const imageData = new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height)
        canvas.width = imageData.width;
        canvas.height = imageData.height;

        ctx.putImageData(imageData, 0, 0);

        setOrigSrc(canvas.toDataURL())
      })
    }
    const blob = new Blob([selectedFile.rawBuffer])
    const url = URL.createObjectURL(blob)
    setOrigSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile?.rawBuffer, isHeic])

  // Build object URL for encoded layer — revoke on cleanup (T-9-URL)
  useEffect(() => {
    if (!selectedFile?.encodedBuffer) {
      setEncodedSrc(null)
      return
    }
    // Encoded layer keys on the OUTPUT codec, not the source: SVG output → data URI
    // (sandboxed iframe); any raster codec (PNG/WebP/JPEG/AVIF) → revocable object URL (<img>).
    if (isSvgOutput) {
      setEncodedSrc(svgDataUri(selectedFile.encodedBuffer))
      return
    }
    const blob = new Blob([selectedFile.encodedBuffer])
    const url = URL.createObjectURL(blob)
    setEncodedSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile?.encodedBuffer, isSvgOutput])

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
      className="flex-1 min-h-0 overflow-hidden flex items-center justify-center"
      style={CHECKER_BG}
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
              className="absolute inset-0 w-full h-full border-0 pointer-events-none"
              style={{ clipPath: 'inset(0 calc(100% - var(--split)) 0 0)' }}
            />
          ) : (
            <img
              src={origSrc}
              alt="Original"
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
            className="absolute inset-0 bg-[var(--color-bg-2)]"
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
              className="absolute inset-0 w-full h-full border-0 pointer-events-none"
              style={{ clipPath: 'inset(0 0 0 var(--split))' }}
            />
          ) : (
            <img
              src={encodedSrc}
              alt="Optimized"
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
            className="absolute inset-0 bg-[var(--color-bg-3)]"
            style={{ clipPath: 'inset(0 0 0 var(--split))' }}
          />
        )}

        {/* split-handle */}
        <div
          className="absolute top-0 bottom-0 w-[1px] cursor-col-resize bg-[var(--color-accent)]"
          style={{ left: 'var(--split)', transform: 'translateX(-0.5px)' }}
          onMouseDown={handleSplitMouseDown}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-[var(--color-accent)] flex items-center justify-center">
            <span className="font-mono text-[11px] font-semibold text-[var(--color-accent-fg)] pointer-events-none select-none">
              ⇆
            </span>
          </div>
        </div>

        {/* split label left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-[4px] font-mono text-[11px] font-semibold text-[var(--color-fg-0)] bg-[var(--color-bg-0)]/70 backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[var(--color-fg-3)] shrink-0" />
          ORIGINAL · {fmtBytes(selectedFile?.orig ?? null)}
        </div>

        {/* split label right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-[4px] font-mono text-[11px] font-semibold text-[var(--color-fg-0)] bg-[var(--color-bg-0)]/70 backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
          {optTarget ?? '—'} · {fmtBytes(selectedFile?.opt ?? null)}
        </div>
      </div>
    </div>
  )
}
