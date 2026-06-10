---
phase: quick-260610-lby
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - vite.config.ts
  - src/workers/codec.worker.ts
  - src/lib/stub-data.ts
  - src/hooks/useIngest.ts
  - src/hooks/useOptimize.ts
  - src/hooks/useLiveEncode.ts
  - src/components/panels/FilesPane.tsx
  - src/tests/heic.test.ts
autonomous: false
requirements: [QUICK-260610-lby]
user_setup: []

must_haves:
  truths:
    - "A user can drop or pick a .heic / .heif file and it is accepted by the ingest gate (not silently rejected)"
    - "A dropped HEIC file decodes inside codec.worker.ts via heic-decode and re-encodes to a raster target (JPEG default), producing a downloadable optimized buffer"
    - "HEIC is NOT added as an output codec / inspector tab — the Codec union and CODECS list stay 5 entries"
    - "User-facing supported-INPUT-format copy lists HEIC after AVIF; output-codec menus do NOT list HEIC"
  artifacts:
    - path: "src/workers/codec.worker.ts"
      provides: "decodeSource case 'heic'/'heif' that dynamically import('heic-decode') and returns ImageData; sourceFormat union includes 'heic'|'heif'"
      contains: "heic-decode"
    - path: "src/lib/stub-data.ts"
      provides: "codecForType('heic'|'heif') returns 'JPEG' raster default"
      contains: "case 'heic'"
    - path: "src/hooks/useIngest.ts"
      provides: "ACCEPTED_EXTS + ACCEPTED_MIMES + picker accept map include heic/heif"
      contains: "heic"
    - path: "src/tests/heic.test.ts"
      provides: "Node unit test proving gate accepts heic and it routes to a non-null output codec + 'heic' sourceFormat"
      contains: "heic"
  key_links:
    - from: "src/hooks/useOptimize.ts"
      to: "EncodeJob.codec"
      via: "HEIC entry uses its settings.codec (JPEG) as output target, not toCodec(entry.type)"
      pattern: "settings\\.codec|toCodec"
    - from: "src/workers/codec.worker.ts decodeSource"
      to: "heic-decode"
      via: "dynamic import inside case 'heic'"
      pattern: "import\\('heic-decode'\\)"
---

<objective>
Add HEIC/HEIF as a DECODE-ONLY input format. A user drops a `.heic` file, the codec worker decodes it via the `heic-decode` npm library into ImageData, and the existing pipeline re-encodes it to a raster target (PNG/JPEG/AVIF/WebP — JPEG is the seeded default). HEIC is never an output codec: no inspector tab, no entry in the `Codec` union or `CODECS` list, no HEIC encode target.

Purpose: Lets developers convert iPhone/Apple HEIC photos through oimg.app without leaving the browser, closing a common input-format gap.
Output: HEIC end-to-end ingest→decode→encode→export works; supported-input copy mentions HEIC; one Node unit test covers the routing/gate logic.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./ARCH.md

<interfaces>
<!-- Verified from codebase. Use directly — no exploration needed. -->

EncodeJob (src/workers/codec.worker.ts):
  codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'              // OUTPUT target — DO NOT add HEIC
  sourceFormat: 'png'|'jpeg'|'jpg'|'webp'|'avif'|'svg'         // INPUT — ADD 'heic'|'heif'
  buffer: ArrayBuffer
  settings: FileSettings

decodeSource(buffer, sourceFormat): switch with one case per input; each does
  `const { decode } = await import('@jsquash/<fmt>')` INSIDE the branch (PIPE-02 — never hoist).

stub-data.ts:
  type Codec = 'SVG'|'PNG'|'WebP'|'JPEG'|'AVIF'   // DO NOT add HEIC
  CODECS = ['SVG','PNG','WebP','JPEG','AVIF']      // DO NOT add HEIC — drives inspector tabs
  codecForType(type): Codec   // maps INPUT type → natural OUTPUT codec; default returns 'WebP'
  defaultFileSettings(type, q): seeds entry.settings.codec = codecForType(type)

useIngest.ts:
  ACCEPTED_EXTS = Set(['png','jpg','jpeg','webp','svg','avif'])
  ACCEPTED_MIMES = Set(['image/png','image/jpeg','image/webp','image/svg+xml','image/avif'])
  fileToEntry: ext 'jpg'→type 'jpeg'; readDimensions try/catches createImageBitmap (HEIC will throw → '—', acceptable)
  showOpenFilePicker types.accept map (per-MIME → ext globs)

useOptimize.ts AND useLiveEncode.ts: both have toCodec(type) + toSourceFormat(type).
  Currently toCodec('heic') would return null → file SKIPPED. Must route HEIC to its OUTPUT codec.

vite.config.ts: worker.format='es'; assetsInclude ['**/*.wasm']; optimizeDeps.exclude lists @jsquash/* (WASM URL resolution). heic-decode wraps libheif-js (WASM/asm.js) — likely needs the same exclude treatment.

FilesPane.tsx:130 dropzone copy: `SVG · PNG · JPEG · WEBP · AVIF · JXL`
FilesPane.tsx:23 ACCEPT string (input accept attr).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install heic-decode + wire worker decode + output-codec routing</name>
  <files>package.json, vite.config.ts, src/workers/codec.worker.ts, src/lib/stub-data.ts, src/hooks/useOptimize.ts, src/hooks/useLiveEncode.ts</files>
  <action>
1. Run `npm install heic-decode` (adds heic-decode + its libheif-js dep). This is an explicit install step — do not skip.

2. `src/workers/codec.worker.ts`:
   - Widen `EncodeJob.sourceFormat` union to add `'heic' | 'heif'`.
   - In `decodeSource`, add a `case 'heic':` (fall-through) `case 'heif': {` branch BEFORE `default:`. Inside the branch, dynamically `const heicDecode = (await import('heic-decode')).default` (default export is `async ({ buffer }) => ({ width, height, data })` where `data` is RGBA bytes). Pass the raw `buffer` (ArrayBuffer). Construct and return `new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height)`. Confirm the exact import subpath that resolves in-browser — if bare `'heic-decode'` does not bundle, try the package's documented ESM entry; document the working path in a comment.
   - Wrap the heic decode in try/catch that rethrows a descriptive Error (mirror the AVIF Safari try/catch at the existing `case 'AVIF'`) so a libheif init failure becomes a per-file error → useOptimize/useLiveEncode convert to setFileError + toast, never crashing the worker. NOTE: KNOWN_CODECS validation is on the OUTPUT codec only — HEIC never reaches it as an output, so leave KNOWN_CODECS unchanged.

3. `vite.config.ts`: add `'heic-decode'` (and `'libheif-js'` if it surfaces as a separately-resolved WASM/asm.js module) to `optimizeDeps.exclude`, matching the @jsquash/* treatment, so the worker can dynamically import it without esbuild flattening its WASM/asm.js URL resolution. If a build/dev import error appears instead, prefer `optimizeDeps.include` — test which works and comment the choice.

4. `src/lib/stub-data.ts`: in `codecForType`, add `case 'heic': case 'heif':` returning `'JPEG'` (documented default raster output for HEIC — chosen over WebP for universal compatibility of converted photos). Do NOT touch the `Codec` type or `CODECS` array. This makes `defaultFileSettings('heic', q).codec === 'JPEG'`, so a freshly-ingested HEIC entry already targets a real output codec.

5. `src/hooks/useOptimize.ts` AND `src/hooks/useLiveEncode.ts` (apply the SAME change to both — they are analogs):
   - `toSourceFormat`: add `case 'heic': return 'heic'` and `case 'heif': return 'heif'`.
   - `toCodec`: HEIC has no HEIC output. Instead of returning null (which SKIPS the file), route HEIC entries to their chosen output codec. Change the dispatch so the `EncodeJob.codec` for a HEIC entry comes from `entry.settings.codec` (already seeded to 'JPEG' by codecForType) rather than `toCodec(entry.type)`. Concretely: where `const codec = toCodec(entry.type)` is computed, fall back to the entry's settings codec for input-only formats — e.g. `const codec = toCodec(entry.type) ?? (entry.settings?.codec ?? null)`. Keep the existing `if (codec === null) continue/return` guard so genuinely unsupported types still skip. Verify the resulting EncodeJob.codec is one of PNG/WebP/JPEG/AVIF for a HEIC entry. In useLiveEncode apply the identical `?? entry.settings?.codec` fallback in its `toCodec` usage.
  </action>
  <verify>
    <automated>npm run -s typecheck 2>&1 | tail -5 || npx tsc -b 2>&1 | tail -5</automated>
  </verify>
  <done>heic-decode in package.json deps; codec.worker.ts decodeSource has heic/heif case importing heic-decode and returning ImageData with descriptive-error try/catch; sourceFormat union widened; codecForType maps heic/heif→JPEG; both hooks' toSourceFormat return heic/heif and toCodec falls back to entry.settings.codec for HEIC; typecheck (tsc -b) shows no NEW errors vs baseline.</done>
</task>

<task type="auto">
  <name>Task 2: Open the ingest gate + supported-input copy + unit test</name>
  <files>src/hooks/useIngest.ts, src/components/panels/FilesPane.tsx, src/tests/heic.test.ts</files>
  <action>
1. `src/hooks/useIngest.ts`:
   - `ACCEPTED_EXTS`: add `'heic'`, `'heif'`.
   - `ACCEPTED_MIMES`: add `'image/heic'`, `'image/heif'`.
   - In `fileToEntry`, the `type` normalization currently maps `jpg→jpeg`. Leave `heic`/`heif` as-is (type stays `'heic'` / `'heif'`) so codecForType / toSourceFormat / decodeSource all key off it consistently. (ACCEPT_ATTR is derived from the gate sets, so it updates automatically.) `readDimensions` already try/catches `createImageBitmap` — HEIC throws and falls back to `'—'`; do NOT special-case it.
   - In `openPicker`'s `showOpenFilePicker` `types[0].accept` map, add `'image/heic': ['.heic'], 'image/heif': ['.heif']`.

2. `src/components/panels/FilesPane.tsx`:
   - Line 23 `ACCEPT` string: add `.heic,.heif,image/heic,image/heif` (input accept attr).
   - Line ~130 dropzone copy `SVG · PNG · JPEG · WEBP · AVIF · JXL`: insert `HEIC` AFTER `AVIF` → `SVG · PNG · JPEG · WEBP · AVIF · HEIC · JXL`. This is supported-INPUT copy. Do NOT add HEIC to any output-codec menu (TitleBar codec MenuItems, CodecPanel) — those are encode targets.
   - grep `src` + `index.html` for any other supported-INPUT-format copy strings; add HEIC after AVIF there too if found. Do NOT modify output-codec lists.

3. Create `src/tests/heic.test.ts` (Node unit test, mirror the structure of src/tests/stub-data.test.ts — top-of-file `// Quick 260610-lby` attribution comment, `assert` helper, `process.exit(failed>0?1:0)`). Test ROUTING/GATE logic only — do NOT decode real WASM (keeps it fast/deterministic):
   - `import('../hooks/useIngest.ts')` → assert `isAccepted({ name: 'photo.heic', type: '' } as File)` is true and `isAccepted({ name: 'photo.heif', type: '' } as File)` is true.
   - `import('../lib/stub-data.ts')` → assert `defaultFileSettings('heic', null).codec === 'JPEG'` (HEIC routes to a real raster output, never null/HEIC).
   - assert `CODECS.length === 5` and `!CODECS.includes('HEIC')` (no inspector output tab added).
   Use a Wave-0 stub-state try/catch like the sibling tests so a missing module is tolerated.
  </action>
  <verify>
    <automated>node --experimental-strip-types src/tests/heic.test.ts 2>&1 | tail -3</automated>
  </verify>
  <done>Gate accepts .heic/.heif (ext + MIME); picker accept map includes HEIC; dropzone copy shows HEIC after AVIF; no output-codec menu lists HEIC; src/tests/heic.test.ts prints "N passed, 0 failed" and exits 0.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>HEIC decode-only input support: ingest gate + picker accept HEIC/HEIF, codec.worker.ts decodes via heic-decode, HEIC files seed a JPEG output target and run the full encode→export pipeline. Supported-input copy lists HEIC after AVIF.</what-built>
  <how-to-verify>
    1. `npm run dev`, open the app.
    2. Confirm the dropzone subtitle reads `SVG · PNG · JPEG · WEBP · AVIF · HEIC · JXL`.
    3. Drop a REAL `.heic` photo (e.g. an iPhone export). Expected: it is accepted (appears in the file list), status goes processing → done, and an optimized JPEG-sized result shows (orig vs opt bytes). Dimensions may show `—` (createImageBitmap can't read HEIC — acceptable).
    4. Export / download the file and confirm you get a valid JPEG that opens.
    5. Open the inspector for the HEIC file — confirm there is NO "HEIC" output-codec tab; the output codec defaults to JPEG (switchable to PNG/WebP/AVIF).
    6. If libheif fails to init in your browser, confirm you get a per-file error toast (not a frozen/crashed app).
  </how-to-verify>
  <resume-signal>Type "approved" or describe the HEIC behavior you observed (accepted? decoded? exported? any error).</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc -b` shows no NEW type errors (baseline tsc has pre-existing debt — compare, don't expect clean).
- `node --experimental-strip-types src/tests/heic.test.ts` passes.
- Existing `src/tests/ingest.spec.ts` and `src/tests/stub-data.test.ts` still pass (HEIC is additive; CODECS stays 5).
- Manual: real .heic drops → decodes → exports as JPEG (checkpoint).
</verification>

<success_criteria>
- A `.heic`/`.heif` file is accepted by ingest and end-to-end produces a downloadable optimized raster file (JPEG default).
- HEIC decode happens inside codec.worker.ts via a dynamic `import('heic-decode')` in a switch branch (PIPE-02 discipline preserved).
- The `Codec` union and `CODECS` array are unchanged (5 entries) — no HEIC inspector tab / encode target.
- HEIC appears after AVIF only in supported-INPUT copy, nowhere in output-codec menus.
</success_criteria>

<output>
Create `.planning/quick/260610-lby-add-heic-extension-support-via-heic-deco/260610-lby-SUMMARY.md` when done.
</output>
