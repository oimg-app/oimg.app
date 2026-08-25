import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import {$selectedFile, setFileSettings, setFileTarget} from '@/stores/files'
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
  setColors,
  setDithering,
  setColorsOn,
} from '@/stores/settings'
import type { Codec } from '@/stores/settings'
import type { FileSettings, AvifOptions, AvifTune } from '@/stores/files'
import { DEFAULT_AVIF_OPTIONS } from '@/stores/files'
import { useLiveEncode } from '@/hooks/useLiveEncode'
import { Slider2 } from '@/components/ui/slider2'
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
      setFileTarget(selectedFile.id,  v)

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

  function handleSetColors(v: number) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'colors', v)
      trigger(selectedFile.id)
    } else {
      setColors(v)
    }
  }

  function handleSetColorsOn(v: boolean) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'colorsOn', v)
      trigger(selectedFile.id)
    } else {
      setColorsOn(v)
    }
  }

  function handleSetDithering(v: number) {
    if (selectedFile) {
      setFileSettings(selectedFile.id, 'dithering', v)
      trigger(selectedFile.id)
    } else {
      setDithering(v)
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

  // AVIF advanced knobs — nested under settings.avif so the generic setFileSettings writer
  // still applies (single key, whole object value). Per-file only: there's no global
  // AVIF-advanced state on settingsAtom, and global-encode paths use DEFAULT_AVIF_OPTIONS
  // via the worker fallback.
  const avif: AvifOptions = settings.avif ?? DEFAULT_AVIF_OPTIONS
  const avifAdvancedOn = settings.avifAdvancedOn ?? false
  function handleSetAvif<K extends keyof AvifOptions>(key: K, value: AvifOptions[K]) {
    if (!selectedFile) return
    setFileSettings(selectedFile.id, 'avif', { ...avif, [key]: value })
    trigger(selectedFile.id)
  }
  function handleSetAvifAdvancedOn(v: boolean) {
    if (!selectedFile) return
    setFileSettings(selectedFile.id, 'avifAdvancedOn', v)
    trigger(selectedFile.id)
  }
  const SUBSAMPLE_LABELS = ['4:4:4', '4:2:2', '4:2:0', '4:0:0'] as const
  const TUNE_OPTIONS: readonly AvifTune[] = ['auto', 'psnr', 'ssim'] as const

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
                <Slider2
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
                <Slider2
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

          </Section>

          {/* AVIF advanced encoder knobs — mirrors jSquash EncodeOptions surface.
              Per-file only (needs a selectedFile so setFileSettings has an id). */}
          {settings.codec === 'AVIF' && selectedFile && (
            <Section title="Advanced (AVIF)">
              {/* Master switch — off by default. When off, the worker skips the entire
                  advanced-knobs branch and jSquash's own defaults fill EncodeOptions,
                  so users don't accidentally ship non-default encoder settings. */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[var(--color-fg-2)]">Enable advanced</span>
                <Switch checked={avifAdvancedOn} onCheckedChange={handleSetAvifAdvancedOn} />
              </div>
              {avifAdvancedOn && <>
              {/* Subsample */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Subsample</span>
                <SegControl
                  options={SUBSAMPLE_LABELS as unknown as string[]}
                  value={SUBSAMPLE_LABELS[Math.min(3, Math.max(0, avif.subsample))]}
                  onChange={(v) => handleSetAvif('subsample', SUBSAMPLE_LABELS.indexOf(v as typeof SUBSAMPLE_LABELS[number]))}
                  aria-label="Subsample"
                />
              </div>

              {/* Tune */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Tune</span>
                <SegControl
                  options={TUNE_OPTIONS as unknown as string[]}
                  value={avif.tune}
                  onChange={(v) => handleSetAvif('tune', v as AvifTune)}
                  aria-label="Tune"
                />
              </div>

              {/* Alpha quality — -1 sentinel = match main quality */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Match alpha</span>
                <Switch
                  checked={avif.qualityAlpha === -1}
                  onCheckedChange={(v) => handleSetAvif('qualityAlpha', v ? -1 : Math.max(0, settings.q ?? 50))}
                />
              </div>
              {avif.qualityAlpha !== -1 && (
                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Alpha quality</span>
                  <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                    <Slider2
                      min={0} max={100} step={1}
                      value={[avif.qualityAlpha]}
                      onValueChange={([v]) => handleSetAvif('qualityAlpha', v)}
                      className="w-full"
                    />
                    <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                      {avif.qualityAlpha}
                    </span>
                  </div>
                </div>
              )}

              {/* Denoise (0..50) */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Denoise</span>
                <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                  <Slider2
                    min={0} max={50} step={1}
                    value={[avif.denoiseLevel]}
                    onValueChange={([v]) => handleSetAvif('denoiseLevel', v)}
                    className="w-full"
                  />
                  <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                    {avif.denoiseLevel}
                  </span>
                </div>
              </div>

              {/* Sharpness (0..7) */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Sharpness</span>
                <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                  <Slider2
                    min={0} max={7} step={1}
                    value={[avif.sharpness]}
                    onValueChange={([v]) => handleSetAvif('sharpness', v)}
                    className="w-full"
                  />
                  <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                    {avif.sharpness}
                  </span>
                </div>
              </div>

              {/* Tile rows (log2) 0..6 */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Tile rows</span>
                <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                  <Slider2
                    min={0} max={6} step={1}
                    value={[avif.tileRowsLog2]}
                    onValueChange={([v]) => handleSetAvif('tileRowsLog2', v)}
                    className="w-full"
                  />
                  <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                    {1 << avif.tileRowsLog2}
                  </span>
                </div>
              </div>

              {/* Tile cols (log2) 0..6 */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Tile cols</span>
                <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                  <Slider2
                    min={0} max={6} step={1}
                    value={[avif.tileColsLog2]}
                    onValueChange={([v]) => handleSetAvif('tileColsLog2', v)}
                    className="w-full"
                  />
                  <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                    {1 << avif.tileColsLog2}
                  </span>
                </div>
              </div>

              {/* Chroma delta Q */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[var(--color-fg-2)]">Chroma delta Q</span>
                <Switch checked={avif.chromaDeltaQ} onCheckedChange={(v) => handleSetAvif('chromaDeltaQ', v)} />
              </div>

              {/* Sharp YUV */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-fg-2)]">Sharp YUV</span>
                <Switch checked={avif.enableSharpYUV} onCheckedChange={(v) => handleSetAvif('enableSharpYUV', v)} />
              </div>
              </>}
            </Section>
          )}

          {/* INSP-04 — Resize */}
          <Section title="Resize">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[var(--color-fg-2)]">Resize</span>
              <Switch checked={settings.resizeOn} onCheckedChange={handleSetResizeOn} />
            </div>
            {settings.resizeOn && (
              <div className="space-y-2">
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Width</span>
                  <Input
                    value={settings.w}
                    onChange={(e) => handleSetResizeDimensions(e.target.value, settings.h)}
                    className="h-6 font-mono text-[12px] bg-color-bg-2 border-[var(--color-line)]"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Height</span>
                  <Input
                    value={settings.h}
                    onChange={(e) => handleSetResizeDimensions(settings.w, e.target.value)}
                    className="h-6 font-mono text-[12px] bg-color-bg-2 border-[var(--color-line)]"
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
          {/* Colors */}
          <Section title="Reduce palette">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[var(--color-fg-2)]">Reduce palette</span>
              <Switch checked={settings.colorsOn} onCheckedChange={handleSetColorsOn} />
            </div>
            {settings.colorsOn && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                    <span className="text-[12px] text-[var(--color-fg-2)]">Colors</span>
                    <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                      <Slider2
                          min={1} max={256} step={1}
                          value={[settings.colors]}
                          onValueChange={([v]) => handleSetColors(v)}
                          className="w-full"
                      />
                      <span
                          className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                  {settings.colors}
                </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                    <span className="text-[12px] text-[var(--color-fg-2)]">Dithering</span>
                    <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                      <Slider2
                          min={0} max={1} step={0.001}
                          value={[settings.dithering]}
                          onValueChange={([v]) => handleSetDithering(v)}
                          className="w-full"
                      />
                      <span
                          className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                  {settings.dithering}
                </span>
                    </div>
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
