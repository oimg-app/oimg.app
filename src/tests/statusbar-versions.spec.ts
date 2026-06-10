// Phase 13 — DIA-03 (D-08/D-09): StatusBar reads live versions + Offline-ready
// pill is conditionally rendered.
//
// - D-08: SVGO badge reads versions.svgo; jSquash badge reads versions.jsquash.webp.
//   Assert PREFIX presence ("SVGO " / "jSquash · webp ") — exact version drifts
//   with package updates.
// - D-07: WASM badge derived from caps.simd/threads — "WASM ready" substring is
//   always present regardless of capability level.
// - D-09: Under Playwright (no SW registration), navigator.serviceWorker.controller
//   is null → caps.offlineReady === false → pill hidden, "Offline-ready" must NOT
//   appear in textContent.
//
// Analog: src/tests/status-bar.spec.ts (page.getByTestId('statusbar')).
import { test, expect } from '@playwright/test'

test.describe('Phase 13 — StatusBar live versions + offline-ready conditional', () => {
  test('SVGO + jSquash · webp + WASM ready prefixes are present; Offline-ready hidden when SW absent', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByTestId('statusbar')
    await expect(bar).toBeVisible()

    const text = (await bar.textContent()) ?? ''

    // D-08: live version badges (prefix-only — versions drift with deps)
    expect(text).toContain('SVGO ')
    expect(text).toContain('jSquash · webp ')

    // D-07: WASM derivation always yields a "WASM ready" prefix
    expect(text).toContain('WASM ready')

    // D-09: Offline-ready pill HIDES when caps.offlineReady === false
    // (Playwright runs without SW registration → navigator.serviceWorker.controller === null)
    expect(text).not.toContain('Offline-ready')

    // Backwards-compat sanity: legacy label + hardcoded WASM-size literal must not appear.
    // We do NOT assert version-number absence — versions.svgo currently happens to be '4.0.1'
    // (matching the prior literal), so a literal check would false-positive. The label
    // ("@squoosh-kit/core" vs "jSquash · webp") and the WASM blob ("312 KB") are unique.
    expect(text).not.toContain('312 KB')
    expect(text).not.toContain('@squoosh-kit/core')
  })
})
