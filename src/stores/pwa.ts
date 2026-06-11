// Phase 14 — Plan 03 (PWA-03 / STORE-08): nanostores atoms for the deferred
// `beforeinstallprompt` event and the "is already installed" probe.
//
// Why a dedicated store file:
//   - STORE-08: zero `useState` for data. State lives in atoms; the hook is a
//     thin bridge between the window event and the atom.
//   - Co-located precedent: `watchedFolderAtom` in `runtime.ts` (Quick 260603-s2x)
//     keeps small atoms in stores; this plan adds two more that don't belong
//     inside `runtimeAtom`'s shape.
//
// Circular-ESM guard (per 14-03-PLAN Task 1 action):
//   pwa.ts MUST NOT import from `files.ts`, `runtime.ts`, or `settings.ts`. The
//   atoms here are self-contained — only `nanostores` is imported.
import { atom } from 'nanostores'

// WICG BeforeInstallPromptEvent surface — Chromium-only, not yet in lib.dom.d.ts.
// Source: https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

// SSR-guarded initial probe for the display-mode standalone check. `matchMedia`
// is not defined in non-browser contexts (Vite SSR / node test runners).
function initialInstalled(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

// The deferred prompt is null until the browser fires `beforeinstallprompt`.
// Firefox never fires it; this atom simply stays null and the StatusBar button
// never appears (PWA-03 acceptance — no fallback UI).
export const $installPrompt = atom<BeforeInstallPromptEvent | null>(null)

// `$isInstalled` flips true either when (a) the boot probe finds the app
// running in standalone display-mode (returning user opens the installed PWA)
// or (b) the browser fires `appinstalled` during this session.
export const $isInstalled = atom<boolean>(initialInstalled())
