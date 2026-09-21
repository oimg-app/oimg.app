// change:add-black-box-e2e-suite — service-worker and install-prompt helpers.
//
// Scope note: faking a real install click is out of scope for this change (the browser
// requires a genuine user gesture for beforeinstallprompt). `fakeBeforeInstallPrompt`
// only flips the app's canInstall state so the button's presence can be asserted.
import type { Page } from '@playwright/test'

/** Waits for a service worker to take control of the page. */
export async function waitForServiceWorker(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout })
}

/** True once a SW registration exists — weaker than controller, useful on a first visit. */
export async function hasServiceWorkerRegistration(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (navigator.serviceWorker === undefined) return false
    const regs = await navigator.serviceWorker.getRegistrations()
    return regs.length > 0
  })
}

/**
 * Dispatches a synthetic `beforeinstallprompt` before app scripts run, so the listener
 * that gates `install-button` sees it. Must be called before `page.goto`.
 */
export async function fakeBeforeInstallPrompt(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.addEventListener('load', () => {
      const evt = new Event('beforeinstallprompt') as Event & {
        prompt?: () => Promise<void>
        userChoice?: Promise<{ outcome: string }>
      }
      evt.prompt = async () => {}
      evt.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(evt)
    })
  })
}

/** Unregisters every service worker and clears caches — isolates offline-behaviour tests. */
export async function resetServiceWorkers(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (navigator.serviceWorker !== undefined) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  })
}
