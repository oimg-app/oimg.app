// Phase 2 test fixture — deterministic Blob factory for worker-pool e2e tests.
// Source: 02-RESEARCH.md §Code Examples lines 619-635 (verbatim).
// Used by worker-pool.spec.ts (VR-01..VR-03) and object-url.spec.ts (VR-04).
//
// Why deterministic: identical seeds produce identical bytes — assertions on
// `optimizedSize === originalSize` and "0 bytes saved" become reproducible.
// Why no upfront 50×50MB allocation: makeSyntheticBatch returns a lazy Array
// of Blobs (each Blob is a single Uint8Array allocation). Memory usage stays
// O(N×size) but lazy iteration keeps GC pressure manageable.

export function makeSyntheticBlob(sizeBytes: number, seed: number): Blob {
  const arr = new Uint8Array(sizeBytes)
  // Cheap deterministic pattern; sparse fill avoids quadratic allocation cost.
  for (let i = 0; i < arr.length; i += 1024) arr[i] = (seed + i) & 0xff
  return new Blob([arr], { type: 'application/octet-stream' })
}

export function makeSyntheticBatch(count: number, sizeBytes: number): Blob[] {
  return Array.from({ length: count }, (_, i) => makeSyntheticBlob(sizeBytes, i))
}
