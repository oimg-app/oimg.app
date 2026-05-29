// Phase 10 — Plan 01: Wave 0 shared fixture helper for store injection (D-05)
// Injects real FileEntry objects with real bytes into filesAtom via page.evaluate.
// Analog: src/tests/per-file-settings.spec.ts (page.evaluate store-injection pattern)
// DO NOT import production logic here — test fixture only; excluded from production bundle.
import type { Page } from '@playwright/test'

/**
 * Injects `count` synthetic PNG FileEntry objects into `filesAtom` via page.evaluate.
 * Entries have deterministic ids `fixture-${i}` and names `fixture-${i}.png`.
 * Monotonic `createdAt` ensures queue-order sort is deterministic.
 * After this call, `filesAtom.get().entries.length === count` and `selectedId === 'fixture-0'`.
 */
export async function ingestFixtureFiles(page: Page, count = 1): Promise<void> {
  await page.evaluate(async (n: number) => {
    const { filesAtom, setFileRawBuffer } = await import('../../stores/files.ts')
    const { defaultFileSettings } = await import('../../lib/stub-data.ts')

    // Reuse the same 1×1 PNG base64 string as TINY_PNG_B64 in stub-data.ts (line 135-136)
    const TINY_PNG_B64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    function b64ToBuffer(b64: string): ArrayBuffer {
      const bin = atob(b64)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      return buf.buffer as ArrayBuffer
    }

    const entries = Array.from({ length: n }, (_, i) => {
      const id = `fixture-${i}`
      const rawBuffer = b64ToBuffer(TINY_PNG_B64)
      return {
        id,
        name: `fixture-${i}.png`,
        type: 'png',
        orig: rawBuffer.byteLength,
        opt: rawBuffer.byteLength,
        status: 'done' as const,
        target: 'png',
        dim: '1×1',
        q: 82,
        createdAt: Date.now() + i, // monotonic so queue-order sort is deterministic
        settings: defaultFileSettings('png', 82),
        rawBuffer,
      }
    })

    filesAtom.setKey('entries', entries)
    filesAtom.setKey('selectedId', entries[0].id)
    for (const e of entries) {
      if (e.rawBuffer) setFileRawBuffer(e.id, e.rawBuffer)
    }
  }, count)
}
