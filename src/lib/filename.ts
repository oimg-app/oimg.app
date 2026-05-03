// Phase 4 D-03 + D-16 — density suffix templating + collision dedup.
// Source: 04-RESEARCH.md §6.1 + §6.2; CONTEXT.md D-16 amendment.
// Pure functions — no React, no zustand. Unit-tested via --experimental-strip-types
// (src/tests/filename.test.ts).

import type { SourceDensity } from '../types/index.ts'

/** Idempotent: strip an existing @1x/@2x/@3x before re-appending. So
 *  applyDensitySuffix('logo@2x.png', '1x') === 'logo@1x.png', NOT 'logo@2x@1x.png'. */
export function applyDensitySuffix(originalName: string, density: SourceDensity): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  const ext = dot > 0 ? originalName.slice(dot) : ''
  const stripped = base.replace(/@[123]x$/, '')
  return `${stripped}@${density}${ext}`
}

/** D-16 — order-of-operations: applyDensitySuffix runs FIRST, then dedup
 *  against the existing FileEntry name set. Insert " (N)" BEFORE the @Nx
 *  suffix so the extension and density tag stay terminal. */
export function deduplicateName(proposed: string, takenSet: ReadonlySet<string>): string {
  if (!takenSet.has(proposed)) return proposed
  // Strip the @Nx suffix so " (N)" inserts before it.
  const m = proposed.match(/^(.*?)(@[123]x)(\.[^.]+)?$/)
  if (!m) return proposed
  const [, head, density, ext = ''] = m
  for (let i = 2; i < 1000; i++) {
    const candidate = `${head} (${i})${density}${ext}`
    if (!takenSet.has(candidate)) return candidate
  }
  return `${head} (${crypto.randomUUID().slice(0, 8)})${density}${ext}`
}
