import { Section } from '@/components/ui/Section';
import { Slider } from '@/components/ui/Slider';
import { Seg } from '@/components/ui/Seg';
import { Toggle } from '@/components/ui/Toggle';
import { CODECS, RESIZE_ALG, FIT_MODES } from '@/data/defaults';
import type { CodecLabel, ResizeAlg, FitMode } from '@/types';
import { useStore } from '@nanostores/react'
import { settingsStore, setCodec } from '@/stores';

// Phase 10 plan 10-01 — codec/q/method/lossless props removed; these values
// are now read directly from useSettingsStore.codec. The resize/meta props
// remain here pending a follow-up migration of the Resize/Metadata sections.
// TODO Phase 10 Task 2 follow-up: resizeOn/w/h/alg/fit/stripMeta/keepIcc are
// duplicate of useSettingsStore.resize/.global — remove after CodecPanel resize
// section reads from store.
interface CodecPanelProps {
  resizeOn: boolean; setResizeOn: (v: boolean) => void;
  w: string; setW: (v: string) => void;
  h: string; setH: (v: string) => void;
  alg: ResizeAlg; setAlg: (v: ResizeAlg) => void;
  fit: FitMode; setFit: (v: FitMode) => void;
  stripMeta: boolean; setStripMeta: (v: boolean) => void;
  keepIcc: boolean; setKeepIcc: (v: boolean) => void;
}

const fieldStyle: React.CSSProperties = {
  height: 24,
  padding: '0 7px',
  background: 'var(--bg-1)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  color: 'var(--fg-0)',
  fontFamily: 'var(--mono)',
  fontSize: 11.5,
};

const codecBadge = (c: CodecLabel) =>
  c === 'AVIF' ? 'libavif' : c === 'WebP' ? 'libwebp' : c === 'JPEG' ? 'mozjpeg' : 'oxipng';

export function CodecPanel(props: CodecPanelProps) {
  const {
    resizeOn, setResizeOn, w, setW, h, setH, alg, setAlg, fit, setFit,
    stripMeta, setStripMeta, keepIcc, setKeepIcc,
  } = props;

  // Phase 10 plan 10-01 — read codec settings directly from store.
  const { codec: codecSlice } = useStore(settingsStore)
  const codec = codecSlice.label
  const q = codecSlice.quality
  const method = codecSlice.method
  const lossless = codecSlice.lossless
  const setCodecLabel = (v: CodecLabel) => setCodec({ label: v })
  const setQ = (v: number) => setCodec({ quality: v })
  const setMethod = (v: number) => setCodec({ method: v })
  const setLossless = (v: boolean) => setCodec({ lossless: v })

  const isSvg = codec === 'SVG';

  return (
    <>
      <Section title="Output format">
        <div className="seg-sm" style={{ marginBottom: 8 }}>
          {CODECS.map((c) => (
            <button key={c} className={codec === c ? 'on' : ''} onClick={() => setCodecLabel(c)}>
              {c}
            </button>
          ))}
        </div>
        {!isSvg && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>Lossless</span>
            <Toggle value={lossless} onChange={setLossless} />
          </div>
        )}
      </Section>

      {!isSvg && (
        <Section title={codec + ' parameters'} badge={{ text: codecBadge(codec) }}>
          <Slider label="Quality" value={q} min={0} max={100} onChange={setQ} />
          <Slider label="Effort" value={method} min={0} max={6} onChange={setMethod} />
          {codec === 'PNG' && (
            <div className="row">
              <label>Palette</label>
              <Seg options={['off', 'auto', 'PNG-8'] as const} value="auto" onChange={() => {}} />
            </div>
          )}
          {codec === 'AVIF' && (
            <div className="row">
              <label>Subsample</label>
              <Seg options={['4:2:0', '4:4:4'] as const} value="4:2:0" onChange={() => {}} />
            </div>
          )}
        </Section>
      )}

      <Section title="Resize">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: resizeOn ? 10 : 0 }}>
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>Resize on export</span>
          <Toggle value={resizeOn} onChange={setResizeOn} />
        </div>
        {resizeOn && (
          <>
            <div className="row">
              <label>Width</label>
              <input className="twk-field" style={fieldStyle} value={w} onChange={(e) => setW(e.target.value)} />
            </div>
            <div className="row">
              <label>Height</label>
              <input className="twk-field" style={fieldStyle} value={h} onChange={(e) => setH(e.target.value)} />
            </div>
            <div className="row">
              <label>Fit</label>
              <Seg options={FIT_MODES} value={fit} onChange={setFit} />
            </div>
            <div className="row">
              <label>Algorithm</label>
              <Seg options={RESIZE_ALG} value={alg} onChange={setAlg} />
            </div>
          </>
        )}
      </Section>

      <Section title="Metadata">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>Strip EXIF / XMP / IPTC</span>
          <Toggle value={stripMeta} onChange={setStripMeta} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>Keep ICC profile</span>
          <Toggle value={keepIcc} onChange={setKeepIcc} />
        </div>
      </Section>
    </>
  );
}
