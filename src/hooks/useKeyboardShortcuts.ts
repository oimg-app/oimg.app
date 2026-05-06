// Phase 10 plan 04 — extracted keyboard shortcuts hook.
// Lifted verbatim from App.tsx lines 344-375 with the handler wrapped in a
// named hook. Accepts actions as params so setCmdkOpen does not need to flow
// through useBatchOrchestrate. App.tsx will call this hook directly.

import { useEffect } from 'react'
import { useRuntimeStore } from '@/stores'

interface UseKeyboardShortcutsParams {
  startOptimize: () => void
  cancelBatch: () => void
  cmdkOpen: boolean
  setCmdkOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  setOpen: (v: string | null) => void
  setRowMenu: (v: string | null) => void
}

export function useKeyboardShortcuts({
  startOptimize,
  cancelBatch,
  cmdkOpen,
  setCmdkOpen,
  setOpen,
  setRowMenu,
}: UseKeyboardShortcutsParams): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setCmdkOpen(false)
        setOpen(null)
        setRowMenu(null)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isInput) {
        e.preventDefault()
        startOptimize()
      } else if ((e.metaKey || e.ctrlKey) && e.key === '.' && useRuntimeStore.getState().running) {
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
  }, [cmdkOpen, startOptimize, cancelBatch])
}
