import { test, expect } from '@playwright/test'

// Phase 3 plan 03-D — live E2E coverage for OPT-01, PIPE-01, SNIP-01,
// SNIP-03, SNIP-04. The Wave 0 stubs (test.fail()) were placeholders that
// turn green when each plan replaces them with the live assertions below.
//
// Pattern: drop a Blob into useFilesStore via the dev-only window.__OIMG_STORES__
// affordance, click "Optimize all", wait for status==='done', then assert on
// the resulting FileEntry / SnippetPanel render. Boilerplate is a verbatim
// copy of worker-pool.spec.ts (Phase 2 VR-01) — this is the agreed test
// shape for store-backed E2E throughout the project.

// Minimal clean SVG with deliberate cruft (comment + metadata) so the
// SVGO output verification has something to remove.
const CLEAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- Remove this comment -->
  <metadata>Remove this metadata</metadata>
  <circle r="50" cx="50" cy="50" fill="blue"/>
</svg>`

// SVG with floating-point coordinates so cleanupNumericValues actually has
// something to round — used by the plugin-toggle test where disabling the
// plugin must produce a measurably-different (or identical) byte size.
const NUMERIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle r="50.123456" cx="50.987654" cy="50.555555" fill="#FF0000"/>
  <rect x="10.111111" y="20.222222" width="30.333333" height="40.444444" fill="#00FF00"/>
</svg>`

async function addSvgFile(
  page: import('@playwright/test').Page,
  id: string,
  svgContent: string,
) {
  await page.evaluate(
    ({ id, svgContent }) => {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const stores = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
      stores.files.getState().addFile({
        id,
        name: `${id}.svg`,
        format: 'svg',
        originalSize: blob.size,
        optimizedSize: null,
        status: 'idle',
        sourceDensity: '1x',
        thumbnail: null,
        sourceBlob: blob,
        optimizedBlob: null,
      })
      stores.files.getState().setSelected(id)
    },
    { id, svgContent },
  )
}

async function waitForDone(
  page: import('@playwright/test').Page,
  id: string,
  timeoutMs = 10000,
) {
  await page.waitForFunction(
    (fileId: string) => {
      const s = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
      const f = s.files.getState().byId[fileId]
      return !s.runtime.getState().running && f && f.status === 'done'
    },
    id,
    { timeout: timeoutMs },
  )
}

test.describe('Phase 3 — SVG pipeline (OPT-01, PIPE-01, SNIP-01, SNIP-03, SNIP-04)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
    )
  })

  test('PIPE-01 + OPT-01: drop SVG → enqueue → optimize → status done + byte delta in row', async ({ page }) => {
    await addSvgFile(page, 'opt-01-test', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'opt-01-test')

    const entry = await page.evaluate(
      () =>
        (window as unknown as { __OIMG_STORES__: any })
          .__OIMG_STORES__.files.getState().byId['opt-01-test'],
    )
    expect(entry.status).toBe('done')
    expect(entry.optimizedSize).not.toBeNull()
    // OPT-01 contract: SVGO removed the comment + metadata, output is smaller.
    expect(entry.optimizedSize).toBeLessThan(entry.originalSize)
  })

  test('OPT-01: SVGO preset-default runs — output is valid SVG with comment + metadata removed', async ({ page }) => {
    await addSvgFile(page, 'svgo-verify', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'svgo-verify')

    const optimizedText = await page.evaluate(async () => {
      const blob = (window as unknown as { __OIMG_STORES__: any })
        .__OIMG_STORES__.files.getState().byId['svgo-verify'].optimizedBlob
      return blob ? await blob.text() : null
    })
    expect(optimizedText).not.toBeNull()
    expect(optimizedText).not.toContain('<!-- Remove this comment -->')
    expect(optimizedText).not.toContain('<metadata>')
    // Sanity: still a valid SVG document.
    expect(optimizedText).toContain('<svg')
  })

  test('OPT-01: plugin toggle re-optimizes selected file (D-08) — debounced re-run completes', async ({ page }) => {
    await addSvgFile(page, 'toggle-test', NUMERIC_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'toggle-test')

    const sizeBefore = await page.evaluate(
      () =>
        (window as unknown as { __OIMG_STORES__: any })
          .__OIMG_STORES__.files.getState().byId['toggle-test'].optimizedSize as number,
    )

    // Toggle cleanupNumericValues OFF — disabling rounding on floating-point
    // coordinates leaves their fuller precision intact, so the re-optimized
    // output must be greater than or equal to (almost always strictly greater
    // than) the baseline run with cleanupNumericValues on.
    await page.evaluate(() => {
      const settings = (window as unknown as { __OIMG_STORES__: any })
        .__OIMG_STORES__.settings
      const plugins = settings.getState().svg.plugins
      settings.getState().setSvg({
        plugins: { ...plugins, cleanupNumericValues: false },
      })
    })

    // D-08/D-11: enqueuePreview debounces 200ms then enqueues a 'preview-…'
    // job; wait long enough for the debounce + worker round-trip + main-thread
    // sanitize step to update FileEntry.optimizedSize.
    await page.waitForFunction(
      ({ id, beforeSize }) => {
        const f = (window as unknown as { __OIMG_STORES__: any })
          .__OIMG_STORES__.files.getState().byId[id]
        return f && f.status === 'done' && f.optimizedSize !== beforeSize
      },
      { id: 'toggle-test', beforeSize: sizeBefore },
      { timeout: 5000 },
    )

    const sizeAfter = await page.evaluate(
      () =>
        (window as unknown as { __OIMG_STORES__: any })
          .__OIMG_STORES__.files.getState().byId['toggle-test'].optimizedSize as number,
    )
    // Disabling cleanupNumericValues keeps wider precision → equal or larger.
    expect(sizeAfter).toBeGreaterThanOrEqual(sizeBefore)
  })

  test('OPT-01: foot-gun warnings render on cleanupIds, removeViewBox, removeDimensions', async ({ page }) => {
    // Selecting an SVG file auto-flips the inspector to the SVGO tab
    // (App.tsx side-effect) so SvgoPanel + foot-gun hints are visible without
    // an explicit tab click.
    await addSvgFile(page, 'footgun-test', CLEAN_SVG)
    await expect(
      page.locator('text=/Disabling viewBox can break responsive scaling/'),
    ).toBeVisible()
    await expect(
      page.locator('text=/Removes width\\/height attributes/'),
    ).toBeVisible()
    await expect(
      page.locator('text=/May break external CSS or/'),
    ).toBeVisible()
  })

  test('OPT-01: live savings column populated post-batch (D-06)', async ({ page }) => {
    await addSvgFile(page, 'live-savings', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'live-savings')

    // computePluginSavings runs N+1 passes through the worker pool with a
    // 5s wall-time cap. After it commits, useSettingsStore.svg.pluginSavings
    // is populated. Wait until at least one entry exists.
    await page.waitForFunction(
      () => {
        const savings = (window as unknown as { __OIMG_STORES__: any })
          .__OIMG_STORES__.settings.getState().svg.pluginSavings
        return savings && Object.keys(savings).length > 0
      },
      { timeout: 10000 },
    )

    const savings = await page.evaluate(
      () =>
        (window as unknown as { __OIMG_STORES__: any })
          .__OIMG_STORES__.settings.getState().svg.pluginSavings,
    )
    // removeComments is the first plugin processed in computePluginSavings'
    // ordered iteration over Object.keys(plugins) — guaranteed present even
    // if the timeout cuts the run short.
    expect(Object.keys(savings)).toContain('removeComments')
  })

  test('SNIP-01: SnippetPanel renders inline-SVG and data-URI sections for SVG file', async ({ page }) => {
    await addSvgFile(page, 'snip-01-test', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'snip-01-test')

    // SVG file auto-tabs to 'svgo' on selection. Switch to the Output tab so
    // SnippetPanel mounts.
    await page.getByRole('tab', { name: /^Output$/ }).click()

    // Section titles from SNIPPET_REGISTRY entries with applicableFormats: ['svg'].
    await expect(page.locator('text=Inline SVG').first()).toBeVisible()
    await expect(page.locator('text=Data URI · URL-encoded')).toBeVisible()
  })

  test('SNIP-01: per-snippet checkbox hides section body when unchecked (D-13)', async ({ page }) => {
    await addSvgFile(page, 'checkbox-test', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'checkbox-test')

    await page.getByRole('tab', { name: /^Output$/ }).click()

    // SnippetPanel renders a per-snippet checkbox with aria-label
    // `${def.label} snippet enabled`. Uncheck the inline-SVG one and the
    // section body must collapse to the "Disabled. Enable above…" hint.
    const checkbox = page.getByRole('checkbox', { name: /Inline SVG snippet enabled/i })
    await checkbox.uncheck()
    await expect(
      page.locator('text=/Disabled\\. Enable above/'),
    ).toBeVisible()
  })

  test('SNIP-03: copy button writes snippet to clipboard; shows copied state ≥ 1100ms', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await addSvgFile(page, 'copy-test', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'copy-test')

    await page.getByRole('tab', { name: /^Output$/ }).click()

    // First .copy-btn in the SnippetPanel = inline-SVG copy button.
    const copyBtn = page.locator('.copy-btn').first()
    await copyBtn.click()
    await expect(copyBtn).toContainText('copied')

    // The clipboard now holds the inline SVG snippet text — assert it's a
    // valid SVG body so we confirm the right text reached the clipboard.
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('<svg')

    // SnippetPanel resets to 'copy' label after 1100ms — wait a bit longer
    // for the timer to fire and re-render to land.
    await page.waitForTimeout(1300)
    await expect(copyBtn).toContainText('copy')
  })

  test('SNIP-04: URL-encoded output is CSS-safe (no unencoded < > # ")', async ({ page }) => {
    await addSvgFile(page, 'snip-04-test', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'snip-04-test')

    await page.getByRole('tab', { name: /^Output$/ }).click()

    // Read the snippet text directly from the clipboard via the copy button —
    // the data-URI Section is the second .copy-btn in registry order.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const dataUriCopyBtn = page.locator('.copy-btn').nth(1)
    await dataUriCopyBtn.click()
    const codeText = await page.evaluate(() => navigator.clipboard.readText())

    expect(codeText).not.toBeNull()
    expect(codeText).toMatch(/^url\("data:image\/svg\+xml,/)
    // Per yoksel encoder (SNIP-04 / D-15): < > # " inside the encoded SVG
    // are replaced with percent-encoded sequences or single quotes; only the
    // outer url("…") wrapper uses double quotes and # is the terminating ")".
    const encoded = (codeText ?? '').replace(/^url\("data:image\/svg\+xml,/, '').replace(/"\)$/, '')
    expect(encoded).not.toContain('<')
    expect(encoded).not.toContain('>')
    expect(encoded).not.toContain('#')
    expect(encoded).not.toContain('"')
  })

  test('sanitized badge: clean SVG → sanitizedCount === 0 → "sanitized" badge not shown', async ({ page }) => {
    await addSvgFile(page, 'clean-badge-test', CLEAN_SVG)
    await page.getByRole('button', { name: /Optimize/i }).click()
    await waitForDone(page, 'clean-badge-test')

    const count = await page.evaluate(
      () =>
        (window as unknown as { __OIMG_STORES__: any })
          .__OIMG_STORES__.files.getState().byId['clean-badge-test'].sanitizedCount,
    )
    // Clean SVG has no dangerous elements/attrs → sanitizedCount is 0
    // (or undefined if the unsafe path was taken — defensive coalesce).
    expect(count ?? 0).toBe(0)
    // The "sanitized · N" badge in the file row only renders when count > 0.
    await expect(page.locator('text=/sanitized · /')).not.toBeVisible()
  })
})
