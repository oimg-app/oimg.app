import { Section } from '@/components/ui/Section';
import { Toggle } from '@/components/ui/Toggle';
import type { SvgoPlugin } from '@/types';

interface SvgoPanelProps {
  plugins: SvgoPlugin[];
  togglePlugin: (id: string) => void;
  aggressive: boolean;
  setAggressive: (v: boolean) => void;
}

export function SvgoPanel({ plugins, togglePlugin, aggressive, setAggressive }: SvgoPanelProps) {
  const onCount = plugins.filter((p) => p.on).length;
  return (
    <>
      <Section title="SVGO preset" badge={{ text: 'preset-default', acc: true }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>Aggressive mode</span>
          <Toggle value={aggressive} onChange={setAggressive} />
        </div>
        <p style={{ margin: '4px 0 0', font: '10.5px var(--mono)', color: 'var(--fg-3)', lineHeight: 1.5 }}>
          warns when fidelity drops &gt;10% (butteraugli)
        </p>
      </Section>

      <Section title={'Plugins · ' + onCount + ' / ' + plugins.length}>
        <div className="plugins">
          {plugins.map((p) => (
            <div
              key={p.id}
              className={'plugin ' + (p.on ? 'on' : 'off')}
              onClick={() => togglePlugin(p.id)}
            >
              <div className="check"></div>
              <div className="name">{p.id}</div>
              <div className="saves">{p.saves}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
