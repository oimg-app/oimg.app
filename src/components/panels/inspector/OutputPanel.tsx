// Phase 06, Plan 01 — INSP-07 OutputPanel: snippet sections + copy buttons
import { useState } from 'react'
import { useStore } from '@nanostores/react'
import { Copy } from '@phosphor-icons/react'
import { $selectedFile } from '@/stores/files'
import { pushToast } from '@/stores/runtime'
import { Button } from '@/components/ui/button'
import { Section } from './Section'
import { buildBase64Snippet, buildUrlEncodedSnippet, buildPictureSnippet } from '@/lib/snippets'

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

  async function handleCopy(sectionId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(sectionId)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      pushToast('Clipboard unavailable — check browser permissions')
    }
  }

  return (
    <div data-testid="output-panel">
      {SECTIONS.map(({ id, title, ariaLabel, builder }) => {
        const snippet = builder(file)
        const isCopied = copied === id
        return (
          <Section key={id} title={title}>
            <pre className="font-mono text-[12px] bg-[var(--color-bg-2)] rounded-md px-3 py-2 overflow-x-auto leading-[1.6] text-[var(--color-fg-1)] whitespace-pre-wrap break-all mb-2">
              {snippet}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              aria-label={ariaLabel}
              onClick={() => handleCopy(id, snippet)}
              className="gap-1.5 text-[var(--color-fg-2)] hover:text-[var(--color-accent)]"
            >
              <Copy />
              {isCopied ? 'Copied!' : 'Copy snippet'}
            </Button>
          </Section>
        )
      })}
    </div>
  )
}
