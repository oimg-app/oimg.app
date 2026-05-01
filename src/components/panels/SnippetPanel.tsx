// Phase 3 plan 03-C — Generic snippet panel; replaces OutputPanel.
//
// CRITICAL contract (D-12): Render derives from SNIPPET_REGISTRY's
// applicableFormats filter. NEVER add switch(file.format) branches here —
// Phase 5/6 plugs in raster generators by adding registry entries instead.
//
// Source: 03-RESEARCH.md §Pattern 4 (registry-driven render)
//         03-UI-SPEC.md §SnippetPanel (Section/code-row layout)
//         WR-04 clipboard pattern (await writeText → copied 1100ms → reset)

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/ui/Section'
import { Icons } from '@/components/icons'
import { SNIPPET_REGISTRY } from '@/lib/snippet-registry'
import { useSettingsStore } from '@/stores/settings'
import type { FileEntryWithBlob } from '@/stores/files'

interface SnippetPanelProps {
  file: FileEntryWithBlob | null
}

type CopyKey = string | null

// Stable empty map used as the fallback when the selected file has no
// per-snippet toggle overrides yet — see the Rule 1 fix below.
const EMPTY_TOGGLES: Record<string, boolean> = {}

export function SnippetPanel({ file }: SnippetPanelProps) {
  const [copied, setCopied] = useState<CopyKey>(null)
  const [svgText, setSvgText] = useState<string | null>(null)
  // WR-04: track the copy-feedback reset timer so a quick file switch
  // (which unmounts/remounts SnippetPanel under a different file?.id)
  // does not leave a dangling setTimeout that fires after unmount.
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    },
    [],
  )

  // Plan 03-D fix (Rule 1) — selector previously returned a fresh `{}` literal
  // on each render whenever the file had no toggles persisted yet, which
  // tripped React 19's getSnapshot caching guard ("The result of getSnapshot
  // should be cached to avoid an infinite loop") and crashed the panel with
  // "Maximum update depth exceeded" the moment the SVG pipeline E2E specs
  // selected the SnippetPanel tab. Hoist the selector to the parent record
  // (a stable reference between renders) and derive the file-specific entry
  // outside zustand so the selector cache is valid.
  const togglesByFile = useSettingsStore((s) => s.snippetTogglesByFileId)
  const snippetToggles = file ? (togglesByFile[file.id] ?? EMPTY_TOGGLES) : EMPTY_TOGGLES
  const setSnippetToggle = useSettingsStore((s) => s.setSnippetToggle)

  // Read the optimizedBlob as text when the selected file or its blob changes.
  // Per Plan A (D-04), optimizedBlob is the sanitized blob — single source of
  // truth for snippet generation. Threat T-V5-07 mitigation: SnippetPanel does
  // NOT re-sanitize; it consumes the already-clean blob.
  useEffect(() => {
    if (!file || !file.optimizedBlob || file.status !== 'done') {
      setSvgText(null)
      return
    }
    let cancelled = false
    file.optimizedBlob.text().then(
      (text) => {
        if (!cancelled) setSvgText(text)
      },
      // WR-03: Blob.text() can reject (e.g. detached source from a
      // transferred ArrayBuffer in some browser builds, or AbortError on
      // platforms that support cancellation). Surface to the console for
      // dev visibility and clear svgText so the panel falls back to its
      // "Run Optimize to generate snippet" empty state instead of staying
      // permanently null with no diagnostic trail.
      (err) => {
        if (cancelled) return
        console.error('[SnippetPanel] blob.text failed:', err)
        setSvgText(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [file?.id, file?.optimizedBlob, file?.status])

  // WR-04 clipboard copy pattern — verbatim from former OutputPanel.tsx.
  // Do NOT flip to "copied" until the clipboard write actually resolves.
  // On failure, surface a sonner toast so the user knows to retry.
  const copy = async (key: string, text: string) => {
    if (!navigator.clipboard?.writeText) {
      toast.error('Clipboard unavailable')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      // WR-04: clear any pending reset before scheduling a new one — a
      // rapid double-copy or file switch would otherwise leak the prior
      // timer into the new mount lifecycle.
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null
        setCopied((c) => (c === key ? null : c))
      }, 1100)
    } catch {
      toast.error('Copy failed')
    }
  }

  if (!file) return null

  // Filter by format using the registry — NEVER switch(file.format).
  const visibleSnippets = Object.values(SNIPPET_REGISTRY).filter((def) =>
    def.applicableFormats.includes(file.format),
  )

  if (visibleSnippets.length === 0) return null

  return (
    <>
      {visibleSnippets.map((def) => {
        const isEnabled = snippetToggles[def.id] ?? true
        const snippetText = def.generate(svgText)

        // Determine the snippet body content based on file status (UI-SPEC §SnippetPanel).
        let codeContent: string
        let copyDisabled = false
        if (!isEnabled) {
          codeContent = '' // collapsed section — body replaced by "Disabled" message below
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

        const maxHeight = def.id === 'inline-svg' ? 200 : 140

        return (
          <Section
            key={def.id}
            title={def.label}
            badge={{ text: def.badge, acc: true }}
          >
            <div
              className="code-row"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) =>
                  setSnippetToggle(file.id, def.id, e.target.checked)
                }
                aria-label={`${def.label} snippet enabled`}
                style={{
                  width: 14,
                  height: 14,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
              <span className="lbl">{def.codeLabel}</span>
              <button
                className={'copy-btn ' + (copied === def.id ? 'ok' : '')}
                onClick={() =>
                  !copyDisabled && isEnabled && copy(def.id, codeContent)
                }
                disabled={copyDisabled || !isEnabled}
                style={
                  copyDisabled || !isEnabled
                    ? { opacity: 0.5, cursor: 'default' }
                    : undefined
                }
                aria-label={`Copy ${def.label} snippet`}
              >
                {copied === def.id ? (
                  <>
                    <Icons.Check size={11} /> copied
                  </>
                ) : (
                  <>
                    <Icons.Copy size={11} /> copy
                  </>
                )}
              </button>
            </div>
            {!isEnabled ? (
              <p
                style={{
                  fontSize: '11.5px',
                  color: 'var(--fg-3)',
                  padding: '6px 0',
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                Disabled. Enable above to include in copy-all output.
              </p>
            ) : (
              <pre
                className="code"
                style={{
                  maxHeight,
                  overflowY: 'auto',
                  fontStyle: copyDisabled ? 'italic' : 'normal',
                  color: copyDisabled ? 'var(--fg-3)' : undefined,
                }}
              >
                {codeContent}
              </pre>
            )}
          </Section>
        )
      })}
    </>
  )
}
