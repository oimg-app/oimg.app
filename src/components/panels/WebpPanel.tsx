// Phase 5 plan 05-04 — WebP codec panel.
// D-01: Shows quality slider (0–100), method slider (0–6), and lossless toggle.
// D-02: onChange patches perFile slice only (no global store calls).
// Props receive resolved settings (global merged with perFile override).

import { Section } from '@/components/ui/Section'
import { Toggle } from '@/components/ui/Toggle'
import { Slider } from '@/components/ui/Slider'
import type { CodecSettingsWebp } from '@/types'

interface WebpPanelProps {
  settings: CodecSettingsWebp
  onChange: (patch: Partial<CodecSettingsWebp>) => void
}

export function WebpPanel({ settings, onChange }: WebpPanelProps) {
  return (
    <>
      <div style={{ padding: '8px 12px 0' }}>
        <span className="pill acc" style={{ fontSize: 10, textTransform: 'uppercase' }}>
          WebP
        </span>
      </div>

      <Section
        title="Quality"
        badge={{ text: settings.lossless ? 'lossless' : String(settings.quality), acc: true }}
      >
        <Slider
          label="WebP quality"
          value={settings.quality}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ quality: v })}
        />
        {settings.lossless && (
          <p style={{ margin: '4px 0 0', font: '10.5px var(--mono)', color: 'var(--fg-3)' }}>
            Quality slider has no effect in lossless mode.
          </p>
        )}
      </Section>

      <Section
        title="Method"
        badge={{ text: String(settings.method), acc: false }}
      >
        <Slider
          label="WebP encode method (0=fast, 6=best)"
          value={settings.method}
          min={0}
          max={6}
          step={1}
          onChange={(v) => onChange({ method: v })}
        />
      </Section>

      <Section title="Mode">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 6,
          }}
        >
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>
            Lossless WebP encoding
          </span>
          <Toggle
            value={settings.lossless}
            onChange={(v) => onChange({ lossless: v })}
          />
        </div>
      </Section>
    </>
  )
}
