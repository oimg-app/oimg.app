// Phase 13 — DIA-02 (D-04): runtime capability probe. Run ONCE at app boot
// (main.tsx) BEFORE React renders. Synchronous (SIMD probe is sync via
// WebAssembly.validate). No re-probe on visibility change.
// Analog: src/lib/dir-picker.ts (Quick 260603-s2x — feature-detect dispatcher,
// silent fallback, zero-telemetry, NEVER throws).
//
// Contract:
//   - probeCaps() is synchronous and returns a fully-populated Caps object.
//   - SIMD/threads/COI/hardwareConcurrency/offlineReady probes are guarded by
//     `typeof window !== 'undefined'` and feature-detect checks so the function
//     is safe in Node (unit tests) and SSR.
//   - On any unexpected error the relevant boolean returns `false` and
//     `hardwareConcurrency` defaults to `1`.
//   - Zero-telemetry: no console.* anywhere. NEVER throws to caller.

export interface Caps {
  simd: boolean
  threads: boolean
  crossOriginIsolated: boolean
  hardwareConcurrency: number
  offlineReady: boolean // PLACEHOLDER until Phase 14 PWA-02 wires precacheComplete
}

// 47-byte SIMD probe: minimal WASM module that uses v128 — validates only on
// SIMD support. Standard sequence from the WebAssembly community feature-detect
// suite (research §2 / 13-PATTERNS.md lines 143-148).
const SIMD_PROBE = new Uint8Array([
  0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
  1, 5, 1, 0x60, 0, 1, 0x7b,
  3, 2, 1, 0,
  10, 10, 1, 8, 0, 0x41, 0, 0xfd, 0x0f, 0xfd, 0x62, 0x0b,
])

export function probeCaps(): Caps {
  // Pattern from dir-picker.ts:21-24 — guard typeof window first for SSR/Node safety.
  const hasWindow = typeof window !== 'undefined'

  // SIMD probe — sync. On any throw or missing WebAssembly global, fall back to
  // `false`. Silent-fallback contract: no telemetry in the catch block.
  let simd = false
  try {
    simd = typeof WebAssembly !== 'undefined' && WebAssembly.validate(SIMD_PROBE)
  } catch {
    /* noop — zero-telemetry, never throws */
  }

  const coi = hasWindow && globalThis.crossOriginIsolated === true
  const threads = typeof SharedArrayBuffer !== 'undefined' && coi

  const offlineReady =
    hasWindow &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller != null // Phase 14 PWA-02 will replace with precacheComplete

  return {
    simd,
    threads,
    crossOriginIsolated: coi,
    hardwareConcurrency: hasWindow ? (navigator.hardwareConcurrency ?? 1) : 1,
    offlineReady,
  }
}
