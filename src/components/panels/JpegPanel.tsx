// Phase 5 plan 05-04 — JPEG (MozJPEG) codec panel.
// D-01: Shows quality slider (0–100) and Progressive toggle.
// D-02: onChange patches perFile slice only (no global store calls).
// Props receive resolved settings (global merged with perFile override).

import { Section } from '@/components/ui/Section'
import { Toggle } from '@/components/ui/Toggle'
import { Slider } from '@/components/ui/Slider'
import type { CodecSettingsJpeg } from '@/types'

interface JpegPanelProps {
  settings: CodecSettingsJpeg
  onChange: (patch: Partial<CodecSettingsJpeg>) => void
}

export function JpegPanel({ settings, onChange }: JpegPanelProps) {
  return (
    <>
      <div style={{ padding: '8px 12px 0' }}>
        <span className="pill acc" style={{ fontSize: 10, textTransform: 'uppercase' }}>
          JPEG
        </span>
      </div>

      <Section
        title="Quality"
        badge={{ text: String(settings.quality), acc: true }}
      >
        <Slider
          label="JPEG quality"
          value={settings.quality}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ quality: v })}
        />
      </Section>

      <Section title="Encoding">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 6,
          }}
        >
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>
            Progressive JPEG encoding
          </span>
          <Toggle
            value={settings.progressive}
            onChange={(v) => onChange({ progressive: v })}
          />
        </div>
      </Section>
    </>
  )
}
