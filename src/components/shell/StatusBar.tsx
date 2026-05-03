// StatusBar — 22px footer.
// Extracted from src/App.tsx (lines 721–733) in plan 01-04.
// Owns: worker pip, tooling badges, totals on the right.
// Visual contract: classNames and ARIA roles must NOT change.
// role="contentinfo" is asserted by src/tests/shell.spec.ts.
//
// Phase 1 note: "5 workers" remains a hardcoded literal — Phase 2 will wire
// it to the real worker pool state (see CLAUDE.md, Open Questions §10).

import { fmtBytes } from '@/lib/format'
import { BackpressureIndicator } from './BackpressureIndicator'

interface StatusBarProps {
  running: boolean
  filesCount: number
  origTotal: number // bytes
  optTotal: number // bytes
  compressionPct: number
  savedBytes: number // bytes
}

export function StatusBar(props: StatusBarProps) {
  const { running, filesCount, origTotal, optTotal, compressionPct, savedBytes } = props
  return (
    <footer role="contentinfo" className="statusbar">
      <span className="item">
        <span className={'pip' + (running ? '' : ' idle')}></span>
        {running ? '5 workers running' : '5 workers idle'}
      </span>
      {/* Phase 4 plan 04-06 — D-13 backpressure pill. Renders nothing when
          throttleActive is false; sits between worker-pip and SVGO version. */}
      <BackpressureIndicator />
      <span className="item">SVGO 4.0.1</span>
      <span className="item">@squoosh-kit/core 0.6.0</span>
      <span className="item">WASM ready · 312 KB</span>
      <span className="item">
        {filesCount} files · {fmtBytes(origTotal)} → {fmtBytes(optTotal)}
      </span>
      <span className="right">
        avg compression {compressionPct.toFixed(1)}% · saved {fmtBytes(savedBytes)}
      </span>
    </footer>
  )
}
