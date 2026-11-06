// Phase 11 — Plan 04 (EXP-01) + Plan 05 (EXP-02): useExport — single/bulk/ZIP file save orchestrator.
// change:deepen-svg-raster — what gets saved (name/blob/mime per entry) is derived once in
// lib/export-items.ts from the bytes the worker produced; this hook is only delivery policy.
//
// Project rule (CLAUDE.md §Conventions): business logic in hooks/lib, components only wire DOM events.
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import { filesAtom } from "@/stores/files";
import type { FileEntry } from "@/stores/files";
import { saveBlob } from "@/lib/save-blob";
import { buildZip } from "@/lib/build-zip";
import { exportItems } from "@/lib/export-items";
import { timestampedZipName } from "@/lib/filename";

const NOTHING_TO_EXPORT = "Nothing to export — optimize files first";

function summaryToast(okCount: number, skippedCount: number): void {
  toast.success(
    skippedCount > 0
      ? `${okCount} files exported, ${skippedCount} skipped — fix and re-export`
      : `${okCount} files exported`,
  );
}

export function useExport() {
  // useStore subscription kept for reactive consumers (matches useOptimize discipline).
  // exportZip / exportIndividually MUST read filesAtom.get() inside their bodies (stale-closure trap).
  useStore(filesAtom);

  async function exportOne(entry: FileEntry): Promise<void> {
    // Defense-in-depth: callers disable the control until the file is done (D-13). Guard anyway.
    const [item] = exportItems([entry]);
    if (!item) return;
    await saveBlob(item.blob, item.name, { ext: item.ext, mime: item.mime });
  }

  async function exportZip(): Promise<void> {
    const { entries } = filesAtom.get();
    const items = exportItems(entries);
    if (items.length === 0) {
      toast.error(NOTHING_TO_EXPORT);
      return;
    }
    const blob = await buildZip(items);
    await saveBlob(blob, timestampedZipName(), { ext: "zip", mime: "application/zip" });
    // D-12: skipped count surfaced in the success toast.
    summaryToast(items.length, entries.length - items.length);
  }

  async function exportIndividually(): Promise<void> {
    const { entries } = filesAtom.get();
    const items = exportItems(entries);
    if (items.length === 0) {
      toast.error(NOTHING_TO_EXPORT);
      return;
    }
    for (const { blob, name, ext, mime } of items) {
      // D-06: bulk path uses fallback delivery only — NEVER showSaveFilePicker per file
      // (a 50-file batch would surface 50 native dialogs).
      await saveBlob(blob, name, { forceFallback: true, ext, mime });
      // Pitfall 5: Safari race + Chromium anti-multi-download throttle — 80 ms is the
      // smallest reliable inter-call delay across both engines.
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    summaryToast(items.length, entries.length - items.length);
  }

  return { exportOne, exportZip, exportIndividually };
}
