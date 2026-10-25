// Phase 03 — NAV-02 (full NAV-02: split buttons, segmented control, filter, theme toggle, settings). Source: 03-02-PLAN.md
// Phase 10 — Plan 04: Add files + From device → openPicker via useIngest. Source: 10-04-PLAN.md
// change:remove-dead-ui-and-fix-a11y — Batch/Compare/Report seg (wrote an unread `view`), the Auto
//   split-button and the Workers button (stub handlers) removed; Workers is now read-only text.
import { useStore } from "@nanostores/react";
import {
  Plus,
  Export,
  CaretDown,
  MagnifyingGlass,
  Sun,
  Moon,
  GearSix,
  Lightning,
} from "@phosphor-icons/react";
import { uiAtom, setOpen, setTheme } from "@/stores/ui";
import {
  filesAtom,
  $hasDone,
  $queueEmpty,
  $selectedFile,
  setFilter,
  clearFiles,
} from "@/stores/files";
import { runtimeAtom } from "@/stores/runtime";
import { toast } from "sonner";
import { useOptimize } from "@/hooks/useOptimize";
import { useIngest } from "@/hooks/useIngest";
import { useExport } from "@/hooks/useExport";
import { useSnippets } from "@/hooks/useSnippets";
import { useWatchFolder } from "@/hooks/useWatchFolder";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { copyToClipboard } from "@/lib/clipboard";
import { pickFromClipboard } from "@/lib/clipboard-ingest";
import { cn } from "@/lib/utils";

const tbtnClass =
  "h-7 px-3 text-xs text-[var(--color-fg-0)] bg-color-bg-2 border border-[var(--color-line)] rounded-[5px] hover:bg-color-bg-3 hover:border-[var(--color-line-strong)] flex items-center gap-1";

const menuItemClass =
  "w-full px-3 py-1.5 text-left text-xs text-[var(--color-fg-0)] hover:bg-color-bg-3 rounded";

const popoverContentClass =
  "w-auto p-2 bg-color-bg-2 border-[var(--color-line)] rounded-[6px]";

function ToolbarDivider() {
  return (
    <div
      aria-hidden="true"
      className="w-px h-[18px] bg-color-line mx-1"
    />
  );
}

export function Toolbar() {
  const { open, theme } = useStore(uiAtom);
  const { filterQuery } = useStore(filesAtom);
  const selectedFile = useStore($selectedFile);
  const hasDone = useStore($hasDone);
  const queueEmpty = useStore($queueEmpty);
  // Phase 13 — D-11: subscribe to runtimeAtom for versions + caps render in Diagnostics tab.
  const { versions, caps } = useStore(runtimeAtom);
  const clearDisabledTitle = queueEmpty ? "No files to clear" : undefined;
  // Phase 13 — D-14 / T-13-03: warning-toast confirmation when work is in flight.
  // Read runtimeAtom.get() inside the handler (NOT useStore) — avoids Toolbar re-renders
  // on every job-count change. PATTERNS lines 467-482 verbatim shape.
  const handleClearAll = () => {
    const { runningJobs } = runtimeAtom.get();
    if (runningJobs > 0) {
      toast.warning(`Cancel ${runningJobs} in-flight jobs?`, {
        action: { label: "Clear anyway", onClick: () => clearFiles() },
      });
      return;
    }
    clearFiles();
  };
  const { runOptimize } = useOptimize();
  const { ingest, openPicker } = useIngest();
  const { exportZip, exportOne, exportIndividually } = useExport();
  const { copyPictureBulk, copyDataUrisBulk, copyManifestJson } = useSnippets();
  const { startWatching } = useWatchFolder();
  // D-13 (Phase 11 Plan 07): disable-then-explain — gate export controls on ≥1 done file.
  const disabledTitle = !hasDone
    ? "Optimize at least one file first"
    : undefined;

  return (
    <div
      data-testid="toolbar"
      role="toolbar"
      aria-label="Primary toolbar"
      className="h-11 bg-color-bg-1 border-b border-[var(--color-line)] px-2 flex items-center gap-2 shrink-0 overflow-x-auto [&>*]:shrink-0"
    >
      {/* 1. Add files split group */}
      <div className="flex">
        <button
          type="button"
          className={cn(tbtnClass, "rounded-r-none border-r-0")}
          data-testid="toolbar-btn-add-files"
          onClick={() => {
            openPicker();
            setOpen(null);
          }}
        >
          <Plus size={12} />
          Add files
        </button>
        <Popover
          open={open === "tb-add"}
          onOpenChange={(o) => setOpen(o ? "tb-add" : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add files options"
              data-testid="toolbar-btn-add-menu"
              className={cn(tbtnClass, "rounded-l-none px-1.5")}
            >
              <CaretDown size={11} />
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <button
                type="button"
                className={menuItemClass}
                data-testid="toolbar-item-add-device"
                onClick={() => {
                  openPicker();
                  setOpen(null);
                }}
              >
                From device
              </button>
              <button
                type="button"
                className={menuItemClass}
                data-testid="toolbar-item-add-watch-folder"
                onClick={() => {
                  void startWatching();
                  setOpen(null);
                }}
              >
                Watch folder
              </button>
              <button
                type="button"
                className={menuItemClass}
                data-testid="toolbar-item-add-clip-url"
                // Phase 15 — ING-01: clipboard → ingest dispatcher.
                // G-15-01: setOpen first → rAF → dispatcher (Popover-unmount race)
                onClick={() => {
                  setOpen(null);
                  requestAnimationFrame(() => void pickFromClipboard({ ingest }));
                }}
              >
                From URL or paste
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 2. Optimize all primary button (UNCHANGED from Plan 01) */}
      {/* change:remove-dead-ui-and-fix-a11y — disable-then-explain on an empty queue, like Export/Clear all. */}
      <button
        type="button"
        onClick={runOptimize}
        data-testid="toolbar-btn-optimize-all"
        disabled={queueEmpty}
        aria-disabled={queueEmpty}
        title={queueEmpty ? "No files to optimize" : undefined}
        className={cn(
          "h-7 px-3 text-xs font-semibold bg-color-accent text-[var(--color-accent-fg)] border-transparent rounded-[5px] hover:brightness-105 flex items-center gap-1 shrink-0",
          queueEmpty && "opacity-50 cursor-not-allowed",
        )}
      >
        <Lightning size={13} />
        Optimize all
      </button>

      {/* 3. Export split group */}
      <div className="flex">
        <button
          type="button"
          className={cn(
            tbtnClass,
            "rounded-r-none border-r-0",
            !hasDone && "opacity-50 cursor-not-allowed",
          )}
          data-testid="toolbar-btn-export"
          onClick={() => {
            selectedFile && exportOne(selectedFile);
            setOpen(null);
          }}
          disabled={!hasDone}
          aria-disabled={!hasDone}
          title={disabledTitle}
        >
          <Export size={12} />
          Export
        </button>
        <Popover
          open={open === "tb-export"}
          onOpenChange={(o) => setOpen(o ? "tb-export" : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Export options"
              data-testid="toolbar-btn-export-menu"
              className={cn(tbtnClass, "rounded-l-none px-1.5")}
            >
              <CaretDown size={11} />
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <button
                type="button"
                className={cn(
                  menuItemClass,
                  !hasDone && "opacity-50 cursor-not-allowed",
                )}
                data-testid="toolbar-item-export-zip"
                onClick={() => {
                  void exportZip();
                  setOpen(null);
                }}
                disabled={!hasDone}
                aria-disabled={!hasDone}
                title={disabledTitle}
              >
                All as ZIP
              </button>
              <button
                type="button"
                className={cn(
                  menuItemClass,
                  !hasDone && "opacity-50 cursor-not-allowed",
                )}
                data-testid="toolbar-item-export-individual"
                onClick={() => {
                  void exportIndividually();
                  setOpen(null);
                }}
                disabled={!hasDone}
                aria-disabled={!hasDone}
                title={disabledTitle}
              >
                Save individually
              </button>
              <button
                type="button"
                className={cn(
                  menuItemClass,
                  !hasDone && "opacity-50 cursor-not-allowed",
                )}
                data-testid="toolbar-item-export-copy-picture"
                onClick={() => {
                  void copyPictureBulk();
                  setOpen(null);
                }}
                disabled={!hasDone}
                aria-disabled={!hasDone}
                title={disabledTitle}
              >
                {"Copy <picture> HTML"}
              </button>
              <button
                type="button"
                className={cn(
                  menuItemClass,
                  !hasDone && "opacity-50 cursor-not-allowed",
                )}
                data-testid="toolbar-item-export-copy-datauris"
                onClick={() => {
                  void copyDataUrisBulk();
                  setOpen(null);
                }}
                disabled={!hasDone}
                aria-disabled={!hasDone}
                title={disabledTitle}
              >
                Copy as data URIs
              </button>
              <button
                type="button"
                className={cn(
                  menuItemClass,
                  !hasDone && "opacity-50 cursor-not-allowed",
                )}
                data-testid="toolbar-item-export-manifest"
                onClick={() => {
                  void copyManifestJson();
                  setOpen(null);
                }}
                disabled={!hasDone}
                aria-disabled={!hasDone}
                title={disabledTitle}
              >
                Manifest JSON
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 4. Toolbar divider */}
      <ToolbarDivider />

      {/* 8. Filter input */}
      <div className="flex items-center h-7 w-[220px] min-w-[160px] bg-color-bg-2 border border-[var(--color-line)] rounded-[5px] px-2 gap-2 focus-within:border-[var(--color-accent)]">
        <MagnifyingGlass
          size={12}
          className="text-[var(--color-fg-2)] shrink-0"
        />
        <input
          type="search"
          aria-label="Filter files"
          data-testid="toolbar-input-filter"
          placeholder="Filter files…"
          value={filterQuery}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 bg-transparent text-xs text-[var(--color-fg-0)] placeholder:text-[var(--color-fg-2)] outline-none focus-visible:outline-none"
        />
      </div>

      {/* 9. Spacer + theme toggle */}
      <div className="ml-auto" />
      <button
        type="button"
        aria-label="Toggle theme"
        data-testid="toolbar-btn-theme"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="h-7 w-7 grid place-items-center rounded-[5px] text-[var(--color-fg-1)] hover:bg-color-bg-2 hover:text-[var(--color-fg-0)]"
      >
        {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
      </button>

      {/* 10. Settings ghost button + Popover */}
      <Popover
        open={open === "tb-settings"}
        onOpenChange={(o) => setOpen(o ? "tb-settings" : null)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open settings"
            data-testid="toolbar-btn-settings"
            className="h-7 w-7 grid place-items-center rounded-[5px] text-[var(--color-fg-1)] hover:bg-color-bg-2 hover:text-[var(--color-fg-0)]"
          >
            <GearSix size={13} />
          </button>
        </PopoverTrigger>
        <PopoverContent className={popoverContentClass} align="end">
          {/* Phase 13 — D-10 / D-11 / D-12: Settings popover content is a Radix Tabs surface
              with two tabs (General + Diagnostics). General tab keeps Plan 05's Workers +
              Clear all verbatim. Diagnostics tab renders versions + caps <dl> + a
              Copy diagnostics button routed through the Phase 12 copyToClipboard chokepoint. */}
          <Tabs defaultValue="general" className="w-[280px]">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="general" data-testid="settings-tab-general">General</TabsTrigger>
              <TabsTrigger value="diagnostics" data-testid="settings-tab-diagnostics">
                Diagnostics
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="p-2">
              {/* change:remove-dead-ui-and-fix-a11y — read-only: the pool derives its size from
                  hardware (worker-pool spec), so this is a fact, not a setting. */}
              <p
                className="px-3 py-1.5 text-xs text-[var(--color-fg-1)]"
                data-testid="settings-workers"
              >
                Workers: {Math.min(caps.hardwareConcurrency, 4)} (auto)
              </p>
              {/* Phase 13 — D-14 / CLR-01: Clear all menu item with disable-then-explain triple.
                  Mirrors Export button shape (lines 96-100 + 122-126). */}
              <button
                type="button"
                className={cn(
                  menuItemClass,
                  queueEmpty && "opacity-50 cursor-not-allowed",
                )}
                data-testid="settings-btn-clear-all"
                onClick={() => {
                  handleClearAll();
                  setOpen(null);
                }}
                disabled={queueEmpty}
                aria-disabled={queueEmpty}
                title={clearDisabledTitle}
              >
                Clear all
              </button>
            </TabsContent>
            <TabsContent value="diagnostics" className="p-2">
              {/* Phase 13 — D-11: Read-only diagnostic surface. T-13-04 mitigation:
                  no dangerouslySetInnerHTML — React's default escaping handles all values. */}
              <dl
                data-testid="settings-dl-diagnostics"
                className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-xs"
              >
                <dt>svgo</dt>
                <dd>{versions.svgo}</dd>
                <dt>jsquash png</dt>
                <dd>{versions.jsquash.png}</dd>
                <dt>jsquash webp</dt>
                <dd>{versions.jsquash.webp}</dd>
                <dt>jsquash jpeg</dt>
                <dd>{versions.jsquash.jpeg}</dd>
                <dt>jsquash avif</dt>
                <dd>{versions.jsquash.avif}</dd>
                <dt>jsquash oxipng</dt>
                <dd>{versions.jsquash.oxipng}</dd>
                <dt>jsquash resize</dt>
                <dd>{versions.jsquash.resize}</dd>
                <dt>ssim</dt>
                <dd>{versions.ssim}</dd>
                <dt>butteraugli</dt>
                <dd>{versions.butteraugli?.buildHash ?? "—"}</dd>
                <dt>SIMD</dt>
                <dd>{caps.simd ? "yes" : "no"}</dd>
                <dt>WASM threads</dt>
                <dd>{caps.threads ? "yes" : "no"}</dd>
                <dt>COOP/COEP</dt>
                <dd>{caps.crossOriginIsolated ? "isolated" : "no"}</dd>
                <dt>CPUs</dt>
                <dd>{caps.hardwareConcurrency}</dd>
              </dl>
              {/* Phase 13 — D-11 / T-13-01: routes through Phase 12 chokepoint;
                  CopyKind 'manifest' reuses the bug-report convenience kind. */}
              <button
                type="button"
                className={cn(menuItemClass, "mt-2")}
                data-testid="settings-btn-copy-diagnostics"
                onClick={() =>
                  void copyToClipboard(
                    JSON.stringify({ versions, caps }, null, 2),
                    "manifest",
                    "Diagnostics",
                  )
                }
              >
                Copy diagnostics
              </button>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
}
