# Phase 13: Diagnostics + Clear Queue - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Source:** v1.2 REQUIREMENTS.md + .planning/research/v1.2-diagnostics.md + codebase scout (no separate discuss-phase needed — scope locked at milestone level)

<domain>
## Phase Boundary

Phase 13 retires three pieces of v1.0/v1.1 stub data and adds one queue-hygiene affordance, all in service of v1.2's "transparency + polish" theme:

1. **Live diagnostics** — replace the StatusBar's hardcoded `svgoVersion: '4.0.1'`, `codecVersion: '0.6.0'`, `wasmInfo: 'WASM ready · 312 KB'` with values populated at build time via Vite `define`, plus runtime capability detection (SIMD, threads, `crossOriginIsolated`, `hardwareConcurrency`).
2. **Settings Diagnostics tab** — extend the existing Toolbar settings popover scaffold (currently shows "Workers: 4 (auto)") with a Diagnostics tab rendering the full version + capability surface, copy-to-clipboard via the Phase 12 `copyToClipboard` chokepoint.
3. **Clear queue** — add `clearFiles()` action + Toolbar "Clear all" menu item + FilesPane header × icon. Disable-then-explain when queue is empty (Phase 11 D-13 pattern reuse).

Phase 14 will replace the temporary "Offline-ready" derivation in DIA-03 with a real service-worker + precache state check. Phase 16 (SSIM) will append `ssim.js` version to the atom; Phase 17 (Butteraugli) will append the wasm build hash. This phase establishes the SHAPE so downstream phases plug in without atom-shape churn.

Requirements: **DIA-01** (build-time version injection), **DIA-02** (runtime capability detection), **DIA-03** (StatusBar live values + temporary Offline-ready derivation), **DIA-04** (Settings Diagnostics tab + copy-to-clipboard), **CLR-01** (clearFiles action + two affordances).

</domain>

<decisions>
## Implementation Decisions

### Vite `define` injection for build-time versions (DIA-01)
- **D-01:** Versions are injected via `vite.config.ts` `define` block, NOT runtime `import('pkg/package.json')` (the runtime approach works in dev but breaks in production Rollup output). Each version reads from the package's `package.json` at build time via a thin async loader in `vite.config.ts`. Map shape: `define: { '__SVGO_VERSION__': JSON.stringify(svgoVer), '__JSQUASH_VERSIONS__': JSON.stringify({...}), ... }`.
- **D-02:** Read versions from `node_modules/<pkg>/package.json` synchronously in the Vite config using `JSON.parse(fs.readFileSync(...))`. Packages to track: `svgo`, `@jsquash/webp`, `@jsquash/jpeg`, `@jsquash/avif`, `@jsquash/oxipng`, `@jsquash/png`, `@jsquash/resize`. SSIM + Butteraugli are added in Phases 16/17 — leave hooks for them now (e.g. comment in vite.config.ts noting where they slot in).
- **D-03:** The injected globals are consumed via a typed module wrapper `src/lib/versions.ts` that re-exports `BUILD_VERSIONS: { svgo: string; jsquash: { webp: string; ... }; ssim?: string; butteraugli?: { buildHash: string } | undefined }`. Components and stores read from this wrapper, NOT from the raw `__XXX__` globals (keeps types tight + makes the Phase 16/17 additions a single-file change).

### Runtime capability detection (DIA-02)
- **D-04:** Detection runs once on app boot in `src/main.tsx` BEFORE React renders (so the atom is populated by the time the first frame paints). Checks:
  - `simd`: `WebAssembly.validate(new Uint8Array([0,0x61,0x73,0x6d,1,0,0,0,1,5,1,0x60,0,1,0x7b]))` — minimal v128 SIMD module probe
  - `threads`: `typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated === true`
  - `crossOriginIsolated`: `globalThis.crossOriginIsolated === true` (separate from threads — useful for diagnostics even when SAB unused)
  - `hardwareConcurrency`: `navigator.hardwareConcurrency ?? 1` (the existing `WorkerPool` already uses this — DRY at the atom)
  - `offlineReady`: derive from `'serviceWorker' in navigator && navigator.serviceWorker.controller != null`. PLACEHOLDER until Phase 14 — note in `<deferred>` that the real `precacheComplete` flag lands in Phase 14.
- **D-05:** Detection results are written into the same `runtimeAtom` (under a new `caps` key) rather than a separate `versionsAtom`. The existing atom already holds `svgoVersion`/`codecVersion`/`wasmInfo` strings — D-08 reshapes these into structured fields. One atom = one update batch on boot.

### runtimeAtom reshape (DIA-01 + DIA-02 + DIA-03)
- **D-06:** Existing fields RETIRE: `svgoVersion: string`, `codecVersion: string`, `wasmInfo: string`. They were single-string blobs hardcoded at Phase 03 NAV-03 time. Replaced with structured fields:
  ```
  versions: { svgo: string; jsquash: Record<CodecKey, string>; ssim?: string; butteraugli?: { buildHash: string } }
  caps: { simd: boolean; threads: boolean; crossOriginIsolated: boolean; hardwareConcurrency: number; offlineReady: boolean }
  ```
  These fields populate from `BUILD_VERSIONS` (D-03) + the boot probe (D-04). Existing consumers (StatusBar lines using `svgoVersion`/`codecVersion`/`wasmInfo`) update to read from the new shape.
- **D-07:** The old single-string `wasmInfo` value rendered as `"WASM ready · 312 KB"` in StatusBar. New rendering derives a short string from `caps`: e.g. `"WASM ready · SIMD · MT"` (when both true) or `"WASM ready"` (when neither). The footer logic lives in the StatusBar component — derive in-place, no new atom field.

### StatusBar wiring (DIA-03)
- **D-08:** StatusBar's existing badges (`SVGO {svgoVersion}` etc.) read from `runtimeAtom.versions.svgo` + `runtimeAtom.versions.jsquash.webp` (etc.). The visual label format stays the same — only the data source changes. Tests pin the new format: `SVGO {versions.svgo}` and `WebP {versions.jsquash.webp}` (or whichever badges currently render).
- **D-09:** Footer "Offline-ready" pill stays VISUALLY identical but derives from `runtimeAtom.caps.offlineReady` (D-04). When `false` → renders as "Online-only" or hides entirely (PICK ONE — recommend HIDE, matches Phase 11 D-13 disable-then-explain philosophy: don't show a status that can't be trusted). Phase 14 will flip this on for real.

### Settings Diagnostics tab (DIA-04)
- **D-10:** The Toolbar settings popover stays a single `<Popover>` but its content becomes a tabbed surface. Use Radix `Tabs` (already in shadcn registry per CLAUDE.md). Tabs: "General" (the existing "Workers: 4 (auto)" item) and "Diagnostics" (new).
- **D-11:** The Diagnostics tab renders a single read-only `<dl>` (definition list) with version + capability rows. At the bottom a "Copy diagnostics" button calls `copyToClipboard(JSON.stringify({versions, caps}, null, 2), 'manifest', 'Diagnostics copied')` — reuses the Phase 12 chokepoint AND the existing `manifest` clipboard kind (matches the bug-report convenience use case).
- **D-12:** Diagnostics tab is keyboard-accessible (Tab navigates rows, Enter on Copy button). Radix Tabs provides arrow-key tab switching out of the box. Settings popover already keyboard-openable per Phase 03; this phase doesn't change that.

### Clear queue (CLR-01)
- **D-13:** `clearFiles()` action in `src/stores/files.ts`. Body: `filesAtom.setKey('entries', []); filesAtom.setKey('selectedId', null)`. Does NOT touch `runtimeAtom` (workers + jobs may still be in flight — let them complete or fail; the queue is a UI-side concept). If `runtimeAtom.runningJobs > 0`, surface a confirmation toast BEFORE clearing — "Cancel N in-flight jobs?" with a single "Clear anyway" action and an auto-dismiss "Keep". For v1.2 simplicity: confirmation is a `sonner` `toast.warning` with action button, NOT a modal dialog.
- **D-14:** Toolbar affordance: new menu item "Clear all" in the existing settings overflow Popover (D-10 General tab) OR a separate Toolbar overflow menu (kebab icon). Recommend: add to the **settings popover General tab** since the kebab adds another button to an already-busy Toolbar. Disabled-then-explain when `$totals.total === 0`.
- **D-15:** FilesPane header × icon: small `XCircle` (phosphor) ghost button next to the existing "FILES" label or search input. `title="Clear all files"` + `aria-label="Clear all files"`. Same `clearFiles()` action. Same disable-then-explain condition.

### Claude's Discretion
- The exact placement of the Diagnostics tab vs the General tab order (General first vs Diagnostics first — recommend General first to preserve current users' muscle memory).
- Whether to add a `$diagnosticsString` computed atom for the copy-to-clipboard convenience or just inline the JSON.stringify in the handler. Recommend inline — no consumer reuses it.
- Whether `runtimeAtom.caps.offlineReady` shows a spinner during SW registration (Phase 14 concern; this phase ships boolean only).
- Where exactly the FilesPane header × icon sits (left of search, right of search, or in the empty space between search and the count badge). Recommend: rightmost of the header row, grouped with any future "Sort by" or "Filter" controls.
- Whether Vite `define` injection breaks the existing `vite-plugin-react` Fast Refresh. Research-confirmed it does not.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` (Phase 13 block) — Goal + 5 Success Criteria + DIA-01..04 / CLR-01 mapping
- `.planning/REQUIREMENTS.md` — full v1.2 traceability with Phase 13 REQ definitions

### Research artifacts (v1.2-level — read alongside CONTEXT.md)
- `.planning/research/v1.2-diagnostics.md` — `versionsAtom` shape + Vite `define` mechanism + capability detection probes + Settings popover extension strategy
- `.planning/research/v1.2-pwa.md` — Phase 14 forward-reference for the real `offlineReady` derivation (Phase 13 places a placeholder)

### Project rules + stack
- `./CLAUDE.md` — TS strict, hooks/stores own logic, WCAG-AA, locked nanostores + Radix + sonner stack; PIPE-02 200 KB initial JS gzipped budget (195.12 KB currently — Phase 13 additions must NOT push over)
- `.planning/PROJECT.md` — Current Milestone v1.2 + Constraints

### Carry-forward from prior phases
- `.planning/phases/11-batch-optimize-export/11-CONTEXT.md` — D-13 disable-then-explain pattern (reused for D-14 + D-15)
- `.planning/phases/12-real-snippets/12-CONTEXT.md` — D-14/D-15 `copyToClipboard` chokepoint (reused for D-11)

### Codebase intelligence
- `src/stores/runtime.ts` (line 17–30) — existing `runtimeAtom` shape with the three string fields to retire (D-06)
- `src/components/shell/StatusBar.tsx` (line 9 + 52) — consumes `svgoVersion`/`codecVersion`/`wasmInfo`; update to new structured shape (D-08)
- `src/components/shell/Toolbar.tsx` (line 249) — existing Settings popover scaffold to extend with Tabs (D-10)
- `src/lib/clipboard.ts` — Phase 12 `copyToClipboard(text, kind, label)` chokepoint reused by D-11
- `src/components/panels/FilesPane.tsx` — FilesPane header location for D-15 × icon
- `src/stores/files.ts` (line 66 — `$hasDone` + `$totals` patterns) — analog for new `$queueEmpty` computed atom that drives D-14/D-15 disable

</canonical_refs>

<specifics>
## Specific Ideas

- **Reshape over extend** — replacing the three string fields (`svgoVersion`/`codecVersion`/`wasmInfo`) with structured `versions` + `caps` is the cleanest way to do this. Phase 16/17 then add `versions.ssim` + `versions.butteraugli.buildHash` without re-architecting.
- **One boot probe** — runtime capability detection runs ONCE in `main.tsx` before render. No re-probing on visibility change, no React-effect-based detection. Simple, cheap, correct.
- **Reuse the chokepoint, not the rendering** — the Diagnostics tab uses `copyToClipboard` for the export action but renders the data as a plain `<dl>` (definition list). No `<pre>` block, no syntax highlight — bug-report content is JSON in clipboard, human-readable in UI.
- **Clear queue stays simple** — no modal confirmation; a sonner toast with "Clear anyway" action is enough. Modals are heavier UI primitives this phase doesn't need to introduce.
- **D-09 chooses HIDE over "Online-only"** — showing a stale/wrong status is worse than hiding it. Phase 14 brings it back when it can be trusted.

</specifics>

<deferred>
## Deferred Ideas

- **Real `offlineReady` derivation** with `precacheComplete` flag — Phase 14 (PWA-02).
- **`ssim.js` + `butteraugli` version surfacing** in the Diagnostics tab — Phases 16 + 17 will append. This phase ships the shape only.
- **"Build date" in Diagnostics** — useful for matching diagnostics to a deploy. Could ship now (cheap: `define: { __BUILD_TIME__: Date.now() }`) but not required by DIA-NN; revisit if user wants it during execution.
- **"User agent" in Diagnostics** — out of zero-telemetry concern; UA is already visible in DevTools; redundant.
- **Toggleable detailed diagnostics** (verbose vs minimal mode) — premature; one read-only view is enough.
- **Confirmation modal for clear-queue** — toast with action button is sufficient for v1.2. Revisit if users report accidental clears.
- **Telemetry on install / clear / copy** — explicitly excluded by zero-telemetry constraint.
- **Custom WCAG-AA contrast on the banded green/yellow/red metric display** — Phase 16 concern, not Phase 13.

</deferred>

---

*Phase: 13-diagnostics-clear-queue*
*Context gathered: 2026-06-10*
