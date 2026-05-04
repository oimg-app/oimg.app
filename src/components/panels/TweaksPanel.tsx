// Phase 4 plan 04-06 — TweaksPanel sections (Resize / Variants + Privacy / Metadata).
// Source: 04-CONTEXT.md D-05 + D-06 + D-09 + D-10 amendment; 04-UI-SPEC.md
// §Surface 4 + §Surface 5 + §Surface 9; 04-PATTERNS.md lines 508-555.
//
// Two named section components live here so Plan 04-07 can wire them into the
// existing TweaksPanel composition root (currently CodecPanel + SvgoPanel are
// rendered directly by App.tsx). Both sections are presentational +
// selector-bound; they do NOT mutate behavior of startOptimize or the pool
// callbacks (those land in Plan 04-07).
//
// Critical disclosure: the Preserve-ICC helper text is locked verbatim per
// UI-SPEC §Surface 9 (D-10 amendment) and tells the truth about the worker
// no-op. Drift = blocker per threat T-04-06-01 / T-04-06-02.

import { Section } from '@/components/ui/Section';
import { Toggle } from '@/components/ui/Toggle';
import { Seg } from '@/components/ui/Seg';
import { TargetDensityCheckboxes } from '@/components/file-row/TargetDensityCheckboxes';
import { useSettingsStore } from '@/stores/settings';
import { RESIZE_ALG } from '@/data/defaults';
import type { ResizeAlg } from '@/types';

// Helper-text style — mirrors SvgoPanel.tsx footgunStyle (lines 68-73) so the
// visual contract for "panel helper paragraph" stays one block across panels.
const helperStyle = {
  margin: '4px 0 0',
  font: '11.5px var(--sans, Inter)',
  color: 'var(--fg-2)',
  lineHeight: 1.45,
} as const;

/**
 * UI-SPEC §Surface 4 — TweaksPanel "Resize / Variants" section.
 *
 * Single row: Algorithm label + 4-option Seg (lanczos3 default, mitchell,
 * catrom, triangle). Bound to useSettingsStore.resize.alg via setResize.
 * Section visible on every codec tab (resize affects rasters; SVG variants
 * are a no-op but the global-config UX should be consistent).
 */
export function TweaksResizeSection() {
  const alg = useSettingsStore((s) => s.resize.alg);
  const setAlg = (next: ResizeAlg) =>
    useSettingsStore.getState().setResize({ alg: next });
  return (
    <Section title="Resize / Variants">
      <div
        className="row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <label
          style={{ fontSize: 11.5, color: 'var(--fg-2)' }}
          htmlFor="tweaks-resize-alg"
        >
          Algorithm
        </label>
        <Seg
          options={RESIZE_ALG}
          value={alg}
          onChange={setAlg}
          ariaLabel="Resize algorithm"
        />
      </div>
      {/* Plan 04-07 — variant target-density selector moved here from the
          file-row. Self-binds to the currently-selected FileEntry; renders
          nothing when no file is selected or the entry has no
          sourceFamilyId (legacy addFile path). */}
      <div
        className="row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center',
          gap: 10,
          paddingTop: 8,
        }}
      >
        <label style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>
          Generate variants
        </label>
        <TargetDensityCheckboxes />
      </div>
    </Section>
  );
}

/**
 * UI-SPEC §Surface 5 — TweaksPanel "Privacy / Metadata" section.
 *
 * Two rows:
 *   1. Strip metadata toggle (default ON; bound to global.stripMetadata).
 *   2. Preserve ICC color profiles toggle (default OFF; bound to
 *      global.preserveIccProfile). Helper text below is the LOCKED verbatim
 *      copy from UI-SPEC §Surface 9 — it is the SOLE disclosure preventing
 *      the ICC no-op from being a UI lie (D-10 amendment + threat T-04-06-02).
 *
 * Helper text is ALWAYS visible (no aria-expanded, no details). 11.5px
 * Inter regular, 1.45 line-height, var(--fg-2) color (UI-SPEC §Surface 9).
 */
export function TweaksPrivacySection() {
  const stripMetadata = useSettingsStore((s) => s.global.stripMetadata);
  const setStripMetadata = (v: boolean) =>
    useSettingsStore.getState().setGlobal({ stripMetadata: v });
  const preserveIcc = useSettingsStore((s) => s.global.preserveIccProfile);
  const setPreserveIcc = (v: boolean) =>
    useSettingsStore.getState().setGlobal({ preserveIccProfile: v });
  return (
    <Section title="Privacy / Metadata">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
        }}
      >
        <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>
          Strip metadata
        </span>
        <Toggle value={stripMetadata} onChange={setStripMetadata} />
      </div>
      <p style={helperStyle}>
        {/* Locked copy (UI-SPEC §Copywriting Contract): Strip metadata helper. */}
        Removes EXIF, XMP, IPTC, and ICC by default. Required for privacy-first
        defaults.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
        }}
      >
        <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>
          Preserve ICC color profiles
        </span>
        <Toggle value={preserveIcc} onChange={setPreserveIcc} />
      </div>
      <p style={helperStyle}>
        {/* LOCKED verbatim — UI-SPEC §Surface 9 + §Copywriting Contract.
            Drift = blocker per threats T-04-06-01 + T-04-06-02 (D-10 amend). */}
        Wired but inactive in this version. Color profiles are stripped along
        with all metadata. ICC preservation ships in v1.1 once raster encoders
        integrate.
      </p>
    </Section>
  );
}
