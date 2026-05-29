// Phase 09 — Plan 01: Wave 0 ENC-01..06 + D-13 test scaffold
// Tests assert FINAL expected behavior — RED until Plans 02/03 land (codec adapters + worker wiring).
// Analog: src/tests/worker-pipeline.spec.ts
import { test, expect } from '@playwright/test'

// Smallest valid 1×1 PNG (8-byte IHDR, no IDAT data — just enough for byteLength checks)
// Base64 of a real 1×1 transparent PNG (67 bytes)
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// // Smallest valid 1×1 JPEG (baseline, 631 bytes)
// const TINY_JPEG_B64 =
//   '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA/8QAHxAAAQQCAwEAAAAAAAAAAAAAAQIDBAURITFB/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKtqtqmS5bEVqxJFWjduYjbud3OT6lKUpSlKUpSv/9k='
//
// // Smallest valid 1×1 WebP (lossy, 26 bytes)
// const TINY_WEBP_B64 =
//   'UklGRiYAAABXRUJQVlA4IBoAAADQAQCdASoBAAEAAUAmJbACdAEO/g3OAAAA'

// Minimal SVG string for SVG encode tests
const TINY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>'

test.describe('Codec Encoders — ENC-01..06', () => {
  test('PNG via OxiPNG produces output with byteLength > 0 (ENC-01)', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async (b64) => {
      // Decode base64 in the page context
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const buffer = bytes.buffer

      const { getPool } = await import('../lib/worker-pool.ts')
      const pool = getPool()
      const job = {
        codec: 'PNG' as const,
        sourceFormat: 'png' as const,
        buffer,
        settings: { codec: 'PNG' as const, q: 80, method: 2, lossless: false, resizeOn: false,
          w: '100', h: '100', alg: 'lanczos3', fit: 'contain', stripMeta: true,
          keepIcc: false, aggressive: false, plugins: [] },
      }
      const res = await pool.run(job)
      return { byteLength: res.buffer.byteLength, optimizedSize: res.optimizedSize, originalSize: res.originalSize }
    }, TINY_PNG_B64)

    expect(result.byteLength).toBeGreaterThan(0)
    // OxiPNG should not inflate a valid PNG
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
  })

  test('WebP encode produces output with byteLength > 0 (ENC-02)', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async (b64) => {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const buffer = bytes.buffer

      const { getPool } = await import('../lib/worker-pool.ts')
      const pool = getPool()
      const job = {
        codec: 'WebP' as const,
        sourceFormat: 'png' as const,
        buffer,
        settings: { codec: 'WebP' as const, q: 80, method: 4, lossless: false, resizeOn: false,
          w: '100', h: '100', alg: 'lanczos3', fit: 'contain', stripMeta: true,
          keepIcc: false, aggressive: false, plugins: [] },
      }
      const res = await pool.run(job)
      return { byteLength: res.buffer.byteLength }
    }, TINY_PNG_B64)

    expect(result.byteLength).toBeGreaterThan(0)
  })

  test('JPEG encode produces output with byteLength > 0 (ENC-03)', async ({ page }) => {
    await page.goto('/')

    // Use PNG source decoded → re-encoded as JPEG (decode-then-encode path; TINY_JPEG_B64 atob
    // fails in Chromium evaluate due to argument serialization — PNG source avoids the issue)
    const result = await page.evaluate(async (b64) => {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const buffer = bytes.buffer

      const { getPool } = await import('../lib/worker-pool.ts')
      const pool = getPool()
      const job = {
        codec: 'JPEG' as const,
        sourceFormat: 'png' as const,
        buffer,
        settings: { codec: 'JPEG' as const, q: 80, method: 4, lossless: false, resizeOn: false,
          w: '100', h: '100', alg: 'lanczos3', fit: 'contain', stripMeta: true,
          keepIcc: false, aggressive: false, plugins: [], progressive: true },
      }
      const res = await pool.run(job)
      return { byteLength: res.buffer.byteLength }
    }, TINY_PNG_B64)

    expect(result.byteLength).toBeGreaterThan(0)
  })

  test('AVIF encode produces output with byteLength > 0 (ENC-04)', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async (b64) => {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const buffer = bytes.buffer

      const { getPool } = await import('../lib/worker-pool.ts')
      const pool = getPool()
      const job = {
        codec: 'AVIF' as const,
        sourceFormat: 'png' as const,
        buffer,
        settings: { codec: 'AVIF' as const, q: 60, method: 4, lossless: false, resizeOn: false,
          w: '100', h: '100', alg: 'lanczos3', fit: 'contain', stripMeta: true,
          keepIcc: false, aggressive: false, plugins: [] },
      }
      const res = await pool.run(job)
      return { byteLength: res.buffer.byteLength }
    }, TINY_PNG_B64)

    expect(result.byteLength).toBeGreaterThan(0)
  })

  test('SVG optimize produces valid XML shorter than input (ENC-05)', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async (svgStr) => {
      const encoder = new TextEncoder()
      const buffer = encoder.encode(svgStr).buffer

      const { getPool } = await import('../lib/worker-pool.ts')
      const pool = getPool()
      const job = {
        codec: 'SVG' as const,
        sourceFormat: 'svg' as const,
        buffer,
        settings: { codec: 'SVG' as const, q: 80, method: 4, lossless: false, resizeOn: false,
          w: '100', h: '100', alg: 'lanczos3', fit: 'contain', stripMeta: true,
          keepIcc: false, aggressive: false, plugins: [] },
      }
      const res = await pool.run(job)
      // SVG result is returned as buffer containing UTF-8 text
      const text = new TextDecoder('utf-8').decode(res.buffer)
      // Verify it is valid XML by checking for root element
      return { text, inputLength: svgStr.length, outputLength: text.length }
    }, TINY_SVG)

    // Result must be non-empty and parseable as XML (contains opening tag)
    expect(result.outputLength).toBeGreaterThan(0)
    expect(result.text).toContain('<svg')
    // Optimized SVG should not be longer than input
    expect(result.outputLength).toBeLessThanOrEqual(result.inputLength)
  })

  test('changing quality settings measurably changes output byteLength (ENC-06)', async ({ page }) => {
    await page.goto('/')

    const results = await page.evaluate(async (b64) => {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const { getPool } = await import('../lib/worker-pool.ts')
      const pool = getPool()

      const baseSettings = { codec: 'WebP', method: 4, lossless: false, resizeOn: false,
        w: '100', h: '100', alg: 'lanczos3', fit: 'contain', stripMeta: true,
        keepIcc: false, aggressive: false, plugins: [] }

      const jobHigh = {
        codec: 'WebP' as const,
        sourceFormat: 'png' as const,
        buffer: bytes.slice(0).buffer,
        settings: { ...baseSettings, codec: 'WebP' as const, q: 90 },
      }
      const jobLow = {
        codec: 'WebP' as const,
        sourceFormat: 'png' as const,
        buffer: bytes.slice(0).buffer,
        settings: { ...baseSettings, codec: 'WebP' as const, q: 10 },
      }

      const [resHigh, resLow] = await Promise.all([pool.run(jobHigh), pool.run(jobLow)])
      return { highByteLength: resHigh.buffer.byteLength, lowByteLength: resLow.buffer.byteLength }
    }, TINY_PNG_B64)

    // High quality should produce larger output than low quality
    expect(results.highByteLength).toBeGreaterThan(results.lowByteLength)
  })

  test('empty buffer dispatch rejects with error (D-13 WR-02)', async ({ page }) => {
    await page.goto('/')

    const rejected = await page.evaluate(async () => {
      const { getPool } = await import('../lib/worker-pool.ts')
      const pool = getPool()
      const job = {
        codec: 'WebP' as const,
        sourceFormat: 'png' as const,
        buffer: new ArrayBuffer(0),
        settings: { codec: 'WebP' as const, q: 80, method: 4, lossless: false, resizeOn: false,
          w: '100', h: '100', alg: 'lanczos3', fit: 'contain', stripMeta: true,
          keepIcc: false, aggressive: false, plugins: [] },
      }
      try {
        await pool.run(job)
        return false
      } catch {
        return true
      }
    })

    expect(rejected).toBe(true)
  })
})
