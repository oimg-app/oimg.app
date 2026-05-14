# Requirements: oimg.app — UI Port Milestone

**Defined:** 2026-05-14
**Core Value:** Developer drops assets, adjusts settings once, walks away with optimized files + copy-paste snippets — nothing leaves the browser

## v1 Requirements

### Setup

- [ ] **SETUP-01**: Tailwind CSS installed and extended with oimg design tokens — oklch palette, Inter (UI) + JetBrains Mono (code), accent green ~145°, custom spacing/radius matching OIMG.html
- [ ] **SETUP-02**: CSS variables from `example-ui/OIMG.html` ported to Tailwind theme config — dark theme default, light theme variant, all `--var` names mapped to Tailwind tokens
- [ ] **SETUP-03**: Shadcn base components generated via CLI — `button`, `separator`, `tooltip`, `popover`, `slider`, `dialog`, `tabs`, `input`, `checkbox`, `switch`, `dropdown-menu`, `context-menu`, `menubar`, `kbd`, `resizable`, `sonner`, `spinner`

### Stores

- [ ] **STORE-01**: `src/stores/files.ts` — `filesAtom` with `entries:FileEntry[]`, `selectedId:string|null`, `filterQuery:string`, `sortBy:SortKey`; types `FileEntry={id,name,type,orig,opt,status,target,dim,q:number|null,prog?}`, `SortKey='queue order'|'file size'|'savings %'|'name'|'format'`; computed `$selectedFile`, `$filteredFiles`, `$totals:{orig,opt,saved,pct}`; initial entries from `stub-data.ts`; actions: `selectFile(id)`, `setFilter(q)`, `setSortBy(s)`, `removeFile(id)`
- [ ] **STORE-02**: `src/stores/settings.ts` — `settingsAtom` with `codec:Codec='WebP'`, `q=82`, `method=4`, `lossless=false`, `resizeOn=false`, `w='1600'`, `h='auto'`, `alg='lanczos3'`, `fit='contain'`, `stripMeta=true`, `keepIcc=false`, `aggressive=false`, `plugins:SvgoPlugin[]`; types `Codec='SVG'|'PNG'|'WebP'|'JPEG'|'AVIF'`, `SvgoPlugin={id,on,saves}`; constants exported: `CODECS`, `RESIZE_ALGS`, `FIT_MODES`; initial plugins from `stub-data.ts`; actions: `setCodec`, `setQuality`, `setMethod`, `setLossless`, `setResizeOn`, `setResizeDimensions(w,h)`, `setFit`, `setAlg`, `setStripMeta`, `setKeepIcc`, `setAggressive`, `togglePlugin(id)`
- [ ] **STORE-03**: `src/stores/ui.ts` — `uiAtom` with `open:string|null=null`, `view:View='Batch'`, `tab:Tab='codec'`, `split=50`, `zoom=100`, `cmdkOpen=false`, `cmdkQ=''`, `cmdkSel=0`, `rowMenu:string|null=null`, `theme:'dark'|'light'='dark'`; types `View='Batch'|'Compare'|'Report'`, `Tab='codec'|'svgo'|'output'|'report'`; computed `$cmdFlat` filtering `ALL_COMMANDS` by `cmdkQ`; actions: `setOpen`, `setView`, `setTab`, `setSplit`, `setZoom`, `openCmdk`, `closeCmdk`, `setCmdkQuery`, `setCmdkSel`, `setRowMenu`, `setTheme` — zero imports from other stores
- [ ] **STORE-04**: `src/stores/runtime.ts` — `runtimeAtom` with `running=false`, `toasts:Toast[]`; `Toast={id:string,msg:string,meta?:string}`; actions: `startRun`, `stopRun`, `pushToast(msg,meta?)`, `dismissToast(id)`
- [ ] **STORE-05**: `src/lib/stub-data.ts` — typed exports: `STUB_FILES:FileEntry[]` (12 entries from `data.jsx`), `SVGO_PLUGINS:SvgoPlugin[]` (22 plugins from `data.jsx`), `CODECS`, `RESIZE_ALGS`, `FIT_MODES` — single source of truth; no component imports this directly
- [ ] **STORE-06**: `src/lib/format.ts` — pure utilities: `fmtBytes(b:number):string`, `fmtPct(orig:number,opt:number):string` — ported from `data.jsx`
- [ ] **STORE-07**: `src/lib/commands.ts` — `ALL_COMMANDS:CommandGroup[]` (Actions / View / Codec groups from `app.jsx`); `CommandItem={ic,label,meta?,group,do:()=>void}`; handlers call store actions
- [ ] **STORE-08**: All components read data exclusively via `useStore(atom)` or exported constants from stores — zero direct stub-data imports in components; zero app-level `useState`; only ephemeral hover/focus state allowed in components

### Icons

- [ ] **ICON-01**: `icons.jsx` not ported — replaced by `@phosphor-icons/react` throughout; icon mapping established: `Play→PlayCircle`, `Pause→PauseCircle`, `Upload→UploadSimple`, `Download→DownloadSimple`, `Layers→Stack`, `Filter→Funnel`, `More→DotsThreeVertical`, `Zap→Lightning`, `BarChart→ChartBar`, `Grid→SquaresFour`, `Lock→LockSimple`, `Eye→Eye`, `File→File`, `Image→Image`, `Code→Code`, `Check→Check`, `X→X`, `ChevronRight→CaretRight`, `ChevronDown→CaretDown`, `Trash→Trash`, `Search→MagnifyingGlass`, `Settings→GearSix`, `Copy→Copy`, `Sun→Sun`, `Moon→Moon`, `Plus→Plus`

### Shell

- [ ] **SHELL-01**: `AppShell` renders 3-pane resizable layout — FilesPane (left, fixed width ~240px) | CenterPane (center, flex-grow) | InspectorPane (right, fixed width ~260px) — using Radix resizable panels; layout fills viewport height
- [ ] **SHELL-02**: `BackpressureIndicator` renders in shell — visible when `runtimeAtom.running` is true
- [ ] **SHELL-03**: `<html>` `data-theme` attribute set from `uiAtom.theme`; theme toggle calls `setTheme` action

### Navigation

- [ ] **NAV-01**: `TitleBar` renders brand mark + "OIMG · image optimizer" wordmark; Codec menu (popover: codec selector + Auto/Butteraugli item); View menu (popover: Batch/Compare/Report items + theme toggle); Help menu (popover: Documentation / Keyboard shortcuts / What's new / version); "100% local" + "Offline-ready" pills; Search/⌘K button opening CommandPalette; all menu actions call store actions
- [ ] **NAV-02**: `Toolbar` renders: Add files split-button (popover: From device / Watch folder / From URL or paste / Recent list); Optimize all button (reads `runtimeAtom.running`, calls `startRun`); Export split-button (popover: All as ZIP / Save individually / Copy `<picture>` HTML / Copy as data URIs / Manifest JSON); Batch/Compare/Report view seg (calls `setView`); Auto split-button (butteraugli target popover: 1.4 balanced / 1.0 high quality / 2.0 aggressive); filter search input (calls `setFilter`); theme toggle (calls `setTheme`); settings popover (workers config + privacy toggles — stub)
- [ ] **NAV-03**: `StatusBar` renders: worker status pip (running/idle from `runtimeAtom.running`); SVGO version; codec version; WASM status; file count + size summary from `$totals`; avg compression + saved bytes from `$totals`
- [ ] **NAV-04**: `CommandPalette` renders as modal overlay — opens on `⌘K`/`Ctrl+K` keyboard shortcut (reads `uiAtom.cmdkOpen`); search input; grouped list from `$cmdFlat`; keyboard navigation (↑↓ moves `cmdkSel`, Enter runs command); footer with key hints; Escape closes

### Files Pane

- [ ] **FILES-01**: `FilesPane` pane header renders "Queue · N files" label (N from `$filteredFiles.length`); Sort icon button opening popover (sort options: queue order/file size/savings%/name/format; filter: all formats/errors only — calls `setSortBy`); Add icon button (calls `pushToast` stub)
- [ ] **FILES-02**: Dropzone renders "Drop images to optimize" + "or click to browse · max 200 files" + format pill row "SVG · PNG · JPEG · WEBP · AVIF · JXL" — always visible above file list
- [ ] **FILES-03**: Each file row renders: format thumbnail badge (type abbrev, colored); file name; `orig → opt` sizes + savings% badge (accent; warns in orange if <30%); progress bar when `status='processing'` + `prog` value; context icon button; status dot (done=green, processing=blue, queued=muted) — row reads from `$filteredFiles`; click calls `selectFile(id)`; selected state from `filesAtom.selectedId`
- [ ] **FILES-04**: File row context menu (right-click on row OR ctxbtn click) renders popover: Re-optimize / Save as… / Copy data URI / Copy `<picture>` / Reveal in compare / Apply same settings to all / Remove from queue (danger) — all actions call `pushToast` stub except Remove which calls `removeFile(id)`; context menu state in `uiAtom.rowMenu`
- [ ] **FILES-05**: Totals bar renders 4 stat cells: Total before / Total after / Saved / Compression % — all values from `$totals`

### Center Pane

- [ ] **CENTER-01**: `CenterPane` renders 3 vertical sections: header / compare stage / delta strip — takes full available height
- [ ] **CENTER-02**: Center header renders breadcrumb (Queue / `file.name` / `{type}→{target}` tag / `file.dim` tag / `q{file.q}` tag omitted when null) + "Optimized" accent pill + zoom dropdown popover (25%/50%/100%/200%/Fit — selection reads/writes `uiAtom.zoom`) — file data from `$selectedFile`
- [ ] **CENTER-03**: Compare stage renders `.image-frame` with CSS `--split` var from `uiAtom.split`; `.layer-orig` + `.layer-opt` placeholder layers; split labels ("ORIGINAL · {orig bytes}" left, "{target.upper} · {opt bytes}" right); draggable `.split-handle` at `left: split%` — drag calls `setSplit(pct)`; file data from `$selectedFile`
- [ ] **CENTER-04**: Delta strip renders 6 metric cards using `$selectedFile` + `settingsAtom`: Original (`file.orig` / `file.dim · file.type`) / Optimized (`file.opt` / `{codec} q{q} m{method}`) / Saved (−bytes accent / % smaller) / SSIM (0.987 stub / "visually identical") / Butteraugli (1.24 stub / "target ≤ 1.40") / Decode (38ms stub / "est. on 4G")

### Inspector Pane

- [ ] **INSP-01**: `InspectorPane` renders pane header ("Inspector" + options popover: Apply to all files / Save as preset / preset list stubs); tab bar showing "Codec" tab when non-SVG file selected OR "SVGO" tab when SVG file selected, plus "Output" and "Report" tabs always visible; tab state in `uiAtom.tab`; tab auto-switches when `$selectedFile.type` changes (svg→'svgo', non-svg+'svgo'→'codec')
- [ ] **INSP-02**: `CodecPanel` "Output format" `Section` renders codec selector buttons (reads `CODECS` from settings store, active from `settingsAtom.codec`, click calls `setCodec`); lossless toggle (hidden for SVG, reads `settingsAtom.lossless`, calls `setLossless`)
- [ ] **INSP-03**: `CodecPanel` "Parameters" `Section` (hidden when codec='SVG') renders: quality `Slider` (0–100, reads `settingsAtom.q`, calls `setQuality`); effort `Slider` (0–6, reads `settingsAtom.method`, calls `setMethod`); PNG palette `Seg` (off/auto/PNG-8, shown when codec='PNG'); AVIF subsample `Seg` (4:2:0/4:4:4, shown when codec='AVIF'); section badge shows codec engine name
- [ ] **INSP-04**: `CodecPanel` "Resize" `Section` renders: "Resize on export" toggle (reads `settingsAtom.resizeOn`, calls `setResizeOn`); when enabled: Width input, Height input (reads/writes `settingsAtom.w/h` via `setResizeDimensions`); Fit `Seg` (reads `FIT_MODES`, writes `setFit`); Algorithm `Seg` (reads `RESIZE_ALGS`, writes `setAlg`)
- [ ] **INSP-05**: `CodecPanel` "Metadata" `Section` renders: "Strip EXIF / XMP / IPTC" toggle (reads `settingsAtom.stripMeta`, calls `setStripMeta`); "Keep ICC profile" toggle (reads `settingsAtom.keepIcc`, calls `setKeepIcc`)
- [ ] **INSP-06**: `SvgoPanel` (shown when `uiAtom.tab='svgo'`) renders: "SVGO preset" `Section` with aggressive mode toggle (reads `settingsAtom.aggressive`, calls `setAggressive`) + info text; "Plugins" `Section` with plugin grid (reads `settingsAtom.plugins`, each item calls `togglePlugin(id)`, shows on/off state + saves %)
- [ ] **INSP-07**: `OutputPanel` (shown when `uiAtom.tab='output'`) renders three `Section` blocks from `$selectedFile`: "Data URI · Base64" with `<img src="…">` label + copy button; "Data URI · URL-encoded" with CSS background label + copy button; "Responsive `<picture>`" with syntax-highlighted HTML snippet + copy button — copy calls `navigator.clipboard.writeText`
- [ ] **INSP-08**: `ReportPanel` (shown when `uiAtom.tab='report'`) renders "Total savings" `Section` with before/after stats grid + per-file bar chart (bar height = savings%, warn color if <30%); "Format breakdown" `Section` with per-format row (type label / file count / bytes saved) — all data from `filesAtom.entries`

## v2 Requirements

### Worker Reconnection

- **WRKR-01**: Connect `filesAtom.entries` to real file upload (drag-drop + file picker)
- **WRKR-02**: Route optimization jobs through `WorkerPool` → jSquash WASM codecs
- **WRKR-03**: `runtimeAtom.running` reflects actual worker pool state
- **WRKR-04**: Per-file `status` and `prog` updated from worker progress events
- **WRKR-05**: ZIP export via jszip + file-saver

### PWA

- **PWA-01**: Service worker + offline support
- **PWA-02**: Install prompt

## Out of Scope

| Feature | Reason |
|---------|--------|
| Worker/store reconnection | Deferred to next milestone — UI-only scope |
| Real file processing | Deferred — stub data only this milestone |
| TargetDensityCheckboxes (1×/2×/3× per row) | Not in example-ui — deferred |
| tweaks-panel.jsx port | Prototype dev tool only — not a production component |
| TDD gate sequence | `tdd_mode: false` in config |
| Server-side rendering | Non-negotiable — client-side only |
| IE/legacy browsers | Non-negotiable |

## Traceability

*Populated by roadmapper.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01..03 | TBD | Pending |
| STORE-01..08, ICON-01 | TBD | Pending |
| SHELL-01..03 | TBD | Pending |
| NAV-01..04 | TBD | Pending |
| FILES-01..05 | TBD | Pending |
| CENTER-01..04 | TBD | Pending |
| INSP-01..08 | TBD | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 36 ⚠️

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after initial definition*
