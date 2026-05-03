// Phase 4 plan 04-06 — File-row target-density checkbox group.
// Source: 04-CONTEXT.md D-01 + D-02 (SCOPED amendment); 04-UI-SPEC.md
// §Surface 2 + §Copywriting Contract; 04-PATTERNS.md §TargetDensityCheckboxes.
//
// UI: three role="checkbox" boxes (1x · 2x · 3x). aria-checked iff a variant
// of that target density exists in the family. The variant whose
// targetDensity === sourceDensity is LOCKED + dim-accent fill +
// aria-disabled="true" + tooltip "Source density (Nx) — included automatically".
//
// Scope (CONTEXT.md `<post_research_amendments>` D-01/D-02 SCOPED): toggling a
// non-locked checkbox is a NO-OP in Phase 4. Initial drop already takes
// targets[]; mid-flight target edit is Phase-5 enhancement. TODO(P5) comment
// below marks the wiring point.

import { useFilesStore } from '@/stores/files';
import { useShallow } from 'zustand/react/shallow';
import type { SourceDensity } from '@/types';

const DENSITIES: readonly SourceDensity[] = ['1x', '2x', '3x'] as const;

interface TargetDensityCheckboxesProps {
  /** All FileEntries with this sourceFamilyId form one source's variant set. */
  sourceFamilyId: string;
}

/**
 * Per-row target-density checkbox group.
 *
 * a11y:
 *   - Each checkbox has role="checkbox" + aria-checked.
 *   - Locked source checkbox additionally has aria-disabled="true" so screen
 *     readers announce its state without offering a toggle action.
 *   - Visually hidden group label "Generate variants for" (UI-SPEC §Copywriting).
 *
 * Defensive empty-target rendering: if reading the family yields zero entries,
 * the inline error string `Pick at least one density` renders. In Phase 4 this
 * branch is unreachable from the normal drop path because addSourceWithVariants
 * always pushes ≥1 entry; this is purely a safety net.
 */
export function TargetDensityCheckboxes({
  sourceFamilyId,
}: TargetDensityCheckboxesProps) {
  // Pull the full byId snapshot then filter to the family. Cheaper than a
  // selector per density — three densities at most + the family is a single
  // groupBy of the existing list.
  //
  // Plan 04-07 Rule 1 fix — wrap the .filter() selector in useShallow so the
  // derived array is referentially stable across renders. Without this, every
  // render returned a fresh array and React's useSyncExternalStore tripped the
  // "Maximum update depth exceeded / getSnapshot should be cached to avoid an
  // infinite loop" guard the moment a real FileEntry was rendered (caught by
  // raster.spec.ts metadata-strip test as a blank-DOM page during execution).
  const family = useFilesStore(
    useShallow((s) =>
      Object.values(s.byId).filter((e) => e.sourceFamilyId === sourceFamilyId),
    ),
  );

  if (family.length === 0) {
    return (
      <span
        role="alert"
        style={{
          fontSize: 11.5,
          color: 'var(--err)',
          fontFamily: 'var(--mono)',
        }}
      >
        Pick at least one density
      </span>
    );
  }

  // All variants in a family share the same sourceDensity (set at fan-out time).
  const sourceDensity = family[0].sourceDensity;
  // Set of target densities currently materialized for this family.
  const targetSet = new Set(
    family.map((e) => e.targetDensity).filter((d): d is SourceDensity => !!d),
  );

  const onToggle = (_density: SourceDensity) => {
    // TODO(P5): toggle handler should add/remove family member via
    // addSourceWithVariants/removeFile — see CONTEXT.md D-01/D-02 SCOPED
    // amendment. For Phase 4 mid-flight target edits are no-ops; the initial
    // drop's targets[] is the authoritative variant set.
  };

  return (
    <span
      role="group"
      aria-label="Generate variants for"
      style={{
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        fontFamily: 'var(--mono)',
        fontSize: 11,
      }}
    >
      {DENSITIES.map((d) => {
        const checked = targetSet.has(d);
        const locked = d === sourceDensity;
        return (
          <label
            key={d}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: locked ? 'not-allowed' : 'pointer',
              color: 'var(--fg-1)',
            }}
            // Tooltip surrogate — Radix Tooltip wiring lands in Plan 04-07
            // when the row composition root mounts the Tooltip provider.
            title={
              locked
                ? `Source density (${d}) — included automatically`
                : undefined
            }
          >
            <span
              role="checkbox"
              aria-checked={checked}
              aria-disabled={locked || undefined}
              tabIndex={locked ? -1 : 0}
              onClick={() => {
                if (locked) return;
                onToggle(d);
              }}
              onKeyDown={(e) => {
                if (locked) return;
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onToggle(d);
                }
              }}
              className={'check' + (checked ? ' on' : '')}
              style={{
                width: 13,
                height: 13,
                display: 'inline-block',
                borderRadius: 2,
                border: '1px solid var(--line)',
                background: checked
                  ? locked
                    ? 'var(--accent-dim)'
                    : 'var(--accent)'
                  : 'transparent',
                cursor: locked ? 'not-allowed' : 'pointer',
              }}
            />
            {d}
          </label>
        );
      })}
    </span>
  );
}
