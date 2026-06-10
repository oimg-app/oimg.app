// Phase 06, Plan 01 — INSP-07 OutputPanel: snippet sections + copy buttons
// Phase 12, Plan 03 — D-05 effect-dep fix (re-render on encodedBuffer mutation),
//                     D-06 per-status presentation (queued/processing/error/done),
//                     D-07 derive-live (no atom),
//                     D-15 reroute copy through copyToClipboard chokepoint.
import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { Copy } from '@phosphor-icons/react'
import { $selectedFile } from '@/stores/files'
import { Button } from '@/components/ui/button'
import { Section } from './Section'
import { buildBase64Snippet, buildUrlEncodedSnippet, buildPictureSnippet } from '@/lib/snippets'
import { copyToClipboard } from '@/lib/clipboard'
import type { FileEntry } from '@/lib/settings'
import { cn } from '@/lib/utils.ts'

const SECTIONS = [
  {
    id: 'base64',
    title: 'Data URI · Base64',
    ariaLabel: 'Copy Base64 snippet',
    builder: buildBase64Snippet,
  },
  {
    id: 'urlencoded',
    title: 'Data URI · URL-encoded',
    ariaLabel: 'Copy URL-encoded snippet',
    builder: buildUrlEncodedSnippet,
  },
  {
    id: 'picture',
    title: 'Responsive `<picture>`',
    ariaLabel: 'Copy picture snippet',
    builder: buildPictureSnippet,
  },
] as const

type SnippetProps = {
  id: string
  title: string
  ariaLabel: string
  file: FileEntry
  // Phase 12 Plan 02 D-03: buildPictureSnippet is now sync (no buffer access); base64/url-encoded stay async.
  builder: (file: FileEntry) => Promise<string> | string
  onCopy: (id: string, text: string, label: string) => void
  isCopied?: boolean
}

// D-06: per-status presentation. Order matters:
//   queued     → empty placeholder
//   error      → message in --color-err
//   processing OR encodedBuffer missing → skeleton with animate-pulse (covers re-encode race)
//   done + encodedBuffer present → real <pre> snippet
function Snippet({ file, id, title, ariaLabel, builder, onCopy, isCopied }: SnippetProps) {
  const [text, setText] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    // Only build when bytes are available + file is done (D-06). Guard against
    // setState-after-unmount when file id swaps mid-build.
    if (file.status === 'done' && file.encodedBuffer != null) {
      Promise.resolve(builder(file)).then((t) => {
        if (!cancelled) setText(t)
      })
    } else {
      // Clear stale text so a previous done-file's snippet does not flash during
      // a target swap / re-encode (T-12-RACE).
      setText('')
    }
    return () => {
      cancelled = true
    }
    // D-05: re-run when bytes change (live-encode push) or target swap.
  }, [file?.id, file?.encodedBuffer, file?.target, file?.status, builder])

  const status = file.status
  const hasBytes = file.encodedBuffer != null
  const canCopy = status === 'done' && hasBytes && text.length > 0

  const disabledTitle =
    status === 'queued'
      ? 'Optimize this file first'
      : status === 'processing'
      ? 'Encoding in progress'
      : status === 'error'
      ? 'Encoding failed'
      : !hasBytes
      ? 'Encoding in progress'
      : undefined

  let body: React.ReactNode
  if (status === 'queued') {
    body = (
      <p className="text-[12px] text-[var(--color-fg-3)]">Optimize this file first</p>
    )
  } else if (status === 'error') {
    body = (
      <p className="text-[12px] text-[var(--color-err)]">
        {file.error ?? 'Encoding failed'}
      </p>
    )
  } else if (status === 'processing' || !hasBytes) {
    body = (
      <div
        className="h-[60px] rounded-md bg-[var(--color-bg-2)] animate-pulse mb-2"
        aria-label="Encoding in progress"
      />
    )
  } else {
    // done + bytes — render the real snippet text.
    body = (
      <pre
        className={cn(
          'px-3 py-2 mb-2',
          'text-[var(--color-fg-1)] bg-[var(--color-bg-2)]',
          'max-h-[300px] overflow-y-auto',
          'font-mono text-[12px] rounded-md overflow-x-auto leading-[1.6] whitespace-pre-wrap break-all '
        )}
      >
        {text}
      </pre>
    )
  }

  return (
    <Section key={id} title={title}>
      {body}
      <Button
        variant="ghost"
        size="sm"
        aria-label={ariaLabel}
        onClick={() => onCopy(id, text, title)}
        disabled={!canCopy}
        aria-disabled={!canCopy}
        title={disabledTitle}
        className="gap-1.5 text-[var(--color-fg-2)] hover:text-[var(--color-accent)]"
      >
        <Copy />
        {isCopied ? 'Copied!' : 'Copy snippet'}
      </Button>
    </Section>
  )
}

export function OutputPanel() {
  const file = useStore($selectedFile)
  // Ephemeral UI state only — STORE-08: not file/snippet data
  const [copied, setCopied] = useState<string | null>(null)

  if (file === null) {
    return (
      <div
        data-testid="output-empty"
        className="flex flex-col items-center justify-center px-4 py-10 text-center"
      >
        <p className="text-[12px] font-semibold text-[var(--color-fg-1)] mb-1">
          Select a file to see snippets
        </p>
        <p className="text-[12px] text-[var(--color-fg-3)] leading-[1.5]">
          Click any file in the queue to generate output snippets.
        </p>
      </div>
    )
  }

  // D-15: route every copy through the chokepoint. On failure the chokepoint
  // already raises a toast (D-14) — do NOT double-toast here.
  async function handleCopy(sectionId: string, text: string, label: string) {
    const { ok } = await copyToClipboard(text, 'snippet', label)
    if (ok) {
      setCopied(sectionId)
      setTimeout(() => setCopied(null), 1500)
    }
  }

  return (
    <div data-testid="output-panel">
      {SECTIONS.map(({ id, title, ariaLabel, builder }) => {
        const isCopied = copied === id

        return (
          <Snippet
            key={id}
            id={id}
            title={title}
            ariaLabel={ariaLabel}
            file={file}
            builder={builder}
            onCopy={handleCopy}
            isCopied={isCopied}
          />
        )
      })}
    </div>
  )
}
