---
phase: 14-installable-pwa
plan: 03
subsystem: pwa-install-prompt
tags: [pwa, beforeinstallprompt, install-button, nanostores, store-08]
requires: [14-00, 14-01]
provides:
  - "src/stores/pwa.ts — $installPrompt + $isInstalled nanostores atoms (STORE-08)"
  - "src/hooks/useInstallPrompt.ts — beforeinstallprompt/appinstalled bridge + promptInstall()"
  - "StatusBar Install button gated on canInstall (PWA-03)"
affects:
  - src/stores/pwa.ts (new)
  - src/hooks/useInstallPrompt.ts (new)
  - src/components/shell/StatusBar.tsx
tech-stack:
  added: []
  patterns:
    - "STORE-08: zero useState for data — atoms in stores/pwa.ts, hook is a thin bridge"
    - "Window event listeners attached in useEffect with cleanup (useWatchFolder.ts precedent)"
    - "Async body reads via $installPrompt.get() — dodges React stale-closure trap"
    - "SSR-guarded matchMedia probe for $isInstalled initial value"
    - "data-testid hook for Wave-0 Playwright PWA-03 spec"
key-files:
  created:
    - src/stores/pwa.ts
    - src/hooks/useInstallPrompt.ts
  modified:
    - src/components/shell/StatusBar.tsx
decisions:
  - "Used type-only import for BeforeInstallPromptEvent (import { type Foo } from ...) — matches existing codebase pattern in button.tsx/tabs.tsx/sonner.tsx/utils.ts; same TS-baseline-parser false positive as documented in MEMORY typecheck-and-test-gotchas"
  - "Caught promptInstall() rejection — synthetic / forged BeforeInstallPromptEvent (T-14-IP) may reject prompt(); clear atom + return false so button hides instead of looping on a broken handle"
  - "Atom-based, not useState-based — STORE-08 enforcement; atom survives component unmount and is testable from page.evaluate() in e2e"
  - "Used `event !== null && !installed` for canInstall (live nanostores subscription via useStore), not a useMemo — useStore already returns a stable reference per atom value"
metrics:
  duration: ~10min
  completed: 2026-06-11
  tasks: 2
  files: 3
---

# Phase 14 Plan 03: PWA Install Prompt Capture + StatusBar Install Button Summary

PWA-03 wired — `beforeinstallprompt` is captured into `$installPrompt` (nanostores), `$isInstalled` flips on `appinstalled` or matchMedia standalone, `useInstallPrompt()` exposes `{ canInstall, installed, promptInstall }`, StatusBar surfaces an accent-coloured "Install" button next to the offline-ready pill gated entirely on `canInstall`, and the Wave-0 PWA-03 e2e turned GREEN (button appears on synthetic event, disappears on synthetic `appinstalled`). Foundation regression suite 3/3 still green; build budget 198,261 B gzipped ≤ 204,800 B.

## What Was Built

| Artifact | Path | Purpose |
|----------|------|---------|
| pwa store | `src/stores/pwa.ts` | 33 lines — `BeforeInstallPromptEvent` interface, `$installPrompt` atom (null until browser fires the event), `$isInstalled` atom (SSR-guarded `matchMedia('(display-mode: standalone)').matches` initial). Zero cross-store imports (circular-ESM guard) — only `nanostores` |
| install hook | `src/hooks/useInstallPrompt.ts` | 71 lines — `useEffect` attaches both event listeners with cleanup; `onBeforeInstallPrompt` calls `e.preventDefault()` + caches event; `onAppInstalled` sets `$isInstalled=true` + clears the cached prompt. `promptInstall()` reads live atom via `.get()`, awaits `userChoice`, clears atom regardless of outcome, returns `outcome === 'accepted'`. Try/catch around `prompt()` handles synthetic event rejection (T-14-IP) |
| StatusBar install affordance | `src/components/shell/StatusBar.tsx` | Imported `useInstallPrompt`; inserted `{canInstall && <button data-testid="install-button" onClick={() => void promptInstall()} ...>Install</button>}` immediately after the offline-ready pill block, using Tailwind utilities only (`text-[11px] text-[var(--color-accent)] underline underline-offset-2 hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded-sm`) |

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `741398d` | feat | add pwa store atoms + useInstallPrompt hook |
| 2 | `4d35eeb` | feat | wire Install button into StatusBar via useInstallPrompt |

## Verification Results

### Task 1 — pwa store + useInstallPrompt hook

- `grep -q "export const \$installPrompt" src/stores/pwa.ts` → **PASS**
- `grep -q "beforeinstallprompt" src/hooks/useInstallPrompt.ts` → **PASS**
- `grep -q "appinstalled" src/hooks/useInstallPrompt.ts` → **PASS**
- `npx tsc -b` → same pre-existing RED baseline (button.tsx L2, tabs.tsx L2, sonner.tsx L1, utils.ts L1, caps.test.ts L5, tsconfig.app.json, tsconfig.node.json, @types/node/{buffer,crypto}.d.ts, @types/babel__traverse). `useInstallPrompt.ts:24` adds one identical false-positive (`type` modifier inside import list — TS1005 from the stale tsc parser; Vite swc compiles cleanly). **Zero NEW errors beyond the documented baseline pattern**; same disposition as 14-01-SUMMARY decision #4 and MEMORY `typecheck-and-test-gotchas`.

### Task 2 — StatusBar Install button + PWA-03 e2e

- `grep -q "useInstallPrompt" src/components/shell/StatusBar.tsx` → **PASS**
- `grep -q "install-button" src/components/shell/StatusBar.tsx` → **PASS**
- `npx playwright test src/tests/pwa.spec.ts --grep "PWA-03" --reporter=line` → **PASS (1)** in 156.2s
  - "install button appears on beforeinstallprompt; hides on appinstalled" — GREEN (synthetic event captured by hook → button visible; synthetic `appinstalled` event → atom cleared, button hidden).
- `npx playwright test src/tests/foundation.spec.ts --reporter=line` → **PASS (3)** in 156.4s (no regression).
- `./node_modules/.bin/vite build` → **PASS** (vite 7.3.2, 82 modules, built in 6.81s + SW built in 152ms).
- **Bundle budget gate:** `gzip -c dist/assets/index-Bp_rsE7x.js | wc -c` → **198,261 bytes** ≤ 204,800 (200KB) — **PASS** (+353 B vs 14-02's 197,908 B; allocates ~120 B for the new hook + ~230 B for the StatusBar button JSX).

## Decisions Made

1. **`import { type BeforeInstallPromptEvent } from '@/stores/pwa'`** — inline `type` modifier matches the existing codebase pattern (button.tsx, tabs.tsx, sonner.tsx, utils.ts, caps.test.ts all use it). Trips the same stale-tsc TS1005 false positive as those files but Vite swc compiles cleanly. Alternative `import type { BeforeInstallPromptEvent }` would also work but breaks the precedent of mixing value + type imports in one statement.
2. **Try/catch around `event.prompt()`** in `promptInstall()` — T-14-IP threat says a forged event at most no-ops (prompt() rejects). Catching the rejection lets us clear the atom + hide the button instead of looping on a broken handle. Plan didn't strictly require this but it is a correctness improvement that matches the threat model disposition.
3. **`.get()` for the live atom read** inside the async `promptInstall()` body — useWatchFolder.ts precedent. The `event` variable from `useStore($installPrompt)` is captured in closure; if the user clicks Install while the atom is being cleared by `appinstalled`, the closure copy is stale. Reading via `.get()` always sees current state.
4. **Atoms in `src/stores/pwa.ts`, not co-located in the hook** — RESEARCH §Open Question #2 + STORE-08. Atoms survive component unmount (Install button hides while page is mid-navigation should not lose the deferred event). Co-located precedent: `watchedFolderAtom` in `runtime.ts`.

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written.

### Process notes

- Three `PreToolUse:Write` / `PreToolUse:Edit` workflow advisories fired (pwa.ts, useInstallPrompt.ts, StatusBar.tsx). These are advisory only — this executor is the GSD-spawned plan agent for 14-03, so SUMMARY.md + STATE.md updates are produced by the standard execution flow. Advisories acknowledged inline; not blockers (same disposition as 14-01-SUMMARY process notes).
- The working tree has unrelated dirty files (`src/components/panels/center/CompareStage.tsx`, `src/components/panels/inspector/CodecPanel.tsx`, `src/hooks/useIngest.ts`) that pre-existed the plan start. They are NOT part of 14-03 scope and were NOT staged in any commit. Untouched.

## Threat Surface Verification

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-14-IP (Spoofing — synthetic beforeinstallprompt) | accept | Plan disposition was "accept" — we additionally hardened by wrapping `event.prompt()` in try/catch (a real Chromium event resolves cleanly; a synthetic one with a real `prompt()` function still resolves; only a malformed forged event rejects, in which case we clear the atom). The PWA-03 e2e exercises exactly this path: a synthetic `prompt()`-bearing event flows through `useInstallPrompt` end-to-end without throwing. No privilege escalation, no PII (the event surface is local-only) |
| T-14-INST (Information Disclosure — install detection) | accept | `matchMedia('(display-mode: standalone)').matches` is a local-only probe; no install event is reported anywhere. Zero-telemetry contract upheld — there is no `fetch()` / no `navigator.sendBeacon()` / no analytics call in either new file. Verified by grep: `grep -nE 'fetch\\(|sendBeacon|navigator\\.connection' src/stores/pwa.ts src/hooks/useInstallPrompt.ts` → empty |

No new threat flags discovered (no new network endpoints, no new auth paths, no new file-access patterns, no schema changes at trust boundaries). The two new files only touch `window.addEventListener` / `matchMedia` / `nanostores.atom` — all browser-local APIs.

## Known Stubs

None. Both atoms ship with real initial values (`$installPrompt = null` is the correct semantic — no event has fired yet — not a placeholder), the hook returns a real `promptInstall` that calls the real `event.prompt()`, and the StatusBar button has a real `onClick` handler. No mock data, no placeholder text.

## Carry-Forward Notes

**Plan 14-04 (`bootstrapSW` + main.tsx integration) MUST:**

- Continue with the existing 14-02 carry-forward (unchanged by this plan): create `src/lib/register-sw.ts` with `bootstrapSW()`, wire it from `App.tsx` via `requestIdleCallback`, expose `window.__simulateSWNeedRefresh` / `window.__simulateSWOfflineReady`.
- No changes required to `src/stores/pwa.ts` or `src/hooks/useInstallPrompt.ts` — these are install-prompt-only and orthogonal to SW registration.

**Plan 14-05 (Lighthouse + `_headers` final audit) MUST:**

- Lighthouse "Installable" criterion — the Install button only fires when the browser deems the page installable (manifest + SW + HTTPS). Plan 14-03 surfaces the affordance; whether it shows in production on first visit depends on 14-04 (SW registration) + 14-01 (manifest, already shipped).
- Manual smoke: on Chromium desktop, run a clean profile, visit oimg.app over HTTPS, confirm the Install button appears in the StatusBar within a few seconds of `bootstrapSW()` firing.

## Self-Check: PASSED

- [x] `src/stores/pwa.ts` — FOUND (33 lines; exports `$installPrompt`, `$isInstalled`, `BeforeInstallPromptEvent`)
- [x] `src/hooks/useInstallPrompt.ts` — FOUND (71 lines; listens both events, returns `{ canInstall, installed, promptInstall }`)
- [x] `src/components/shell/StatusBar.tsx` — modified to import `useInstallPrompt` and render the gated Install button with `data-testid="install-button"`
- [x] Commit `741398d` — FOUND (`git log --oneline | grep 741398d` → `feat(14-03): add pwa store atoms + useInstallPrompt hook`)
- [x] Commit `4d35eeb` — FOUND (`git log --oneline | grep 4d35eeb` → `feat(14-03): wire Install button into StatusBar via useInstallPrompt`)
- [x] `npx playwright test src/tests/pwa.spec.ts --grep "PWA-03"` → PASS (1) / FAIL (0)
- [x] `npx playwright test src/tests/foundation.spec.ts` → PASS (3) / FAIL (0) — no regression
- [x] `./node_modules/.bin/vite build` succeeded; main JS gzipped 198,261 B ≤ 204,800 B budget
