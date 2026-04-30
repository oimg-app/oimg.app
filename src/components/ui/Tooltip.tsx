import { useId, useState, type ReactNode } from 'react';

interface TooltipProps {
  label: string;
  kbd?: string;
  children: ReactNode;
}

// Hand-rolled tooltip — Phase 1 deviation D-06 (see deferred-items.md).
// The visible bubble carries an id; the trigger is wired with
// aria-describedby so screen readers announce the label on focus or hover.
// Hides on Escape or blur in addition to mouse leave.
export function Tooltip({ label, kbd, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      aria-describedby={show ? id : undefined}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setShow(false);
      }}
    >
      {children}
      {show && (
        <span
          id={id}
          role="tooltip"
          className="tip"
          style={{ left: '50%', top: 'calc(100% + 6px)', transform: 'translateX(-50%)' }}
        >
          {label}
          {kbd && <span className="kbd-inv">{kbd}</span>}
        </span>
      )}
    </span>
  );
}
