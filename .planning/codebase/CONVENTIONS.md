# Coding Conventions

**Analysis Date:** 2026-05-14

## Naming Patterns

**Files:**
- React components: PascalCase matching component name — `AppShell.tsx`, `FilesPane.tsx`, `StatusBar.tsx`
- Component subdirectories: PascalCase directory + PascalCase file — `src/components/shell/AppShell/AppShell.tsx`
- CSS Modules: camelCase, co-located with component — `appShell.module.css`, `statusBar.module.css`
- Hooks: `use` prefix camelCase — `useBatchOrchestrate.ts`, `useFilePicker.ts`, `useKeyboardShortcuts.ts`
- Stores: `[domain]Store` pattern — `filesStore`, `settingsStore`, `runtimeStore`
- Store actions: camelCase verb — `addFile`, `removeFile`, `markDone`, `setSelected`, `setStatus`
- Workers: `[codec]-adapter.ts` + `[codec]-config.ts` paired files — `jpeg-adapter.ts`, `jpeg-config.ts`
- Tests: `*.spec.ts` for Playwright E2E, `*.unit.ts` and `*.test.ts` for Node runner tests
- Lib utilities: kebab-case — `filename.ts`, `sanitize-svg.ts`, `memory-budget.ts`
- UI primitives (shadcn): kebab-case — `button.tsx`, `input-group.tsx`, `toggle-group.tsx`

**Functions:**
- Actions (store mutations): camelCase verbs — `addFile()`, `removeFile()`, `markDone()`, `setSort()`
- Pure utilities: camelCase descriptive — `applyDensitySuffix()`, `deduplicateName()`, `computePoolSize()`
- Builder functions: `build` prefix — `buildSvgoConfig()`, `buildJpegSettings()`, `buildPngResizeSettings()`
- Private class methods: camelCase with no prefix — `spawnAll()`, `spawnOne()`, `tryDispatch()`, `runOnSlot()`
- Test-only exports: `__` double-underscore prefix — `__setWorkerPoolForTesting()`

**Variables:**
- camelCase throughout
- Boolean flags: descriptive names — `spawned`, `settled`, `timedOut`
- Counters/accumulator: descriptive — `inflightBytes`, `renameCount`, `passed`, `failed`
- Private class fields: camelCase — `size`, `slots`, `idle`, `queue`, `inFlight`

**Types / Interfaces:**
- Interface: PascalCase — `FileEntry`, `FileEntryWithBlob`, `PoolCallbacks`, `PendingJob`
- Type aliases: PascalCase — `FormatId`, `Density`, `FileStatus`, `SnippetId`, `ThemeMode`
- Union string literals: lowercase — `'idle' | 'queued' | 'processing' | 'done' | 'error'`
- Generics: single-letter or descriptive — `map<FilesData>`, `Remote<WorkerProxyApi>`

## Code Style

**Formatting:**
- TypeScript strict mode throughout
- Trailing commas in multi-line object/array literals
- Single quotes for strings (observed in imports and string literals)
- 2-space indentation inferred from file structure

**Linting:**
- No `.eslintrc` or `biome.json` detected — linting rules not formally configured
- Comments reference `// eslint-disable-next-line no-console` inline, indicating ESLint is expected

## Import Organization

**Order (observed pattern):**
1. External packages — `import * as Comlink from 'comlink'`, `import { useEffect } from 'react'`
2. Internal `@/` alias imports — `import { filesStore } from '@/stores/files'`
3. Relative imports — `import { buildSvgoConfig } from './svg-config.ts'`

**Path Aliases:**
- `@/` → `src/` — used consistently throughout all non-worker files
- Relative imports (`./`) used inside `src/workers/` when importing sibling workers (to avoid Vite alias issues under Node runner)

**Explicit extensions:**
- Worker-to-worker imports use explicit `.ts` extension — `import { buildSvgoConfig } from './svg-config.ts'`
- Required for Node `--experimental-strip-types` runner compatibility

## Error Handling

**Patterns:**
- Workers throw `AdapterError(format, phase, message)` — a typed error class from `src/workers/types.ts`
- Pool callbacks propagate errors via `onError(jobId, err)` callback — never re-throw across postMessage
- Try/catch wraps SVGO `optimize()` because it throws on malformed SVG; caught and rethrown as `AdapterError`
- Promise cancellation via `DOMException('Batch cancelled', 'AbortError')` — standard AbortError pattern
- `settled` flag on `PendingJob` prevents double-reject/double-resolve in race conditions
- Generation counter (`this.generation`) prevents stale finally blocks from corrupting pool state after cancel

## Logging

**Framework:** `sonner` toast library for user-visible feedback

**Patterns:**
- `toast.info()` / `toast.promise()` for user notifications (batch completion, warnings)
- `console.log()` / `console.error()` used only in Node test runners (unit test pass/fail reporting)
- `// eslint-disable-next-line no-console` guard on console.log in production store code — indicates console logging is intentionally suppressed

## Comments

**When to Comment:**
- Every file begins with a phase/plan attribution header: `// Phase N — [description]. Source: [plan doc]`
- Phase/plan references on every significant code block — links implementation to planning artifacts
- `// CRITICAL:` prefix for non-obvious constraints (e.g., Worker spawn idiom)
- `// WR-NN:`, `// CR-NN:`, `// D-NN:` prefixes for design decisions traceable to planning docs
- `// @TODO:` for deferred work (function stubs with empty bodies)
- `// PATTERNS.md Pitfall N` for cross-references to research pitfalls

**JSDoc/TSDoc:**
- `/** ... */` JSDoc used on public API methods (`enqueue`, `cancel`, `cancelByPrefix`, `terminate`)
- `/** @deprecated ... */` used to tag superseded exports with migration guidance
- Inline type annotation comments for non-obvious fields (e.g., `// Object URL — must be revoked when no longer needed (see threat T-03-02)`)

## Function Design

**Size:** Functions are focused. Store actions are typically 5–20 lines. Worker adapters under 50 lines each.

**Parameters:** Prefer destructured object params for multi-argument functions — `buildPngResizeSettings({ sourceDensity, targetDensity, globalAlg, ... })`. Simple 1–2 arg functions use positional params.

**Return Values:**
- Async worker `run()` functions always return `Promise<{ output: ArrayBuffer; meta: AdapterMeta }>`
- Store actions return `void` (state is read from the store, not returned)
- Builder functions return plain typed objects

## Module Design

**Exports:**
- Stores: named exports only — `export const filesStore`, `export function addFile`, etc.
- Barrel files: `src/stores/index.ts` re-exports all three stores with `export * from './files'`
- Test-only exports clearly marked with `__` prefix and comment

**State Architecture:**
- nanostores `map()` for reactive store state (migrated from zustand)
- `store.get()` for synchronous reads, `store.set()` / `store.setKey()` for atomic mutations
- Business logic in standalone action functions, never inline in components
- Components subscribe via `useStore(storeInstance)` from `@nanostores/react`

**Worker Architecture:**
- Each codec splits into `[codec]-adapter.ts` (WASM + run logic) and `[codec]-config.ts` (pure settings builder)
- Config modules are dependency-free so they run under Node `--experimental-strip-types`
- Adapter modules import `svgo/browser` or jSquash — browser-bundle only, never run in Node

**Circular Dependency Note:**
- `files.ts` ↔ `runtime.ts` ↔ `settings.ts` form a three-way circular ESM graph — documented in file headers
- Safe in browser ESM (live bindings); breaks Node `--experimental-strip-types` runner
- Unit tests that import these files must not trigger cross-module calls at import time

---

*Convention analysis: 2026-05-14*
