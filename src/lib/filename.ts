// Phase 11 — filename + extension + collision-suffix + ZIP timestamp + MIME lookup + base-name sanitation. Source: 11-RESEARCH.md § Code Examples

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  zip: 'application/zip',
}

/** D-05: replace final extension on a filename. Idempotent if equal. Case-insensitive on incoming ext. */
export function renameExtension(originalName: string, targetExt: string): string {
  const ext = targetExt.toLowerCase()
  const dot = originalName.lastIndexOf('.')
  const base = dot === -1 ? originalName : originalName.slice(0, dot)
  return `${base}.${ext}`
}

/** D-10: append `(1)`, `(2)`, … to base name (before extension) until non-colliding. Pure. Does not mutate `used`. */
export function collisionSuffix(name: string, used: Set<string>): string {
  if (!used.has(name)) return name
  const dot = name.lastIndexOf('.')
  const base = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? '' : name.slice(dot)
  let i = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base} (${i})${ext}`
    if (!used.has(candidate)) return candidate
    i++
  }
}

/** D-10: timestamped ZIP filename `oimg-export-YYYY-MM-DD-HHMM.zip` in LOCAL time. */
export function timestampedZipName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = now.getFullYear()
  const mm = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const hh = pad(now.getHours())
  const min = pad(now.getMinutes())
  return `oimg-export-${yyyy}-${mm}-${dd}-${hh}${min}.zip`
}

/** MIME lookup by extension (case-insensitive). Unknown → `application/octet-stream`. */
export function mimeFor(ext: string): string {
  const key = ext.toLowerCase().replace(/^\./, '')
  return EXT_TO_MIME[key] ?? 'application/octet-stream'
}

/** T-11-01 zip-slip mitigation: replace `/`, `\`, and NUL with `_`. */
export function sanitizeBaseName(name: string): string {
  return name.replace(/[/\\\0]/g, '_')
}
