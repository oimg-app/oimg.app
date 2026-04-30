import { Section } from '@/components/ui/Section';
import { fmtBytes } from '@/lib/format';
import type { MockFile } from '@/types';

interface ReportPanelProps {
  files: MockFile[];
}

const FORMAT_KEYS: Array<'svg' | 'png' | 'jpg' | 'webp' | 'avif'> = ['svg', 'png', 'jpg', 'webp', 'avif'];

export function ReportPanel({ files }: ReportPanelProps) {
  const total = files.reduce((s, f) => s + f.orig, 0);
  const optTotal = files.reduce((s, f) => s + f.opt, 0);
  const saved = total - optTotal;
  // WR-01: empty queue → total=0 → NaN%. Guard with explicit zero.
  const pct = total === 0 ? 0 : (saved / total) * 100;

  return (
    <>
      <Section title="Total savings" badge={{ text: pct.toFixed(1) + '%', acc: true }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <div>
            <div style={{ font: '10px var(--mono)', color: 'var(--fg-2)', letterSpacing: '0.05em' }}>BEFORE</div>
            <div className="num" style={{ font: '600 16px var(--mono)', color: 'var(--fg-0)' }}>{fmtBytes(total)}</div>
          </div>
          <div>
            <div style={{ font: '10px var(--mono)', color: 'var(--fg-2)', letterSpacing: '0.05em' }}>AFTER</div>
            <div className="num" style={{ font: '600 16px var(--mono)', color: 'var(--accent)' }}>{fmtBytes(optTotal)}</div>
          </div>
        </div>
        <div className="chart">
          {files.map((f) => {
            // WR-01: per-file guard — placeholder + zero-byte sources don't divide.
            const localPct = f.orig === 0 ? 0 : ((f.orig - f.opt) / f.orig) * 100;
            const h = Math.max(4, localPct * 0.9);
            return (
              <div
                key={f.id}
                className={'bar' + (localPct < 30 ? ' warn' : '')}
                style={{ height: h + '%' }}
                title={f.name + ' · ' + localPct.toFixed(1) + '%'}
              />
            );
          })}
        </div>
        <div className="chart-axis">
          <span>0%</span>
          <span>per-file savings</span>
          <span>100%</span>
        </div>
      </Section>

      <Section title="Format breakdown">
        {FORMAT_KEYS.map((t) => {
          const fs = files.filter((f) => f.target === t || f.type === t);
          if (!fs.length) return null;
          const sub = fs.reduce((s, f) => s + (f.orig - f.opt), 0);
          return (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 0',
                borderBottom: '1px solid var(--line)',
                fontSize: 11.5,
              }}
            >
              <span className="mono" style={{ color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t}
              </span>
              <span style={{ color: 'var(--fg-3)', font: '10.5px var(--mono)' }}>
                {fs.length} {fs.length === 1 ? 'file' : 'files'}
              </span>
              <span className="num" style={{ color: 'var(--accent)', font: '600 11.5px var(--mono)' }}>
                −{fmtBytes(sub)}
              </span>
            </div>
          );
        })}
      </Section>
    </>
  );
}
