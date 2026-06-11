// Phase 14 Plan 00 — Wave 0 Playwright e2e RED stubs for PWA-02/03/05 + SC#6.
//
// Four describe blocks cover the Nyquist sampling targets Waves 1–2 must
// implement. All assertions currently RED — no install button, no service
// worker, no update toast, no offline-ready pill flip exist yet.
//
// Conventions:
//   - testMatch '**/*.spec.ts' per playwright.config.ts (auto-discovered).
//   - baseURL http://localhost:5174 (config); use page.goto('/').
//   - getByTestId for stable UI hooks; page.evaluate to dispatch synthetic
//     events at the document level (analog: status-bar.spec.ts, batch-progress).
//   - addInitScript for pre-load event injection (PWA-03 beforeinstallprompt).
//
// Run: npx playwright test src/tests/pwa.spec.ts
import { test, expect } from '@playwright/test'

// ─── (a) PWA-03: Install button on synthetic beforeinstallprompt ────────────
test.describe('PWA-03 — Install button', () => {
  test('install button appears on beforeinstallprompt; hides on appinstalled', async ({ page }) => {
    // Inject a synthetic BeforeInstallPromptEvent BEFORE the app boots so the
    // `useInstallPrompt` hook (Plan 14-03) can capture it. The Event constructor
    // can't model `prompt()`/`userChoice` natively; we stub the surface.
    await page.addInitScript(() => {
      // Fire after a tick so React attaches its listener first.
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true })
          // Augment with the WICG BeforeInstallPromptEvent surface.
          Object.assign(e, {
            prompt: async () => undefined,
            userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
          })
          window.dispatchEvent(e)
        }, 50)
      })
    })

    await page.goto('/')

    // Install button surfaces in the statusbar (PWA-03 wires it next to the
    // offline pip per 14-RESEARCH.md Pattern 4).
    const installBtn = page.getByRole('button', { name: /^Install$/ })
    await expect(installBtn).toBeVisible({ timeout: 10_000 })

    // Simulate appinstalled — Chrome fires this after a successful install.
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await expect(installBtn).toBeHidden({ timeout: 5_000 })
  })
})

// ─── (b) PWA-02: SW registers and crossOriginIsolated is preserved ─────────
test.describe('PWA-02 — Service worker offline readiness', () => {
  test('service worker registers and crossOriginIsolated stays true after SW controls page', async ({ page, context }) => {
    await page.goto('/')

    // Wait for the SW to register. Playwright surfaces it via
    // context.serviceWorkers() once active; we poll with a small budget.
    const sw = await page.waitForEvent('serviceworker', { timeout: 30_000 }).catch(() => null)
    expect(sw, 'a service worker should register on first visit').toBeTruthy()

    // Reload so the SW controls the page (controllerchange).
    await page.reload({ waitUntil: 'domcontentloaded' })

    // crossOriginIsolated MUST remain true — COOP/COEP headers travel with the
    // cached Response objects per 14-RESEARCH.md §Critical Integration Risk.
    const isolated = await page.evaluate(() => crossOriginIsolated)
    expect(isolated, 'crossOriginIsolated must survive SW takeover').toBe(true)

    // SW should now control this client.
    const controlled = await page.evaluate(
      () => navigator.serviceWorker.controller !== null,
    )
    expect(controlled, 'page should be controlled by the SW after reload').toBe(true)

    // Also verify via the context surface (defensive; Plan 14-02).
    void context
  })
})

// ─── (c) PWA-05: "New version available" update toast ──────────────────────
test.describe('PWA-05 — SW update toast', () => {
  test('a "New version available" toast with a Reload action appears on onNeedRefresh', async ({ page }) => {
    await page.goto('/')

    // Plan 14-04 wires `bootstrapSW()` → registerSW({ onNeedRefresh }) and
    // exposes `window.__simulateSWNeedRefresh()` (DEV/test hook). App.tsx
    // defers registration via requestIdleCallback — poll until the hook is
    // present rather than racing first paint.
    await page.waitForFunction(
      () => typeof (window as unknown as { __simulateSWNeedRefresh?: () => void })
        .__simulateSWNeedRefresh === 'function',
      undefined,
      { timeout: 10_000 },
    )

    await page.evaluate(() => {
      const w = window as unknown as { __simulateSWNeedRefresh?: () => void }
      w.__simulateSWNeedRefresh?.()
    })

    // sonner renders toasts inside a region with role="status" / data-sonner-toast.
    await expect(
      page.getByText(/New version available/i),
    ).toBeVisible({ timeout: 10_000 })

    await expect(
      page.getByRole('button', { name: /^Reload$/ }),
    ).toBeVisible({ timeout: 5_000 })
  })
})

// ─── (d) SC#6: StatusBar Offline-ready pill renders on onOfflineReady ──────
test.describe('SC#6 — Offline-ready pill', () => {
  test('offline-ready pill renders after onOfflineReady fires (was hidden per D-09)', async ({ page }) => {
    await page.goto('/')

    // Phase 13 D-09 HIDE rule: the "Offline-ready" pill is NOT in the DOM
    // until caps.offlineReady === true. Verify the hidden baseline first.
    await expect(
      page.getByTestId('statusbar').getByText(/Offline-ready/i),
    ).toHaveCount(0)

    // Plan 14-04: poll for the test hook (App.tsx defers SW registration via
    // requestIdleCallback so the hook is installed lazily).
    await page.waitForFunction(
      () => typeof (window as unknown as { __simulateSWOfflineReady?: () => void })
        .__simulateSWOfflineReady === 'function',
      undefined,
      { timeout: 10_000 },
    )

    await page.evaluate(() => {
      const w = window as unknown as { __simulateSWOfflineReady?: () => void }
      w.__simulateSWOfflineReady?.()
    })

    // StatusBar now RENDERS the "Offline-ready" text (HIDE-when-false rule
    // inverted by setCaps({ ..., offlineReady: true })). This is SC#6: the
    // pill flips from hidden → visible on real precache-complete signal.
    await expect(
      page.getByTestId('statusbar').getByText(/Offline-ready/i),
    ).toBeVisible({ timeout: 10_000 })
  })
})
