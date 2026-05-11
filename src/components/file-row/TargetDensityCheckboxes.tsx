// Phase 4 plan 04-06 + 04-07 — target-density variant selector.
// Source: 04-CONTEXT.md D-01 + D-02; 04-UI-SPEC.md
// §Surface 2 + §Copywriting Contract; 04-PATTERNS.md §TargetDensityCheckboxes.
//
// Composition: lives inside TweaksPanel "Resize / Variants" section
// (Inspector). Binds to the currently-selected FileEntry's sourceFamilyId
// when no `sourceFamilyId` prop is passed — keeps a Phase-5 escape hatch
// for per-row mounting if that need returns.
//
// UI: three toggle buttons (1x · 2x · 3x) styled as a multi-select
// segmented group. Each carries role="checkbox" + aria-checked. The
// variant whose targetDensity === sourceDensity is LOCKED + dim-accent
// fill + aria-disabled="true" + tooltip "Source density (Nx) —
// included automatically".
//
// Plan 04-08: onToggle wired to addSourceWithVariants / removeFile / removeFamily.
// Check path → addSourceWithVariants({ targets: [density] })
// Uncheck path (siblings remain) → removeFile(entry.id)
// Uncheck path (last variant) → removeFamily(selectedFamilyId)

import { useFilesStore } from '@/stores/files';
import { useShallow } from 'zustand/react/shallow';
import type { SourceDensity } from '@/types';

const DENSITIES: readonly SourceDensity[] = ['1x', '2x', '3x'] as const;

interface TargetDensityCheckboxesProps {
  /** All FileEntries with this sourceFamilyId form one source's variant
   *  set. Optional — when omitted the component derives the family from
   *  the currently-selected FileEntry. */
  sourceFamilyId?: string;
}

/**
 * Target-density variant selector for the Inspector.
 *
 * a11y:
 *   - Each button has role="checkbox" + aria-checked.
 *   - Locked source button additionally has aria-disabled="true" so screen
 *     readers announce its state without offering a toggle action.
 *   - Group label "Generate variants for" is the locked aria-label
 *     (UI-SPEC §Copywriting Contract).
 *
 * Defensive empty-target rendering: if reading the family yields zero
 * entries, the inline error string `Pick at least one density` renders.
 * In Phase 4 this branch is unreachable from the normal drop path because
 * addSourceWithVariants always pushes ≥1 entry; this is purely a safety
 * net.
 */
export function TargetDensityCheckboxes({
  sourceFamilyId: sourceFamilyIdProp,
}: TargetDensityCheckboxesProps = {}) {
  // Plan 04-07 — when no prop is passed, resolve sourceFamilyId from the
  // currently-selected FileEntry. selectedId can be null, point at a
  // non-existent id (mid-cleanup), or point at an entry without a family
  // (legacy addFile path). All three cases collapse to undefined, which
  // hides the component below.
  const selectedFamilyId = useFilesStore((s) => {
    if (sourceFamilyIdProp !== undefined) return sourceFamilyIdProp;
    if (!s.selectedId) return undefined;
    const entry = s.byId[s.selectedId];
    return entry?.sourceFamilyId;
  });

  // Pull the full byId snapshot then filter to the family. Cheaper than a
  // selector per density — three densities at most + the family is a single
  // groupBy of the existing list.
  //
  // Plan 04-07 Rule 1 fix — wrap the .filter() selector in useShallow so the
  // derived array is referentially stable across renders. Without this, every
  // render returned a fresh array and React's useSyncExternalStore tripped
  // the "Maximum update depth exceeded / getSnapshot should be cached to avoid
  // an infinite loop" guard the moment a real FileEntry was rendered.
  const family = useFilesStore(
    useShallow((s) =>
      selectedFamilyId
        ? Object.values(s.byId).filter(
            (e) => e.sourceFamilyId === selectedFamilyId,
          )
        : [],
    ),
  );

  // Plan 04-08 — store actions for add/remove variant.
  const { addSourceWithVariants, removeFile, removeFamily } = useFilesStore(
    useShallow((s) => ({
      addSourceWithVariants: s.addSourceWithVariants,
      removeFile: s.removeFile,
      removeFamily: s.removeFamily,
    })),
  );

  if (!selectedFamilyId) return null;

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

  const onToggle = (density: SourceDensity) => {
    if (!selectedFamilyId || family.length === 0) return;

    if (!targetSet.has(density)) {
      // ADD: fan out a new variant. sourceBlob is shared across all family members.
      // applyDensitySuffix (called inside addSourceWithVariants) is idempotent —
      // passing any family member's name is safe; @Nx is stripped then re-applied.
      const ref = family.find((e) => e.targetDensity === sourceDensity) ?? family[0];
      void addSourceWithVariants({
        sourceBlob: ref.sourceBlob,
        sourceDensity: ref.sourceDensity,
        name: ref.name,
        format: ref.format,
        targets: [density],
      });
    } else {
      // REMOVE: specific variant, or the whole family if it is the last one.
      const toRemove = family.find((e) => e.targetDensity === density);
      if (!toRemove) return;
      if (family.length === 1) {
        removeFamily(selectedFamilyId);
      } else {
        removeFile(toRemove.id);
      }
    }
  };

  return (
    <div
      role="group"
      aria-label="Generate variants for"
      className="seg-sm"
      style={{ width: '100%' }}
    >
      {DENSITIES.map((d) => {
        const checked = targetSet.has(d);
        const locked = d === sourceDensity;
        return (
          <button
            key={d}
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-disabled={locked || undefined}
            tabIndex={locked ? -1 : 0}
            title={
              locked
                ? `Source density (${d}) — included automatically`
                : undefined
            }
            className={(checked ? 'on' : '') + (locked ? ' locked' : '')}
            style={{
              cursor: locked ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--mono)',
              fontVariantNumeric: 'tabular-nums',
              ...(locked && checked
                ? {
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                  }
                : {}),
            }}
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
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
