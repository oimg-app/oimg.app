---
phase: 13-diagnostics-clear-queue
verified: 2026-06-11T09:10:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Copy diagnostics → paste into a real bug-report editor"
    expected: "JSON contains live versions + caps; is parseable and human-readable"
    why_human: "Clipboard round-trip crosses application boundary; can't be programmatically verified outside Playwright fixture"
  - test: "StatusBar version badges render at WCAG-AA contrast in both dark and light themes"
    expected: "SVGO + jSquash badges remain legible after theme toggle"
    why_human: "Visual contrast judgement; VALIDATION.md §Manual-Only row 3"
  - test: "Capability detection on real low-end device (older iPhone / low-end Android)"
    expected: "caps.simd and caps.threads reflect actual hardware support"
    why_human: "CI runners don't represent low-end mobile silicon; VALIDATION.md §Manual-Only row 2"
---

# Phase 13: Diagnostics + Clear Queue — Verification Report

**Phase Goal:** Replace hardcoded version badges and "Offline-ready" stub text with live diagnostic values. Add Settings Diagnostics tab. Land `clearFiles()` action with Toolbar + FilesPane affordances.
**Verified:** 2026-06-11T09:10:00Z
**Status:** human_needed (automated SCs PASS; 3 manual checks pending per VALIDATION.md)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (5 ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | `versionsAtom` populated at build time via Vite `define` with live svgo + per-codec jSquash versions | ✓ VERIFIED | `vite.config.ts:14-31` reads `node_modules/<pkg>/package.json` via `readVer()`; `define:` block lines 84-89 wraps every value in `JSON.stringify(...)` (T-13-02 + PATTERNS risk #3 mitigated). `src/lib/versions.ts:42-49` exports `BUILD_VERSIONS` with documented shape + safe fallbacks. `dist/assets/index-D4uiN2UH.js` grep shows 0 raw `__XXX__` tokens — literals inlined at build. Unit: `versions.test.ts` 17/17 pass. NOTE: ssim version "(Phase 16)" still pending — matches ROADMAP SC-1 wording but Phase 13 ships only the hook (line 47 of versions.ts: `// Phase 16` slot). |
| SC-2 | App boot detects SIMD / threads / `crossOriginIsolated` / `hardwareConcurrency` and caches in `caps` | ✓ VERIFIED | `src/lib/caps.ts:27-32` defines SIMD probe (Uint8Array with v128 opcodes — `WebAssembly.validate` returns `true` in Node verification). Note: code comment says "47-byte" but probe is 31 bytes (standard SIMD detect variant); validates correctly — comment is doc-drift, NOT a behavior gap. `caps.ts:34-62` probes all five fields. `src/main.tsx:26` calls `setCaps(probeCaps())` BEFORE `createRoot(...).render(...)` (line 49). Unit: `caps.test.ts` 13/13 pass. |
| SC-3 | StatusBar reads live values from atom; "Offline-ready" derives from SW registration (HIDE when false) | ✓ VERIFIED | `StatusBar.tsx:13` destructures `versions, caps` (legacy strings retired). Line 64: `SVGO {versions.svgo}`. Line 67: `jSquash · webp {versions.jsquash.webp}`. Lines 26-30: `wasmStr` derived in-place from `caps.simd && caps.threads`. Lines 75-80: D-09 HIDE rule — `{caps.offlineReady && (...)}` renders nothing when false (NOT "Online-only"). `grep svgoVersion\|codecVersion\|wasmInfo src/` returns hits only inside `*.test.ts` and Phase 13 banner comments — no live production references. E2e `statusbar-versions.spec.ts` declared in VALIDATION.md (not run here — Playwright). |
| SC-4 | Settings popover gains Diagnostics tab + Copy diagnostics via Phase 12 chokepoint | ✓ VERIFIED | `Toolbar.tsx:436` `<Tabs defaultValue="general">`; lines 437-440 TabsList with General (first per D-10 ordering) + Diagnostics. Lines 471-509 Diagnostics TabContent: versions + caps rendered in read-only `<dl>` (D-11), Copy button lines 496-508 routes through `copyToClipboard(JSON.stringify({versions, caps}, null, 2), 'manifest', 'Diagnostics')` — toast appends "copied" → "Diagnostics copied" matches D-11 spec. `grep navigator.clipboard src/components/shell/Toolbar.tsx` → 0 hits (chokepoint exclusivity preserved, T-13-01 mitigation). Clear all button still present in General tab (lines 454-469). E2e `settings-diagnostics.spec.ts` 4/4 per regression sweep. |
| SC-5 | `clearFiles()` action + Toolbar Clear all + FilesPane × icon; both disable-then-explain when queue empty | ✓ VERIFIED | `src/stores/files.ts:83-86` `clearFiles()` body literally: `filesAtom.setKey('entries', [])` + `filesAtom.setKey('selectedId', null)`. Line 69: `$queueEmpty = computed(filesAtom, (s) => s.entries.length === 0)`. `Toolbar.tsx:454-469` Clear all menu item: `disabled={queueEmpty}` + `aria-disabled={queueEmpty}` + `title={clearDisabledTitle}` (disable-then-explain triple). `FilesPane.tsx:89-101` XCircle button: `disabled={queueEmpty}` + `aria-disabled={queueEmpty}` + `title={queueEmpty ? 'No files to clear' : 'Clear all files'}`. Both handlers (`Toolbar.tsx:76-85`, `FilesPane.tsx:39-48`) call `runtimeAtom.get().runningJobs` snapshot and surface `toast.warning` with "Clear anyway" action when runningJobs > 0 (T-13-03 mitigation). Units: `clearfiles.test.ts` 11/11 pass (via `_alias-loader.mjs`). |

**Score:** 5/5 SCs verified

### Decision Coverage (D-01..D-15)

| D | Citation |
|---|----------|
| D-01 | `vite.config.ts:84-89` `define:` block (NOT runtime `import('pkg/package.json')`) |
| D-02 | `vite.config.ts:14-17` `readVer()` reads `node_modules/<pkg>/package.json` synchronously |
| D-03 | `src/lib/versions.ts:22-49` `BUILD_VERSIONS` typed wrapper with `ssim?` + `butteraugli?` hooks |
| D-04 | `src/lib/caps.ts:34-62` `probeCaps()` synchronous, populates all five fields |
| D-05 | `src/stores/runtime.ts:22-23, 41-42` `versions` + `caps` under same `runtimeAtom`, no separate atom |
| D-06 | `runtime.ts` — no `svgoVersion\|codecVersion\|wasmInfo` strings anywhere in production source (grep clean) |
| D-07 | `StatusBar.tsx:26-30` four-way ternary derives wasm string in-place from `caps.simd && caps.threads` |
| D-08 | `StatusBar.tsx:64, 67` `SVGO {versions.svgo}` + `jSquash · webp {versions.jsquash.webp}` |
| D-09 | `StatusBar.tsx:75-80` Offline-ready pill renders only when `caps.offlineReady === true` (HIDE branch) |
| D-10 | `Toolbar.tsx:436-440` Radix Tabs with General first, Diagnostics second |
| D-11 | `Toolbar.tsx:474-493` `<dl>` versions + caps; lines 496-508 Copy via `copyToClipboard` Phase 12 chokepoint with `'manifest'` kind |
| D-12 | Radix Tabs provides arrow-key tab switching; Copy button is keyboard-operable `<button type="button">` |
| D-13 | `files.ts:83-86` `clearFiles()` mutates entries + selectedId only; runtimeAtom untouched. `Toolbar.tsx:76-85` + `FilesPane.tsx:39-48` warning-toast (sonner) confirmation when `runningJobs > 0` |
| D-14 | `Toolbar.tsx:454-469` Clear all in Settings popover General tab + disable-then-explain triple |
| D-15 | `FilesPane.tsx:89-101` XCircle ghost button in header row + identical disable-then-explain triple + same `clearFiles()` action |

### Threat Mitigation (T-13-01..04)

| Threat | Mitigation Evidence |
|--------|---------------------|
| T-13-01 (clipboard regression) | `Toolbar.tsx:500` routes via `copyToClipboard(...)`; `grep navigator.clipboard src/components/shell/Toolbar.tsx` → 0 hits |
| T-13-02 (filesystem read injection) | `vite.config.ts:14-17` `readVer()` only reads `node_modules/<pkg>/package.json` `.version` field; no env/path interpolation; comment lines 9-11 documents the constraint |
| T-13-03 (silent destructive clear) | `Toolbar.tsx:76-85` + `FilesPane.tsx:39-48` surface `toast.warning` with "Clear anyway" action when `runtimeAtom.get().runningJobs > 0` |
| T-13-04 (HTML injection in Diagnostics) | `Toolbar.tsx:474-493` `<dl>` uses React's default text escaping for all values; no `dangerouslySetInnerHTML` (grep src/components/shell/Toolbar.tsx → 0 hits) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DIA-01 | 13-01-PLAN | Build-time version injection | ✓ SATISFIED | SC-1 evidence + vite.config.ts:84-89 |
| DIA-02 | 13-02-PLAN | Runtime capability detection | ✓ SATISFIED | SC-2 evidence + main.tsx:26 |
| DIA-03 | 13-03-PLAN | StatusBar live values + Offline-ready derivation | ✓ SATISFIED | SC-3 evidence |
| DIA-04 | 13-07-PLAN | Settings Diagnostics tab + Copy chokepoint | ✓ SATISFIED | SC-4 evidence |
| CLR-01 | 13-04/05/06-PLAN | clearFiles + Toolbar + FilesPane affordances | ✓ SATISFIED | SC-5 evidence |

Note: `.planning/REQUIREMENTS.md` table still shows DIA-01..04 as "Pending" (line 84-87). This is a metadata bookkeeping miss, not an implementation gap — CLR-01 was updated to "Complete" on line 80 but the DIA-NN rows were not. Flag for the planner / cleanup pass; does not block phase goal.

### Build Budget

`./node_modules/.bin/vite build` produces `dist/assets/index-D4uiN2UH.js` = **197.54 KB gzipped** (< 200 KB ceiling per PIPE-02 / CLAUDE.md). Phase 13 additions fit within the budget.

### Anti-Pattern Scan

No blockers. No unreferenced `TBD\|FIXME\|XXX` markers introduced. No empty stubs in modified files. `INITIAL_CAPS` "safe zero" in `runtime.ts:28-34` is overwritten pre-render by `main.tsx:26` — not a stub (verified by data-flow trace).

### Test Results (Re-Run)

| Suite | Result |
|-------|--------|
| `versions.test.ts` | 17/17 PASS |
| `caps.test.ts` | 13/13 PASS |
| `runtime-shape.test.ts` | 6/6 PASS (per-suite counter; full file 24 assertions per SUMMARY) |
| `clearfiles.test.ts` | 11/11 PASS (with `_alias-loader.mjs`) |
| `vite build` | PASS (`tsc -b` has 2 pre-existing errors in `snippets.ts` + `toolbar-snippets.spec.ts` — NOT Phase 13 surface; project memory confirms baseline tsc is red with pre-existing debt) |

E2e suites (`statusbar-versions`, `toolbar-clear`, `filespane-clear`, `settings-diagnostics`) declared green per the verification context's regression sweep; not re-executed here (Playwright outside verifier latency budget).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| SIMD probe validates in Node | `node -e "WebAssembly.validate(new Uint8Array([0,0x61,...,0x0b]))"` | `true` | ✓ PASS |
| Production bundle omits raw define globals | `grep __SVGO_VERSION__ dist/assets/index-D4uiN2UH.js` | 0 matches | ✓ PASS |
| Toolbar avoids navigator.clipboard | `grep navigator.clipboard src/components/shell/Toolbar.tsx` | 0 matches | ✓ PASS |
| Legacy retired fields absent from production | `grep svgoVersion src/stores src/components src/main.tsx` | 0 matches | ✓ PASS |

### Human Verification Required

Three items per VALIDATION.md §Manual-Only — see frontmatter `human_verification` block.

### Gaps Summary

No code gaps. Two informational items for the planner:

1. **REQUIREMENTS.md bookkeeping** — DIA-01..04 rows still say "Pending" on lines 84-87. Update to "Complete".
2. **Doc-drift in caps.ts:27 + PATTERNS.md:141** — comment says "47-byte SIMD probe" but the array is 31 bytes. Probe is functionally correct (`WebAssembly.validate` returns `true`); only the comment is wrong. Suggest fixing the comment to "31-byte" in a quick docs cleanup.
3. **ROADMAP plan checkboxes** — Plan 13-07 checkbox still `[ ]` on line 81; should be `[x]` since the Settings Tabs are shipped (SUMMARY + e2e green).

---

*Verified: 2026-06-11T09:10:00Z*
*Verifier: Claude (gsd-verifier)*
