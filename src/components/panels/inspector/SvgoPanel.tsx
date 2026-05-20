// Phase 04 — INSP-06: SvgoPanel aggressive toggle + plugin list. Source: 04-04-PLAN.md
import { useStore } from '@nanostores/react'
import { settingsAtom, setAggressive, togglePlugin } from '@/stores/settings'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Section } from './Section'

export function SvgoPanel() {
  const settings = useStore(settingsAtom)
  const onCount = settings.plugins.filter(p => p.on).length

  return (
    <div>
      <Section title="SVGO preset" badge={{ text: 'preset-default', acc: true }}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--color-fg-2)]">Aggressive mode</span>
          <Switch
            size="sm"
            checked={settings.aggressive}
            onCheckedChange={setAggressive}
          />
        </div>
        <p className="text-[10px] font-mono text-[var(--color-fg-3)] mt-1 leading-[1.5]">
          warns when fidelity drops &gt;10% (butteraugli)
        </p>
      </Section>

      <Section title={`Plugins · ${onCount} / ${settings.plugins.length}`}>
        <div className="flex flex-col">
          {settings.plugins.map(p => (
            <button
              type="button"
              key={p.id}
              aria-pressed={p.on}
              onClick={() => togglePlugin(p.id)}
              className="grid grid-cols-[16px_1fr_auto] gap-2 items-center py-1.5 px-1 rounded cursor-default hover:bg-[var(--color-bg-1)] w-full text-left transition-colors"
            >
              <div
                className={cn(
                  'w-[13px] h-[13px] rounded-[3px] flex items-center justify-center shrink-0 border transition-colors',
                  p.on
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                    : 'bg-[var(--color-bg-1)] border-[var(--color-line-strong)]'
                )}
              >
                {p.on && (
                  <svg viewBox="0 0 10 10" width="10" height="10" fill="none">
                    <path
                      d="M2 5l2.5 2.5L8 3"
                      stroke="var(--color-accent-fg)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                className={cn(
                  'font-mono text-[11px] truncate',
                  p.on
                    ? 'text-[var(--color-fg-0)]'
                    : 'text-[var(--color-fg-3)] line-through'
                )}
              >
                {p.id}
              </span>
              <span
                className={cn(
                  'font-mono text-[11px] font-semibold tabular-nums shrink-0',
                  p.on
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-fg-3)]'
                )}
              >
                {p.saves}
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}
