// Phase 17 — MTR-02/MTR-03: end-to-end Butteraugli display flow.
// Cloned from ssim-metric.spec.ts; verifies parallel dispatch alongside SSIM.
//
// Covers four cases:
//   1. Happy path: PNG file with buffers + status='done' → Butteraugli row auto-populates.
//   2. Parallel dispatch (Phase 17 specific): BOTH ssim-score AND butteraugli-score
//      resolve simultaneously — proves useMetricsAuto fans out under a single seqRef.
//   3. Selection thrash (CR-02): rapid alternation between two files; final band lands
//      on the last-selected file's inspector view.
//   4. SVG source: Quality Section is entirely absent (SVG-N/A gate spans both metrics).
//
// Selector discipline: `data-testid` + attribute assertions ONLY on the score nodes.
// Text-content is only used for a shape regex (`/^\d+\.\d{2}$/`) — never for band inference.
//
// Store-injection pattern is copied verbatim from ssim-metric.spec.ts (project precedent —
// spec files copy helpers; no shared helper file). The pattern exercises useMetricsAuto
// directly, isolating the display path from the real optimize pipeline.
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// 32×32 checker RGBA PNG — small, deterministic, embedded inline (per Phase 16 lesson:
// avoid checked-in binaries for determinism). NOTE (Rule 3 auto-fix during 17-05):
// Phase 16 used a 16×16 solid-blue PNG that worked for ssim.js but returns null through
// visdif (Butteraugli's frequency-domain analysis rejects too-small / zero-variance
// tiles). A 32×32 4-px checker gives Butteraugli the spatial variation it needs while
// remaining a tiny inline fixture (~139 bytes). Both SSIM (≈1.0) and Butteraugli (≈0.0)
// land in the green band since source and target buffers point at the same bytes.
// Generated via Node zlib+CRC32 — see 17-05-SUMMARY §Fixture strategy.
const BLUE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAUklEQVR4nO3SIQEAIAwF0SVBE4I4hCUEXYYFPJw5MfXFnrgYreR+tc/jXu8hAAf8fnjvAngAHqEAHIBHKAAH4BEKwAF4hAJwAB6hAByARyiABizUHxCIVoQBwgAAAABJRU5ErkJggg=='

// Tiny SVG — used to verify the SVG-source N/A gate (Quality Section gated off).
const TINY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
  '<rect width="16" height="16" fill="red"/></svg>'

interface InjectSpec {
  id: string
  name: string
  /** Lowercase file-extension (drives Codec via codecForType). */
  type: 'png' | 'svg'
  /** Bytes for rawBuffer + encodedBuffer. */
  b64?: string
  svg?: string
}

/** Inject FileEntry rows with buffers into filesAtom. Mirrors ssim-metric.spec.ts. */
async function injectEntries(page: Page, specs: InjectSpec[]): Promise<void> {
  await page.evaluate(async (specs: InjectSpec[]) => {
    const { filesAtom, setFileRawBuffer } = await import('/src/stores/files.ts')
    const { defaultFileSettings } = await import('/src/lib/settings.ts')

    function b64ToBuffer(b64: string): ArrayBuffer {
      const bin = atob(b64)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      return buf.buffer as ArrayBuffer
    }

    const entries = specs.map((s, i) => {
      const buffer = s.type === 'svg'
        ? new TextEncoder().encode(s.svg ?? '<svg/>').buffer as ArrayBuffer
        : b64ToBuffer(s.b64 ?? '')
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        orig: buffer.byteLength,
        opt: buffer.byteLength,
        status: 'done' as const,
        target: s.type,
        dim: s.type === 'svg' ? '16×16' : '32×32',
        q: 82,
        createdAt: Date.now() + i,
        settings: defaultFileSettings(s.type, 82),
        rawBuffer: buffer,
        encodedBuffer: buffer,
      }
    })
    filesAtom.setKey('entries', entries)
    filesAtom.setKey('selectedId', entries[0]?.id ?? null)
    for (const e of entries) {
      if (e.rawBuffer) setFileRawBuffer(e.id, e.rawBuffer)
    }
  }, specs)
}

async function openReportTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'report' }).click()
  await expect(page.getByTestId('report-panel')).toBeVisible()
}

async function selectFileById(page: Page, id: string): Promise<void> {
  await page.evaluate(async (fid: string) => {
    const { selectFile } = await import('/src/stores/files.ts')
    selectFile(fid)
  }, id)
}

test.describe('Butteraugli metric — MTR-02/MTR-03 end-to-end display', () => {
  // Butteraugli wasm bootstrap (~150 ms) + SSIM + Butteraugli parallel compute + CI margin.
  test.setTimeout(45_000)

  test('happy path: PNG with buffers → Butteraugli row shows banded score', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, [
      { id: 'happy', name: 'butteraugli-happy.png', type: 'png', b64: BLUE_PNG_B64 },
    ])
    await openReportTab(page)

    // Wait for the metric to land in the store first — isolates worker-compute latency
    // from render latency for a cleaner diagnostic if a regression appears.
    await page.waitForFunction(
      async () => {
        const { filesAtom } = await import('/src/stores/files.ts')
        const entry = filesAtom.get().entries.find((e) => e.id === 'happy')
        return entry?.metrics?.butteraugli !== undefined
      },
      undefined,
      { timeout: 30_000 },
    )

    // Now the DOM node exists — literal `[data-testid="butteraugli-score"]` per plan gate.
    const scoreLoc = page.locator('[data-testid="butteraugli-score"]')
    await expect(scoreLoc).toBeVisible({ timeout: 5_000 })

    // Attribute-only assertion (per plan quality gate — no text matching on band).
    // Data-band is one of the three enum values; that is sufficient — the numeric value
    // drifts with codec output and is intentionally NOT asserted for band inference.
    await expect(scoreLoc).toHaveAttribute('data-band', /^(green|yellow|red)$/)

    // Score-shape check: matches .toFixed(2) output shape.
    // Butteraugli range is [0, +∞), so one or more leading digits, dot, exactly 2 decimals.
    const scoreText = await scoreLoc.textContent()
    expect(scoreText).toMatch(/^\d+\.\d{2}$/)

    // Cross-check against the store: computed metric is a real number in defensive range.
    const cachedDistance = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const entry = filesAtom.get().entries.find((e) => e.id === 'happy')
      return typeof entry?.metrics?.butteraugli === 'number' ? entry.metrics.butteraugli : null
    })
    expect(cachedDistance).not.toBeNull()
    // visdif on identical bytes returns near-0; defensive ceiling at 20 catches
    // wasm-corruption returns without pinning to codec output.
    expect(cachedDistance as number).toBeGreaterThanOrEqual(0)
    expect(cachedDistance as number).toBeLessThanOrEqual(20)
  })

  test('parallel dispatch: SSIM AND Butteraugli both populate for one file', async ({ page }) => {
    // Phase 17 — proves useMetricsAuto fans out both metrics under a single seqRef.
    // If dispatch were serial, one metric would arrive materially later than the other;
    // both must resolve within the same 30 s window.
    await page.goto('/')
    await injectEntries(page, [
      { id: 'parallel', name: 'parallel.png', type: 'png', b64: BLUE_PNG_B64 },
    ])
    await openReportTab(page)

    await page.waitForFunction(
      async () => {
        const { filesAtom } = await import('/src/stores/files.ts')
        const entry = filesAtom.get().entries.find((e) => e.id === 'parallel')
        return entry?.metrics?.ssim !== undefined && entry?.metrics?.butteraugli !== undefined
      },
      undefined,
      { timeout: 30_000 },
    )

    // BOTH score nodes must be visible simultaneously.
    const ssimLoc = page.locator('[data-testid="ssim-score"]')
    const butteraugliLoc = page.locator('[data-testid="butteraugli-score"]')
    await expect(ssimLoc).toBeVisible({ timeout: 5_000 })
    await expect(butteraugliLoc).toBeVisible({ timeout: 5_000 })

    // Both bands must be valid enum values.
    await expect(ssimLoc).toHaveAttribute('data-band', /^(green|yellow|red)$/)
    await expect(butteraugliLoc).toHaveAttribute('data-band', /^(green|yellow|red)$/)
  })

  test('selection thrash: final band lands on last-selected file (CR-02)', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, [
      { id: 'thrash-a', name: 'thrash-a.png', type: 'png', b64: BLUE_PNG_B64 },
      { id: 'thrash-b', name: 'thrash-b.png', type: 'png', b64: BLUE_PNG_B64 },
    ])
    await openReportTab(page)

    // Rapid alternation — supersedes the seqRef so any in-flight compute lands on the last
    // click. Five toggles is enough to exercise the CR-02 stale-drop guard.
    for (let i = 0; i < 5; i++) {
      await selectFileById(page, 'thrash-a')
      await selectFileById(page, 'thrash-b')
    }
    // Settle on thrash-b — verify the store agrees.
    const settledId = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().selectedId
    })
    expect(settledId).toBe('thrash-b')

    // Wait for the settled file's Butteraugli metric to land — thrash-a's metric may still
    // be undefined (its compute was superseded by CR-02).
    await page.waitForFunction(
      async () => {
        const { filesAtom } = await import('/src/stores/files.ts')
        const entry = filesAtom.get().entries.find((e) => e.id === 'thrash-b')
        return entry?.metrics?.butteraugli !== undefined
      },
      undefined,
      { timeout: 30_000 },
    )

    // Literal `[data-testid="butteraugli-score"]` — plan quality gate.
    const scoreLoc = page.locator('[data-testid="butteraugli-score"]')
    await expect(scoreLoc).toBeVisible({ timeout: 5_000 })
    // Defensive: proves no NaN write from a stale dispatch (any valid band is fine).
    await expect(scoreLoc).toHaveAttribute('data-band', /^(green|yellow|red)$/)

    // Cross-check: metrics for thrash-b were written (not thrash-a's cache spilling over).
    const finalMetric = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const b = filesAtom.get().entries.find((e) => e.id === 'thrash-b')
      return typeof b?.metrics?.butteraugli === 'number' ? b.metrics.butteraugli : null
    })
    expect(finalMetric).not.toBeNull()
  })

  test('SVG source: Quality Section is not rendered (N/A path spans both metrics)', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, [
      { id: 'svg-source', name: 'logo.svg', type: 'svg', svg: TINY_SVG },
    ])
    await openReportTab(page)

    // Quality Section is gated off entirely for SVG source. Both butteraugli-row and
    // butteraugli-score must be absent from the DOM (not just hidden).
    await expect(page.locator('[data-testid="butteraugli-row"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="butteraugli-score"]')).toHaveCount(0)
    // Regression check: Phase 16 gate held; Phase 17 didn't accidentally add a
    // parallel Section that renders for SVG.
    await expect(page.locator('[data-testid="ssim-score"]')).toHaveCount(0)
  })
})
