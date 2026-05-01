---
phase: 03-svg-pipeline
plan: C
type: execute
wave: 3
depends_on: [03-A]
files_modified:
  - src/lib/snippet-registry.ts
  - src/lib/svg-snippets.ts
  - src/components/panels/SnippetPanel.tsx
  - src/App.tsx
autonomous: true
requirements:
  - SNIP-01
  - SNIP-03
  - SNIP-04

must_haves:
  truths:
    - "SnippetPanel replaces OutputPanel; OutputPanel.tsx is deleted"
    - "SNIPPET_REGISTRY is a plain Record — no switch(format) in SnippetPanel render"
    - "Inline SVG section renders optimized+sanitized SVG markup verbatim (max-height: 200px, scrollable)"
    - "Data URI section renders url(\"data:image/svg+xml,${yokselEncoded}\") (max-height: 140px)"
    - "Per-snippet checkboxes collapse section body when unchecked (D-13); state in useSettingsStore.snippetTogglesByFileId"
    - "WR-04 clipboard copy pattern preserved verbatim: await writeText → copied 1100ms → reset; sonner error on failure"
    - "URL-encoded output: '<' → '%3C', '>' → '%3E', '#' → '%23', '\"' → single-quote; spaces and UTF-8 untouched"
    - "Raster snippet stubs (picture, img-srcset, data-uri-base64) render NOTHING for SVG files (applicableFormats excludes svg)"
  artifacts:
    - path: "src/lib/snippet-registry.ts"
      provides: "SNIPPET_REGISTRY: Record<SnippetId, SnippetDef> with 5 entries (2 SVG + 3 raster stubs)"
      exports: ["SNIPPET_REGISTRY", "SnippetDef", "SnippetId"]
    - path: "src/lib/svg-snippets.ts"
      provides: "encodeSvgForDataUri() (yoksel) + ensureNamespace()"
      exports: ["encodeSvgForDataUri", "ensureNamespace", "generateInlineSvg", "generateDataUri"]
    - path: "src/components/panels/SnippetPanel.tsx"
      provides: "Generic snippet panel; replaces OutputPanel"
      exports: ["SnippetPanel"]
  key_links:
    - from: "src/components/panels/SnippetPanel.tsx"
      to: "src/lib/snippet-registry.ts"
      via: "Object.values(SNIPPET_REGISTRY).filter(def => def.applicableFormats.includes(file.format))"
      pattern: "SNIPPET_REGISTRY"
    - from: "src/lib/svg-snippets.ts"
      to: "inspired/url-encoder/src/js/script.js"
      via: "verbatim symbols regex + encode algorithm (D-15)"
      pattern: "encodeURIComponent"
    - from: "src/App.tsx"
      to: "src/components/panels/SnippetPanel.tsx"
      via: "tab === 'output' renders SnippetPanel instead of OutputPanel"
      pattern: "SnippetPanel"
---

<objective>
Build the snippet infrastructure: snippet-registry.ts (plain Record), svg-snippets.ts (yoksel URL-encoder verbatim), and SnippetPanel.tsx (registry-driven, replaces OutputPanel). Implement D-12 per-snippet checkboxes and D-15 URL-encoding. Delete OutputPanel.tsx.

Purpose: Closes SNIP-01 (per-file snippet panel), SNIP-03 (one-click copy), SNIP-04 (URL-encoded data URI). Establishes the registry pattern that Phase 5/6 raster generators plug into without touching SnippetPanel.
Output: SnippetPanel live for SVG files with inline-svg and url-encoded-uri snippets. Clipboard copy works. Registry shape locked for Phase 5/6 extension.
</objective>

<execution_context>
@/Users/jilizart/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jilizart/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-svg-pipeline/03-CONTEXT.md
@.planning/phases/03-svg-pipeline/03-RESEARCH.md
@.planning/phases/03-svg-pipeline/03-PATTERNS.md
@.planning/phases/03-svg-pipeline/03-UI-SPEC.md
@.planning/phases/03-svg-pipeline/03-A-SUMMARY.md

<interfaces>
<!-- Key contracts and patterns the executor must match exactly. -->

From inspired/url-encoder/src/js/script.js (verbatim — D-15):
```javascript
// Line 15: symbols regex
const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g

// Lines 134-148: encodeSVG function (double-quote branch)
function encodeSVG(data) {
  data = data.replace(/"/g, "'")           // " → '
  data = data.replace(/>\s{1,}</g, '><')   // collapse whitespace
  data = data.replace(/\s{2,}/g, ' ')
  return data.replace(symbols, encodeURIComponent)
}
```

From src/components/panels/OutputPanel.tsx (WR-04 pattern — copy verbatim):
```typescript
// Clipboard copy pattern (lines 17-33):
type CopyKey = string | null
const [copied, setCopied] = useState<CopyKey>(null)
const copy = async (key: string, text: string) => {
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard unavailable')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100)
  } catch {
    toast.error('Copy failed')
  }
}
// Section + code-row pattern (lines 56-75):
// <Section title="..."> <div className="code-row"> <span className="lbl"> <button className="copy-btn"> ... </div> <pre className="code">
```

From src/types/index.ts (Plan A extensions):
```typescript
export type SnippetId = 'inline-svg' | 'url-encoded-uri' | 'picture' | 'img-srcset' | 'data-uri-base64'
export type FormatId = 'svg' | 'png' | 'jpeg' | 'webp' | 'avif'
export interface FileEntry {
  optimizedBlob: Blob | null
  format: FormatId
  status: FileStatus
  // ...
}
```

From src/stores/settings.ts (Plan B extension):
```typescript
snippetTogglesByFileId: Record<string, Record<string, boolean>>
setSnippetToggle: (fileId: string, snippetId: string, value: boolean) => void
```

SnippetPanel sections per UI-SPEC.md (SVG file, verbatim copy):
- Section 1: title="Inline SVG", badge="inline" (acc), code-row label="<svg>", max-height 200px
- Section 2: title="Data URI · URL-encoded", badge="data-uri" (acc), code-row label="CSS background", max-height 140px

Empty / no-data state (UI-SPEC.md §SnippetPanel):
- Status queued/processing: `<pre>` reads `// Run Optimize to generate snippet` in var(--fg-3), italic; copy button disabled
- Status error: `// Snippet unavailable — see Report tab`; copy button disabled
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: svg-snippets.ts (yoksel encoder) + snippet-registry.ts (registry with 5 entries)</name>
  <files>
    src/lib/svg-snippets.ts
    src/lib/snippet-registry.ts
  </files>
  <action>
**Read first:**
- `inspired/url-encoder/src/js/script.js` lines 1-30 and 130-160 — verbatim symbols regex and encodeSVG function
- `src/lib/sanitize-svg.ts` (Plan A) — understand the sanitized string shape that generators receive
- `src/types/index.ts` — FormatId, SnippetId, FileEntry shape

**Create src/lib/svg-snippets.ts:**

```typescript
/**
 * SVG snippet generators — Phase 3
 * Source: 03-RESEARCH.md §Pattern 3 (yoksel URL-encoder, D-15)
 * D-15: Mirror yoksel's minimal-escape strategy verbatim.
 * inspired/url-encoder/src/js/script.js lines 15 + 134-148
 */

// The symbols regex from yoksel (line 15 verbatim) — ONLY these characters are percent-encoded
const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g

/**
 * Ensures the SVG has an xmlns declaration (SVGO may strip it).
 * yoksel's addNameSpace() equivalent.
 */
export function ensureNamespace(svg: string): string {
  if (!svg.includes('http://www.w3.org/2000/svg')) {
    return svg.replace(/<svg/, "<svg xmlns='http://www.w3.org/2000/svg'")
  }
  return svg
}

/**
 * URL-encodes an SVG string for use in CSS data URI.
 * Implements yoksel's minimal-escape: only encode characters that break URL/CSS contexts.
 * Full percent-encoding (encodeURIComponent on entire string) doubles the output size.
 *
 * D-15: " → ', whitespace collapsed, only symbols regex chars percent-encoded.
 * Spaces and UTF-8 characters (e.g. ★) are left as-is.
 */
export function encodeSvgForDataUri(svgString: string): string {
  let data = svgString.replace(/"/g, "'")          // " → ' (avoids encoding in CSS url("..."))
  data = data.replace(/>\s{1,}</g, '><')            // collapse whitespace between tags
  data = data.replace(/\s{2,}/g, ' ')               // collapse runs of whitespace
  return data.replace(symbols, encodeURIComponent)  // encode only the problematic chars
}

/**
 * Generates the inline SVG snippet (Section 1 of SnippetPanel).
 * Returns the sanitized SVG markup verbatim.
 * D-14: ID-collision handling deferred to Phase 6.
 */
export function generateInlineSvg(svgText: string): string {
  return ensureNamespace(svgText)
}

/**
 * Generates the CSS background-image data URI snippet (Section 2 of SnippetPanel).
 * Output: url("data:image/svg+xml,${encoded}")
 * D-15: yoksel minimal-escape encoding.
 */
export function generateDataUri(svgText: string): string {
  const withNamespace = ensureNamespace(svgText)
  const encoded = encodeSvgForDataUri(withNamespace)
  return `url("data:image/svg+xml,${encoded}")`
}
```

**Create src/lib/snippet-registry.ts:**

```typescript
/**
 * Snippet registry — Phase 3
 * Source: 03-RESEARCH.md §Pattern 4 (Registry design, D-12)
 *
 * CRITICAL: SnippetPanel MUST use this registry's applicableFormats filter.
 * NEVER add switch(file.format) branches to SnippetPanel — add entries here instead.
 * Phase 5/6 plugs in raster generators by adding entries, NOT by touching SnippetPanel.
 */
import type { FormatId, SnippetId } from '../types/index'
import { generateInlineSvg, generateDataUri } from './svg-snippets'

export interface SnippetDef {
  id: SnippetId
  label: string             // Section title: "Inline SVG", "Data URI · URL-encoded"
  badge: string             // Section badge: "inline", "data-uri"
  codeLabel: string         // code-row .lbl text: "<svg>", "CSS background"
  applicableFormats: FormatId[]
  generate: (svgText: string | null) => string | null  // null = no data or not applicable
}

export const SNIPPET_REGISTRY: Record<SnippetId, SnippetDef> = {
  'inline-svg': {
    id: 'inline-svg',
    label: 'Inline SVG',
    badge: 'inline',
    codeLabel: '<svg>',
    applicableFormats: ['svg'],
    generate: (svgText) => svgText ? generateInlineSvg(svgText) : null,
  },
  'url-encoded-uri': {
    id: 'url-encoded-uri',
    label: 'Data URI · URL-encoded',
    badge: 'data-uri',
    codeLabel: 'CSS background',
    applicableFormats: ['svg'],
    generate: (svgText) => svgText ? generateDataUri(svgText) : null,
  },
  // Phase 5/6 stubs — render nothing for SVG files (applicableFormats excludes 'svg')
  'picture': {
    id: 'picture',
    label: 'Picture',
    badge: 'picture',
    codeLabel: '<picture>',
    applicableFormats: ['png', 'jpeg', 'webp', 'avif'],
    generate: () => null,  // Phase 5/6 implements
  },
  'img-srcset': {
    id: 'img-srcset',
    label: 'Image srcset',
    badge: 'img',
    codeLabel: '<img srcset>',
    applicableFormats: ['png', 'jpeg', 'webp', 'avif'],
    generate: () => null,  // Phase 5/6 implements
  },
  'data-uri-base64': {
    id: 'data-uri-base64',
    label: 'Data URI · Base64',
    badge: 'base64',
    codeLabel: 'CSS background',
    applicableFormats: ['png', 'jpeg', 'webp', 'avif'],
    generate: () => null,  // Phase 5/6 implements
  },
}
```
  </action>
  <verify>
    <automated>
      node --experimental-strip-types src/tests/svg-snippets.unit.ts &amp;&amp;
      grep -c "const symbols" src/lib/svg-snippets.ts &amp;&amp;
      grep -c "applicableFormats" src/lib/snippet-registry.ts &amp;&amp;
      npx tsc --noEmit
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep "const symbols = /\[\\\\r\\\\n%#" src/lib/svg-snippets.ts` matches (verbatim yoksel regex)
    - `encodeSvgForDataUri('<svg>')` returns `'%3Csvg%3E'` (verified by unit test)
    - `encodeSvgForDataUri('fill="#f00"')` returns `"fill='%23f00'"` (`"` → `'`, `#` → `%23`)
    - UTF-8 star `★` is unchanged (verified by unit test)
    - `SNIPPET_REGISTRY` has exactly 5 entries: inline-svg, url-encoded-uri, picture, img-srcset, data-uri-base64
    - `picture`, `img-srcset`, `data-uri-base64` have `applicableFormats` NOT including `'svg'`
    - `grep "switch" src/lib/snippet-registry.ts` returns NO match
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>svg-snippets.ts with yoksel encoder. snippet-registry.ts with 5 entries (2 SVG live + 3 raster stubs). Unit test stubs updated to actual assertions.</done>
</task>

<task type="auto">
  <name>Task 2: SnippetPanel.tsx (replaces OutputPanel) + App.tsx wiring + OutputPanel.tsx deletion</name>
  <files>
    src/components/panels/SnippetPanel.tsx
    src/App.tsx
  </files>
  <action>
**Read first:**
- `src/components/panels/OutputPanel.tsx` — FULL file; copy WR-04 clipboard pattern verbatim (lines 17-33); copy Section+code-row pattern (lines 56-75); note import paths
- `src/App.tsx` — find OutputPanel import and mount point (tab === 'output'); find selectedFile access pattern
- `src/components/ui/Section.tsx` — Section props (title, badge)
- `src/stores/settings.ts` — snippetTogglesByFileId + setSnippetToggle access pattern (Plan B)
- `src/stores/files.ts` — selectedId + byId access pattern

**Create src/components/panels/SnippetPanel.tsx:**

```tsx
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/ui/Section'
import { Icons } from '@/components/icons'
import { SNIPPET_REGISTRY } from '@/lib/snippet-registry'
import { useSettingsStore } from '@/stores/settings'
import type { FileEntry } from '@/types/index'

interface SnippetPanelProps {
  file: FileEntry | null
}

type CopyKey = string | null

export function SnippetPanel({ file }: SnippetPanelProps) {
  const [copied, setCopied] = useState<CopyKey>(null)
  const [svgText, setSvgText] = useState<string | null>(null)

  const snippetToggles = useSettingsStore(s =>
    file ? (s.snippetTogglesByFileId[file.id] ?? {}) : {}
  )
  const setSnippetToggle = useSettingsStore(s => s.setSnippetToggle)

  // Read blob as text when selected file or its optimizedBlob changes
  useEffect(() => {
    if (!file || !file.optimizedBlob || file.status !== 'done') {
      setSvgText(null)
      return
    }
    let cancelled = false
    file.optimizedBlob.text().then(text => {
      if (!cancelled) setSvgText(text)
    })
    return () => { cancelled = true }
  }, [file?.id, file?.optimizedBlob, file?.status])

  // WR-04 clipboard copy pattern — verbatim from OutputPanel.tsx
  const copy = async (key: string, text: string) => {
    if (!navigator.clipboard?.writeText) {
      toast.error('Clipboard unavailable')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100)
    } catch {
      toast.error('Copy failed')
    }
  }

  if (!file) return null

  // Filter by format using registry — NEVER switch(file.format)
  const visibleSnippets = Object.values(SNIPPET_REGISTRY)
    .filter(def => def.applicableFormats.includes(file.format))

  if (visibleSnippets.length === 0) return null

  return (
    <>
      {visibleSnippets.map(def => {
        const isEnabled = snippetToggles[def.id] ?? true
        const snippetText = def.generate(svgText)

        // Determine snippet body content based on file status
        let codeContent: string
        let copyDisabled = false
        if (!isEnabled) {
          codeContent = ''  // collapsed section
        } else if (file.status === 'queued' || file.status === 'processing') {
          codeContent = '// Run Optimize to generate snippet'
          copyDisabled = true
        } else if (file.status === 'error') {
          codeContent = '// Snippet unavailable — see Report tab'
          copyDisabled = true
        } else {
          codeContent = snippetText ?? '// Run Optimize to generate snippet'
          copyDisabled = !snippetText
        }

        return (
          <Section
            key={def.id}
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={e => setSnippetToggle(file.id, def.id, e.target.checked)}
                  aria-label={`${def.label} snippet enabled`}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', marginRight: 2 }}
                />
                {def.label}
              </span>
            }
            badge={{ text: def.badge, acc: true }}
          >
            {!isEnabled ? (
              <p style={{ fontSize: '11.5px', color: 'var(--fg-3)', padding: '6px 0' }}>
                Disabled. Enable above to include in copy-all output.
              </p>
            ) : (
              <>
                <div className="code-row">
                  <span className="lbl">{def.codeLabel}</span>
                  <button
                    className={'copy-btn ' + (copied === def.id ? 'ok' : '')}
                    onClick={() => !copyDisabled && copy(def.id, codeContent)}
                    disabled={copyDisabled}
                    style={copyDisabled ? { opacity: 0.5, cursor: 'default' } : undefined}
                    aria-label={`Copy ${def.label} snippet`}
                  >
                    {copied === def.id
                      ? <><Icons.Check size={11} /> copied</>
                      : <><Icons.Copy size={11} /> copy</>
                    }
                  </button>
                </div>
                <pre
                  className="code"
                  style={{
                    maxHeight: def.id === 'inline-svg' ? 200 : 140,
                    overflowY: 'auto',
                    fontStyle: copyDisabled ? 'italic' : 'normal',
                    color: copyDisabled ? 'var(--fg-3)' : undefined,
                  }}
                >
                  {codeContent}
                </pre>
              </>
            )}
          </Section>
        )
      })}
    </>
  )
}
```

**Wire in App.tsx:**

1. Add import: `import { SnippetPanel } from '@/components/panels/SnippetPanel'`
2. Remove import: `import { OutputPanel } from '@/components/panels/OutputPanel'`
3. Find the `tab === 'output'` render location. Replace `<OutputPanel ... />` with:
   ```tsx
   <SnippetPanel file={selectedFile ?? null} />
   ```
   Where `selectedFile` is the currently selected FileEntry from `useFilesStore` (or however App.tsx accesses it).

**Delete OutputPanel.tsx:**
```bash
rm src/components/panels/OutputPanel.tsx
```

**Update svg-snippets unit test** (src/tests/svg-snippets.unit.ts — Task 1 shipped a stub):

Replace the stub with actual assertions:
```typescript
// Unit tests for encodeSvgForDataUri and generateDataUri (yoksel, D-15)
// Run: node --experimental-strip-types src/tests/svg-snippets.unit.ts

import { encodeSvgForDataUri, ensureNamespace, generateDataUri } from '../lib/svg-snippets.js'

let passed = 0; let failed = 0
function assert(desc: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`  PASS: ${desc}`)
    passed++
  } else {
    console.error(`  FAIL: ${desc}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

// yoksel test cases from RESEARCH.md §Pattern 3
assert('<svg> encodes < and >', encodeSvgForDataUri('<svg>'), '%3Csvg%3E')
assert('fill="#f00" — " → \', # → %23', encodeSvgForDataUri('fill="#f00"'), "fill='%23f00'")
assert('xmlns=... — colon left alone', encodeSvgForDataUri('xmlns="http://www.w3.org/2000/svg"'), "xmlns='http://www.w3.org/2000/svg'")
assert('UTF-8 star left unchanged', encodeSvgForDataUri('★'), '★')
assert('newline encoded', encodeSvgForDataUri('\n'), '%0A')

// generateDataUri wraps in url(...)
const uri = generateDataUri('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>')
assert('generateDataUri starts with url("data:image/svg+xml,', uri.startsWith('url("data:image/svg+xml,'), true)
assert('generateDataUri ends with ")', uri.endsWith('")'), true)
assert('generateDataUri: no unencoded <', !uri.includes('<'), true)
assert('generateDataUri: no unencoded "  (only outer url quotes)', uri.split('url("data:image/svg+xml,')[1].split('")')[0].includes('"'), false)

// ensureNamespace
assert('ensureNamespace: adds xmlns when missing', ensureNamespace('<svg>').includes('http://www.w3.org/2000/svg'), true)
assert('ensureNamespace: no-op when xmlns present', ensureNamespace('<svg xmlns="http://www.w3.org/2000/svg">'), '<svg xmlns="http://www.w3.org/2000/svg">')

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```
  </action>
  <verify>
    <automated>
      test ! -f src/components/panels/OutputPanel.tsx &amp;&amp;
      test -f src/components/panels/SnippetPanel.tsx &amp;&amp;
      grep -c "SNIPPET_REGISTRY" src/components/panels/SnippetPanel.tsx &amp;&amp;
      grep -v '^[[:space:]]*//' src/components/panels/SnippetPanel.tsx | grep -c "switch.*format" | grep -q "^0$" &amp;&amp;
      grep -c "SnippetPanel" src/App.tsx &amp;&amp;
      grep -v '^[[:space:]]*//' src/App.tsx | grep -c "OutputPanel" | grep -q "^0$" &amp;&amp;
      node --experimental-strip-types src/tests/svg-snippets.unit.ts &amp;&amp;
      npx tsc --noEmit
    </automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/panels/OutputPanel.tsx` returns non-zero (file deleted)
    - `test -f src/components/panels/SnippetPanel.tsx` returns 0 (file exists)
    - `grep "SNIPPET_REGISTRY" src/components/panels/SnippetPanel.tsx` returns a match
    - `grep "switch.*format" src/components/panels/SnippetPanel.tsx` returns NO match (registry filter used)
    - `grep "SnippetPanel" src/App.tsx` returns a match (mounted)
    - `grep "OutputPanel" src/App.tsx` returns NO match (removed)
    - `node --experimental-strip-types src/tests/svg-snippets.unit.ts` exits 0 (all yoksel cases pass)
    - Copy button uses WR-04 pattern: `await navigator.clipboard.writeText(...)` before `setCopied`
    - Per-snippet checkbox state reads from `useSettingsStore.snippetTogglesByFileId`
    - `npx tsc --noEmit` exits 0
    - `npx playwright test src/tests/svg-pipeline.spec.ts -g "SNIP-01"` completes (stub or live)
  </acceptance_criteria>
  <done>SnippetPanel live for SVG files. Registry-driven render (no format switch). Two SVG sections visible. Per-snippet checkboxes work. WR-04 clipboard pattern. OutputPanel deleted. Unit test green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| sanitized blob → snippet generator | Snippet text derives from the sanitized blob written by markDone (D-04 source of truth) |
| snippet text → clipboard | User-facing output; must not contain executable script tags from unsanitized content |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-V5-07 | Tampering | `src/components/panels/SnippetPanel.tsx` + `src/lib/svg-snippets.ts` | mitigate | Snippet generators receive `svgText` decoded from `file.optimizedBlob` — which is the sanitized blob written by `markDone` after `sanitizeSvg()` runs (D-04). No separate sanitization step in SnippetPanel is needed — the blob is the single source of truth. Verified by `svg-xss.spec.ts -g "snippet output"` asserting no `<script>` / `on*` / `javascript:` in generated snippets. |
</threat_model>

<verification>
```bash
# After Task 1:
node --experimental-strip-types src/tests/svg-snippets.unit.ts
grep "const symbols" src/lib/svg-snippets.ts
grep -c "applicableFormats" src/lib/snippet-registry.ts

# After Task 2:
test ! -f src/components/panels/OutputPanel.tsx
node --experimental-strip-types src/tests/svg-snippets.unit.ts
npx tsc --noEmit
npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts
```
</verification>

<success_criteria>
- `test ! -f src/components/panels/OutputPanel.tsx` exits 0 (deleted)
- SnippetPanel renders "Inline SVG" and "Data URI · URL-encoded" sections for any SVG file with `status: done`
- Unchecking a snippet checkbox collapses section body to the "Disabled" message
- Copy button writes snippet text to clipboard; button shows "copied" for 1100ms then resets
- `node --experimental-strip-types src/tests/svg-snippets.unit.ts` exits 0 (all 10 yoksel cases pass)
- URL-encoded output contains no unencoded `<`, `>`, `#`, or `"` characters
- `npx tsc --noEmit` exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/03-svg-pipeline/03-C-SUMMARY.md`
</output>
