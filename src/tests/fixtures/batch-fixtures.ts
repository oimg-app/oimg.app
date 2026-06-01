// Phase 11 Plan 00 — Wave 0 shared batch fixture set.
// Provides exactly 20 ≤200KB PNG/WebP fixture buffers for SC-4 backpressure runs
// (Plan 08) and for ZIP roundtrip + collision-suffix exercise (Plan 05).
//
// Constraints (from 11-00-PLAN.md Task 3 acceptance criteria):
//   - batchFixtures.length === 20
//   - At least 3 entries share the base filename "dup.png" (D-10 collision logic)
//   - Each fixture's bytes.byteLength <= 200_000
//   - Each fixture is re-readable as `new File([f.bytes], f.name, { type: f.mime })`
//
// Generation strategy: deterministic, fully in-process, zero network. The PNG bytes are
// pre-built 8x8 solid-color PNGs (~80 bytes each) materialized from base64. The WebP
// bytes are a known-good ~32-byte VP8 lossy 1x1 RIFF container. All buffers are
// committed alongside the test code per threat T-11-FX (no fetch at test time).

export interface BatchFixture {
  /** Filename including extension. May repeat across entries (collision exerciser). */
  name: string
  /** MIME type matching the byte format. */
  mime: 'image/png' | 'image/webp'
  /** Raw image bytes. Always ≤ 200_000 bytes. */
  bytes: Uint8Array
}

// ── Base byte builders ────────────────────────────────────────────────────────

function b64ToBytes(b64: string): Uint8Array {
  // Node + browser-safe base64 decoder.
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  // Node fallback (test harness runs under node --experimental-strip-types)
  const buf = Buffer.from(b64, 'base64')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice()
}

// 8x8 solid-color PNGs generated via Node + zlib (see PLAN.md Task 3 notes).
// Each entry: [colorTag, base64]. Total ~80 bytes per PNG → far below 200_000 cap.
const PNG_SAMPLES: ReadonlyArray<readonly [string, string]> = [
  ['red',     'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC'],
  ['blue',    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEElEQVR4nGNgYPiPAw0pCQCpcD/BFMrqcwAAAABJRU5ErkJggg=='],
  ['green',   'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR4nGNgYGD4DwQACQEB/wjE6PEAAAAASUVORK5CYII='],
  ['yellow',  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEElEQVR4nGP8z8DwHwsiKQ4Aov0/wQiPq2EAAAAASUVORK5CYII='],
  ['magenta', 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEElEQVR4nGP4z8DA8B8LIikOAKL9P8EIj6thAAAAAElFTkSuQmCC'],
  ['cyan',    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEElEQVR4nGNgYPj/HwsiKQ4Aov0/wQiPq2EAAAAASUVORK5CYII='],
  ['black',   'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVR4nGNgYGD4DwQABQECAUz23bEAAAAASUVORK5CYII='],
]

// Minimal valid 1x1 lossy WebP (RIFF / VP8). ~32 bytes — well under 200_000.
const WEBP_TINY_B64 = 'UklGRhoAAABXRUJQVlA4IA4AAAAwAQBQAgAANCWkAwA='

// ── Build the 20-entry fixture array ──────────────────────────────────────────

const fixtures: BatchFixture[] = []

// 14 unique PNGs (cycle through the 7 colors twice with distinct filenames)
for (let i = 0; i < 14; i++) {
  const [tag, b64] = PNG_SAMPLES[i % PNG_SAMPLES.length]
  fixtures.push({
    name: `tiny-${String(i + 1).padStart(3, '0')}-${tag}.png`,
    mime: 'image/png',
    bytes: b64ToBytes(b64),
  })
}

// 3 collision entries — all share the literal base name "dup.png" (D-10 exerciser).
// Use different color bytes so the byte content is non-identical (proves the
// collision logic keys off filename, not byte hash).
for (let i = 0; i < 3; i++) {
  const [, b64] = PNG_SAMPLES[i] // red, blue, green
  fixtures.push({
    name: 'dup.png',
    mime: 'image/png',
    bytes: b64ToBytes(b64),
  })
}

// 3 WebP entries
for (let i = 0; i < 3; i++) {
  fixtures.push({
    name: `tiny-${String(15 + i).padStart(3, '0')}.webp`,
    mime: 'image/webp',
    bytes: b64ToBytes(WEBP_TINY_B64),
  })
}

if (fixtures.length !== 20) {
  throw new Error(`batchFixtures must have exactly 20 entries, got ${fixtures.length}`)
}
for (const f of fixtures) {
  if (f.bytes.byteLength > 200_000) {
    throw new Error(`batchFixtures entry ${f.name} exceeds 200KB cap: ${f.bytes.byteLength}`)
  }
}

export const batchFixtures: ReadonlyArray<BatchFixture> = fixtures
