// Phase 11 Plan 00 — Wave 0 shared save-file mocks.
// Installs renderer-side stubs for two save-path APIs used by Plans 04 + 05:
//   1. window.showSaveFilePicker — native File System Access save dialog (D-07).
//   2. saveAs (file-saver fallback) — captured via a window.__saveAsCalls spy plus a
//      URL.createObjectURL wrapper that records the anchor-click blob payloads.
//
// Per CLAUDE.md (zero-telemetry) the mocks NEVER write to disk and NEVER hit network.
// They record every recorded call into window globals that the spec then asserts.
//
// Consumed by:
//   - tests/e2e/single-download.spec.ts   (Plan 04)
//   - tests/e2e/batch-zip.spec.ts         (Plan 05)
//
// Mode reference:
//   - 'accept' (default): showSaveFilePicker resolves with a recording handle.
//   - 'cancel'          : showSaveFilePicker throws DOMException('user cancel', 'AbortError').
//                         The single-file save path must swallow this silently (D-07 + RESEARCH §Pitfall 2).

import type { Page } from '@playwright/test'

export type SaveMockMode = 'accept' | 'cancel'

export interface InstallSaveFileMocksOpts {
  /** Default: 'accept'. Use 'cancel' to assert AbortError swallow paths. */
  mode?: SaveMockMode
}

/**
 * Window globals materialized by the installed mocks. Specs can `page.evaluate`
 * any of these to read recorded calls.
 */
export interface SaveFileMockGlobals {
  /** Files that flowed through the showSaveFilePicker stub. */
  __savedFiles?: Array<{ name: string; bytes: ArrayBuffer }>
  /** Spy records for any saveAs() invocation routed through the anchor-click flow. */
  __saveAsCalls?: Array<{ name: string; blobSize: number }>
  /** True after installSaveFileMocks has run in this page. */
  __saveMocksInstalled?: boolean
}

/**
 * Install both save-file stubs in the page via `page.addInitScript`.
 * Must be called BEFORE `page.goto(...)` so the stubs are present at first paint.
 */
export async function installSaveFileMocks(
  page: Page,
  opts: InstallSaveFileMocksOpts = {},
): Promise<void> {
  const mode: SaveMockMode = opts.mode ?? 'accept'

  await page.addInitScript(
    ({ mode: m }: { mode: SaveMockMode }) => {
      type Win = Window & {
        __savedFiles?: Array<{ name: string; bytes: ArrayBuffer }>
        __saveAsCalls?: Array<{ name: string; blobSize: number }>
        __saveMocksInstalled?: boolean
        showSaveFilePicker?: (opts?: { suggestedName?: string }) => Promise<unknown>
      }
      const w = window as unknown as Win

      w.__savedFiles = []
      w.__saveAsCalls = []
      w.__saveMocksInstalled = true

      // ── (1) showSaveFilePicker stub ────────────────────────────────────────
      w.showSaveFilePicker = async (pickerOpts?: { suggestedName?: string }) => {
        if (m === 'cancel') {
          throw new DOMException('user cancel', 'AbortError')
        }
        const suggestedName = pickerOpts?.suggestedName ?? 'unnamed.bin'
        const chunks: Uint8Array[] = []
        const writable = {
          write: async (data: Blob | ArrayBuffer | Uint8Array) => {
            if (data instanceof Blob) {
              const ab = await data.arrayBuffer()
              chunks.push(new Uint8Array(ab))
            } else if (data instanceof ArrayBuffer) {
              chunks.push(new Uint8Array(data))
            } else {
              chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
            }
          },
          close: async () => {
            let total = 0
            for (const c of chunks) total += c.byteLength
            const merged = new Uint8Array(total)
            let off = 0
            for (const c of chunks) { merged.set(c, off); off += c.byteLength }
            const ab = new ArrayBuffer(merged.byteLength)
            new Uint8Array(ab).set(merged)
            const arr = w.__savedFiles ?? (w.__savedFiles = [])
            arr.push({ name: suggestedName, bytes: ab })
          },
        }
        return {
          name: suggestedName,
          kind: 'file',
          createWritable: async () => writable,
        }
      }

      // ── (2) saveAs (file-saver) spy via anchor-click + URL.createObjectURL ─
      // file-saver delivers a blob by creating an anchor with `download="name"`,
      // setting href to `URL.createObjectURL(blob)`, and synthesizing a click.
      // Wrap createObjectURL to remember the most recent blob, then intercept
      // anchor clicks that carry a `download` attribute and record the pair.
      const origCreate = URL.createObjectURL.bind(URL)
      const blobByUrl = new Map<string, Blob>()
      URL.createObjectURL = function patched(obj: Blob | MediaSource) {
        const url = origCreate(obj)
        if (obj instanceof Blob) blobByUrl.set(url, obj)
        return url
      }
      document.addEventListener(
        'click',
        (ev) => {
          const target = ev.target as Element | null
          if (!target) return
          const a = target.closest?.('a[download]') as HTMLAnchorElement | null
          if (!a) return
          const href = a.getAttribute('href') ?? ''
          const blob = blobByUrl.get(href)
          if (!blob) return
          const name = a.getAttribute('download') ?? 'unnamed.bin'
          const arr = w.__saveAsCalls ?? (w.__saveAsCalls = [])
          arr.push({ name, blobSize: blob.size })
          // Suppress the actual navigation/download so the test runner doesn't
          // open a download prompt or fetch the blob URL.
          ev.preventDefault()
        },
        true,
      )
    },
    { mode },
  )
}
