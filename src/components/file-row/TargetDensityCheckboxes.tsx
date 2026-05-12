// Inspector "Resize / Variants" — export-density selector.
// Clicking 2x/3x records which densities go into ZIP output (Phase 5 D-12).
// No file rows are added; setTargetDensities writes to FileEntry.targetDensities.
// Source density is always locked — always included in the export set.

import { useFilesStore } from '@/stores/files';
import { useShallow } from 'zustand/react/shallow';
import type { Density } from '@/types';

const DENSITIES: readonly Density[] = ['1x', '2x', '3x'] as const;

interface TargetDensityCheckboxesProps {
  /** Override the file whose export targets are shown. Defaults to selectedId. */
  fileId?: string;
}

export function TargetDensityCheckboxes({
  fileId: fileIdProp,
}: TargetDensityCheckboxesProps = {}) {
  const { activeId, entry, setTargetDensities } = useFilesStore(
    useShallow((s) => {
      const id = fileIdProp ?? s.selectedId;
      return {
        activeId: id,
        entry: id ? s.byId[id] : undefined,
        setTargetDensities: s.setTargetDensities,
      };
    }),
  );

  if (!entry || !activeId) return null;

  const sourceDensity = entry.sourceDensity;
  // Default: only source density is selected until the user picks more.
  const exportSet = new Set<Density>(entry.targetDensities ?? [sourceDensity]);
  exportSet.add(sourceDensity); // source is always present

  const onToggle = (density: Density) => {
    if (density === sourceDensity) return;
    const next = new Set(exportSet);
    if (next.has(density)) {
      next.delete(density);
    } else {
      next.add(density);
    }
    setTargetDensities(activeId, [...next]);
  };

  return (
    <div
      role="group"
      aria-label="Generate variants for"
      className="seg-sm"
      style={{ width: '100%' }}
    >
      {DENSITIES.map((d) => {
        const checked = exportSet.has(d);
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
                ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                : {}),
            }}
            onClick={() => {
              if (!locked) onToggle(d);
            }}
            onKeyDown={(e) => {
              if (!locked && (e.key === ' ' || e.key === 'Enter')) {
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
