import type { CSSProperties, ReactNode } from 'react';

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

export function Popover({ open, onClose, children, anchor = 'bl', style = {} }: PopoverProps) {
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
        style={{ ...pos, ...style }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
