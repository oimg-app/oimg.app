import { useState, type ReactNode } from 'react';

interface TooltipProps {
  label: string;
  kbd?: string;
  children: ReactNode;
}

export function Tooltip({ label, kbd, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
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
