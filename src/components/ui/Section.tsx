import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  badge?: { text: string; acc?: boolean };
  children: ReactNode;
}

export function Section({ title, badge, children }: SectionProps) {
  return (
    <div className="section">
      <h3>
        <span>{title}</span>
        {badge && <span className={'badge ' + (badge.acc ? 'acc' : '')}>{badge.text}</span>}
      </h3>
      {children}
    </div>
  );
}
