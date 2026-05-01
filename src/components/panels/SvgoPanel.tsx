// Phase 3 plan 03-B — SVGO inspector panel rewrite.
// Source: 03-CONTEXT.md D-05/D-06/D-07/D-08; 03-PATTERNS.md §SvgoPanel; 03-UI-SPEC.md.
//
// Replaces the Phase-1 visual-shell panel:
//   - 12 curated plugins in a locked order (RESEARCH.md §Curated Plugin Set).
//   - Per-plugin live-savings column ('—' before any Optimize batch run; '%'
//     once D-06 post-batch computation has populated pluginSavings).
//   - Always-visible foot-gun hints below cleanupIds, removeViewBox,
//     removeDimensions (verbatim copy from 03-UI-SPEC.md §Foot-gun hint copy).
//   - Sanitization section with the "Disable on export" Toggle (D-04). Default
//     OFF; badge flips between `safe` (acc) and `unsafe` (warn).
//   - The legacy perceptual-loss toggle (raster-only fidelity metric) is
//     removed — SVG is text-in/text-out; no perceptual metric applies.
//     See 03-CONTEXT.md §Deferred Ideas for the Phase 3 cleanup decision.

import { Section } from '@/components/ui/Section';
import { Toggle } from '@/components/ui/Toggle';

// Foot-gun hint copy — verbatim from 03-UI-SPEC.md §Foot-gun hint copy.
// Exported so App.tsx can build the per-plugin row view-models without
// duplicating the copy.
export const PLUGIN_FOOTGUNS: Record<string, string> = {
  cleanupIds: 'May break external CSS or <use> references that target SVG element ids',
  removeViewBox: 'Disabling viewBox can break responsive scaling when the SVG is embedded in HTML or CSS',
  removeDimensions: 'Removes width/height attributes — only safe when viewBox is preserved',
};

// Locked plugin order (UI-SPEC §Curated plugin set). The 10 plugins above
// `removeViewBox` are in SVGO v4 preset-default; the bottom 2 are opt-in
// extras (default OFF) — see 03-RESEARCH.md §Critical Contradiction.
const PLUGIN_META: Array<{ id: string; footgun?: string }> = [
  { id: 'removeComments' },
  { id: 'removeMetadata' },
  { id: 'removeUselessDefs' },
  { id: 'removeUnusedNS' },
  { id: 'cleanupIds', footgun: PLUGIN_FOOTGUNS.cleanupIds },
  { id: 'cleanupNumericValues' },
  { id: 'convertColors' },
  { id: 'convertPathData' },
  { id: 'mergePaths' },
  { id: 'minifyStyles' },
  { id: 'removeViewBox', footgun: PLUGIN_FOOTGUNS.removeViewBox },
  { id: 'removeDimensions', footgun: PLUGIN_FOOTGUNS.removeDimensions },
];

interface SvgoPanelProps {
  // Plan B contract: per-plugin row view-models built in App.tsx from
  // useSettingsStore.svg.plugins + svg.pluginSavings. `savings === null`
  // means no Optimize batch has run yet (column blank); a populated record
  // shows aggregate '%' across the batch.
  plugins: Array<{
    id: string;
    on: boolean;
    savings: { bytes: number; pct: number } | null;
    footgun?: string;
  }>;
  togglePlugin: (id: string) => void;
  unsafeExport: boolean;
  setUnsafeExport: (v: boolean) => void;
}

export function SvgoPanel({ plugins, togglePlugin, unsafeExport, setUnsafeExport }: SvgoPanelProps) {
  const onCount = plugins.filter((p) => p.on).length;

  // Foot-gun hint paragraph style mirrors the deleted perceptual-loss
  // hint block from the visual shell (verbatim per 03-PATTERNS.md
  // §SvgoPanel rewrite).
  const footgunStyle = {
    margin: '4px 0 0',
    font: '10.5px var(--mono)',
    color: 'var(--fg-3)',
    lineHeight: 1.5,
  } as const;

  return (
    <>
      <Section title="SVGO preset" badge={{ text: 'preset-default', acc: true }}>
        <p style={{ margin: 0, font: '11px var(--mono)', color: 'var(--fg-3)', lineHeight: 1.5 }}>
          Curated 12-plugin subset. Per-plugin savings populate after each Optimize run.
        </p>
      </Section>

      <Section title={'Plugins · ' + onCount + ' / ' + plugins.length}>
        <div className="plugins">
          {PLUGIN_META.map((meta) => {
            const p = plugins.find((x) => x.id === meta.id);
            if (!p) return null;
            // Savings column rules (UI-SPEC §Live savings):
            //   savings === null  → no batch run yet: show blank
            //   savings.pct === 0 → measured zero: show '—'
            //   else              → show '%.1f%' (accent color when > 0)
            const savesLabel =
              p.savings === null
                ? ''
                : p.savings.pct === 0
                  ? '—'
                  : p.savings.pct.toFixed(1) + '%';
            const savesColor =
              p.savings && p.savings.pct > 0 ? 'var(--accent)' : undefined;

            return (
              <div key={meta.id}>
                <div
                  className={'plugin ' + (p.on ? 'on' : 'off')}
                  onClick={() => togglePlugin(meta.id)}
                  role="button"
                  aria-pressed={p.on}
                  aria-label={meta.id + ' plugin ' + (p.on ? 'enabled' : 'disabled')}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      togglePlugin(meta.id);
                    }
                  }}
                >
                  <div className="check"></div>
                  <div className="name">{meta.id}</div>
                  <div className="saves" style={savesColor ? { color: savesColor } : undefined}>
                    {savesLabel}
                  </div>
                </div>
                {meta.footgun && (
                  <p style={footgunStyle}>
                    {/* Inline warn glyph — uses an exclamation triangle drawn
                        with the same stroke conventions as src/components/icons.
                        Done inline to avoid a new icon export for one use. */}
                    <svg
                      width={11}
                      height={11}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: 'var(--warn)', verticalAlign: 'middle', marginRight: 4 }}
                      aria-hidden="true"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {meta.footgun}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Sanitization"
        badge={{ text: unsafeExport ? 'unsafe' : 'safe', acc: !unsafeExport }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 6,
          }}
        >
          <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>
            Disable on export
          </span>
          <Toggle value={unsafeExport} onChange={setUnsafeExport} />
        </div>
        <p style={footgunStyle}>
          Advanced. Skips the DOMPurify pass on the exported SVG. Preview, snippets,
          and ZIP all use the unsanitized output. Off by default.
        </p>
      </Section>
    </>
  );
}
