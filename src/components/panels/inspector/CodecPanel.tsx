import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
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
  setStripMeta,
  setKeepIcc,
} from '@/stores/settings'
import type { Codec } from '@/stores/settings'
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
  const settings = useStore(settingsAtom)
  const selectedFile = useStore($selectedFile)
  const isSvgFile = selectedFile?.type === 'svg'
  const availableCodecs = isSvgFile ? CODECS : CODECS.filter(c => c !== 'SVG')
  const isSvg = settings.codec === 'SVG'

  // Auto-switch away from SVG codec when a non-SVG file is selected
  useEffect(() => {
    if (!isSvgFile && settingsAtom.get().codec === 'SVG') {
      setCodec('WebP')
    }
  }, [isSvgFile])

  return (
    <div>
      {/* INSP-02 — Output format */}
      <Section title="Output format">
        <div className="mb-2">
          <SegControl
            options={availableCodecs}
            value={settings.codec}
            onChange={(v) => setCodec(v as Codec)}
            aria-label="Output format"
          />
        </div>
        {!isSvg && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[12px] text-[var(--color-fg-2)]">Lossless</span>
            <Switch checked={settings.lossless} onCheckedChange={setLossless} />
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
            <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Quality</span>
              <div className="grid grid-cols-[1fr_42px] gap-2.5 items-center">
                <Slider
                  min={0} max={100} step={1}
                  value={[settings.q]}
                  onValueChange={([v]) => setQuality(v)}
                  className="w-full"
                />
                <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                  {settings.q}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Effort</span>
              <div className="grid grid-cols-[1fr_42px] gap-2.5 items-center">
                <Slider
                  min={0} max={6} step={1}
                  value={[settings.method]}
                  onValueChange={([v]) => setMethod(v)}
                  className="w-full"
                />
                <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                  {settings.method}
                </span>
              </div>
            </div>

            {settings.codec === 'PNG' && (
              <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Palette</span>
                <SegControl options={['off', 'auto', 'PNG-8']} value="off" onChange={() => {}} aria-label="Palette" disabled />
              </div>
            )}

            {settings.codec === 'AVIF' && (
              <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Subsample</span>
                <SegControl options={['4:2:0', '4:4:4']} value="4:2:0" onChange={() => {}} aria-label="Subsample" disabled />
              </div>
            )}
          </Section>

          {/* INSP-04 — Resize */}
          <Section title="Resize">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[var(--color-fg-2)]">Resize on export</span>
              <Switch checked={settings.resizeOn} onCheckedChange={setResizeOn} />
            </div>
            {settings.resizeOn && (
              <div className="space-y-2">
                <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Width</span>
                  <Input
                    value={settings.w}
                    onChange={(e) => setResizeDimensions(e.target.value, settings.h)}
                    className="h-6 font-mono text-[12px] bg-[var(--color-bg-2)] border-[var(--color-line)]"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Height</span>
                  <Input
                    value={settings.h}
                    onChange={(e) => setResizeDimensions(settings.w, e.target.value)}
                    className="h-6 font-mono text-[12px] bg-[var(--color-bg-2)] border-[var(--color-line)]"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Fit</span>
                  <SegControl options={FIT_MODES} value={settings.fit} onChange={setFit} aria-label="Fit" />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Algorithm</span>
                  <SegControl options={RESIZE_ALGS} value={settings.alg} onChange={setAlg} aria-label="Algorithm" />
                </div>
              </div>
            )}
          </Section>

          {/* INSP-05 — Metadata */}
          <Section title="Metadata">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-[var(--color-fg-2)]">Strip EXIF / XMP / IPTC</span>
              <Switch checked={settings.stripMeta} onCheckedChange={setStripMeta} />
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-[var(--color-fg-2)]">Keep ICC profile</span>
              <Switch checked={settings.keepIcc} onCheckedChange={setKeepIcc} />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
