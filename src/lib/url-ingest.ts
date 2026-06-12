// Phase 15 — ING-01: URL → File dispatcher with CORS-honest failure messaging.
// Source: .planning/phases/15-from-url-or-paste/15-RESEARCH.md §1.1 + §4 + §5.
// Returns null on ANY failure (network, CORS, non-image MIME, oversize). Never throws.
// Emits its own sonner toast on failure so callers can no-op gracefully.
// T-15-04 mitigation: every filename source flows through `sanitizeBaseName`
// (T-11-01 chokepoint reused).
import { toast } from 'sonner'
import { sanitizeBaseName } from '@/lib/filename'

const MAX_URL_BYTES = 100 * 1024 * 1024 // 100 MB hard cap (D-06)

const EXT_FROM_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export async function pickFromUrl(url: string): Promise<File | null> {
  // Validate scheme — http/https only. Reject data:, blob:, file:, javascript:.
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    toast.error('Invalid URL')
    return null
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    toast.error('Only http(s) URLs are supported')
    return null
  }

  let res: Response
  try {
    // D-06: cors mode + credentials omitted so we don't leak cookies to third
    // parties (T-15-01 mitigation, even though the threat is accepted).
    res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  } catch {
    // Fetch threw — almost certainly CORS rejection or network error.
    // Zero-telemetry: NO logging here (per CLAUDE.md zero-telemetry rule).
    toast.error('URL blocked by CORS — download and drop the file, or paste it directly.')
    return null
  }
  if (!res.ok) {
    toast.error(`URL fetch failed (${res.status})`)
    return null
  }

  const ct = (res.headers.get('content-type') ?? '').toLowerCase().split(';')[0].trim()
  if (!ct.startsWith('image/')) {
    toast.error('URL did not return an image')
    return null
  }

  // Size cap from header BEFORE draining the body — fast reject for huge payloads.
  const cl = Number(res.headers.get('content-length') ?? 0)
  if (cl > MAX_URL_BYTES) {
    toast.error('Image is too large (max 100 MB)')
    return null
  }

  let blob: Blob
  try {
    blob = await res.blob()
  } catch {
    toast.error('Failed to read image bytes')
    return null
  }
  // Defense-in-depth: a lying content-length header is still capped here.
  if (blob.size > MAX_URL_BYTES) {
    toast.error('Image is too large (max 100 MB)')
    return null
  }

  const filename = deriveFilename(parsed, res, blob.type || ct)
  return new File([blob], filename, {
    type: blob.type || ct,
    lastModified: Date.now(),
  })
}

/**
 * Filename derivation per RESEARCH §4 priority order:
 *   1. Content-Disposition `filename*=` / `filename=`
 *   2. Last URL path segment (percent-decoded; URIError → fall through)
 *   3. `pasted-image-${ts}.${ext}` keyed off MIME
 * All three sources funnel through `sanitizeBaseName` (T-15-04).
 */
function deriveFilename(parsed: URL, res: Response, mime: string): string {
  // Priority 1: Content-Disposition filename.
  const cd = res.headers.get('content-disposition') ?? ''
  const cdMatch = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
  if (cdMatch?.[1]) {
    try {
      return sanitizeBaseName(decodeURIComponent(cdMatch[1]))
    } catch {
      return sanitizeBaseName(cdMatch[1])
    }
  }

  // Priority 2: last path segment, percent-decoded.
  const last = parsed.pathname.split('/').filter(Boolean).pop() ?? ''
  if (last) {
    try {
      const decoded = decodeURIComponent(last)
      if (decoded.length > 0) return sanitizeBaseName(decoded)
    } catch {
      // Malformed percent-encoding — fall through to timestamp fallback.
    }
  }

  // Priority 3: timestamped fallback by MIME.
  const ext = EXT_FROM_MIME[mime] ?? 'bin'
  return sanitizeBaseName(`pasted-image-${Date.now()}.${ext}`)
}
