// Phase 16 Plan 05 — MTR-01/MTR-03: end-to-end SSIM display flow.
// Covers three cases (per plan-checker note #8):
//   1. Happy path: file with buffers + status='done' → SSIM row auto-populates with a banded score.
//   2. Selection thrash (CR-02): rapid alternation between two files; final band lands on the
//      last-selected file's inspector view.
//   3. SVG source: Quality Section is entirely absent (SVG-N/A gate).
//
// Selector discipline: `data-testid` + attribute assertions ONLY on the SSIM score node.
// No text-content matching on the score (drifts with codec output) — only on labels
// ("Computing…" / "N/A") if needed elsewhere.
//
// Store-injection pattern is copied from src/tests/output-panel-live.spec.ts (project precedent —
// spec files copy helpers; no shared helper file). The pattern exercises useMetricsAuto directly,
// isolating the SSIM display path from the real optimize pipeline (which is covered by ingest.spec).
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// 16×16 solid-blue PNG — small, deterministic, embedded inline (per plan-checker note #4:
// avoid checked-in binaries for determinism). Suffices for SSIM: source and target buffers
// need to be decodable by jSquash — a valid PNG is enough since both raw and encoded slots
// point at the same bytes for the happy path (SSIM ≈ 1.0 → green band).
// Generated via Node zlib+CRC32 (see 16-05-SUMMARY §Fixture strategy). Decodes cleanly
// through jSquash png → ImageData for ssim.js. Chose 16×16 solid RGBA because ssim.js
// weber downsamples to ≥ 4×4 tiles; smaller sizes emit a mssim of NaN.
const BLUE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGOQSznxnxLMMGrAqAGjBgwXAwAOHUkf5QU4ZwAAAABJRU5ErkJggg=='

// Tiny SVG — used to verify the SVG-source N/A gate.
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

/** Inject FileEntry rows with buffers into filesAtom. Mirrors output-panel-live.spec.ts. */
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
        dim: '16×16',
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

test.describe('SSIM metric — MTR-01/MTR-03 end-to-end display', () => {
  test.setTimeout(45_000)

  test('happy path: PNG with buffers → SSIM row shows banded score', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, [
      { id: 'happy', name: 'ssim-happy.png', type: 'png', b64: BLUE_PNG_B64 },
    ])
    await openReportTab(page)

    // Wait for the metric to land in the store first — isolates worker-compute latency
    // from render latency for a cleaner diagnostic if a regression appears.
    await page.waitForFunction(
      async () => {
        const { filesAtom } = await import('/src/stores/files.ts')
        const entry = filesAtom.get().entries.find((e) => e.id === 'happy')
        return entry?.metrics?.ssim !== undefined
      },
      undefined,
      { timeout: 30_000 },
    )

    // Now the DOM node exists — literal `[data-testid="ssim-score"]` per plan quality gate.
    const scoreLoc = page.locator('[data-testid="ssim-score"]')
    await expect(scoreLoc).toBeVisible({ timeout: 5_000 })

    // Attribute-only assertion (per plan quality gate — no text matching on the score).
    // Data-band is one of the three enum values; that is sufficient — the numeric value
    // drifts with codec output and is intentionally NOT asserted.
    await expect(scoreLoc).toHaveAttribute('data-band', /^(green|yellow|red)$/)

    // Cross-check against the store: computed metric is a real number in [0, 1].
    const cachedMssim = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const entry = filesAtom.get().entries.find((e) => e.id === 'happy')
      return typeof entry?.metrics?.ssim === 'number' ? entry.metrics.ssim : null
    })
    expect(cachedMssim).not.toBeNull()
    expect(cachedMssim as number).toBeGreaterThanOrEqual(0)
    expect(cachedMssim as number).toBeLessThanOrEqual(1)
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

    // Wait for the settled file's metric to land — thrash-a's metric may still be
    // undefined (its compute was superseded by CR-02).
    await page.waitForFunction(
      async () => {
        const { filesAtom } = await import('/src/stores/files.ts')
        const entry = filesAtom.get().entries.find((e) => e.id === 'thrash-b')
        return entry?.metrics?.ssim !== undefined
      },
      undefined,
      { timeout: 30_000 },
    )

    // Literal `[data-testid="ssim-score"]` — plan quality gate.
    const scoreLoc = page.locator('[data-testid="ssim-score"]')
    await expect(scoreLoc).toBeVisible({ timeout: 5_000 })
    await expect(scoreLoc).toHaveAttribute('data-band', /^(green|yellow|red)$/)

    // Cross-check: metrics for thrash-b were written (not thrash-a's cache spilling over).
    const finalMetric = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const b = filesAtom.get().entries.find((e) => e.id === 'thrash-b')
      return typeof b?.metrics?.ssim === 'number' ? b.metrics.ssim : null
    })
    expect(finalMetric).not.toBeNull()
  })

  test('SVG source: Quality Section is not rendered (N/A path)', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, [
      { id: 'svg-source', name: 'logo.svg', type: 'svg', svg: TINY_SVG },
    ])
    await openReportTab(page)

    // Even after settling, the Quality Section is gated off entirely for SVG source.
    // Both `ssim-row` and `ssim-score` must be absent from the DOM (not just hidden).
    await expect(page.getByTestId('ssim-row')).toHaveCount(0)
    await expect(page.getByTestId('ssim-score')).toHaveCount(0)
  })
})
