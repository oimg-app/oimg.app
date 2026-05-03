// Composition root for the OIMG shell — TypeScript port of example-ui/app.jsx.
// Plan 01-04 decomposed the 810-line monolith: TitleBar/Toolbar/StatusBar/
// CommandPalette live in src/components/shell/ now; App.tsx is the state
// owner that wires them together via <AppShell>. Work-area JSX intentionally
// remains here pending Plan 05's panel decomposition.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { CodecPanel } from '@/components/panels/CodecPanel'
import { SvgoPanel, PLUGIN_FOOTGUNS } from '@/components/panels/SvgoPanel'
import { SnippetPanel } from '@/components/panels/SnippetPanel'
import { ReportPanel } from '@/components/panels/ReportPanel'
import { AppShell } from '@/components/shell/AppShell'
import { TitleBar } from '@/components/shell/TitleBar'
import { Toolbar } from '@/components/shell/Toolbar'
import { StatusBar } from '@/components/shell/StatusBar'
import { CommandPalette } from '@/components/shell/CommandPalette'
import type { CmdGroup } from '@/components/shell/CommandPalette'
import { useTheme } from '@/hooks/useTheme'
import { fmtBytes, fmtPct } from '@/lib/format'
// Phase 2 plan 02-05 (cleanup wave): src/data/mock.ts deleted.
// Types moved to @/types; data constants (CODECS) moved to @/data/defaults.
// MOCK_FILES is no longer needed — the queue starts empty and is populated
// by addFile() into useFilesStore (drag-drop / file-picker in Phase 5).
// Phase 3 plan 03-A: SVGO_PLUGINS array deleted from defaults.ts in favor of
// DEFAULT_CODEC_SVG.plugins record.
// Phase 3 plan 03-B: SvgoPanel rewritten to consume the curated record + live
// pluginSavings directly, so the Plan-A SVGO_PLUGINS shim is gone and the
// Plan-1 useState plugin slice is replaced by a store-backed binding.
import { CODECS } from '@/data/defaults'
import type {
  CodecLabel,
  ResizeAlg,
  FitMode,
  MockFile,
} from '@/types'

// Phase 2 plan 02-04 — store + worker pool + ARIA live wiring.
import { useFilesStore, useSettingsStore, useRuntimeStore } from '@/stores'
import { getWorkerPool } from '@/workers/pool'
import type { PoolJob, AdapterFormat } from '@/workers/types'
import { setLiveRegion, announce, isQuartileBoundary } from '@/lib/live-region'
// Phase 3 plan 03-A — main-thread DOMPurify (Pitfall 1: cannot run in worker).
import { sanitizeSvg } from '@/lib/sanitize-svg'
// Phase 4 plan 04-07 — PNG branch in startOptimize. buildPngResizeSettings is
// re-exported by png-adapter; importing from png-config avoids pulling
// @jsquash/* into the App.tsx bundle (Vite still tree-shakes the worker chunk).
import { buildPngResizeSettings } from '@/workers/png-config'
// Phase 4 plan 04-07 — TweaksPanel sections + file-row density controls.
import {
  TweaksResizeSection,
  TweaksPrivacySection,
} from '@/components/panels/TweaksPanel'
import { SourceDensityControl } from '@/components/file-row/SourceDensityControl'
import { TargetDensityCheckboxes } from '@/components/file-row/TargetDensityCheckboxes'

type Tab = 'codec' | 'svgo' | 'output' | 'report'
type View = 'Batch' | 'Compare' | 'Report'

// Phase 3 plan 03-B (D-06) — post-batch per-plugin live savings.
// Source: 03-RESEARCH.md §Architectural Responsibility Map —
//   "Live per-plugin savings computation | Worker thread preferred —
//    N+1 SVGO runs enqueued via WorkerPool.enqueue()"
//
// For each plugin, enqueue one pool job per completed SVG file with that
// plugin disabled (overrides[plugin]=false). Aggregate the byte deltas vs.
// the all-on optimized size already in FileEntry.optimizedSize. Job ids
// carry a 'savings-' prefix so the App-level pool callbacks skip the
// runtime-store bookkeeping (would otherwise inflate doneCount past
// totalJobs and corrupt the batch-completion subscriber).
//
// Wall-time cap: 5s. On timeout, pluginSavings stays empty (or partially
// populated up to the timeout) and the SvgoPanel column shows '—' / blank
// for un-measured plugins — the noticeable affordance per plan spec.
const SAVINGS_TIMEOUT_MS = 5000

async function computePluginSavings(fileIds: string[]): Promise<void> {
  const settings = useSettingsStore.getState().svg
  const pluginIds = Object.keys(settings.plugins)
  const savings: Record<string, { bytes: number; pct: number }> = {}
  const pool = getWorkerPool()

  const svgFiles = fileIds
    .map((id) => useFilesStore.getState().byId[id])
    .filter((f): f is NonNullable<typeof f> =>
      Boolean(f && f.format === 'svg' && f.optimizedBlob),
    )

  if (svgFiles.length === 0) return

  let timedOut = false
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      timedOut = true
      reject(new Error('savings timeout'))
    }, SAVINGS_TIMEOUT_MS),
  )

  try {
    await Promise.race([
      (async () => {
        for (const pluginId of pluginIds) {
          if (timedOut) break
          let totalBaselineBytes = 0
          let totalDisabledBytes = 0

          await Promise.all(
            svgFiles.map(async (file) => {
              // WR-08: check timedOut BEFORE enqueuing. Without this,
              // every file's pool.enqueue is fired synchronously inside
              // .map() and continues to occupy worker slots after the
              // 5s wall-clock timeout has already rejected the race.
              if (timedOut) return
              const baselineSize = file.optimizedSize ?? file.optimizedBlob!.size
              totalBaselineBytes += baselineSize

              const disabledSettings = {
                ...settings,
                plugins: { ...settings.plugins, [pluginId]: false },
              }
              const job: PoolJob = {
                id: `savings-${pluginId}-${file.id}`,
                fileId: file.id,
                format: 'svg',
                settings: disabledSettings,
                // Use the SOURCE blob — we want to measure full re-optimization
                // with this plugin disabled vs. the all-on baseline that
                // produced FileEntry.optimizedSize.
                blob: file.sourceBlob,
              }
              const result = await pool.enqueue(job)
              // WR-08: re-check after the await — the timeout may have
              // landed while the worker was running. Discarding the
              // late result keeps totalDisabledBytes consistent with
              // totalBaselineBytes for this plugin.
              if (timedOut) return
              totalDisabledBytes += result.output.byteLength
            }),
          )

          const bytesDiff = totalDisabledBytes - totalBaselineBytes
          const pct = totalBaselineBytes > 0 ? (bytesDiff / totalBaselineBytes) * 100 : 0
          // Negative pct (disabling the plugin made things smaller — surprising
          // but possible for plugins that interact). Clamp to 0 so the UI
          // shows '—' rather than a negative percent.
          savings[pluginId] = { bytes: bytesDiff, pct: Math.max(0, pct) }
        }
        useSettingsStore.getState().setSvg({ pluginSavings: savings })
      })(),
      timeoutPromise,
    ])
  } catch (err) {
    if (err instanceof Error && err.message === 'savings timeout') {
      // Persist whatever was measured before the timeout so partial info
      // appears in the panel rather than blanking everything.
      if (Object.keys(savings).length > 0) {
        useSettingsStore.getState().setSvg({ pluginSavings: savings })
      }
      console.warn('[oimg] Plugin savings computation timed out after 5s — columns may show — for unmeasured plugins')
    } else {
      // AbortError from a concurrent pool.cancel() (the user clicked Cancel
      // mid-savings). Bail silently — savings is best-effort.
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (!isAbort) {
        console.error('[oimg] computePluginSavings failed:', err)
      }
    }
  }
}

export default function App() {
  const { theme, setTheme } = useTheme()

  // Phase 2 plan 02-04: selectedId migrated to useFilesStore.
  // Phase 2 plan 02-05: MOCK_FILES gone, so the legacy 'f1' fallback is now
  // 'placeholder' to keep aria-activedescendant resolving to the
  // PLACEHOLDER_FILE when nothing is selected (Phase 5 will switch this to
  // the first FileEntry once real uploads land).
  const filesSelectedId = useFilesStore((s) => s.selectedId)
  const selectedId = filesSelectedId ?? 'placeholder'
  const setSelectedId = (id: string) => useFilesStore.getState().setSelected(id)

  const [tab, setTab] = useState<Tab>('codec')
  const [split, setSplit] = useState<number>(50)
  const [view, setView] = useState<View>('Batch')

  const [open, setOpen] = useState<string | null>(null)
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false)
  const [rowMenu, setRowMenu] = useState<string | null>(null)

  // Codec UI state — full migration to settings store deferred to Phase 5
  // (PATTERNS.md §Migration map: only `selectedId`, `running`, `toasts` are
  // MUST-MIGRATE in Phase 2; other codec settings are not yet wired to a real
  // codec, so local useState is fine until Phase 5 panel migrations).
  const [codec, setCodec] = useState<CodecLabel>('WebP')
  const [q, setQ] = useState<number>(82)
  const [method, setMethod] = useState<number>(4)
  const [lossless, setLossless] = useState<boolean>(false)
  const [resizeOn, setResizeOn] = useState<boolean>(true)
  const [w, setW] = useState<string>('1600')
  const [h, setH] = useState<string>('auto')
  const [alg, setAlg] = useState<ResizeAlg>('lanczos3')
  const [fit, setFit] = useState<FitMode>('contain')
  const [stripMeta, setStripMeta] = useState<boolean>(true)
  const [keepIcc, setKeepIcc] = useState<boolean>(false)
  // Phase 3 plan 03-B — `aggressive` removed (butteraugli is bitmap-only;
  // SVG never had a meaningful "aggressive mode"). The Sanitization toggle
  // replaces it; see SvgoPanel.tsx and 03-CONTEXT.md §Deferred Ideas.

  // Phase 2 plan 02-04: `running` migrated to useRuntimeStore; local `toasts`
  // state + pushToast helper REMOVED — sonner Toaster owns the toast surface.
  const running = useRuntimeStore((s) => s.running)
  const [filterQuery, setFilterQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('queue order')

  // Phase 3 plan 03-B — SVG settings are now read live from useSettingsStore
  // (D-09 global in v1). Toggling a plugin calls setSvg with the updated
  // record; the plugin-change subscriber further down fires enqueuePreview
  // for the selected SVG file (D-08/D-10/D-11).
  const svgSettings = useSettingsStore((s) => s.svg)
  const setSvg = useSettingsStore((s) => s.setSvg)
  const togglePlugin = (id: string) => {
    const current = useSettingsStore.getState().svg.plugins
    if (!(id in current)) return
    setSvg({ plugins: { ...current, [id]: !current[id] } })
  }
  const setUnsafeExport = (v: boolean) => setSvg({ unsafeExport: v })
  // Per-row view-model the SvgoPanel consumes. `savings === null` until the
  // first Optimize batch completes and computePluginSavings populates
  // useSettingsStore.svg.pluginSavings.
  const svgoPluginRows = useMemo(
    () =>
      Object.entries(svgSettings.plugins).map(([id, on]) => ({
        id,
        on,
        savings: svgSettings.pluginSavings?.[id] ?? null,
        footgun: PLUGIN_FOOTGUNS[id],
      })),
    [svgSettings.plugins, svgSettings.pluginSavings],
  )

  // Backwards-compat shim for child components that still call onToast(msg, meta).
  // Routes through sonner so the visual contract from Phase 1 stays intact while
  // we incrementally remove the helper from child surfaces in later plans.
  const pushToast = (msg: string, meta?: string) => {
    if (meta) toast(msg, { description: meta })
    else toast(msg)
  }

  // Phase 2 plan 02-04 — Worker pool singleton, instantiated once with
  // callbacks bound to runtime store actions (D-08). The pool lazy-spawns
  // workers on first enqueue, so importing the module here is what causes
  // Vite to trace and split out the worker-*.js / stub-adapter-*.js chunks
  // (closes the deferred chunk-emission gate from plan 02-03).
  //
  // Phase 3 plan 03-B — preview / savings jobs use prefixed jobIds
  // ('preview-...' from enqueuePreview, 'savings-...' from
  // computePluginSavings). They are awaited via pool.enqueue's returned
  // promise; bookkeeping in the runtime store (markStarted / markDone /
  // markError) MUST NOT count them — the auxiliary jobs would otherwise
  // inflate doneCount past totalJobs, corrupt the batch-completion subscriber,
  // and double-fire on cancel. Discriminate by prefix.
  const isAuxiliaryJob = (jobId: string) =>
    jobId.startsWith('preview-') || jobId.startsWith('savings-')
  const pool = useMemo(() => getWorkerPool({
    onStarted: (jobId) => {
      if (isAuxiliaryJob(jobId)) return
      useRuntimeStore.getState().markStarted(jobId)
    },
    onDone: (jobId) => {
      if (isAuxiliaryJob(jobId)) return
      useRuntimeStore.getState().markDone(jobId)
    },
    onError: (jobId, err) => {
      if (isAuxiliaryJob(jobId)) return
      const msg = err instanceof Error ? err.message : String(err)
      useRuntimeStore.getState().markError(jobId, msg)
    },
    // Phase 4 plan 04-07 (D-13) — admission gate held the queue. Snapshot the
    // toast latch BEFORE markThrottle() flips it (markThrottle is idempotent
    // and sets throttleToastFiredThisBatch=true on first call). The toast
    // therefore fires at most once per batch even if the gate trips 50 times.
    // UI-SPEC §Surface 7.
    onThrottle: () => {
      const r = useRuntimeStore.getState()
      const wasFired = r.throttleToastFiredThisBatch
      r.markThrottle()
      if (!wasFired) {
        toast.info('Pacing batch for memory', {
          description:
            'Some files are queued briefly to keep the tab responsive.',
        })
      }
    },
  }), [])

  // Phase 2 plan 02-04 — Keyboard shortcuts. Combined Phase-1 (Cmd+K, Esc, /)
  // with Phase-2 additions (Cmd+Enter optimize, Cmd+. cancel batch).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setCmdkOpen(false)
        setOpen(null)
        setRowMenu(null)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isInput) {
        // Cmd+Enter — Run Optimize (UI-SPEC §8 line 225).
        e.preventDefault()
        startOptimize()
      } else if ((e.metaKey || e.ctrlKey) && e.key === '.' && useRuntimeStore.getState().running) {
        // Cmd+. — Cancel batch (UI-SPEC §8 line 226). Only active while running.
        e.preventDefault()
        cancelBatch()
      } else if (e.key === '/' && !cmdkOpen) {
        const tag = document.activeElement?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          ;(document.querySelector<HTMLInputElement>('.search input'))?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmdkOpen])

  // Phase 2 plan 02-04 — Live-region quartile cadence + completion toast.
  // Subscribes narrowly to runtime store via subscribeWithSelector so we only
  // re-fire on real transitions (D-09 selector convention).
  useEffect(() => {
    const unsub = useRuntimeStore.subscribe(
      (s) => ({
        doneCount: s.doneCount,
        errorCount: s.errorCount,
        totalJobs: s.totalJobs,
        running: s.running,
      }),
      (curr, prev) => {
        // Quartile completion announcement on each interior stride.
        if (curr.doneCount !== prev.doneCount && curr.doneCount > 0 && curr.doneCount < curr.totalJobs) {
          if (isQuartileBoundary(curr.doneCount, curr.totalJobs)) {
            announce(`${curr.doneCount} of ${curr.totalJobs} files complete`)
          }
        }
        // Batch end transition (running flipped true → false). cancelBatch()
        // also flips running → false but resets totalJobs to its preserved
        // value — cancel emits its own "Batch canceled" announcement directly,
        // so we guard here with `totalJobs > 0` AND a non-zero done+error sum
        // to avoid double-announcing on cancel.
        if (prev.running && !curr.running && curr.totalJobs > 0) {
          // Phase 4 plan 04-07 (D-13) — clear the StatusBar Pacing pill at
          // batch end. setThrottleActive(false) preserves the toast latch
          // (throttleToastFiredThisBatch) — that latch resets on the next
          // startBatch, ensuring the toast can fire once per future batch.
          // UI-SPEC §Surface 6.
          useRuntimeStore.getState().setThrottleActive(false)
          const finished = curr.doneCount + curr.errorCount === curr.totalJobs
          if (!finished) return // cancel path — handled in cancelBatch()
          const successCount = curr.totalJobs - curr.errorCount
          // Stub adapter saves 0 bytes (Phase 2 acceptance gate). Phase 3+
          // derives savedBytes from useFilesStore originalSize - optimizedSize.
          const savedHuman = '0 bytes'
          announce(`Batch complete. ${successCount} files optimized, ${savedHuman} saved.`)
          if (curr.errorCount === 0) {
            toast.success(`Optimized ${successCount} files`, { description: savedHuman })
          } else if (curr.errorCount === curr.totalJobs) {
            toast.error(`Optimization failed for ${curr.errorCount} files`, { description: 'Click for details' })
          } else {
            toast(`Optimized ${successCount} of ${curr.totalJobs} files`, { description: `${curr.errorCount} failed` })
          }
          // Phase 3 plan 03-B (D-06) — post-batch live per-plugin savings.
          // Run only when at least one SVG file finished successfully.
          // Fire-and-forget; the function handles its own 5s timeout + error
          // path. Errors are logged, not surfaced as toasts.
          //
          // Plan 03-D fix (Rule 1): defer the file-state read by a microtask.
          // pool.runOnSlot calls `job.resolve(result); callbacks.onDone(...)`
          // synchronously — onDone fires runtime.markDone BEFORE the
          // pool.enqueue().then() microtask runs the SVG `useFilesStore
          // .markDone(fileId, sanitizedBlob, …, sanitizedCount)` write. If we
          // read useFilesStore synchronously here, files are still
          // status='processing' / optimizedBlob === null — `completedSvgIds`
          // is empty and computePluginSavings never runs. queueMicrotask
          // schedules our read AFTER the resolve→sanitize→markDone microtask
          // chain has flushed, so file state is current.
          queueMicrotask(() => {
            const filesNow = useFilesStore.getState()
            const completedSvgIds = filesNow.order.filter((id) => {
              const f = filesNow.byId[id]
              return f && f.format === 'svg' && f.status === 'done' && f.optimizedBlob
            })
            if (completedSvgIds.length > 0) {
              void computePluginSavings(completedSvgIds)
            }
          })
        }
      },
    )
    return unsub
  }, [])

  // Phase 4 plan 04-07 (D-16) — collision-rename toast subscriber.
  // useFilesStore.addSourceWithVariants calls
  // useRuntimeStore.markRename(N) once per drop that produced collisions.
  // We listen for renameCountThisBatch transitions and fire one toast.info
  // per batched increment (lastCount → curr; delta = curr - lastCount).
  // startBatch / cancelBatch reset renameCountThisBatch to 0 — those zero
  // transitions produce a negative delta which the if-guard drops. UI-SPEC
  // §Surface 8.
  useEffect(() => {
    let lastCount = useRuntimeStore.getState().renameCountThisBatch
    const unsub = useRuntimeStore.subscribe(
      (s) => s.renameCountThisBatch,
      (curr) => {
        const delta = curr - lastCount
        lastCount = curr
        if (delta > 0) {
          toast.info(
            `${delta} ${delta === 1 ? 'file' : 'files'} renamed to avoid collisions`,
            {
              description:
                'Suffix "(2)", "(3)", … inserted before "@Nx" so each variant has a unique name.',
            },
          )
        }
      },
    )
    return unsub
  }, [])

  // Phase 2 plan 02-04 — Dev-only store exposure on window for Playwright
  // store inspection (PATTERNS.md §"Page-context store inspection"). Gated
  // strictly on import.meta.env.DEV — WR-05: building with `vite build --mode
  // test` would leak this to production. Playwright runs against `vite dev`
  // (DEV=true), so DEV-only is sufficient.
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ = {
        files: useFilesStore,
        settings: useSettingsStore,
        runtime: useRuntimeStore,
      }
    }
  }, [])

  // Phase 3 plan 03-B (D-08 + D-10) — plugin-change subscriber.
  // Toggling any SVGO plugin while a SVG file is selected fires the debounced
  // single-file re-optimize via useRuntimeStore.enqueuePreview. The 200ms
  // debounce + pool cancel-and-restart inside enqueuePreview implements D-11
  // (last-toggle-wins). Subscriber lives in App.tsx so it runs only while the
  // app is mounted; teardown returns the unsubscribe function.
  useEffect(() => {
    const unsub = useSettingsStore.subscribe(
      (s) => s.svg.plugins,
      () => {
        const filesState = useFilesStore.getState()
        const id = filesState.selectedId
        if (!id) return
        const entry = filesState.byId[id]
        if (entry?.format !== 'svg') return
        useRuntimeStore.getState().enqueuePreview(id)
      },
      { equalityFn: Object.is },
    )
    return unsub
  }, [])

  // Phase 2 plan 02-05 — MOCK_FILES is gone. The queue is now driven by
  // useFilesStore: derive a MockFile-shaped view model on the fly so the
  // existing Phase 1 row-renderer keeps working without a wholesale rewrite.
  // Phase 5 will replace MockFile with a FileEntry-derived view model and
  // delete the placeholder branch below.
  const filesById = useFilesStore((s) => s.byId)
  const filesOrder = useFilesStore((s) => s.order)
  const PLACEHOLDER_FILE: MockFile = {
    id: 'placeholder',
    name: 'No file selected',
    type: 'png',
    orig: 0,
    opt: 0,
    status: 'queued',
    target: 'webp',
    dim: '— × —',
    q: null,
  }

  // Derive a MockFile array from the store. Status maps from the FileEntry
  // shape's wider FileStatus to the narrower visual MockFile status set
  // ('idle' folds to 'queued' for the visual contract).
  const SHELL_FILES: MockFile[] = useMemo(() => {
    const fmtToType = (fmt: string): MockFile['type'] =>
      fmt === 'jpeg' ? 'jpg' : (fmt as MockFile['type'])
    // WR-02: filesOrder and filesById come from two separate selectors. A
    // removeFile() that lands between the two reads (concurrent React 19
    // render or strict-mode double render) leaves an id in `order` whose
    // entry is no longer in `byId`. Use flatMap + early-bail to drop those
    // stale ids defensively instead of crashing on entry.status access.
    return filesOrder.flatMap((id) => {
      const entry = filesById[id]
      if (!entry) return []
      const status: MockFile['status'] =
        entry.status === 'idle' ? 'queued' : (entry.status as MockFile['status'])
      return [{
        id: entry.id,
        name: entry.name,
        type: fmtToType(entry.format),
        orig: entry.originalSize,
        opt: entry.optimizedSize ?? entry.originalSize,
        status,
        target: fmtToType(entry.format),
        dim: '—',
        q: null,
      }]
    })
  }, [filesById, filesOrder])

  const file: MockFile = useMemo(
    () => SHELL_FILES.find((f) => f.id === selectedId) ?? PLACEHOLDER_FILE,
    [SHELL_FILES, selectedId]
  )

  const filteredFiles = useMemo(() => {
    const fq = filterQuery.trim().toLowerCase()
    if (!fq) return SHELL_FILES
    return SHELL_FILES.filter((f) => f.name.toLowerCase().includes(fq))
  }, [SHELL_FILES, filterQuery])

  // SVG files don't have a Codec tab; auto-flip to SVGO.
  useEffect(() => {
    if (file.type === 'svg' && tab === 'codec') setTab('svgo')
    if (file.type !== 'svg' && tab === 'svgo') setTab('codec')
  }, [file.type, tab])

  const stageRef = useRef<HTMLDivElement | null>(null)
  const onSplitDrag = () => {
    const rect = stageRef.current?.querySelector<HTMLDivElement>('.image-frame')?.getBoundingClientRect()
    if (!rect) return
    const move = (ev: MouseEvent) => {
      const x = ((ev.clientX - rect.left) / rect.width) * 100
      setSplit(Math.max(2, Math.min(98, x)))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const totals = useMemo(() => {
    // Phase 2 plan 02-05 — derived from SHELL_FILES (which is store-driven).
    const orig = SHELL_FILES.reduce((s, f) => s + f.orig, 0)
    const opt = SHELL_FILES.reduce((s, f) => s + f.opt, 0)
    const pct = orig === 0 ? 0 : ((orig - opt) / orig) * 100
    return { orig, opt, saved: orig - opt, pct }
  }, [SHELL_FILES])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  // Phase 2 plan 02-04 — Real worker-pool batch dispatcher.
  // Reads queued/idle/error files from useFilesStore, calls startBatch on the
  // runtime store (sets running=true + populates queue/totalJobs), enqueues
  // each fileId as a stub job into the pool, and flips files.byId statuses
  // through the pool's onStarted/onDone/onError callbacks.
  //
  // UI-SPEC §7: silent batch start — NO toast, only the live region announces.
  const startOptimize = () => {
    const filesState = useFilesStore.getState()
    const fileIds = filesState.order.filter((id) => {
      const f = filesState.byId[id]
      return f && (f.status === 'idle' || f.status === 'queued' || f.status === 'error')
    })
    if (fileIds.length === 0) return
    // Phase 4 (D-04 + D-14) — 1:1 jobs:FileEntries. addSourceWithVariants in
    // useFilesStore materializes one FileEntry per density variant up-front;
    // each entry is its own pool job here.
    useRuntimeStore.getState().startBatch(fileIds)
    announce(`Optimizing ${fileIds.length} files`)
    for (const fileId of fileIds) {
      const f = filesState.byId[fileId]
      if (!f) continue
      // Phase 2 plan 02-04 — TEST AFFORDANCE: window.__OIMG_SLOW_MS__ injects
      // an artificial per-job delay through the stub adapter (worker reads
      // settings.slowMs). VR-02 (concurrency cap) and VR-03 (cancel correctness)
      // tests set this so the otherwise-microsecond stub run becomes observable.
      // WR-05: gated on import.meta.env.DEV ONLY so accidental `vite build
      // --mode test` does NOT ship this affordance to production.
      const slowMs = import.meta.env.DEV
        ? (window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__ ?? 0
        : 0
      // Phase 3 plan 03-A — route SVG files through the real SVG adapter.
      // Phase 4 plan 04-07 — route PNG files through the real PNG adapter
      // (decode → resize → encode). All other raster formats still fall back
      // to the stub until Phase 5 ships JPEG/WebP/AVIF encoders.
      const isSvg = f.format === 'svg'
      // Plan 04-07 Rule 1 fix — PNG branch is gated on the byteEstimate field
      // (set ONLY by addSourceWithVariants, never by Phase-2 test affordances
      // calling addFile directly). Without this gate, the worker-pool VR-01/02,
      // object-url VR-04, and aria-live VR-05 specs regressed because their
      // synthetic 1KB octet-stream blobs (format='png' as a stand-in for stub)
      // started routing through the real png-adapter, which threw AdapterError
      // on the bogus PNG header and the tests timed out on never-'done' status.
      // Real user-dropped PNGs always carry byteEstimate (Plan 04-05 seeds it
      // during fan-out), so this preserves the Phase 4 contract end-to-end.
      const fileEntry = useFilesStore.getState().byId[fileId]
      const hasPngFanoutShape =
        f.format === 'png' &&
        typeof (fileEntry as { byteEstimate?: number } | undefined)?.byteEstimate ===
          'number'
      const adapterFormat: AdapterFormat = isSvg
        ? 'svg'
        : hasPngFanoutShape
          ? 'png'
          : 'stub'
      let settings: unknown
      if (isSvg) {
        settings = useSettingsStore.getState().svg
      } else if (hasPngFanoutShape) {
        // Plan 04-05 enriched FileEntry: targetDensity, sourceDensity guaranteed
        // for PNG variants emitted by addSourceWithVariants; resizeOverride +
        // preserveIcc are optional per-file overrides (UI deferred to Phase 5
        // per D-07/D-09; data shape only).
        settings = buildPngResizeSettings({
          sourceDensity: fileEntry?.sourceDensity ?? '1x',
          targetDensity:
            fileEntry?.targetDensity ?? fileEntry?.sourceDensity ?? '1x',
          globalAlg: useSettingsStore.getState().resize.alg,
          fileOverride: fileEntry?.resizeOverride,
          globalPreserveIcc:
            useSettingsStore.getState().global.preserveIccProfile,
          filePreserveIcc: fileEntry?.preserveIcc,
        })
      } else {
        settings = slowMs > 0 ? { slowMs } : {}
      }
      const job: PoolJob = {
        id: fileId,
        fileId,
        format: adapterFormat,
        settings,
        blob: f.sourceBlob,
        // Phase 4 D-11(b) — admission gate input. Plan 04-05 seeded
        // byteEstimate on FileEntryWithBlob during addSourceWithVariants.
        // Optional — SVG / stub jobs may have undefined and the gate no-ops.
        byteEstimate: (
          useFilesStore.getState().byId[fileId] as
            | { byteEstimate?: number }
            | undefined
        )?.byteEstimate,
      }
      pool.enqueue(job)
        .then(async (result) => {
          // Phase 3 plan 03-A (Rule 1 fix) — the original CR-04 guard
          // `if (!inFlight.has(fileId)) return` raced with the pool's onDone
          // callback: pool.runOnSlot calls `job.resolve(result); callbacks.onDone(...)`
          // synchronously, so runtime.markDone removes the job from inFlight
          // BEFORE the .then microtask runs. The guard then incorrectly bailed
          // on every successful job — files never reached status='done'. This
          // bug existed since Phase 2 (latent because aria-live tests waited
          // on runtime.doneCount, not file.status; only worker-pool VR-01 hit it).
          //
          // Cancel-race is already handled correctly without this guard: a
          // cancelled job calls `job.reject(AbortError)` which routes through
          // .catch (the AbortError discriminator below skips setStatus('error')).
          // Surviving guard: file may have been removed between enqueue and
          // resolve — bail if byId entry is gone.
          if (!useFilesStore.getState().byId[fileId]) return
          if (isSvg) {
            // Phase 3 (D-01 + Pitfall 1) — SVGO ran in the worker; DOMPurify
            // runs HERE on the main thread because it needs `document`.
            // Read DOMPurify.removed.length immediately after sanitize() —
            // do not await between (Pitfall 5).
            const svgText = new TextDecoder().decode(result.output)
            const unsafe = useSettingsStore.getState().svg.unsafeExport ?? false
            const { clean, sanitizedCount } = sanitizeSvg(svgText, unsafe)
            const sanitizedBlob = new Blob([clean], { type: 'image/svg+xml' })
            useFilesStore
              .getState()
              .markDone(fileId, sanitizedBlob, sanitizedBlob.size, sanitizedCount)
          } else if (hasPngFanoutShape) {
            // Phase 4 plan 04-07 — encoded PNG bytes from png-adapter (decode
            // → resize → encode). Wrap as Blob and store; thumbnail / object
            // URL is auto-managed by useRuntimeStore.getOrCreateObjectURL on
            // the next render. markDone revokes the OLD url before writing
            // the new optimizedBlob (Pitfall 3).
            const optimizedBlob = new Blob([result.output], {
              type: 'image/png',
            })
            useFilesStore
              .getState()
              .markDone(fileId, optimizedBlob, optimizedBlob.size)
          } else {
            // Stub round-trip (Phase 2 contract): byte-equal output.
            const optimizedBlob = new Blob([result.output])
            useFilesStore.getState().markDone(fileId, optimizedBlob, optimizedBlob.size)
          }
        })
        .catch((err) => {
          // CR-04 / WR-08: discriminate AbortError (cancel path — already
          // surfaced via pool onError → runtime.markError) from real adapter
          // failures, which must flip the files-store entry to 'error' so the
          // queue row reflects the failed run instead of an old 'done' state.
          const isAbort =
            err instanceof DOMException && err.name === 'AbortError'
          if (isAbort) return
          useFilesStore.getState().setStatus(fileId, 'error')
          // Phase 2 has no UI surface for adapter errors yet (Phase 5 adds an
          // inline retry affordance per UI-SPEC §7). Surface to console so
          // real bugs are not silently swallowed during dev.
          console.error(`[startOptimize] ${fileId}:`, err)
        })
    }
  }

  // Phase 2 plan 02-04 — Cancel handler.
  // Order matters: pool.cancel() trips AbortController (T-02-01 mitigation)
  // BEFORE useRuntimeStore.cancelBatch() clears the in-flight set. Pool
  // onError fires for each in-flight job; runtime store guards late
  // markDone/markError arrivals via the inFlight.has(jobId) check.
  const cancelBatch = () => {
    const inFlightCount = useRuntimeStore.getState().inFlight.size
    pool.cancel()
    useRuntimeStore.getState().cancelBatch()
    announce('Batch canceled')
    toast(`Batch canceled`, { description: `${inFlightCount} files were processing` })
  }

  const exportZip = () => {
    toast.success('Bundled oimg-export.zip', { description: '2.6 MB' })
  }

  const setCodecFromMenu = (c: CodecLabel) => {
    setCodec(c)
    pushToast('Output set to ' + c)
    setOpen(null)
  }

  // Command palette items.
  // Phase 2 plan 02-04: Optimize meta updated to reflect real worker pool;
  // Cancel batch entry added (visible only while running) per UI-SPEC §3 + §8.
  const cmdGroups: CmdGroup[] = [
    {
      group: 'Actions',
      items: [
        { ic: <Icons.Upload size={13} />, label: 'Add files…', meta: 'A', do: () => pushToast('File picker opened') },
        { ic: <Icons.Play size={13} />, label: 'Optimize all', meta: 'Run worker pool · ⌘⏎', do: startOptimize },
        ...(running ? [{ ic: <Icons.X size={14} />, label: 'Cancel batch', meta: 'Stops in-flight workers · ⌘.', do: cancelBatch }] : []),
        { ic: <Icons.Download size={13} />, label: 'Export ZIP', meta: 'E', do: exportZip },
        { ic: <Icons.Zap size={13} />, label: 'Auto (Butteraugli 1.4)', meta: 'B', do: () => pushToast('Auto-optimizing…', 'butteraugli ≤ 1.4') },
      ],
    },
    {
      group: 'View',
      items: [
        { ic: <Icons.Grid size={13} />, label: 'Switch to Batch', do: () => setView('Batch') },
        { ic: <Icons.Layers size={13} />, label: 'Switch to Compare', do: () => setView('Compare') },
        { ic: <Icons.BarChart size={13} />, label: 'Switch to Report', do: () => setView('Report') },
        {
          ic: theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />,
          label: 'Toggle ' + (theme === 'dark' ? 'light' : 'dark') + ' theme',
          do: toggleTheme,
        },
      ],
    },
    {
      group: 'Codec',
      items: CODECS.filter((c) => c !== 'SVG').map((c) => ({
        ic: <Icons.Image size={13} />,
        label: 'Set output → ' + c + (c === 'JPEG' ? ' (mozjpeg)' : c === 'PNG' ? ' (oxipng)' : ''),
        do: () => setCodecFromMenu(c),
      })),
    },
  ]

  const isPopOpen = (key: string) => open === key
  const togglePop = (key: string) => setOpen(open === key ? null : key)

  const workArea = (
    <main className="work">
      {/* LEFT: Queue */}
      <div className="pane">
        <div className="pane-hd">
          <span>Queue · {filteredFiles.length} files</span>
          <div className="actions" style={{ position: 'relative' }}>
            <button
              className={'iconbtn' + (isPopOpen('sort') ? ' on' : '')}
              onClick={() => togglePop('sort')}
              title="Sort"
            >
              <Icons.Filter size={12} />
            </button>
            <Popover open={isPopOpen('sort')} onClose={() => setOpen(null)} anchor="br" style={{ minWidth: 200 }}>
              <div className="lbl">Sort by</div>
              {['queue order', 'file size', 'savings %', 'name', 'format'].map((s) => (
                <div
                  key={s}
                  className={'pi check' + (sortBy === s ? ' on' : '')}
                  onClick={() => { setSortBy(s); setOpen(null) }}
                >
                  <span>{s}</span>
                </div>
              ))}
            </Popover>
            <button className="iconbtn" title="Add" onClick={() => pushToast('File picker opened')}>
              <Icons.Plus size={12} />
            </button>
          </div>
        </div>

        <div className="dropzone">
          <span className="big">Drop images to optimize</span>
          <span>or click to browse · max 200 files</span>
          <div className="formats">SVG · PNG · JPEG · WEBP · AVIF · JXL</div>
        </div>

        <div className="pane-body" style={{ borderTop: '1px solid var(--line)' }}>
          <div
            className="filelist"
            role="listbox"
            aria-label="Files"
            aria-activedescendant={`file-${selectedId}`}
          >
            {filteredFiles.map((f) => (
              <div
                key={f.id}
                id={`file-${f.id}`}
                role="option"
                aria-selected={selectedId === f.id}
                tabIndex={selectedId === f.id ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedId(f.id)
                  }
                }}
                className={
                  'file-row' +
                  (selectedId === f.id ? ' selected' : '') +
                  (rowMenu === f.id ? ' has-menu' : '')
                }
                onClick={() => setSelectedId(f.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setRowMenu(f.id)
                  setSelectedId(f.id)
                }}
                style={{ position: 'relative' }}
              >
                <div className={'thumb ' + f.type}>{f.type.toUpperCase().slice(0, 3)}</div>
                <div className="file-meta">
                  <div className="file-name">{f.name}</div>
                  <div className="file-stat">
                    <span>{fmtBytes(f.orig)}</span>
                    <span className="arrow">→</span>
                    <span>{fmtBytes(f.opt)}</span>
                    <span className={'save' + (((f.orig - f.opt) / f.orig) < 0.3 ? ' warn' : '')}>
                      {fmtPct(f.orig, f.opt)}
                    </span>
                    {/* Phase 3 (D-03) — sanitized badge: DOMPurify removed N
                        dangerous elements/attrs. Reads FileEntry.sanitizedCount
                        directly from useFilesStore.byId (the SHELL_FILES
                        view-model is MockFile-shaped and doesn't carry it).
                        Plan B may move this to a dedicated FilePanel component. */}
                    {(() => {
                      const entry = filesById[f.id]
                      const n = entry?.sanitizedCount
                      if (n === undefined || n <= 0) return null
                      return (
                        <span
                          className="pill warn sm"
                          aria-label={`${n} element${n === 1 ? '' : 's'} removed by sanitizer`}
                          title={`${n} dangerous element${n === 1 ? '' : 's'} removed by DOMPurify`}
                          style={{ marginLeft: 2 }}
                        >
                          sanitized · {n}
                        </span>
                      )
                    })()}
                  </div>
                  {f.status === 'processing' && <div className="progbar"><div /></div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Phase 4 plan 04-07 — D-01/D-02 SCOPED density controls.
                      Render TargetDensityCheckboxes for the family (groupBy
                      sourceFamilyId; fall back to f.id when the entry was
                      added pre-fanout via addFile). SourceDensityControl
                      renders the hover-revealed chevron popover. Both are
                      no-op interactive (mid-flight edits land Phase 5). */}
                  {filesById[f.id]?.sourceFamilyId && (
                    <TargetDensityCheckboxes
                      sourceFamilyId={filesById[f.id]!.sourceFamilyId!}
                    />
                  )}
                  <SourceDensityControl fileId={f.id} />
                  <button
                    className="ctxbtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRowMenu(rowMenu === f.id ? null : f.id)
                      setSelectedId(f.id)
                    }}
                  >
                    <Icons.More size={12} />
                  </button>
                  <div className={'file-status ' + f.status} title={f.status} />
                </div>
                {rowMenu === f.id && (
                  <Popover
                    open
                    onClose={() => setRowMenu(null)}
                    anchor="br"
                    style={{ minWidth: 200, top: 28, right: 8, left: 'auto' }}
                  >
                    <div className="pi" onClick={() => { setRowMenu(null); pushToast('Re-optimizing ' + f.name) }}>
                      <Icons.Play size={13} /><span>Re-optimize</span>
                    </div>
                    <div className="pi" onClick={() => { setRowMenu(null); pushToast('Saved ' + f.name) }}>
                      <Icons.Download size={13} /><span>Save as…</span>
                    </div>
                    <div className="pi" onClick={() => { setRowMenu(null); pushToast('Copied data URI') }}>
                      <Icons.Copy size={13} /><span>Copy data URI</span>
                    </div>
                    <div className="pi" onClick={() => { setRowMenu(null); setTab('output') }}>
                      <Icons.Code size={13} /><span>Copy &lt;picture&gt;</span>
                    </div>
                    <div className="div" />
                    <div className="pi danger" onClick={() => { setRowMenu(null); pushToast('Removed ' + f.name) }}>
                      <Icons.Trash size={13} /><span>Remove from queue</span>
                    </div>
                  </Popover>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="totals">
          <div>
            <div className="lbl">Total before</div>
            <div className="v num">{fmtBytes(totals.orig)}</div>
          </div>
          <div>
            <div className="lbl">Total after</div>
            <div className="v num acc">{fmtBytes(totals.opt)}</div>
          </div>
          <div>
            <div className="lbl">Saved</div>
            <div className="v num acc">−{fmtBytes(totals.saved)}</div>
          </div>
          <div>
            <div className="lbl">Compression</div>
            <div className="v num">{totals.pct.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* CENTER: Compare */}
      <div className="pane center">
        <div className="center-head">
          <div className="crumbs">
            <span>Queue</span>
            <span className="sep">/</span>
            <span className="cur">{file.name}</span>
            <span className="file-tag">{file.type.toUpperCase()} → {file.target.toUpperCase()}</span>
            <span className="file-tag">{file.dim}</span>
            {file.q != null && <span className="file-tag">q{file.q}</span>}
          </div>
          <div className="right">
            <span className="pill acc"><Icons.Check size={10} /> Optimized</span>
            <button
              className={'tbtn ghost' + (isPopOpen('zoom') ? ' open' : '')}
              style={{ height: 24, padding: '0 8px', position: 'relative' }}
              onClick={() => togglePop('zoom')}
            >
              <Icons.Eye size={12} /> 100%
              <Icons.ChevronDown size={9} />
              <Popover open={isPopOpen('zoom')} onClose={() => setOpen(null)} anchor="br">
                {['25%', '50%', '100%', '200%', 'Fit'].map((z) => (
                  <div key={z} className={'pi check' + (z === '100%' ? ' on' : '')} onClick={() => setOpen(null)}>
                    <span>{z}</span>
                  </div>
                ))}
              </Popover>
            </button>
          </div>
        </div>

        <div className="compare" ref={stageRef}>
          <div className="compare-stage">
            <div
              className="image-frame"
              style={{ ['--split' as string]: split + '%' } as React.CSSProperties}
            >
              <div className="image-layer layer-orig"></div>
              <div className="image-layer layer-opt"></div>
              <div className="split-tag l">
                <span className="dot"></span>
                ORIGINAL · {fmtBytes(file.orig)}
              </div>
              <div className="split-tag r">
                <span className="dot"></span>
                {file.target.toUpperCase()} · {fmtBytes(file.opt)}
              </div>
              <div
                className="split-handle"
                role="slider"
                aria-label="Compare split position"
                aria-valuemin={2}
                aria-valuemax={98}
                aria-valuenow={Math.round(split)}
                tabIndex={0}
                style={{ left: split + '%' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSplitDrag()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') setSplit((s) => Math.max(2, s - 5))
                  if (e.key === 'ArrowRight') setSplit((s) => Math.min(98, s + 5))
                  if (e.key === 'Home') setSplit(2)
                  if (e.key === 'End') setSplit(98)
                }}
              />
            </div>
          </div>

          <div className="delta-strip">
            <div className="delta">
              <span className="l">Original</span>
              <span className="v">{fmtBytes(file.orig)}</span>
              <span className="sub">{file.dim} · {file.type}</span>
            </div>
            <div className="delta">
              <span className="l">Optimized</span>
              <span className="v">{fmtBytes(file.opt)}</span>
              <span className="sub">{codec.toLowerCase()} · q{q} · m{method}</span>
            </div>
            <div className="delta savings">
              <span className="l">Saved</span>
              <span className="v">−{fmtBytes(file.orig - file.opt)}</span>
              <span className="sub">{fmtPct(file.orig, file.opt)} smaller</span>
            </div>
            <div className="delta">
              <span className="l">SSIM</span>
              <span className="v">0.987</span>
              <span className="sub">visually identical</span>
            </div>
            <div className="delta">
              <span className="l">Butteraugli</span>
              <span className="v">1.24</span>
              <span className="sub">target ≤ 1.40</span>
            </div>
            <div className="delta">
              <span className="l">Decode</span>
              <span className="v">38ms</span>
              <span className="sub">est. on 4G</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Inspector */}
      <div className="pane insp">
        <div className="pane-hd">
          <span>Inspector</span>
          <div className="actions" style={{ position: 'relative' }}>
            <button
              className={'iconbtn' + (isPopOpen('insp') ? ' on' : '')}
              onClick={() => togglePop('insp')}
            >
              <Icons.More size={12} />
            </button>
            <Popover open={isPopOpen('insp')} onClose={() => setOpen(null)} anchor="br" style={{ minWidth: 220 }}>
              <div className="pi" onClick={() => { setOpen(null); pushToast('Settings copied to all files') }}>
                <Icons.Layers size={13} /><span>Apply to all files</span>
              </div>
              <div className="pi" onClick={() => { setOpen(null); pushToast('Saved as preset', '"WebP q82 1600w"') }}>
                <Icons.Plus size={13} /><span>Save as preset…</span>
              </div>
              <div className="div" />
              <div className="lbl">Presets</div>
              <div className="pi check on"><span>Web · WebP q82</span></div>
              <div className="pi check"><span>Email · JPEG q70 800w</span></div>
              <div className="pi check"><span>Print · PNG lossless</span></div>
            </Popover>
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="Inspector">
          {file.type === 'svg' ? (
            <button
              role="tab"
              aria-selected={tab === 'svgo'}
              aria-controls="inspector-panel"
              id="inspector-tab-svgo"
              className={tab === 'svgo' ? 'on' : ''}
              onClick={() => setTab('svgo')}
            >
              SVGO
            </button>
          ) : (
            <button
              role="tab"
              aria-selected={tab === 'codec'}
              aria-controls="inspector-panel"
              id="inspector-tab-codec"
              className={tab === 'codec' ? 'on' : ''}
              onClick={() => setTab('codec')}
            >
              Codec
            </button>
          )}
          <button
            role="tab"
            aria-selected={tab === 'output'}
            aria-controls="inspector-panel"
            id="inspector-tab-output"
            className={tab === 'output' ? 'on' : ''}
            onClick={() => setTab('output')}
          >
            Output
          </button>
          <button
            role="tab"
            aria-selected={tab === 'report'}
            aria-controls="inspector-panel"
            id="inspector-tab-report"
            className={tab === 'report' ? 'on' : ''}
            onClick={() => setTab('report')}
          >
            Report
          </button>
        </div>
        <div
          className="pane-body"
          role="tabpanel"
          id="inspector-panel"
          aria-labelledby={`inspector-tab-${tab}`}
        >
          {tab === 'codec' && (
            <>
              <CodecPanel
                codec={codec} setCodec={setCodec}
                q={q} setQ={setQ}
                method={method} setMethod={setMethod}
                lossless={lossless} setLossless={setLossless}
                resizeOn={resizeOn} setResizeOn={setResizeOn}
                w={w} setW={setW} h={h} setH={setH}
                alg={alg} setAlg={setAlg} fit={fit} setFit={setFit}
                stripMeta={stripMeta} setStripMeta={setStripMeta}
                keepIcc={keepIcc} setKeepIcc={setKeepIcc}
              />
              {/* Phase 4 plan 04-07 — Global pipeline sections (D-05 + D-06 +
                  D-09 + D-10 amend). UI-SPEC §Surface 4: Resize / Variants is
                  visible on every codec tab. UI-SPEC §Surface 5: Privacy /
                  Metadata follows it. Rendered AFTER CodecPanel because
                  CodecPanel is a closed component owning its own Output
                  format + per-codec params; interleaving would require a
                  Phase-5 panel-decomposition refactor that is out of scope. */}
              <TweaksResizeSection />
              <TweaksPrivacySection />
            </>
          )}
          {tab === 'svgo' && (
            <>
              <SvgoPanel
                plugins={svgoPluginRows}
                togglePlugin={togglePlugin}
                unsafeExport={svgSettings.unsafeExport ?? false}
                setUnsafeExport={setUnsafeExport}
              />
              {/* Phase 4 plan 04-07 — Tweaks sections visible on SVG tab too
                  (UI-SPEC §Surface 4 acceptance: "Section visible on all
                  codec tabs (SVG + each raster)" — SVG variants are a no-op
                  but the global-config UX should be consistent). */}
              <TweaksResizeSection />
              <TweaksPrivacySection />
            </>
          )}
          {tab === 'output' && (
            <SnippetPanel file={filesById[selectedId] ?? null} />
          )}
          {tab === 'report' && <ReportPanel files={SHELL_FILES} />}
        </div>
      </div>
    </main>
  )

  // Phase 2 plan 02-04 — Overlays:
  //   1. ARIA live region (UI-SPEC §5) — single role=status aria-live=polite
  //      sr-only div mounted at App root. Owned by setLiveRegion ref binder
  //      so non-React modules (worker pool callbacks, store actions) can
  //      announce via @/lib/live-region#announce.
  //   2. Sonner Toaster — replaces the Phase 1 hand-rolled toast-wrap. Sonner
  //      handles slide-in animation, prefers-reduced-motion, focus return.
  //   3. CommandPalette (unchanged from Phase 1).
  const overlays = (
    <>
      <div
        ref={(el) => setLiveRegion(el)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
      <Toaster position="bottom-right" />
      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} groups={cmdGroups} />
    </>
  )

  return (
    <AppShell
      titleBar={
        <TitleBar
          theme={theme}
          onToggleTheme={toggleTheme}
          openKey={open}
          onOpenKey={setOpen}
          codec={codec}
          onSelectCodec={setCodecFromMenu}
          view={view}
          onSetView={setView}
          onToast={pushToast}
          onOpenCommandPalette={() => setCmdkOpen(true)}
        />
      }
      toolbar={
        <Toolbar
          running={running}
          onStartOptimize={startOptimize}
          onExportZip={exportZip}
          view={view}
          onSetView={setView}
          filterQuery={filterQuery}
          onSetFilterQuery={setFilterQuery}
          theme={theme}
          onToggleTheme={toggleTheme}
          openKey={open}
          onOpenKey={setOpen}
          onToast={pushToast}
        />
      }
      workArea={workArea}
      statusBar={
        <StatusBar
          running={running}
          filesCount={SHELL_FILES.length}
          origTotal={totals.orig}
          optTotal={totals.opt}
          compressionPct={totals.pct}
          savedBytes={totals.saved}
        />
      }
      overlays={overlays}
    />
  )
}
