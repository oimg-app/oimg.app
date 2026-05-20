// Phase 04 — INSP-02 through INSP-05: CodecPanel sections. Source: 04-03-PLAN.md
import { useStore } from '@nanostores/react'
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
import { cn } from '@/lib/utils'
import { Section } from './Section'
import { SegControl } from './SegControl'

const CODEC_ENGINE: Record<string, string> = {
  AVIF: 'libavif',
  WebP: 'libwebp',
  JPEG: 'mozjpeg',
  PNG: 'oxipng',
  SVG: 'svgo',
}

export function CodecPanel() {
  const settings = useStore(settingsAtom)

  return (
    <div>
      {/* INSP-02 — Output format */}
      <Section title="Output format">
        <div className="flex gap-1 mb-2.5">
          {CODECS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCodec(c as Codec)}
              className={cn(
                'flex-1 h-6 rounded text-[11px] font-mono transition-colors border',
                settings.codec === c
                  ? 'bg-[var(--color-bg-3)] text-[var(--color-fg-0)] border-[var(--color-line-strong)] font-semibold'
                  : 'bg-transparent text-[var(--color-fg-2)] border-[var(--color-line)] hover:text-[var(--color-fg-0)]',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {settings.codec !== 'SVG' && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[12px] text-[var(--color-fg-2)]">Lossless</span>
            <Switch checked={settings.lossless} onCheckedChange={setLossless} />
          </div>
        )}
      </Section>

      {/* INSP-03 — Parameters (hidden for SVG) */}
      {settings.codec !== 'SVG' && (
        <Section
          title={`${settings.codec} parameters`}
          badge={{ text: CODEC_ENGINE[settings.codec] ?? '' }}
        >
          {/* Quality slider */}
          <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
            <span className="text-[12px] text-[var(--color-fg-2)]">Quality</span>
            <div className="grid grid-cols-[1fr_42px] gap-2.5 items-center">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[settings.q]}
                onValueChange={([v]) => setQuality(v)}
                className="w-full"
              />
              <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                {settings.q}
              </span>
            </div>
          </div>

          {/* Effort slider */}
          <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
            <span className="text-[12px] text-[var(--color-fg-2)]">Effort</span>
            <div className="grid grid-cols-[1fr_42px] gap-2.5 items-center">
              <Slider
                min={0}
                max={6}
                step={1}
                value={[settings.method]}
                onValueChange={([v]) => setMethod(v)}
                className="w-full"
              />
              <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                {settings.method}
              </span>
            </div>
          </div>

          {/* PNG Palette (codec='PNG' only) */}
          {settings.codec === 'PNG' && (
            <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Palette</span>
              <SegControl options={['off', 'auto', 'PNG-8']} value="off" onChange={() => {}} />
            </div>
          )}

          {/* AVIF Subsample (codec='AVIF' only) */}
          {settings.codec === 'AVIF' && (
            <div className="grid grid-cols-[100px_1fr] gap-2.5 mb-2 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Subsample</span>
              <SegControl options={['4:2:0', '4:4:4']} value="4:2:0" onChange={() => {}} />
            </div>
          )}
        </Section>
      )}

      {/* INSP-04 — Resize */}
      <Section title="Resize">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[var(--color-fg-2)]">Resize on export</span>
          <Switch checked={settings.resizeOn} onCheckedChange={setResizeOn} />
        </div>
        {settings.resizeOn && (
          <div className="space-y-2">
            {/* Width */}
            <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Width</span>
              <Input
                value={settings.w}
                onChange={(e) => setResizeDimensions(e.target.value, settings.h)}
                className="h-6 font-mono text-[12px] bg-[var(--color-bg-2)] border-[var(--color-line)]"
              />
            </div>
            {/* Height */}
            <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Height</span>
              <Input
                value={settings.h}
                onChange={(e) => setResizeDimensions(settings.w, e.target.value)}
                className="h-6 font-mono text-[12px] bg-[var(--color-bg-2)] border-[var(--color-line)]"
              />
            </div>
            {/* Fit */}
            <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Fit</span>
              <SegControl options={FIT_MODES} value={settings.fit} onChange={setFit} />
            </div>
            {/* Algorithm */}
            <div className="grid grid-cols-[100px_1fr] gap-2.5 items-center">
              <span className="text-[12px] text-[var(--color-fg-2)]">Algorithm</span>
              <SegControl options={RESIZE_ALGS} value={settings.alg} onChange={setAlg} />
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
    </div>
  )
}
