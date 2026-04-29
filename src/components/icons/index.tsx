// Lucide-style hairline icons. 13×13 by default. Stroke = currentColor.
// Ported from example-ui/icons.jsx.

import type { SVGProps, ReactNode } from 'react';

interface IcProps extends SVGProps<SVGSVGElement> {
  d?: string;
  paths?: ReactNode;
  size?: number;
  sw?: number;
}

const Ic = ({ d, paths, size = 13, sw = 1.5, ...rest }: IcProps) => (
  <svg
    className="icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {paths || (d ? <path d={d} /> : null)}
  </svg>
);

export type IconProps = Omit<IcProps, 'd' | 'paths'>;

export const Icons = {
  Plus:    (p: IconProps) => <Ic {...p} d="M12 5v14M5 12h14" />,
  Upload:  (p: IconProps) => <Ic {...p} paths={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>} />,
  Download:(p: IconProps) => <Ic {...p} paths={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>} />,
  Play:    (p: IconProps) => <Ic {...p} d="M6 4l14 8-14 8V4z" />,
  Pause:   (p: IconProps) => <Ic {...p} paths={<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>} />,
  Settings:(p: IconProps) => <Ic {...p} paths={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></>} />,
  Search:  (p: IconProps) => <Ic {...p} paths={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />,
  Sun:     (p: IconProps) => <Ic {...p} paths={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>} />,
  Moon:    (p: IconProps) => <Ic {...p} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
  Copy:    (p: IconProps) => <Ic {...p} paths={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>} />,
  Check:   (p: IconProps) => <Ic {...p} d="M20 6L9 17l-5-5" />,
  X:       (p: IconProps) => <Ic {...p} d="M18 6L6 18M6 6l12 12" />,
  ChevronRight: (p: IconProps) => <Ic {...p} d="M9 18l6-6-6-6" />,
  ChevronDown:  (p: IconProps) => <Ic {...p} d="M6 9l6 6 6-6" />,
  Trash:   (p: IconProps) => <Ic {...p} paths={<><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /></>} />,
  Zap:     (p: IconProps) => <Ic {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  Layers:  (p: IconProps) => <Ic {...p} paths={<><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>} />,
  File:    (p: IconProps) => <Ic {...p} paths={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></>} />,
  Image:   (p: IconProps) => <Ic {...p} paths={<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>} />,
  Code:    (p: IconProps) => <Ic {...p} d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  BarChart:(p: IconProps) => <Ic {...p} paths={<><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>} />,
  Filter:  (p: IconProps) => <Ic {...p} d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  More:    (p: IconProps) => <Ic {...p} paths={<><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></>} />,
  Grid:    (p: IconProps) => <Ic {...p} paths={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>} />,
  Lock:    (p: IconProps) => <Ic {...p} paths={<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>} />,
  Eye:     (p: IconProps) => <Ic {...p} paths={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />,
};
