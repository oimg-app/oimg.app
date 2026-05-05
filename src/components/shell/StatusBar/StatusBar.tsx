// StatusBar — 22px footer.
// Extracted from src/App.tsx (lines 721–733) in plan 01-04.
// Owns: worker pip, tooling badges, totals on the right.
// Quick task 260505-0hr — Task 6: classes migrated to statusBar.module.css.
// `.statusbar` and the parent layout move to the module; `.item` / `.pip`
// inside this component reference module classes via `s.item` / `s.pip`,
// while the BackpressureIndicator child's bare `.item` / `.pip warn`
// classNames are matched by `.statusbar :global(.item)` rules in the
// module so that child does not need its own migration in this chunk.
// role="contentinfo" still asserted by src/tests/shell.spec.ts.
//
// Phase 1 note: "5 workers" remains a hardcoded literal — Phase 2 will wire
// it to the real worker pool state (see CLAUDE.md, Open Questions §10).

import clsx from 'clsx'
import { fmtBytes } from '@/lib/format'
import { BackpressureIndicator } from '../BackpressureIndicator'
import s from './statusBar.module.css'

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
    <footer role="contentinfo" className={s.statusbar}>
      <span className={s.item}>
        <span className={clsx(s.pip, !running && s.pipIdle)}></span>
        {running ? '5 workers running' : '5 workers idle'}
      </span>
      {/* Phase 4 plan 04-06 — D-13 backpressure pill. Renders nothing when
          throttleActive is false; sits between worker-pip and SVGO version. */}
      <BackpressureIndicator />
      <span className={s.item}>SVGO 4.0.1</span>
      <span className={s.item}>@squoosh-kit/core 0.6.0</span>
      <span className={s.item}>WASM ready · 312 KB</span>
      <span className={s.item}>
        {filesCount} files · {fmtBytes(origTotal)} → {fmtBytes(optTotal)}
      </span>
      <span className={s.right}>
        avg compression {compressionPct.toFixed(1)}% · saved {fmtBytes(savedBytes)}
      </span>
    </footer>
  )
}
