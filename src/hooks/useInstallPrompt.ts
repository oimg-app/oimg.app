// Phase 14 — Plan 03 (PWA-03): thin React bridge between the window's
// `beforeinstallprompt` / `appinstalled` events and the nanostores atoms
// declared in `src/stores/pwa.ts` (STORE-08).
//
// Pattern reference: 14-RESEARCH.md §Pattern 4. Convention reference:
// `useWatchFolder.ts` — window event listeners attached in `useEffect` with
// cleanup; reactive reads via `useStore`; async bodies read via `.get()` to
// dodge stale closures.
//
// Behaviour contract (must match `src/tests/pwa.spec.ts` PWA-03):
//   1. On `beforeinstallprompt`: preventDefault + cache the event into
//      `$installPrompt`. This is the only way to invoke the prompt later.
//   2. On `appinstalled`: flip `$isInstalled` + clear the cached event so the
//      Install button disappears immediately.
//   3. `promptInstall()` calls `event.prompt()`, awaits `userChoice`, clears
//      the atom regardless of outcome, and returns whether the user accepted.
//   4. `canInstall` = a deferred prompt exists AND the app isn't already
//      installed. The StatusBar button is gated entirely on this flag.
import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import {
  $installPrompt,
  $isInstalled,
  type BeforeInstallPromptEvent,
} from '@/stores/pwa'

export function useInstallPrompt(): {
  canInstall: boolean
  installed: boolean
  promptInstall: () => Promise<boolean>
} {
  const event = useStore($installPrompt)
  const installed = useStore($isInstalled)

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event): void => {
      // Prevent the browser's mini-infobar from appearing on mobile Chrome —
      // we surface our own Install affordance in the StatusBar instead.
      e.preventDefault()
      $installPrompt.set(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = (): void => {
      $isInstalled.set(true)
      // Drop the stale deferred prompt — calling prompt() after install no-ops
      // and Chromium fires `beforeinstallprompt` again if the user uninstalls.
      $installPrompt.set(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function promptInstall(): Promise<boolean> {
    // Read live state to avoid the React-stale-closure trap (precedent:
    // useWatchFolder.ts reads watchedFolderAtom.get() in async bodies).
    const live = $installPrompt.get()
    if (live === null) return false
    try {
      await live.prompt()
      const choice = await live.userChoice
      $installPrompt.set(null)
      return choice.outcome === 'accepted'
    } catch {
      // Synthetic / forged events (T-14-IP) may reject `prompt()` — clear the
      // atom so the button hides and we don't loop on a broken handle.
      $installPrompt.set(null)
      return false
    }
  }

  return {
    canInstall: event !== null && !installed,
    installed,
    promptInstall,
  }
}
