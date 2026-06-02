// Phase 11 — Plan 04 (EXP-01): useExport — single/bulk/ZIP file save orchestrator.
// Source: 11-RESEARCH.md § Code Examples + 11-PATTERNS.md § "src/hooks/useExport.ts".
// Analog: src/hooks/useOptimize.ts (same shape — useStore(filesAtom) for re-render
// driver, async functions consume the passed argument; future exportZip will read
// filesAtom.get() directly to avoid stale-closure per useOptimize discipline).
//
// Wave-2 skeleton: exportOne only. Plan 05 adds exportZip; Plan 06 adds
// exportIndividually. Keep the return type OPEN for those additions.
//
// Project rule (CLAUDE.md §Conventions, memory architecture_file_business_logic.md):
// business logic in hooks/lib, components only wire DOM events.
import { useStore } from '@nanostores/react'
import { filesAtom } from '@/stores/files'
import type { FileEntry } from '@/stores/files'
import { saveBlob } from '@/lib/save-blob'
import { renameExtension, mimeFor } from '@/lib/filename'

export function useExport() {
  // useStore subscription kept for reactive consumers (matches useOptimize discipline).
  // exportOne reads `entry` from its argument, so stale-closure isn't a concern here —
  // but future exportZip/exportIndividually MUST use filesAtom.get() inside their bodies.
  useStore(filesAtom)

  async function exportOne(entry: FileEntry): Promise<void> {
    // Defense-in-depth: caller (D-13 disable / D-04 ContextMenu disabled prop) is
    // responsible for not invoking this until the file is done. Guard anyway.
    if (!entry.encodedBuffer) return

    const filename = renameExtension(entry.name, entry.target)
    const mime = mimeFor(entry.target)
    const blob = new Blob([entry.encodedBuffer], { type: mime })
    await saveBlob(blob, filename, { ext: entry.target, mime })
  }

  return { exportOne }
}
