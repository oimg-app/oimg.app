// Phase 15 — ING-02: document-level Cmd/Ctrl+V handler. Source: 15-03-PLAN.md
// Mirrors useWatchFolder shape (Quick task 260603-s2x): hook owns a single
// useEffect that mounts/unmounts the listener; routes the event through the
// shared Wave 1 dispatcher (src/lib/clipboard-ingest.ts → processClipboardEvent)
// so Toolbar onClick (15-04) and document paste share one decision tree.
//
// D-11 inputs-elements guard: when the paste originates inside an <input>,
// <textarea>, or [contenteditable], bail early so the native browser paste
// (filter field, command palette, etc.) is preserved untouched.
//
// D-12 preventDefault discipline: only when processClipboardEvent reports the
// event was consumed (returned true). This keeps unrelated text pastes — e.g.
// dragging focus onto a non-input but pasting text — flowing through the
// browser's default semantics for future surfaces.

import { useEffect } from 'react'
import { useIngest } from '@/hooks/useIngest'
import { processClipboardEvent } from '@/lib/clipboard-ingest'

export function useClipboardIngest(): void {
  const { ingest } = useIngest()

  useEffect(() => {
    async function onPaste(e: ClipboardEvent): Promise<void> {
      // D-11: input-elements early return. tagName check + isContentEditable
      // covers every text-input surface in the app (verified RESEARCH §3 — no
      // Shadow DOM, composedPath not required).
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      const consumed = await processClipboardEvent(e, { ingest })
      // D-12: preventDefault ONLY when the dispatcher consumed the event.
      if (consumed) e.preventDefault()
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [ingest])
}
