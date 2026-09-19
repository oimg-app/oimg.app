# Phase 13: Diagnostics + Clear Queue — Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 11 (4 new lib/types, 4 modified, plus 8 test files)
**Analogs found:** 11 / 11
**Wave 0 prerequisite confirmed:** `src/components/ui/tabs.tsx` ALREADY EXISTS (shadcn radix-ui Tabs at 3.4K) — no new shadcn install task needed.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vite.config.ts` (modify) | config | build-time-inject | `vite.config.ts` itself (`squooshVitePlugin(path.resolve(...))` reads node_modules at config load) | self-precedent |
| `src/lib/versions.ts` (new) | utility | build-time-constants | `src/lib/save-blob.ts` (typed module + feature-detect + safe fallback) | role-match |
| `src/lib/caps.ts` (new) | utility | feature-detect | `src/lib/dir-picker.ts` (Quick 260603-s2x dispatcher: feature-detect + silent fallback + zero-telemetry) | exact |
| `src/types/globals.d.ts` (new) | types | declare-only | `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) | role-match |
| `src/stores/runtime.ts` (modify) | store | atom reshape | `src/stores/runtime.ts` itself (`map<RuntimeState>` + setKey actions, lines 12-32) | self-precedent |
| `src/main.tsx` (modify) | bootstrap | pre-render side-effect | `src/main.tsx` itself (lines 10-17 already runs `crossOriginIsolated` probe pre-render) | self-precedent |
| `src/components/shell/StatusBar.tsx` (modify) | component | render-from-atom | itself (lines 9 destructure + 52/55/58 render) | self-precedent |
| `src/components/shell/Toolbar.tsx` (modify) | component | popover + tabs | `Toolbar.tsx:249-268` (existing Settings Popover) + `src/components/ui/tabs.tsx` (shadcn) + `src/components/panels/InspectorPane.tsx:46-89` (custom-tab bottom-border accent) | role-match |
| `src/components/panels/FilesPane.tsx` (modify) | component | header icon button | `FilesPane.tsx:65-110` (header row already hosts sort + add buttons) + `FileRow.tsx:121-127` (ctxbtn shape) | self-precedent |
| `src/stores/files.ts` (modify) | store | action + computed | `removeFile` (line 72) + `$hasDone` (line 66) + `$totals` (line 57) | exact |
| Tests (8 files) | test | unit + e2e | `src/tests/stores.test.ts` (Node `--experimental-strip-types` unit pattern) + `src/tests/status-bar.spec.ts` (Playwright e2e with `ingestFixtureFiles` helper) | exact |

---

## Pattern Assignments

### `vite.config.ts` (modify — DIA-01)

**Analog:** Existing `vite.config.ts` already reads `node_modules` paths synchronously at config-load time (`squooshVitePlugin(path.resolve('node_modules/@squoosh-kit'))` line 11). Pattern is proven.

**Top-of-file synchronous reads** (insert above `defineConfig`):
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import squooshVitePlugin from '@squoosh-kit/vite-plugin'

// Read versions at config-load time. Cache once at module scope so subsequent
// dev/build reloads use the cached object (Vite re-executes the config on file
// change, but the require cache is invalidated — re-reading is cheap anyway).
function readVer(pkg: string): string {
  const pkgPath = path.resolve(`node_modules/${pkg}/package.json`)
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version as string
}
const VERSIONS = {
  svgo: readVer('svgo'),
  jsquash: {
    webp:   readVer('@jsquash/webp'),
    jpeg:   readVer('@jsquash/jpeg'),
    avif:   readVer('@jsquash/avif'),
    oxipng: readVer('@jsquash/oxipng'),
    png:    readVer('@jsquash/png'),
    resize: readVer('@jsquash/resize'),
  },
  // Phase 16 — append: ssim: readVer('ssim.js')
  // Phase 17 — append: butteraugli: { buildHash: '...' }
}
```

**`define` block** (insert into existing `defineConfig({...})`):
```ts
define: {
  __SVGO_VERSION__: JSON.stringify(VERSIONS.svgo),
  __JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash),
  // Phase 16/17 hooks:
  // __SSIM_VERSION__: JSON.stringify(VERSIONS.ssim),
  // __BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli),
},
```

**Pitfall watch:** `package.json` `dependencies` strings include caret prefix (`^4.0.1`) but reading the installed package's own `package.json` returns the pure version (`4.0.1`) — research §1 caveat. The `node_modules/<pkg>/package.json` approach is correct here.

---

### `src/lib/versions.ts` (new — DIA-01 / D-03)

**Analog:** `src/lib/save-blob.ts` (lines 14-24 + 42-91) — pattern: typed exported shape, internal feature-detect, safe fallback when the underlying capability is missing. Same "single module wraps an environment-provided value with TS types" intent.

**Shape:**
```ts
// Phase 13 — DIA-01 (D-01/D-03): typed wrapper around Vite-injected version globals.
// Components and stores read BUILD_VERSIONS, NOT the raw __SVGO_VERSION__ etc.
// Keeps the Phase 16 (SSIM) / Phase 17 (Butteraugli) additions a single-file change.
// Analog: src/lib/save-blob.ts (typed-export-of-env-feature pattern).

export type CodecKey = 'webp' | 'jpeg' | 'avif' | 'oxipng' | 'png' | 'resize'

export interface BuildVersions {
  svgo: string
  jsquash: Record<CodecKey, string>
  ssim?: string                          // Phase 16
  butteraugli?: { buildHash: string }    // Phase 17
}

// Safe-fallback pattern: defines may be `undefined` when this module is imported
// outside a Vite build (e.g. Node unit tests via --experimental-strip-types).
// Tests assert on the shape, not the values — see src/tests/versions.test.ts.
const FALLBACK_JSQUASH: Record<CodecKey, string> = {
  webp: '0.0.0', jpeg: '0.0.0', avif: '0.0.0',
  oxipng: '0.0.0', png: '0.0.0', resize: '0.0.0',
}

export const BUILD_VERSIONS: BuildVersions = {
  svgo: typeof __SVGO_VERSION__ === 'string' ? __SVGO_VERSION__ : '0.0.0',
  jsquash: typeof __JSQUASH_VERSIONS__ === 'object' && __JSQUASH_VERSIONS__
    ? __JSQUASH_VERSIONS__
    : FALLBACK_JSQUASH,
}
```

---

### `src/lib/caps.ts` (new — DIA-02 / D-04)

**Analog:** `src/lib/dir-picker.ts` (lines 1-46) — exact match for "feature-detect dispatcher with silent fallback + zero-telemetry + never throws". Mirror the:
- File header comment style (purpose + analog reference + contract bullets)
- `typeof window !== 'undefined' && '<feature>' in window` guard pattern (line 21-24)
- Bare-bones export, no React, no toast

**Shape:**
```ts
// Phase 13 — DIA-02 (D-04): runtime capability probe. Run ONCE at app boot
// (main.tsx) BEFORE React renders. Synchronous (SIMD probe is sync via
// WebAssembly.validate). No re-probe on visibility change.
// Analog: src/lib/dir-picker.ts (Quick 260603-s2x — feature-detect dispatcher,
// silent fallback, zero-telemetry, NEVER throws).

export interface Caps {
  simd: boolean
  threads: boolean
  crossOriginIsolated: boolean
  hardwareConcurrency: number
  offlineReady: boolean   // PLACEHOLDER until Phase 14 PWA-02 wires precacheComplete
}

// 47-byte SIMD probe: minimal WASM module that uses v128 — validates only on SIMD support.
// Standard sequence from WebAssembly community feature-detect suite.
const SIMD_PROBE = new Uint8Array([
  0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
  1, 5, 1, 0x60, 0, 1, 0x7b,
  3, 2, 1, 0,
  10, 10, 1, 8, 0, 0x41, 0, 0xfd, 0x0f, 0xfd, 0x62, 0x0b,
])

export function probeCaps(): Caps {
  // Pattern from dir-picker.ts:21-24 — guard typeof window first for SSR/Node safety.
  const hasWindow = typeof window !== 'undefined'
  let simd = false
  try { simd = typeof WebAssembly !== 'undefined' && WebAssembly.validate(SIMD_PROBE) } catch { /* noop */ }

  const coi = hasWindow && globalThis.crossOriginIsolated === true
  const threads = typeof SharedArrayBuffer !== 'undefined' && coi

  const offlineReady =
    hasWindow &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller != null   // Phase 14 will replace with precacheComplete

  return {
    simd,
    threads,
    crossOriginIsolated: coi,
    hardwareConcurrency: hasWindow ? (navigator.hardwareConcurrency ?? 1) : 1,
    offlineReady,
  }
}
```

---

### `src/types/globals.d.ts` (new — Wave 0)

**Analog:** `src/vite-env.d.ts` (1 line: `/// <reference types="vite/client" />`) — single-purpose ambient `.d.ts`. Mirror its placement (top-level `src/`) and its zero-runtime nature.

**Shape:**
```ts
// Phase 13 — Wave 0 (DIA-01): ambient declarations for Vite `define` injected globals.
// These are inlined as literal expressions at build time per vite.config.ts.
// Tests and non-Vite runtimes must safe-fallback via `typeof X === 'string'` checks
// (see src/lib/versions.ts).

declare const __SVGO_VERSION__: string
declare const __JSQUASH_VERSIONS__: {
  webp: string
  jpeg: string
  avif: string
  oxipng: string
  png: string
  resize: string
}
// Phase 16/17 — append:
// declare const __SSIM_VERSION__: string
// declare const __BUTTERAUGLI_BUILD__: string
```

**Note on tsconfig:** `src/types/globals.d.ts` is auto-picked-up if `tsconfig.json`'s `include` covers `src/**/*` (it does — verify before plan). No `tsconfig.json` edit needed.

---

### `src/stores/runtime.ts` (modify — D-05 / D-06)

**Analog:** Itself, lines 12-32 — same `map<RuntimeState>(...)` shape + `setKey` action pattern.

**OLD fields to remove** (lines 17-19, 28-30):
```ts
svgoVersion: string
codecVersion: string
wasmInfo: string
// initial values: svgoVersion: '4.0.1', codecVersion: '0.6.0', wasmInfo: 'WASM ready · 312 KB'
```

**NEW fields to add** (insert into `RuntimeState` + map init):
```ts
import { BUILD_VERSIONS } from '@/lib/versions'
import type { Caps } from '@/lib/caps'

interface RuntimeState {
  // ... existing running/runningJobs/queuedJobs/toasts/encodingFileId stay ...
  versions: typeof BUILD_VERSIONS
  caps: Caps
}

// Initial caps is a "safe zero" — main.tsx overwrites it pre-render via probeCaps().
// Pattern mirrors `running: false` baseline above.
const INITIAL_CAPS: Caps = {
  simd: false, threads: false, crossOriginIsolated: false,
  hardwareConcurrency: 1, offlineReady: false,
}

export const runtimeAtom = map<RuntimeState>({
  running: false, runningJobs: 0, queuedJobs: 0, toasts: [],
  encodingFileId: null,
  versions: BUILD_VERSIONS,
  caps: INITIAL_CAPS,
})
```

**New setter (mirror `setJobCounts` line 60-64):**
```ts
// Phase 13 — DIA-02: called once from main.tsx pre-render with the boot probe result.
// CR-01 atomic setKey precedent (line 60-64).
export function setCaps(c: Caps): void {
  runtimeAtom.setKey('caps', c)
}
```

**CRITICAL:** This file MUST be updated in the SAME task as `StatusBar.tsx` (line 9 destructure currently reads old fields), or the build breaks mid-wave. Per CONTEXT.md `<canonical_refs>` line 94. Wave 1 plans 01-03 should all merge in one task or use a coordinated wave commit.

---

### `src/main.tsx` (modify — D-04)

**Analog:** Lines 10-17 already perform a pre-render probe (`crossOriginIsolated`). Mirror its placement (before `createRoot(...).render(...)`) and its imperative side-effect nature.

**Patch (after line 17, before line 19 registerCommands):**
```ts
// Phase 13 — DIA-02: capability probe runs ONCE pre-render. Result goes into
// runtimeAtom.caps so StatusBar/SettingsPanel render the truth on first paint.
// Pattern: same pre-render-side-effect placement as the crossOriginIsolated guard above.
import { probeCaps } from '@/lib/caps'
import { setCaps } from '@/stores/runtime'
setCaps(probeCaps())
```

---

### `src/components/shell/StatusBar.tsx` (modify — D-07 / D-08 / D-09)

**Analog:** Itself.

**Line 9 destructure** changes from:
```ts
const { running, svgoVersion, codecVersion, wasmInfo } = useStore(runtimeAtom)
```
to:
```ts
const { running, versions, caps } = useStore(runtimeAtom)
```

**Line 52 SVGO badge** (UNCHANGED format, new data source):
```tsx
<span className="font-mono text-[11px] font-semibold">SVGO {versions.svgo}</span>
```

**Line 55 codec badge** (rename label per D-08 spec; pick representative codec — research §3 used `webp`):
```tsx
<span className="font-mono text-[11px] font-semibold">jSquash · webp {versions.jsquash.webp}</span>
```

**Line 58 wasmInfo derivation** (D-07: derive in-place, no atom field). Insert above the JSX:
```tsx
const wasmStr =
  caps.simd && caps.threads ? 'WASM ready · SIMD · MT'
  : caps.simd               ? 'WASM ready · SIMD'
  : caps.threads            ? 'WASM ready · MT'
  : 'WASM ready'
```
Then render: `<span>{wasmStr}</span>` (same JSX shape as line 58).

**D-09 Offline-ready pill:** If StatusBar currently shows one (does it? line 8-67 above does not render it — confirm by re-Read at execute time). Per D-09 recommend HIDE when `!caps.offlineReady`. Pattern:
```tsx
{caps.offlineReady && (
  <>
    <span aria-hidden="true">·</span>
    <span>Offline-ready</span>
  </>
)}
```

**Test pin** (per VALIDATION.md task 13-04): `src/tests/statusbar-versions.spec.ts` reads the textContent of `[data-testid="statusbar"]` and asserts presence of `SVGO ` + `jSquash · webp `. The version values come from build-injected globals — assert "contains the prefix", not the exact version string (versions change with package updates).

---

### `src/components/shell/Toolbar.tsx` (modify — D-10 / D-11 / D-14)

**Analog (existing settings popover):** Lines 249-268.

**Analog (Radix Tabs):** `src/components/ui/tabs.tsx` — exists, exports `Tabs, TabsList, TabsTrigger, TabsContent`. Note its tabs use `data-active:bg-background` styling — that's shadcn-default but might clash with `--color-bg-2` tokens. Use the existing `tabs-list variant="line"` (line 30-32) for a less aggressive accent that matches the dark-default token palette.

**Analog (disable-then-explain):** Lines 96-100 + 122-126 + 130-134 etc. — `disabled={...} aria-disabled={...} title={disabledTitle}` triple repeated for each Export menu item.

**Wire-in pattern** (replace lines 264-267, the `<div className="flex flex-col">` content):
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { clearFiles, $queueEmpty } from '@/stores/files'
import { copyToClipboard } from '@/lib/clipboard'

// inside component body:
const queueEmpty = useStore($queueEmpty)
const { versions, caps } = useStore(runtimeAtom)
const clearDisabledTitle = queueEmpty ? 'No files to clear' : undefined

// inside <PopoverContent>:
<Tabs defaultValue="general" className="w-[280px]">
  <TabsList variant="line" className="w-full">
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
  </TabsList>

  <TabsContent value="general" className="p-2">
    <button type="button" className={menuItemClass} onClick={() => { setWorkerCount(4); setOpen(null) }}>
      Workers: 4 (auto)
    </button>
    {/* D-14: Clear all — disable-then-explain mirroring Export item shape (lines 122-126) */}
    <button
      type="button"
      className={cn(menuItemClass, queueEmpty && 'opacity-50 cursor-not-allowed')}
      onClick={() => { clearFiles(); setOpen(null) }}
      disabled={queueEmpty}
      aria-disabled={queueEmpty}
      title={clearDisabledTitle}
    >Clear all</button>
  </TabsContent>

  <TabsContent value="diagnostics" className="p-2">
    {/* D-11: read-only <dl>; inline JSON.stringify per CONTEXT.md "Claude's Discretion" guidance */}
    <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
      <dt>svgo</dt><dd>{versions.svgo}</dd>
      <dt>jsquash webp</dt><dd>{versions.jsquash.webp}</dd>
      <dt>jsquash jpeg</dt><dd>{versions.jsquash.jpeg}</dd>
      <dt>jsquash avif</dt><dd>{versions.jsquash.avif}</dd>
      <dt>jsquash oxipng</dt><dd>{versions.jsquash.oxipng}</dd>
      <dt>SIMD</dt><dd>{caps.simd ? 'yes' : 'no'}</dd>
      <dt>WASM threads</dt><dd>{caps.threads ? 'yes' : 'no'}</dd>
      <dt>COOP/COEP</dt><dd>{caps.crossOriginIsolated ? 'isolated' : 'no'}</dd>
      <dt>CPUs</dt><dd>{caps.hardwareConcurrency}</dd>
    </dl>
    <button
      type="button"
      className={cn(menuItemClass, 'mt-2')}
      onClick={() => void copyToClipboard(
        JSON.stringify({ versions, caps }, null, 2),
        'manifest',          // D-11: reuse the 'manifest' CopyKind for bug-report convenience
        'Diagnostics'
      )}
    >Copy diagnostics</button>
  </TabsContent>
</Tabs>
```

**Test pin** (per VALIDATION.md task 13-08): `src/tests/settings-diagnostics.spec.ts` opens Settings → clicks Diagnostics tab → reads `<dl>` rows → clicks Copy → verifies sonner toast via `await expect(page.getByText('Diagnostics copied')).toBeVisible()`. Mirror `src/tests/clipboard.test.ts` or whichever existing snippet-copy spec uses sonner assertions.

---

### `src/components/panels/FilesPane.tsx` (modify — D-15)

**Analog (header row):** Lines 65-110 — header already has flex row with Sort popover button (lines 70-92) + Add button (lines 93-99) using the `w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)]` class triple.

**Analog (ghost icon button):** `FileRow.tsx` line 121-127:
```tsx
<button
  className="w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] cursor-pointer hover:text-[var(--fg-0)]"
  aria-label="File options"
  onClick={handleCtxBtn}
>
  <DotsThreeVertical size={12} />
</button>
```

**Patch (insert into header `<div className="flex items-center gap-1">` at line 69, leftmost or between Sort and Add per "Claude's Discretion"):**
```tsx
import { XCircle } from '@phosphor-icons/react'  // add to existing import
import { clearFiles, $queueEmpty } from '@/stores'  // re-export from barrel

const queueEmpty = useStore($queueEmpty)

<button
  className={cn(
    "w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)]",
    queueEmpty && 'opacity-50 cursor-not-allowed'
  )}
  aria-label="Clear all files"
  title={queueEmpty ? 'No files to clear' : 'Clear all files'}
  onClick={() => clearFiles()}
  disabled={queueEmpty}
  aria-disabled={queueEmpty}
>
  <XCircle size={13} />
</button>
```

Note: `aria-label` is the screen-reader voice; `title` is the explanatory tooltip per D-15 / Phase 11 D-13 pattern.

---

### `src/stores/files.ts` (modify — D-13)

**Analog `removeFile` (lines 72-74):**
```ts
export function removeFile(id: string): void {
  filesAtom.setKey('entries', filesAtom.get().entries.filter((f) => f.id !== id))
}
```

**Analog `$hasDone` (line 66):**
```ts
export const $hasDone = computed(filesAtom, (s) => s.entries.some((e) => e.status === 'done'))
```

**New `clearFiles` action:**
```ts
// Phase 13 — CLR-01 / D-13: drop entries + selectedId in one transaction.
// Does NOT touch runtimeAtom (workers may still be in flight; the queue is a
// UI-side concept). The Phase 11 D-13 disable-then-explain pattern from FilesPane
// header (× icon) + Toolbar Settings (Clear all) gates the call site.
// Analog: removeFile (line 72) — module-level export + filesAtom.setKey shape.
export function clearFiles(): void {
  // Re-read inside the function body, not at module scope (nanostores discipline).
  filesAtom.setKey('entries', [])
  filesAtom.setKey('selectedId', null)
}
```

**New `$queueEmpty` computed atom (drives D-14 + D-15 disable):**
```ts
// Phase 13 — CLR-01 driver. Analog: $hasDone (line 66) + $totals (line 57).
export const $queueEmpty = computed(filesAtom, (s) => s.entries.length === 0)
```

**Barrel export:** `src/stores/index.ts` already re-exports `* from './files'` — `clearFiles` and `$queueEmpty` flow through automatically. No barrel edit needed.

**D-13 in-flight confirmation toast** (per CONTEXT.md — sonner `toast.warning` with "Clear anyway" action; NOT a modal). The call site decides whether to pre-confirm. Suggest moving the confirmation into a thin wrapper in the affordance, NOT in `clearFiles()` (the store action stays a pure mutation):
```ts
// In the Toolbar / FilesPane handler:
import { toast } from 'sonner'
import { runtimeAtom } from '@/stores/runtime'
function handleClear() {
  const { runningJobs } = runtimeAtom.get()
  if (runningJobs > 0) {
    toast.warning(`Cancel ${runningJobs} in-flight jobs?`, {
      action: { label: 'Clear anyway', onClick: () => clearFiles() },
    })
    return
  }
  clearFiles()
}
```

---

## Shared Patterns

### Disable-then-explain (D-14 / D-15)

**Source:** `Toolbar.tsx:96-100` (Export button) — the triple `disabled / aria-disabled / title` is the canonical Phase 11 D-13 affordance.

**Apply to:** Both Toolbar "Clear all" menu item AND FilesPane × icon. Substitute:
- `!hasDone` → `queueEmpty`
- `'Optimize at least one file first'` → `'No files to clear'`

### Zero-telemetry dispatcher

**Source:** `src/lib/dir-picker.ts:1-46` + `src/lib/save-blob.ts:14-91`.

**Apply to:** `src/lib/caps.ts` — never `console.*`, never throw, return a safe-fallback value. (Capability detection is naturally telemetry-adjacent; treat it the same as feature-detect dispatchers.)

### Atomic `setKey` per field

**Source:** `runtime.ts:60-64` (CR-01 fix) — "atomic setKey per field eliminates read-modify-write race under concurrent pushToast".

**Apply to:** `clearFiles()` — two `setKey` calls (entries, selectedId) are fine; do NOT use a single `runtimeAtom.set({...})` replace (would clobber concurrent updates from other paths).

### Computed-atom-drives-disable

**Source:** `files.ts:66` (`$hasDone`) + Toolbar consumer at line 33-40.

**Apply to:** `$queueEmpty` → both Toolbar "Clear all" and FilesPane × icon consume it via `useStore($queueEmpty)`.

### Test infrastructure (Wave 0)

**Source:** `src/tests/stores.test.ts` (Node unit pattern) + `src/tests/status-bar.spec.ts` (Playwright e2e + `ingestFixtureFiles` helper).

**Apply to:**
- `src/tests/versions.test.ts` + `src/tests/caps.test.ts` + `src/tests/runtime-shape.test.ts` + `src/tests/clearfiles.test.ts` — Node unit, run via `node --experimental-strip-types`. Mirror stores.test.ts's `let passed/failed` + `assert(name, cond)` harness; the file alongside `src/tests/_alias-loader.mjs` resolves `@/...` paths.
- `src/tests/statusbar-versions.spec.ts` + `src/tests/toolbar-clear.spec.ts` + `src/tests/filespane-clear.spec.ts` + `src/tests/settings-diagnostics.spec.ts` — Playwright e2e. Mirror status-bar.spec.ts's `await page.goto('/')` + `ingestFixtureFiles(page, N)` setup + `page.getByTestId(...)` / `page.getByRole('button', { name: '...' })` queries.

---

## No Analog Found

All target files have a strong analog in the codebase. No external research-only patterns needed.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/stores/`, `src/components/shell/`, `src/components/panels/`, `src/components/panels/files/`, `src/components/ui/`, `src/tests/`, `vite.config.ts`, `src/main.tsx`.
**Files scanned:** 16
**Pattern extraction date:** 2026-06-10

### Key risks flagged for planner

1. **Atom-reshape coordination** — `runtime.ts` (drop 3 string fields) and `StatusBar.tsx` (line 9 destructure) MUST land in the same task or coordinated Wave 1 commit, else `npm run build` red. Per CONTEXT.md `<canonical_refs>` line 94. Planner should bind plans 03 + 04 into a single execute-phase wave OR put both file edits in a single task with combined verify.
2. **`globals.d.ts` Wave 0 dependency** — Versions.ts references `__SVGO_VERSION__` / `__JSQUASH_VERSIONS__`. Without the ambient declaration file, `tsc -b` fails immediately. Wave 0 task must land `globals.d.ts` BEFORE plan 01 (versions.ts).
3. **`@/components/ui/tabs.tsx` already present** — confirmed via `ls` (3.4K, shadcn radix-ui style). No shadcn install task needed. Use `variant="line"` per CONTEXT.md token-palette concern.
4. **Vite `define` literal-substitution** — research §1 + CLAUDE.md "Vite 7 (not 8)" stack drift memory. Verify `vite.config.ts` `define` evaluates at config-load (NOT runtime). The `JSON.stringify(...)` wrapper IS required (Vite docs) — `define: { __X__: VERSIONS.svgo }` would inject the literal `4.0.1` (broken JS), not `"4.0.1"`.
5. **`crossOriginIsolated` in main.tsx already exists** (line 10-17) — the new `probeCaps()` call should INSERT after that block, not replace it. The existing console.error is the COOP/COEP smoke test for codec-worker scheduling; the new probe writes to runtimeAtom for UI surface.
