// Phase 11 — Plan 04 (EXP-01) + Plan 05 (EXP-02): useExport — single/bulk/ZIP file save orchestrator.
// Source: 11-RESEARCH.md § Code Examples + 11-PATTERNS.md § "src/hooks/useExport.ts".
// Analog: src/hooks/useOptimize.ts (same shape — useStore(filesAtom) for re-render
// driver, async functions read filesAtom.get() directly inside their bodies to
// avoid stale-closure capture per useOptimize discipline).
//
// Plan 04 shipped exportOne; Plan 05 adds exportZip + exportIndividually:
//   - exportZip      → buildZip(entries) → saveBlob(zipBlob, timestamped) + toast
//   - exportIndividually → loop done entries, per-iteration saveBlob({ forceFallback }),
//                          80ms inter-call sleep (Pitfall 5 — Safari race + Chromium
//                          anti-multi-download throttling); never invokes the native picker
//                          per-file (D-06).
//
// Project rule (CLAUDE.md §Conventions, memory architecture_file_business_logic.md):
// business logic in hooks/lib, components only wire DOM events.
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import { filesAtom } from "@/stores/files";
import type { FileEntry } from "@/stores/files";
import { saveBlob } from "@/lib/save-blob";
import { buildZip } from "@/lib/build-zip";
import {
  collisionSuffix,
  mimeFor,
  renameExtension,
  sanitizeBaseName,
  timestampedZipName,
} from "@/lib/filename";
import { isSvgToRaster, svgRasterExport } from "@/lib/svg-export";

const NOTHING_TO_EXPORT = "Nothing to export — optimize files first";

function summaryToast(okCount: number, skippedCount: number): void {
  const msg =
    skippedCount > 0
      ? `${okCount} files exported, ${skippedCount} skipped — fix and re-export`
      : `${okCount} files exported`;
  toast.success(msg);
}

export function useExport() {
  // useStore subscription kept for reactive consumers (matches useOptimize discipline).
  // exportOne reads `entry` from its argument; exportZip / exportIndividually MUST
  // read filesAtom.get() inside their bodies (stale-closure trap).
  useStore(filesAtom);

  async function exportOne(entry: FileEntry): Promise<void> {
    // SVG → selected raster codec: rasterize on the main thread (the codec worker can't decode
    // SVG, so encodedBuffer is still SVG bytes). Save the raster output, not the SVG.
    if (isSvgToRaster(entry)) {
      try {
        const { blob, ext, mime } = await svgRasterExport(entry);
        await saveBlob(blob, renameExtension(entry.name, ext), { ext, mime });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "SVG export failed");
      }
      return;
    }

    // Defense-in-depth: caller (D-13 disable / D-04 ContextMenu disabled prop) is
    // responsible for not invoking this until the file is done. Guard anyway.
    if (!entry.encodedBuffer) return;

    const filename = renameExtension(entry.name, entry.target);
    const mime = mimeFor(entry.target);
    const blob = new Blob([entry.encodedBuffer], { type: mime });
    await saveBlob(blob, filename, { ext: entry.target, mime });
  }

  async function exportZip(): Promise<void> {
    const { entries } = filesAtom.get();
    const exportable = entries.filter(
      (e) => e.status === "done" && e.encodedBuffer != null,
    );
    if (exportable.length === 0) {
      toast.error(NOTHING_TO_EXPORT);
      return;
    }

    // Pre-rasterize SVG → raster-codec entries so the ZIP carries the raster bytes (+ correct
    // extension via target) instead of the SVG. On rasterize failure, keep the entry as-is.
    const prepared = await Promise.all(
      entries.map(async (e) => {
        if (!isSvgToRaster(e)) return e;
        try {
          const { blob, ext } = await svgRasterExport(e);
          return { ...e, target: ext, encodedBuffer: await blob.arrayBuffer() };
        } catch {
          return e;
        }
      }),
    );

    let blob: Blob;
    try {
      blob = await buildZip(prepared);
    } catch (err) {
      if (err instanceof Error && err.message === "NO_EXPORTABLE_FILES") {
        toast.error(NOTHING_TO_EXPORT);
        return;
      }
      throw err;
    }

    await saveBlob(blob, timestampedZipName(), {
      ext: "zip",
      mime: "application/zip",
    });

    // D-12: skipped count surfaced in the success toast.
    const skipped = entries.length - exportable.length;
    summaryToast(exportable.length, skipped);
  }

  async function exportIndividually(): Promise<void> {
    const { entries } = filesAtom.get();
    const exportable = entries.filter(
      (e) => e.status === "done" && e.encodedBuffer != null,
    );
    if (exportable.length === 0) {
      toast.error(NOTHING_TO_EXPORT);
      return;
    }

    const used = new Set<string>();
    for (const e of exportable) {
      // SVG → selected raster codec: rasterize to the raster blob + ext; raster failure falls
      // back to the original encoded bytes/extension below.
      let ext = e.target;
      let mime = mimeFor(e.target);
      let blob = new Blob([e.encodedBuffer!], { type: mime });
      if (isSvgToRaster(e)) {
        try {
          const r = await svgRasterExport(e);
          ext = r.ext;
          mime = r.mime;
          blob = r.blob;
        } catch {
          /* keep the original encoded SVG bytes */
        }
      }

      // T-11-01: sanitize after extension swap; D-10: collision suffix per call.
      const candidate = sanitizeBaseName(renameExtension(e.name, ext));
      const name = collisionSuffix(candidate, used);
      used.add(name);

      // D-06: bulk path uses fallback delivery only — NEVER showSaveFilePicker
      // per file (a 50-file batch would surface 50 native dialogs).
      await saveBlob(blob, name, { forceFallback: true, ext, mime });
      // Pitfall 5: Safari race + Chromium anti-multi-download throttle. 80ms
      // is the smallest reliable inter-call delay across both engines.
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const skipped = entries.length - exportable.length;
    summaryToast(exportable.length, skipped);
  }

  return { exportOne, exportZip, exportIndividually };
}
