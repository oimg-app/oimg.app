// Phase 4 plan 04-06 — File-row source-density popover trigger.
// Source: 04-CONTEXT.md D-01 + D-02 (SCOPED amendment); 04-UI-SPEC.md
// §Surface 1 + §Copywriting Contract; 04-PATTERNS.md §SourceDensityControl.
//
// UI affordance: a hover/focus-revealed chevron-down icon button at the right
// edge of the file-row stat line. Click/Enter/Space opens a Popover with a
// 3-button Seg (1x / 2x / 3x). Selecting an option closes the popover and
// mutates useFilesStore.setSourceDensity for the entry.
//
// Scope (CONTEXT.md `<post_research_amendments>` D-01/D-02 SCOPED): mid-flight
// density change is a Phase-5 enhancement. The popover MUTATES the entry's
// sourceDensity field only — variant fan-out re-runs only on initial drop.
// The TODO(P5) comment below marks Phase-5 ownership of re-fan-out logic.

import { useState } from 'react';
import { useFilesStore } from '@/stores/files';
import { Popover } from '@/components/ui/Popover';
import { Seg } from '@/components/ui/Seg';
import { Icons } from '@/components/icons';
import type { SourceDensity } from '@/types';

const DENSITIES: readonly SourceDensity[] = ['1x', '2x', '3x'] as const;

interface SourceDensityControlProps {
  /** FileEntry.id whose sourceDensity this trigger reads + mutates. */
  fileId: string;
}

/**
 * Hover/focus-revealed chevron icon button + Popover with Seg.
 * Parent file-row CSS controls visibility (the button is rendered always but
 * styled invisible until row :hover OR :focus-within — same pattern as
 * existing iconbtns in pane headers).
 *
 * a11y:
 *   - Button has aria-label "Change source density (currently {density})"
 *     (UI-SPEC §Surface 1 keyboard contract).
 *   - aria-haspopup + aria-expanded reflect popover state.
 *   - Popover handles Esc + outside-click (existing primitive).
 *   - Inside the Popover, Seg renders a radiogroup with arrow-key navigation.
 */
export function SourceDensityControl({ fileId }: SourceDensityControlProps) {
  const density = useFilesStore((s) => s.byId[fileId]?.sourceDensity);
  const [open, setOpen] = useState(false);

  // Defensive: if the file no longer exists in the store (e.g. removed
  // between render passes), skip rendering rather than crashing.
  if (!density) return null;

  const select = (next: SourceDensity) => {
    // TODO(P5): re-fan-out variants when sourceDensity changes mid-batch —
    // see CONTEXT.md D-01/D-02 SCOPED amendment. For Phase 4 the popover
    // only updates the cosmetic sourceDensity field on the existing entry;
    // variant family is not regenerated.
    useFilesStore.getState().setSourceDensity(fileId, next);
    setOpen(false);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="iconbtn"
        aria-label={`Change source density (currently ${density})`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        // Keyboard: Enter/Space already activate native button onClick.
        // Escape inside the popover is handled by the Popover primitive.
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          padding: 3,
          background: 'transparent',
          border: 'none',
          color: 'var(--fg-2)',
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        <Icons.ChevronDown size={14} />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor="br"
        style={{
          padding: 6,
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 4,
          boxShadow: 'var(--shadow-elev)',
        }}
      >
        <Seg<SourceDensity>
          options={DENSITIES}
          value={density}
          onChange={select}
          ariaLabel="Source density"
        />
      </Popover>
    </span>
  );
}
