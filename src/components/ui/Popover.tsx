import { useEffect, type CSSProperties, type ReactNode } from 'react';

type Anchor = 'bl' | 'br' | 'tr';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  anchor?: Anchor;
  style?: CSSProperties;
}

const POSITIONS: Record<Anchor, CSSProperties> = {
  bl: { top: '100%', left: 0, marginTop: 4 },
  br: { top: '100%', right: 0, marginTop: 4 },
  tr: { bottom: '100%', right: 0, marginBottom: 4 },
};

// Hand-rolled popover — Phase 1 deviation D-06 (see deferred-items.md).
// When closed we return null, so invisible items are removed from the tab
// order. While open, the backdrop swallows outside clicks and a window-
// level keydown listener closes on Escape.
export function Popover({ open, onClose, children, anchor = 'bl', style = {} }: PopoverProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const pos = POSITIONS[anchor];
  return (
    <>
      <div
        className="pop-backdrop"
        onMouseDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="popover"
        role="menu"
        style={{ ...pos, ...style }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
