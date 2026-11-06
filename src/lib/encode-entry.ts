// change:deepen-encode-entry — the ONE place a FileEntry becomes an EncodeJob and runs on the
// WorkerPool. Both scheduling policies (optimize-all batch, debounced live re-encode) call
// encodeEntry() and only decide *when* to run and *whether* to commit the result.
import { getPool } from '@/lib/worker-pool'
import { rasterizeSvg } from '@/lib/svg-raster'
import { sourceFormatOf } from '@/lib/formats'
import { defaultFileSettings } from '@/lib/settings'
import type { Codec, FileEntry } from '@/lib/settings'
import type { EncodeJob } from '@/workers/codec.worker'

export interface Encoded {
  buffer: ArrayBuffer
  optimizedSize: number
  /** Codec that produced `buffer` — the truthful producer tag for setFileResult / CompareStage. */
  codec: Codec
}

/**
 * Build the worker job for an entry. Pure except for SVG → raster, which rasterizes on the
 * main thread (see svg-raster.ts) and dispatches PNG bytes instead. The entry's own settings
 * win; a legacy entry without settings gets the same self-healing default as setFileSettings.
 *
 * Returns null when the entry has no bytes to encode. Throws on unsupported input formats
 * and on rasterize failure.
 */
export async function prepareJob(
  entry: FileEntry,
  rasterize: typeof rasterizeSvg = rasterizeSvg,
): Promise<EncodeJob | null> {
  const sourceFormat = sourceFormatOf(entry.type)
  if (!sourceFormat) throw new Error('Unsupported input format: ' + entry.type)
  const raw = entry.rawBuffer
  // Never dispatch a 0-byte buffer (T-9-V5).
  if (!raw || raw.byteLength === 0) return null

  const settings = entry.settings ?? defaultFileSettings(entry.type, entry.q)
  const codec = settings.codec

  if (sourceFormat === 'svg' && codec !== 'SVG') {
    const width = settings.resizeOn && Number.isFinite(Number(settings.w)) ? Number(settings.w) : undefined
    const blob = await rasterize(new TextDecoder('utf-8').decode(raw), { width })
    return { codec, sourceFormat: 'png', buffer: await blob.arrayBuffer(), settings }
  }
  // slice(0): Comlink.transfer detaches the dispatched buffer; the cached original must survive.
  return { codec, sourceFormat, buffer: raw.slice(0), settings }
}

/**
 * Encode one entry on the pool. `onDispatch` fires when the job leaves the queue and actually
 * starts on a worker. Resolves null when there was nothing to encode; rejects on any failure
 * (unsupported format, rasterize, decode/encode). Does NOT write to the store — the caller
 * decides whether the result is still current.
 */
export async function encodeEntry(entry: FileEntry, onDispatch?: () => void): Promise<Encoded | null> {
  const job = await prepareJob(entry)
  if (!job) return null
  const { buffer, optimizedSize } = await getPool().run(job, onDispatch)
  return { buffer, optimizedSize, codec: job.codec }
}
