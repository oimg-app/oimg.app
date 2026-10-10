// change:add-black-box-e2e-suite — shared fixture bytes for the black-box suite.
// These base64 strings are consolidated from the constants that were previously inlined in
// codec-encoders.spec.ts, ssim-metric.spec.ts and watch-folder.spec.ts. Bytes are committed
// here rather than fetched: tests must never touch the network (threat T-11-FX).
//
// No production imports — this module is test-only.

/** 1×1 transparent PNG (67 bytes). Smallest fixture that still decodes through jSquash. */
export const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** 1×1 opaque PNG, distinct bytes from PNG_1x1 — use when a test needs two unequal sources. */
export const PNG_1x1_ALT =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/**
 * 16×16 solid-blue PNG. Required by the metrics path: ssim.js weber-downsamples to ≥4×4
 * tiles, so anything smaller yields mssim = NaN. Use this — not PNG_1x1 — for SSIM work.
 */
export const PNG_16x16 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGOQSznxnxLMMGrAqAGjBgwXAwAOHUkf5QU4ZwAAAABJRU5ErkJggg=='

/** 1×1 lossy WebP (26 bytes) — RIFF/VP8 container. */
export const WEBP_1x1 = 'UklGRiYAAABXRUJQVlA4IBoAAADQAQCdASoBAAEAAUAmJbACdAEO/g3OAAAA'

/** Minimal SVG markup — the SVG source/codec path. Not base64: SVG ingests as text. */
export const SVG_SIMPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
  '<rect width="16" height="16" fill="red"/></svg>'

/**
 * SVG carrying cruft SVGO actually removes (comment, metadata, redundant precision),
 * so a plugin toggle produces a measurable byte delta instead of a no-op.
 */
export const SVG_COMPLEX =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<!-- a comment SVGO strips -->' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
  '<metadata>drop me</metadata>' +
  '<g><path d="M 4.00000 4.00000 L 28.00000 4.00000 L 28.00000 28.00000 Z" fill="#ff0000"/></g>' +
  '</svg>'

/** Decodes a base64 fixture to bytes. Works in both Node and the browser context. */
export function b64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  const buf = Buffer.from(b64, 'base64')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice()
}

/** Node-side Buffer for `page.setInputFiles`, which requires a Buffer rather than a view. */
export function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64')
}
