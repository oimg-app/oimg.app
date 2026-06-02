// Phase 11 — Plan 04 (EXP-01): saveBlob dispatcher — showSaveFilePicker → file-saver fallback.
// Source: 11-RESEARCH.md § Pattern 2 + § Pitfall 2 (silent AbortError swallow).
// Analog: src/hooks/useIngest.ts openPicker (FS Access API feature-detect + AbortError swallow).
//
// Contract:
//   - Feature-detect 'showSaveFilePicker' AND window.isSecureContext === true before invoking
//     the native picker (Pattern 2 secure-context gate — picker requires HTTPS or localhost).
//   - Pass MIME → ext[] dict shape to `types[].accept` (Pitfall 2 — bug-prone direction).
//   - Silent AbortError swallow: user-cancel is intentional UX, never a toast / console / fallback.
//   - All other picker errors fall through to file-saver saveAs (Pitfall 2 — opaque picker errors
//     are worse than silent fallback).
//   - `forceFallback: true` skips the picker entirely (D-06 bulk path will set this).
//
// Zero telemetry: no console.error, no console.log, no toast calls (CLAUDE.md privacy constraint).
import { saveAs } from 'file-saver'

export interface SaveOptions {
  /** Skip the native picker entirely; go straight to file-saver. D-06 bulk path. */
  forceFallback?: boolean
  /** Target extension (e.g. 'webp') — drives the picker's `accept` dict. */
  ext?: string
  /** MIME type (e.g. 'image/webp') — pairs with `ext` for the `accept` dict. */
  mime?: string
}

type ShowSaveFilePickerOpts = {
  suggestedName: string
  startIn?: string
  excludeAcceptAllOption?: boolean
  types?: Array<{ description: string; accept: Record<string, string[]> }>
}

type WritableHandle = {
  write: (b: Blob) => Promise<void>
  close: () => Promise<void>
}

type FileHandleWithWritable = {
  createWritable: () => Promise<WritableHandle>
}

export async function saveBlob(blob: Blob, filename: string, opts: SaveOptions = {}): Promise<void> {
  const canUsePicker =
    !opts.forceFallback &&
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    window.isSecureContext === true

  if (canUsePicker) {
    try {
      const pickerOpts: ShowSaveFilePickerOpts = {
        suggestedName: filename,
        startIn: 'downloads',
        excludeAcceptAllOption: false,
      }
      if (opts.ext && opts.mime) {
        pickerOpts.types = [
          {
            description: `${opts.ext.toUpperCase()} image`,
            // Pitfall 2: MIME → extension[] direction (NOT ext → MIME).
            accept: { [opts.mime]: ['.' + opts.ext] },
          },
        ]
      }

      const picker = (window as unknown as {
        showSaveFilePicker: (o: ShowSaveFilePickerOpts) => Promise<FileHandleWithWritable>
      }).showSaveFilePicker

      const handle = await picker(pickerOpts)
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      // Pitfall 2: AbortError = user cancelled the dialog. Silent no-op:
      // - No toast (would surface intentional UX as failure).
      // - No console.error (zero-telemetry; also pollutes logs in test runs).
      // - No fall-through to saveAs (would re-prompt the user).
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      // Any OTHER picker error → fall through to saveAs (opaque picker exceptions
      // surface as a working fallback, not as an opaque toast).
    }
  }

  // Fallback path: file-saver (used by Firefox/Safari, insecure context,
  // forceFallback=true, and non-AbortError picker failures).
  saveAs(blob, filename)
}
