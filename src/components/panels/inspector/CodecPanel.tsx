import { useEffect } from 'react'
// change:remove-dead-ui-and-fix-a11y — every Switch/Slider2 carries an aria-label matching its visible label.
// change:deepen-settings-edit — all knobs call one edit(key, value); per-file vs global and the
// live re-encode trigger are decided in stores/settings.ts editSetting().
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
import { settingsAtom, editSetting, CODECS, RESIZE_ALGS, FIT_MODES } from '@/stores/settings'
import type { Codec, FileSettings } from '@/stores/settings'
import type { AvifOptions, AvifTune } from '@/stores/files'
import { DEFAULT_AVIF_OPTIONS } from '@/stores/files'
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

  // D-03: read per-file settings when a file is selected; fall back to global defaults
  const settings: FileSettings = selectedFile?.settings ?? globalSettings
  const edit = <K extends keyof FileSettings>(key: K, value: FileSettings[K]) =>
    editSetting(selectedFile?.id ?? null, key, value)

  const isSvgFile = selectedFile?.type === 'svg'
  const availableCodecs = isSvgFile ? CODECS : CODECS.filter(c => c !== 'SVG')
  const isSvg = settings.codec === 'SVG'
  const isPng = settings.codec === 'PNG'
  const isJpeg = settings.codec === 'JPEG'

  // Auto-switch away from SVG codec when a non-SVG file is selected
  useEffect(() => {
    if (!isSvgFile && settingsAtom.get().codec === 'SVG') {
      editSetting(null, 'codec', 'WebP')
    }
  }, [isSvgFile])

  // AVIF advanced knobs — nested under settings.avif so one key carries the whole object.
  const avif: AvifOptions = settings.avif ?? DEFAULT_AVIF_OPTIONS
  const avifAdvancedOn = settings.avifAdvancedOn ?? false
  const editAvif = <K extends keyof AvifOptions>(key: K, value: AvifOptions[K]) =>
    edit('avif', { ...avif, [key]: value })
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
            onChange={(v) => edit('codec', v as Codec)}
            aria-label="Output format"
            data-testid="codec-format"
          />
        </div>
        {!isSvg && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[12px] text-[var(--color-fg-2)]">Lossless</span>
            <Switch
              aria-label="Lossless"
              checked={settings.lossless}
              onCheckedChange={(v) => edit('lossless', v)}
              data-testid="codec-switch-lossless"
            />
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
                  aria-label="Quality"
                  min={0} max={100} step={1}
                  value={[settings.q]}
                  onValueChange={([v]) => edit('q', v)}
                  className="w-full"
                  disabled={isPng}
                  data-testid="codec-slider-quality"
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
                  aria-label="Effort"
                  min={0} max={6} step={1}
                  value={[settings.method]}
                  onValueChange={([v]) => edit('method', v)}
                  className="w-full"
                  data-testid="codec-slider-effort"
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
                  aria-label="Progressive"
                  checked={settings.progressive ?? true}
                  onCheckedChange={(v) => edit('progressive', v)}
                  data-testid="codec-switch-progressive"
                />
              </div>
            )}

            {settings.codec === 'PNG' && (
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Palette</span>
                <SegControl
                  options={['off', 'auto', 'PNG-8']}
                  value="off"
                  onChange={() => {}}
                  aria-label="Palette"
                  disabled
                  data-testid="codec-seg-palette"
                />
              </div>
            )}

          </Section>

          {/* AVIF advanced encoder knobs — mirrors jSquash EncodeOptions surface.
              Per-file only (needs a selectedFile so setFileSettings has an id). */}
          {settings.codec === 'AVIF' && (
            <Section title="Advanced (AVIF)">
              {/* Master switch — off by default. When off, the worker skips the entire
                  advanced-knobs branch and jSquash's own defaults fill EncodeOptions,
                  so users don't accidentally ship non-default encoder settings. */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[var(--color-fg-2)]">Enable advanced</span>
                <Switch
                  aria-label="Enable advanced"
                  checked={avifAdvancedOn}
                  onCheckedChange={(v) => edit('avifAdvancedOn', v)}
                  data-testid="codec-switch-avif-advanced"
                />
              </div>
              {avifAdvancedOn && <>
              {/* Subsample */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Subsample</span>
                <SegControl
                  options={SUBSAMPLE_LABELS as unknown as string[]}
                  value={SUBSAMPLE_LABELS[Math.min(3, Math.max(0, avif.subsample))]}
                  onChange={(v) => editAvif('subsample', SUBSAMPLE_LABELS.indexOf(v as typeof SUBSAMPLE_LABELS[number]))}
                  aria-label="Subsample"
                  data-testid="codec-seg-avif-subsample"
                />
              </div>

              {/* Tune */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Tune</span>
                <SegControl
                  options={TUNE_OPTIONS as unknown as string[]}
                  value={avif.tune}
                  onChange={(v) => editAvif('tune', v as AvifTune)}
                  aria-label="Tune"
                  data-testid="codec-seg-avif-tune"
                />
              </div>

              {/* Alpha quality — -1 sentinel = match main quality */}
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                <span className="text-[12px] text-[var(--color-fg-2)]">Match alpha</span>
                <Switch
                  aria-label="Match alpha"
                  checked={avif.qualityAlpha === -1}
                  onCheckedChange={(v) => editAvif('qualityAlpha', v ? -1 : Math.max(0, settings.q ?? 50))}
                  data-testid="codec-switch-avif-match-alpha"
                />
              </div>
              {avif.qualityAlpha !== -1 && (
                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Alpha quality</span>
                  <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                    <Slider2
                      aria-label="Alpha quality"
                      min={0} max={100} step={1}
                      value={[avif.qualityAlpha]}
                      onValueChange={([v]) => editAvif('qualityAlpha', v)}
                      className="w-full"
                      data-testid="codec-slider-avif-alpha"
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
                    aria-label="Denoise"
                    min={0} max={50} step={1}
                    value={[avif.denoiseLevel]}
                    onValueChange={([v]) => editAvif('denoiseLevel', v)}
                    className="w-full"
                    data-testid="codec-slider-avif-denoise"
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
                    aria-label="Sharpness"
                    min={0} max={7} step={1}
                    value={[avif.sharpness]}
                    onValueChange={([v]) => editAvif('sharpness', v)}
                    className="w-full"
                    data-testid="codec-slider-avif-sharpness"
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
                    aria-label="Tile rows"
                    min={0} max={6} step={1}
                    value={[avif.tileRowsLog2]}
                    onValueChange={([v]) => editAvif('tileRowsLog2', v)}
                    className="w-full"
                    data-testid="codec-slider-avif-tile-rows"
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
                    aria-label="Tile cols"
                    min={0} max={6} step={1}
                    value={[avif.tileColsLog2]}
                    onValueChange={([v]) => editAvif('tileColsLog2', v)}
                    className="w-full"
                    data-testid="codec-slider-avif-tile-cols"
                  />
                  <span className="text-right font-mono text-[12px] font-semibold text-[var(--color-fg-0)] tabular-nums">
                    {1 << avif.tileColsLog2}
                  </span>
                </div>
              </div>

              {/* Chroma delta Q */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[var(--color-fg-2)]">Chroma delta Q</span>
                <Switch
                  aria-label="Chroma delta Q"
                  checked={avif.chromaDeltaQ}
                  onCheckedChange={(v) => editAvif('chromaDeltaQ', v)}
                  data-testid="codec-switch-avif-chroma-delta"
                />
              </div>

              {/* Sharp YUV */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-fg-2)]">Sharp YUV</span>
                <Switch
                  aria-label="Sharp YUV"
                  checked={avif.enableSharpYUV}
                  onCheckedChange={(v) => editAvif('enableSharpYUV', v)}
                  data-testid="codec-switch-avif-sharp-yuv"
                />
              </div>
              </>}
            </Section>
          )}

          {/* INSP-04 — Resize */}
          <Section title="Resize">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[var(--color-fg-2)]">Resize</span>
              <Switch
                aria-label="Resize"
                checked={settings.resizeOn}
                onCheckedChange={(v) => edit('resizeOn', v)}
                data-testid="codec-switch-resize"
              />
            </div>
            {settings.resizeOn && (
              <div className="space-y-2">
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Width</span>
                  <Input
                    value={settings.w}
                    data-testid="codec-input-width"
                    aria-label="Width (px)"
                    onChange={(e) => edit('w', e.target.value)}
                    className="h-6 font-mono text-[12px] bg-color-bg-2 border-[var(--color-line)]"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Height</span>
                  <Input
                    value={settings.h}
                    data-testid="codec-input-height"
                    aria-label="Height (px)"
                    onChange={(e) => edit('h', e.target.value)}
                    className="h-6 font-mono text-[12px] bg-color-bg-2 border-[var(--color-line)]"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Fit</span>
                  <SegControl
                    options={FIT_MODES}
                    value={settings.fit}
                    onChange={(v) => edit('fit', v)}
                    aria-label="Fit"
                    data-testid="codec-seg-fit"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-[12px] text-[var(--color-fg-2)]">Algorithm</span>
                  <SegControl
                    options={RESIZE_ALGS}
                    value={settings.alg}
                    onChange={(v) => edit('alg', v)}
                    aria-label="Algorithm"
                    data-testid="codec-seg-algorithm"
                  />
                </div>
              </div>
            )}
          </Section>
          {/* Colors */}
          <Section title="Reduce palette">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[var(--color-fg-2)]">Reduce palette</span>
              <Switch
                aria-label="Reduce palette"
                checked={settings.colorsOn}
                onCheckedChange={(v) => edit('colorsOn', v)}
                data-testid="codec-switch-colors"
              />
            </div>
            {settings.colorsOn && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[100px_1fr] gap-2 mb-2 items-center">
                    <span className="text-[12px] text-[var(--color-fg-2)]">Colors</span>
                    <div className="grid grid-cols-[1fr_42px] gap-2 items-center">
                      <Slider2
                        aria-label="Colors"
                          min={2} max={256} step={1}
                          value={[settings.colors]}
                          onValueChange={([v]) => edit('colors', v)}
                          className="w-full"
                          data-testid="codec-slider-colors"
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
                        aria-label="Dithering"
                          min={0} max={1} step={0.001}
                          value={[settings.dithering]}
                          onValueChange={([v]) => edit('dithering', v)}
                          className="w-full"
                          data-testid="codec-slider-dithering"
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
              <Switch
                checked
                disabled
                aria-label="Strip EXIF / XMP / IPTC (always on)"
                data-testid="codec-switch-strip-exif"
              />
            </div>
            <p className="text-xs font-mono text-[var(--color-fg-3)] mb-1.5 leading-[1.5]">
              always stripped — metadata is dropped when decoding to pixels
            </p>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[12px] text-[var(--color-fg-3)]">Keep ICC profile</span>
              <Switch
                checked={false}
                disabled
                aria-label="Keep ICC profile (not supported)"
                data-testid="codec-switch-keep-icc"
              />
            </div>
            <p className="text-xs font-mono text-[var(--color-fg-3)] leading-[1.5]">
              not supported by current codecs
            </p>
          </Section>
        </>
      )}
    </div>
  )
}
