import { useRef } from 'react';

interface SegProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}

// Hand-rolled segmented control — Phase 1 deviation D-06 (see deferred-items.md).
// Modeled as an ARIA radio group: roving tabindex (only the selected radio
// is in the tab sequence), Arrow Left/Right move focus and select.
export function Seg<T extends string>({ options, value, onChange, ariaLabel = 'Options' }: SegProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusIndex = (i: number) => {
    const len = options.length;
    const next = ((i % len) + len) % len;
    onChange(options[next]);
    refs.current[next]?.focus();
  };

  return (
    <div className="seg-sm" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o, i) => {
        const checked = value === o;
        return (
          <button
            key={o}
            ref={(el) => { refs.current[i] = el; }}
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={checked ? 'on' : ''}
            onClick={() => onChange(o)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                focusIndex(i + 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                focusIndex(i - 1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                focusIndex(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                focusIndex(options.length - 1);
              }
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
