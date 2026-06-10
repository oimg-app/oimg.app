// Phase 10 — OPT-01: useIngest — format gate, File→FileEntry mapping, auto-optimize dispatch.
// All drop/pick/gate/map/auto-optimize logic lives here. Components (Plan 04) only wire DOM events.
// Source: 10-03-PLAN.md

import { filesAtom, setFileRawBuffer, selectFile } from '@/stores/files'
import { defaultFileSettings } from '@/lib/stub-data'
import { useOptimize } from '@/hooks/useOptimize'
import type { FileEntry } from '@/lib/stub-data'

// --- Format gate (D-06) ---

const ACCEPTED_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'avif', 'heic', 'heif'])
const ACCEPTED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  // Quick 260610-lby: HEIC/HEIF decode-only input
  'image/heic',
  'image/heif',
])

// accept="" attribute value for synthesized/native file inputs — single source derived
// from the gate sets above (ext globs + MIME types).
const ACCEPT_ATTR = [...[...ACCEPTED_EXTS].map((e) => `.${e}`), ...ACCEPTED_MIMES].join(',')

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

// Quick 260603-s2x: exported so useWatchFolder can filter directory entries
// without duplicating the extension table. Existing internal usage unchanged.
export function isAccepted(file: File): boolean {
  const ext = getExt(file.name)
  return ACCEPTED_EXTS.has(ext) || ACCEPTED_MIMES.has(file.type)
}

// --- Dimension reading (Pitfall 6: never call createImageBitmap on SVG) ---

async function readDimensions(file: File, type: string): Promise<string> {
  if (type === 'svg') return '—'
  try {
    const bitmap = await createImageBitmap(file)
    const dim = `${bitmap.width}×${bitmap.height}`
    bitmap.close()
    return dim
  } catch {
    // Malformed raster — never blocks ingest (T-10-V5: decoders are the real barrier)
    return '—'
  }
}

// --- File → FileEntry mapping (D-08, D-10) ---

async function fileToEntry(file: File): Promise<FileEntry> {
  const id = crypto.randomUUID()
  const ext = getExt(file.name)
  // Normalize jpg → jpeg consistently for codec dispatch compatibility
  const type = ext === 'jpg' ? 'jpeg' : ext
  const rawBuffer = await file.arrayBuffer()
  const dim = await readDimensions(file, type)
  return {
    id,
    name: file.name,
    type,
    orig: file.size,       // D-08: truthful File.size at ingest
    opt: file.size,        // pending — setFileResult overwrites on encode completion
    status: 'processing',  // D-10: DeltaStrip shimmer visible during pending window
    target: '',
    dim,
    q: 82,
    createdAt: Date.now(), // Pitfall 2: required for queue-order sort (D-04)
    settings: defaultFileSettings(type, 82),
    rawBuffer,
    // No @jsquash import — ingest runs on main thread (200KB budget)
  }
}

// --- useIngest hook (D-01, D-02, D-03, D-06, D-07) ---

/**
 * useIngest — the single ingestion entry point.
 *
 * Returns:
 *   ingest(files)   — filter, map, append to store, auto-select newest, auto-optimize
 *   openPicker()    — showOpenFilePicker (modern) with AbortError swallow (Pitfall 4);
 *                     fallback: accepts an optional trigger callback so the component can
 *                     provide a hidden <input> click — call openPicker(inputEl.click.bind(inputEl))
 *                     from the component. This keeps the input element in the component
 *                     (Plan 04 concern) while leaving picker logic in this hook.
 */
export function useIngest() {
  const { runOptimize } = useOptimize()

  async function ingest(files: File[]): Promise<void> {
    // D-06/D-07: silent format gate — no toast on rejection
    const accepted = files.filter(isAccepted)
    if (accepted.length === 0) return

    const entries = await Promise.all(accepted.map(fileToEntry))

    // Append preserving insertion order (nanostores setKey replaces full array)
    filesAtom.setKey('entries', [...filesAtom.get().entries, ...entries])

    // D-02: auto-select newest (last in append order)
    selectFile(entries[entries.length - 1].id)

    // Pitfall 5: store rawBuffer in the atom so useOptimize can slice(0) before Comlink transfer
    for (const entry of entries) {
      if (entry.rawBuffer) setFileRawBuffer(entry.id, entry.rawBuffer)
    }

    // D-03: auto-optimize — runOptimize reads filesAtom.get().entries (sees newly appended entries)
    // Do NOT write a new dispatch loop or use useLiveEncode (single-file debounced, wrong API)
    await runOptimize()
  }

  /**
   * openPicker — modern file picker with fallback to hidden <input>.
   *
   * @param fallbackTrigger  Optional callback the component provides to trigger its hidden
   *                         <input type="file"> click. Keeps input ownership in the component
   *                         (Plan 04) while picker logic stays in this hook.
   */
  async function openPicker(fallbackTrigger?: () => void): Promise<void> {
    if ('showOpenFilePicker' in window) {
      try {
        // Use `any` for showOpenFilePicker — not yet in every TS lib
        const handles = await (window as { showOpenFilePicker: (opts: object) => Promise<FileSystemFileHandle[]> })
          .showOpenFilePicker({
            multiple: true,
            types: [
              {
                description: 'Images',
                accept: {
                  'image/png': ['.png'],
                  'image/jpeg': ['.jpg', '.jpeg'],
                  'image/webp': ['.webp'],
                  'image/svg+xml': ['.svg'],
                  'image/avif': ['.avif'],
                  // Quick 260610-lby: HEIC/HEIF decode-only input
                  'image/heic': ['.heic'],
                  'image/heif': ['.heif'],
                },
              },
            ],
          })
        const files = await Promise.all(handles.map((h) => h.getFile()))
        await ingest(files)
      } catch (err) {
        // Pitfall 4: swallow AbortError (user cancelled picker) — re-throw everything else
        if ((err as DOMException).name !== 'AbortError') throw err
      }
    } else if (fallbackTrigger) {
      // A component supplied its own hidden <input> (e.g. FilesPane's data-testid="file-input",
      // which the e2e setInputFiles also targets) — use it.
      fallbackTrigger()
    } else {
      // WR-05: no showOpenFilePicker (Firefox / some Safari) AND no caller-supplied input —
      // synthesize a transient <input type="file"> so every entry point (e.g. Toolbar) works
      // cross-browser instead of silently no-opping.
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = ACCEPT_ATTR
      input.style.display = 'none'
      input.addEventListener(
        'change',
        () => {
          if (input.files && input.files.length) void ingest(Array.from(input.files))
          input.remove()
        },
        { once: true },
      )
      document.body.appendChild(input)
      input.click()
    }
  }

  return { ingest, openPicker }
}
