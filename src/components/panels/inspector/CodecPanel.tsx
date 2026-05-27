import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { filesAtom, $selectedFile, setFileSettings } from '@/stores/files'
import {
  settingsAtom,
  CODECS,
  RESIZE_ALGS,
  FIT_MODES,
  setCodec,
  setQuality,
  setMethod,
  setLossless,
  setResizeOn,
  setResizeDimensions,
  setFit,
  setAlg,
} from '@/stores/settings'
import type { Codec } from '@/stores/settings'
import type { FileSettings } from '@/stores/files'
import { useLiveEncode } from '@/hooks/useLiveEncode'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Section } from './Section'
import { SegControl } from './SegControl'
import { SvgoPanel } from './SvgoPanel'

const CODEC_ENGINE: Record<string, string> = {
  AVIF: 'libavif',
  WebP: 'libwebp',
  JPEG: 'mozjpeg',
  PNG: 'oxipng',
  SVG: 'svgo',
}

export function CodecPanel() {
  const globalSettings = useStore(settingsAtom)
  const selectedFile = useStore($selectedFile)
  const { trigger } = useLiveEncode()

  // D-03: read per-file settings when a file is selected; fall back to global defaults
  const settings: FileSettings & { codec: Codec } = (selectedFile?.settings ?? globalSettings) as FileSettings & { codec: Codec }

  const isSvgFile = selectedFile?.type === 'svg'
  const availableCodecs = isSvgFile ? CODECS : CODECS.filter(c => c !== 'SVG')
  const isSvg = settings.codec === 'SVG'
  const isPng = settings.codec === 'PNG'
  const isJpeg = settings.codec === 'JPEG'

  // Auto-switch away from SVG codec when a non-SVG file is selected
  useEffect(() => {
    if (!isSvgFile && settingsAtom.get().codec === 'SVG') {
      setCodec('WebP')
    }
  }, [isSvgFile])

  // Helper: per-file setter when file selected, global setter when not
  function handleSetCodec(v: Codec) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'codec', v)
      trigger(selectedFile.id)
    } else {
      setCodec(v)
    }
  }

  function handleSetQuality(v: number) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'q', v)
      trigger(selectedFile.id)
    } else {
      setQuality(v)
    }
  }

  function handleSetMethod(v: number) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'method', v)
      trigger(selectedFile.id)
    } else {
      setMethod(v)
    }
  }

  function handleSetLossless(v: boolean) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'lossless', v)
      trigger(selectedFile.id)
    } else {
      setLossless(v)
    }
  }

  function handleSetResizeOn(v: boolean) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'resizeOn', v)
      trigger(selectedFile.id)
    } else {
      setResizeOn(v)
    }
  }

  function handleSetResizeDimensions(w: string, h: string) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'w', w)
      setFileSettings(selectedFile.id, 'h', h)
      trigger(selectedFile.id)
    } else {
      setResizeDimensions(w, h)
    }
  }

  function handleSetFit(v: string) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'fit', v)
      trigger(selectedFile.id)
    } else {
      setFit(v)
    }
  }

  function handleSetAlg(v: string) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'alg', v)
      trigger(selectedFile.id)
    } else {
      setAlg(v)
    }
  }

  // CR-03: stripMeta is always-on and keepIcc is unsupported (no jSquash API), so neither has an
  // interactive handler anymore — the Metadata section renders them read-only/disabled.

  function handleSetProgressive(v: boolean) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'progressive', v)
      trigger(selectedFile.id)
    }
    // progressive is JPEG-only — no global setter needed
  }

  return (
    <div>
      {/* INSP-02 — Output format */}
      <Section title="Output format">
        <div className="mb-2">
          <SegControl
            options={availableCodecs}
            value={settings.codec}
            onChange={(v) => handleSetCodec(v as Codec)}
            aria-label="Output format"
          />
        </div>
        {!isSvg && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[12px] text-[var(--color-fg-2)]">Lossless</span>
            <Switch checked={settings.lossless} onCheckedChange={handleSetLossless} />
          </div>
        )}
      </Section>

      {isSvg ? (
        /* INSP-06 — SVGO settings inline when SVG codec selected */
        <SvgoPanel />
      ) : (
        <>
          {/* INSP-03 — Parameters */}
          <Section
            title={`${settings.codec} parameters`}
            badge={{ text: CODEC_ENGINE[settings.codec] ?? '' }}
          >
            {/* Quality — disabled for PNG (lossless); UI-SPEC §6 + Pitfall 4 */}
            <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">
                Quality
                {isPng && (
                  <span className="text-[var(--color-fg-3)]"> (lossless)</span>
                )}
              </span>
              <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                <Slider
                  min={0} max={100} step={1}
                  value={[settings.q]}
                  onValueChange={([v]) => handleSetQuality(v)}
                  className="w-full"
                  disabled={isPng}
                />
                <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                  {settings.q}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Effort</span>
              <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                <Slider
                  min={0} max={6} step={1}
                  value={[settings.method]}
                  onValueChange={([v]) => handleSetMethod(v)}
                  className="w-full"
                />
                <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                  {settings.method}
                </span>
              </div>
            </div>

            {/* JPEG progressive toggle — UI-SPEC §6 + Pitfall 6 */}
            {isJpeg && (
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Progressive</span>
                <Switch
                  checked={settings.progressive ?? true}
                  onCheckedChange={handleSetProgressive}
                />
              </div>
            )}

            {settings.codec === 'PNG' && (
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Palette</span>
                <SegControl options={['off', 'auto', 'PNG-8']} value="off" onChange={() => {}} aria-label="Palette" disabled />
              </div>
            )}

            {settings.codec === 'AVIF' && (
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Subsample</span>
                <SegControl options={['4:2:0', '4:4:4']} value="4:2:0" onChange={() => {}} aria-label="Subsample" disabled />
              </div>
            )}
          </Section>

          {/* INSP-04 — Resize */}
          <Section title="Resize">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[var(--color-fg-2)]">Resize on export</span>
              <Switch checked={settings.resizeOn} onCheckedChange={handleSetResizeOn} />
            </div>
            {settings.resizeOn && (
              <div className="space-y-2">
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Width</span>
                  <Input
                    value={settings.w}
                    onChange={(e) => handleSetResizeDimensions(e.target.value, settings.h)}
                    className="h-6 font-mono text-[12px] bg-[var(--color-bg-2)] border-[var(--color-line)]"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Height</span>
                  <Input
                    value={settings.h}
                    onChange={(e) => handleSetResizeDimensions(settings.w, e.target.value)}
                    className="h-6 font-mono text-[12px] bg-[var(--color-bg-2)] border-[var(--color-line)]"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Fit</span>
                  <SegControl options={FIT_MODES} value={settings.fit} onChange={handleSetFit} aria-label="Fit" />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Algorithm</span>
                  <SegControl options={RESIZE_ALGS} value={settings.alg} onChange={handleSetAlg} aria-label="Algorithm" />
                </div>
              </div>
            )}
          </Section>

          {/* INSP-05 — Metadata.
              CR-03 / D-12: the raster pipeline is decode → ImageData → encode, so EXIF/XMP/IPTC
              (file-container metadata) is ALWAYS stripped at the decode boundary — "Strip EXIF" is
              therefore always-on and shown read-only so the UI doesn't imply optional control it
              lacks. ICC preservation has no jSquash API, so "Keep ICC" is disabled + annotated. */}
          <Section title="Metadata">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-[var(--color-fg-2)]">Strip EXIF / XMP / IPTC</span>
              <Switch checked disabled aria-label="Strip EXIF / XMP / IPTC (always on)" />
            </div>
            <p className="text-[10px] font-mono text-[var(--color-fg-3)] mb-1.5 leading-[1.5]">
              always stripped — metadata is dropped when decoding to pixels
            </p>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[12px] text-[var(--color-fg-3)]">Keep ICC profile</span>
              <Switch checked={false} disabled aria-label="Keep ICC profile (not supported)" />
            </div>
            <p className="text-[10px] font-mono text-[var(--color-fg-3)] leading-[1.5]">
              not supported by current codecs
            </p>
          </Section>
        </>
      )}
    </div>
  )
}
