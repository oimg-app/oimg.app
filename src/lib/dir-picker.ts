// Quick 260603-s2x: pickDirectory dispatcher — feature-detect showDirectoryPicker
// + AbortError silent swallow. Mirrors src/lib/save-blob.ts (Plan 11-04 D-07).
//
// Contract:
//   - Feature-detect 'showDirectoryPicker' in window && window.isSecureContext === true
//     (T-WF-01 mitigation — picker requires HTTPS / localhost / secure origin).
//   - On missing API → pushToast error + return null.
//   - On AbortError (user-cancelled the dialog) → return null silently (no toast,
//     no console — mirrors save-blob.ts Pitfall 2 swallow).
//   - On any other picker error → toast + return null (NEVER throw to caller).
//   - Zero-telemetry: no console.* anywhere.
import { pushToast } from '@/stores/runtime'

type ShowDirectoryPickerOpts = {
  mode?: 'read' | 'readwrite'
  startIn?: string
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const canUsePicker =
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    window.isSecureContext === true

  if (!canUsePicker) {
    pushToast('Watch folder requires Chrome/Edge — your browser does not support directory access')
    return null
  }

  try {
    const picker = (window as unknown as {
      showDirectoryPicker: (o: ShowDirectoryPickerOpts) => Promise<FileSystemDirectoryHandle>
    }).showDirectoryPicker

    const handle = await picker({ mode: 'read', startIn: 'pictures' })
    return handle
  } catch (err) {
    // User-cancel is intentional UX — silent swallow (no toast, no console).
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null
    }
    // Any other picker error → surface a toast and return null. NEVER throw.
    pushToast('Could not open directory picker')
    return null
  }
}
