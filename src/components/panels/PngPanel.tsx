// Phase 5 plan 05-04 — OxiPNG codec panel.
// D-01: Shows OxiPNG level slider (0–6) and ICC toggle.
// D-02: onChange patches perFile slice only (no global store calls).
// Props receive resolved settings (global merged with perFile override).

import { Section } from '@/components/ui/Section'
import { Toggle } from '@/components/ui/Toggle'
import { Slider } from '@/components/ui/Slider'
import type { CodecSettingsPng } from '@/types'

interface PngPanelProps {
  settings: CodecSettingsPng
  preserveIcc: boolean
  onChange: (patch: Partial<CodecSettingsPng>) => void
  onPreserveIccChange: (v: boolean) => void
}

export function PngPanel({ settings, preserveIcc, onChange, onPreserveIccChange }: PngPanelProps) {
  return (
    <>
      <div style={{ padding: '8px 12px 0' }}>
        <span className="pill acc" style={{ fontSize: 10, textTransform: 'uppercase' }}>
          PNG
        </span>
      </div>

      <Section
        title="Compression"
        badge={{ text: String(settings.level), acc: true }}
      >
        <Slider
          label="OxiPNG level"
          value={settings.level}
          min={0}
          max={6}
          step={1}
          onChange={(v) => onChange({ level: v })}
        />
      </Section>

      <Section title="ICC Profile">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 6,
          }}
        >
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>
            Preserve ICC profile
          </span>
          <Toggle
            value={preserveIcc}
            onChange={onPreserveIccChange}
          />
        </div>
      </Section>
    </>
  )
}
