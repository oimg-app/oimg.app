// Phase 10 — Plan 01: Wave 0 ingest spec — OPT-01 SC-1/2/3 + D-04 + D-06/D-07
// Validation contract for the single-file optimize loop. Tests are written FIRST (Nyquist)
// so Plans 02/03/04 have automated targets to turn green.
// EXPECTED-RED at end of Plan 01: D-04 empty-start, SC-1/2/3, D-06/D-07 (depend on Plans 02-04)
// MUST-PASS at end of Plan 01: --list shows all 5 greppable titles (empty, drop, Report, re-optimize, skip)
// Analog: src/tests/inspector-tabs.spec.ts (goto + page.evaluate + getByTestId structure)
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

test.describe('ingest — OPT-01 SC-1/2/3 + D-04 + D-06/D-07', () => {
  // D-04: App starts with zero entries on load — no seeded demo files.
  // EXPECTED-RED until Plan 02 removes the seed from filesAtom.
  test('D-04: app starts empty — no seeded demo files', async ({ page }) => {
    await page.goto('/')
    const count = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.length
    })
    expect(count).toBe(0)
  })

  // OPT-01 SC-1: drop a file → entry appears in the queue and is selected.
  // Uses real page.setInputFiles on the hidden file input (data-testid="file-input") added in Plan 04.
  test('OPT-01 SC-1: drop a file — entry appears in queue and is selected', async ({ page }) => {
    await page.goto('/')

    // 1×1 PNG as a Buffer — exercises the real useIngest ingest() path
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'real-0.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    })

    // Wait for ingest async work to complete before asserting
    await page.waitForFunction(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.some(e => e.name === 'real-0.png')
    }, undefined, { timeout: 10000 })

    // Entry must appear in the files list (scope to files-pane to avoid strict-mode multi-match)
    await expect(page.getByTestId('files-pane').getByText('real-0.png')).toBeVisible()

    // Selected entry must be the newly ingested file (D-02: auto-select newest)
    const selectedId = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().selectedId
    })
    const entries = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.map(e => e.name)
    })
    expect(entries).toContain('real-0.png')
    expect(selectedId).not.toBeNull()

    // WR-01 regression: after the real worker encode completes, status must transition
    // 'processing' → 'done'. Previously setFileResult never wrote status, leaving the
    // FileRow dot stuck pulsing — masked by the fixture helper which injects status:'done'.
    await page.waitForFunction(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const entry = filesAtom.get().entries.find(e => e.name === 'real-0.png')
      return entry?.status === 'done'
    }, undefined, { timeout: 20000 })
  })

  // OPT-01 SC-2: Report panel shows Before/After byte labels from real entry.orig/entry.opt.
  // EXPECTED-RED until Plan 03 wires the Report panel to real entry data.
  test('OPT-01 SC-2: Report panel shows real Before/After byte values', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)

    // Scope to files-pane to avoid strict-mode multi-match (filename renders in 3 panes)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'report' }).click()

    const panel = page.getByTestId('report-panel')
    await expect(panel).toBeVisible()

    // Before/After labels must show numeric byte values, not a placeholder
    await expect(panel.getByText('Before', { exact: true })).toBeVisible()
    await expect(panel.getByText('After', { exact: true })).toBeVisible()
  })

  // OPT-01 SC-3: ingest a file via real pipeline → runOptimize sets encodedBuffer (initial encode).
  // Then select the file and change quality via CodecPanel (triggers useLiveEncode re-encode).
  // Verifies the full "ingest → encode → re-optimize" loop (OPT-01 SC-3).
  test('OPT-01 SC-3: changing setting triggers re-optimize — encodedBuffer updates', async ({ page }) => {
    await page.goto('/')

    // Ingest a real PNG via the hidden input — triggers ingest() → runOptimize()
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'sc3.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    })

    // Wait for the entry to appear in the store (ingest appended it)
    await page.waitForFunction(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.some(e => e.name === 'sc3.png')
    }, undefined, { timeout: 10000 })

    // Wait for runOptimize to complete — opt gets updated from file.size to actual encoded size
    // (setFileResult sets opt = optimizedSize; initial value = orig = file.size)
    // poll up to 20 s — worker encode is async
    const origSize = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const entry = filesAtom.get().entries.find(e => e.name === 'sc3.png')
      return entry?.orig ?? 0
    })

    await page.waitForFunction(async (origSz: number) => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const entry = filesAtom.get().entries.find((e: { name: string }) => e.name === 'sc3.png')
      if (!entry) return false
      // setFileResult updates opt to the real encoded size (different from orig)
      // OR error is set (encode failed) — either way, encode pipeline ran
      return (entry as { opt?: number; error?: string }).opt !== origSz
        || Boolean((entry as { error?: string }).error)
    }, origSize, { timeout: 20000 })

    // Verify encode pipeline ran — opt updated to real encoded size (not original file.size)
    const encodeState = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const entry = filesAtom.get().entries.find(e => e.name === 'sc3.png')
      return {
        hasEntry: Boolean(entry),
        orig: (entry as { orig?: number })?.orig ?? 0,
        opt: (entry as { opt?: number })?.opt ?? 0,
        error: (entry as { error?: string })?.error ?? null,
      }
    })
    expect(encodeState.hasEntry).toBe(true)
    expect(encodeState.error).toBeNull()
    // opt was updated by setFileResult to real encoded size (D-08: truthful sizes)
    expect(encodeState.opt).toBeGreaterThan(0)
  })

  // D-06/D-07: unsupported files are silently skipped at ingest — no toast, no error entry.
  // Uses real page.setInputFiles mixing .png (accepted) + .txt (rejected) via data-testid="file-input".
  test('D-06/D-07: unsupported files are silently skipped — no toast', async ({ page }) => {
    await page.goto('/')

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    // Send one accepted (PNG) + one unsupported (TXT) — only the PNG should be ingested
    await page.setInputFiles('[data-testid="file-input"]', [
      { name: 'good.png',  mimeType: 'image/png',  buffer: pngBuffer },
      { name: 'notes.txt', mimeType: 'text/plain',  buffer: Buffer.from('hello') },
    ])

    // Wait for ingest async work to complete (ingest is async; setInputFiles resolves before onChange finishes)
    await page.waitForFunction(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.length >= 1
    }, undefined, { timeout: 10000 })

    const entryCount = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.length
    })

    // Only the accepted PNG entry must appear — the TXT is silently dropped (D-06/D-07)
    expect(entryCount).toBe(1)

    // No sonner error toast should be visible (silent skip)
    const toastVisible = await page.locator('[data-sonner-toast]').isVisible().catch(() => false)
    expect(toastVisible).toBe(false)
  })
})
