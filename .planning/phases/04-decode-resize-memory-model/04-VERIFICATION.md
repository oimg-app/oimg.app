---
phase: 04-decode-resize-memory-model
verified: 2026-05-12T08:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "Density checkboxes in Inspector create/remove variant rows — onToggle now wired to addSourceWithVariants / removeFile / removeFamily"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run npm run dev, drop PNG, click 2x in Inspector Resize/Variants — second row @2x must appear"
    expected: "Checking 2x creates a @2x row in the file list; unchecking it removes the row"
    why_human: "onToggle now calls store actions but runtime correctness (store mutation → re-render → row appears) requires live browser observation"
  - test: "Drop 50 PNG files, click Optimize, watch Chrome DevTools Memory timeline"
    expected: "JS heap peak stays below 800 MB throughout the batch"
    why_human: "Admission gate logic is correct in code; runtime heap behavior requires in-browser measurement"
  - test: "Drop with-icc.png, optimize, download output, inspect bytes for absence of iCCP"
    expected: "Optimized output contains no iCCP byte sequence"
    why_human: "icc.test.ts has a WASM soft-fallback path; Playwright E2E test requires a running dev server for authoritative confirmation"
---

# Phase 4: Decode + Resize + Memory Model — Verification Report (Re-verification)

**Phase Goal:** Implement the PNG decode → resize → re-encode pipeline with memory-aware admission gate and density variant fan-out. The worker pool must throttle batch processing to stay under 800 MB. Density checkboxes in the Inspector must create/remove variant rows.
**Verified:** 2026-05-12T08:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after cherry-pick landing 04-08 implementation on main

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Checking a density checkbox creates that variant row; unchecking removes it | VERIFIED | `TargetDensityCheckboxes.tsx` `onToggle` now calls `addSourceWithVariants({ targets: [density] })` on check and `removeFile(entry.id)` / `removeFamily(selectedFamilyId)` on uncheck. No TODO stub remains. |
| SC-2 | Processing 50 raster files stays under 800 MB peak | VERIFIED (code) | `pool.ts` admission gate: `inflightBytes` tracked, `computeMemoryBudget()` at construction, deadlock prevention present. Human runtime confirmation pending. |
| SC-3 | Metadata absent from decoded output; ICC preserved when toggled | VERIFIED (code) | `png-adapter.ts` strips ICC; `icc.test.ts` live; `raster.spec.ts` metadata-strip test live. |
| SC-4 | `URL.revokeObjectURL` called for every processed Blob — no leaks | VERIFIED | `removeFile` wired with URL revoke; `removeFamily` loops `removeFile`. |

**Score:** 4/4 truths verified (code-level). Human verification required for SC-1, SC-2, SC-3 runtime behavior.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/components/file-row/TargetDensityCheckboxes.tsx` | VERIFIED | `onToggle` fully implemented — check path calls `addSourceWithVariants`, uncheck path calls `removeFile` (siblings exist) or `removeFamily` (last variant). No TODO stub. `useShallow` wraps store action selector. |
| `src/components/panels/InspectorPane.tsx` | VERIFIED | `perFileOverride` selector at line 40-42 uses `useShallow((s) => selectedId ? (s.perFile[selectedId] ?? {}) : {})`. |
| `src/stores/files.ts` | VERIFIED | `addSourceWithVariants`, `removeFile`, `removeFamily` all fully implemented. |
| `src/lib/memory-budget.ts` | VERIFIED | `computeMemoryBudget` + `estimateJobBytes` exported; 600 MB cap. |
| `src/workers/pool.ts` | VERIFIED | `inflightBytes`, `memoryBudgetBytes`, admission gate, deadlock prevention all present. |
| `src/workers/png-adapter.ts` | VERIFIED | PNG decode → resize → re-encode; `@jsquash/png` + `@jsquash/resize` imports. |
| `src/lib/filename.ts` | VERIFIED | `applyDensitySuffix` (idempotent) + `deduplicateName` exported. |
| `src/lib/sniff.ts` | VERIFIED | `sniffPngDimensions` exported; 24-byte PNG header read. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `TargetDensityCheckboxes.tsx` | `useFilesStore.addSourceWithVariants` | `onToggle` check path — `!targetSet.has(density)` branch | WIRED |
| `TargetDensityCheckboxes.tsx` | `useFilesStore.removeFile` | `onToggle` uncheck path — `family.length > 1` branch | WIRED |
| `TargetDensityCheckboxes.tsx` | `useFilesStore.removeFamily` | `onToggle` uncheck path — `family.length === 1` branch | WIRED |
| `pool.ts` | `memory-budget.ts` | `computeMemoryBudget()` at construction | WIRED |
| `files.ts addSourceWithVariants` | `lib/sniff.ts + memory-budget.ts` | `sniffPngDimensions` then `estimateJobBytes` | WIRED |
| `worker.ts` | `png-adapter.ts` | `png: () => import('./png-adapter')` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit` | Exit 0 | PASS |
| `onToggle` check path calls `addSourceWithVariants` | Code inspection line 125 | `void addSourceWithVariants({ sourceBlob: ref.sourceBlob, sourceDensity: ref.sourceDensity, name: ref.name, format: ref.format, targets: [density] })` | PASS |
| `onToggle` uncheck path calls `removeFile` | Code inspection line 139 | `removeFile(toRemove.id)` when `family.length > 1` | PASS |
| `onToggle` uncheck path calls `removeFamily` | Code inspection line 137 | `removeFamily(selectedFamilyId)` when `family.length === 1` | PASS |
| Locked source density is inert | Code inspection lines 179-181 | `onClick={() => { if (locked) return; onToggle(d) }}` | PASS |
| No TODO stub remains | Grep `TODO\|no.op\|P5` on `TargetDensityCheckboxes.tsx` | No matches in function body | PASS |
| `perFileOverride` uses `useShallow` | `InspectorPane.tsx` line 40-42 | `useShallow((s) => selectedId ? (s.perFile[selectedId] ?? {}) : {})` | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| PIPE-04 | Mark source density; app generates missing variants by scaling | VERIFIED | Fan-out (`addSourceWithVariants`) + checkbox toggle (`onToggle`) both wired. |
| PIPE-01 (raster) | Drag-and-drop multiple raster files including PNG | VERIFIED | `worker.ts` routes `png` to `png-adapter`. |
| OPT-06 | Metadata stripping + optional ICC preservation | VERIFIED | `png-adapter` strips ICC; `icc.test.ts` live. |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None in phase 04 scope | — | — | No blockers |

### Human Verification Required

#### 1. SC-1 — Density Checkbox Creates/Removes Variant Rows (Runtime)

**Test:** `npm run dev` → drop a PNG file → select it → click "2x" in Inspector "Resize / Variants"
**Expected:** A `@2x` row appears in the file list. Click "2x" again — the row disappears.
**Why human:** `onToggle` code is correct but the complete store-mutation → zustand notify → React re-render → row-appears cycle needs live browser observation to confirm no intermediate issue (race, referential equality miss, render bail-out).

#### 2. SC-2 — 50-File Memory Budget Under 800 MB

**Test:** Drop 50 PNG files, click Optimize All, watch Chrome DevTools Memory timeline
**Expected:** JS heap peak stays below 800 MB throughout the batch
**Why human:** Admission gate logic is correct in static analysis; runtime heap behavior requires in-browser measurement.

#### 3. SC-3 — Metadata Strip In-Browser

**Test:** Drop `src/tests/fixtures/with-icc.png`, optimize, download the output file, inspect bytes for `iCCP` absence
**Expected:** Output file contains no `iCCP` byte sequence
**Why human:** `icc.test.ts` has a WASM soft-fallback path; authoritative confirmation requires a running dev server.

### Gaps Summary

No code gaps remain. The previous BLOCKER (empty `onToggle`) is closed — the cherry-pick landed the complete 04-08 implementation. All four observable truths are verified at code level. Three human runtime tests remain as standard E2E gates before declaring the phase fully done.

---

_Verified: 2026-05-12T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after cherry-pick landing 04-08 (worktree-agent-a05681d7993a39341)_
