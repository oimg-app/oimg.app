// change:add-black-box-e2e-suite — waiters for the async encode/metrics pipeline.
//
// Every wait here polls filesAtom rather than the DOM. Status text and byte labels are
// derived render output; the store is where the pipeline actually reports completion.
//
// Timeouts are generous because the first encode in a run pays WASM instantiation — the
// known metrics-worker warmup that the change's CI requirement calls out.
import type { Page } from '@playwright/test'
import { FILES_MOD } from './page-modules'

type FilesModule = typeof import('../../stores/files')

/** First encode of a session instantiates codec WASM; later ones are far quicker. */
export const ENCODE_TIMEOUT = 20_000
export const METRICS_TIMEOUT = 30_000

/** Waits for one entry to reach `done` (throws if it lands in `error` instead). */
export async function waitForEncoded(page: Page, id: string, timeout = ENCODE_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    async ({ mod, fileId }: { mod: string; fileId: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)
      if (entry === undefined) return false
      if (entry.error != null) throw new Error(`encode failed: ${entry.error}`)
      return entry.status === 'done' && entry.encodedBuffer != null
    },
    { mod: FILES_MOD, fileId: id },
    { timeout },
  )
}

/** Current encoded byte length, or null before the first encode lands. */
export async function encodedSize(page: Page, id: string): Promise<number | null> {
  return page.evaluate(
    async ({ mod, fileId }: { mod: string; fileId: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)
      return entry?.encodedBuffer != null ? entry.encodedBuffer.byteLength : null
    },
    { mod: FILES_MOD, fileId: id },
  )
}

/**
 * Waits until an entry's encoded bytes differ from `previous`.
 *
 * This is the honest check that a knob triggered a real re-encode: a settings mutation
 * alone proves nothing about whether useLiveEncode actually reran.
 */
export async function waitForReencode(
  page: Page,
  id: string,
  previous: number | null,
  timeout = ENCODE_TIMEOUT,
): Promise<number> {
  await page.waitForFunction(
    async ({ mod, fileId, prev }: { mod: string; fileId: string; prev: number | null }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)
      if (entry?.encodedBuffer == null) return false
      return entry.status === 'done' && entry.encodedBuffer.byteLength !== prev
    },
    { mod: FILES_MOD, fileId: id, prev: previous },
    { timeout },
  )
  return (await encodedSize(page, id)) as number
}

/** Waits for SSIM and Butteraugli to settle (both workers warm up lazily). */
export async function waitForMetrics(page: Page, id: string, timeout = METRICS_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    async ({ mod, fileId }: { mod: string; fileId: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)
      if (entry === undefined) return false
      // SVG sources are gated out of metrics by design — treat that as settled, not pending.
      if (entry.type === 'svg') return entry.status === 'done'
      // Tri-state: undefined = still computing, null = failed, number = computed. Both
      // settled outcomes end the wait; keying on `!= null` would hang on a failed metric.
      const m = entry.metrics
      if (m === undefined) return false
      return 'ssim' in m && 'butteraugli' in m
    },
    { mod: FILES_MOD, fileId: id },
    { timeout },
  )
}

/** Waits for the whole queue to drain — no entry left queued or processing. */
export async function waitForBatchDone(page: Page, timeout = 60_000): Promise<void> {
  await page.waitForFunction(
    async (mod: string) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const entries = filesAtom.get().entries
      return entries.length > 0 && entries.every((e) => e.status === 'done' || e.status === 'error')
    },
    FILES_MOD,
    { timeout },
  )
}

/** Runs Optimize-all and waits for the queue to drain. */
export async function optimizeAll(page: Page, timeout = 60_000): Promise<void> {
  await page.getByTestId('toolbar-btn-optimize-all').click()
  await waitForBatchDone(page, timeout)
}
