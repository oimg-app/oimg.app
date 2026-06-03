// Quick 260603-s2x: useWatchFolder — Toolbar "Watch folder" handler.
// Picks a directory via showDirectoryPicker (T-WF-01 dispatcher in dir-picker.ts),
// snapshot-ingests every image entry via useIngest (T-WF-02 reuse of existing pool),
// and on supporting browsers attaches a FileSystemObserver to auto-ingest new files
// (Chrome 132+). One-level only; no recursive traversal in this iteration.
//
// Hook shape mirrors src/hooks/useExport.ts + src/hooks/useSnippets.ts:
//   - useStore(watchedFolderAtom) drives reactive isWatching for future Stop UI.
//   - Async bodies read watchedFolderAtom.get() directly (stale-closure trap).
//
// Threat mitigations:
//   T-WF-01: pickDirectory() already gates on isSecureContext + feature-detect.
//   T-WF-02: ingest funnels through useIngest().ingest() — existing pool backpressure.
//   T-WF-03: stopWatching() calls observer.disconnect() before clearing the atom.
//   T-WF-04: try/catch wraps the observer callback; any 'errored' record OR thrown
//            error triggers stopWatching() + a single 'access revoked' toast.
import { useStore } from '@nanostores/react'
import { pickDirectory } from '@/lib/dir-picker'
import { useIngest, isAccepted } from '@/hooks/useIngest'
import { watchedFolderAtom } from '@/stores/runtime'
import { pushToast } from '@/stores/runtime'

// FileSystemObserver is not yet in lib.dom.d.ts as of TS 5.x (Chrome 132+ behind
// a flag at time of writing). Minimal local typing scoped to this hook.
interface FSORecord {
  type: 'appeared' | 'disappeared' | 'modified' | 'moved' | 'errored' | string
  changedHandle?: {
    kind: 'file' | 'directory'
    name: string
    getFile?: () => Promise<File>
  }
}

interface FSObserver {
  observe: (handle: FileSystemDirectoryHandle, opts?: { recursive?: boolean }) => Promise<void>
  disconnect: () => void
}

type FSObserverCtor = new (cb: (records: FSORecord[]) => void) => FSObserver

declare global {
  interface Window {
    FileSystemObserver?: FSObserverCtor
  }
}

export function useWatchFolder() {
  // Reactive subscription so isWatching re-renders future Toolbar Stop affordance.
  const current = useStore(watchedFolderAtom)
  const isWatching = current !== null
  const { ingest } = useIngest()

  function stopWatching(): void {
    const live = watchedFolderAtom.get()
    if (live === null) return
    if (live.observer) {
      // T-WF-03 mitigation — disconnect before clearing the atom.
      live.observer.disconnect()
    }
    watchedFolderAtom.set(null)
    pushToast(`Stopped watching ${live.name}`)
  }

  async function startWatching(): Promise<void> {
    // Cleanup any active watcher first (single-watcher invariant; T-WF-03).
    stopWatching()

    const handle = await pickDirectory()
    if (handle === null) return // user-cancel OR unsupported browser; toast already handled.

    // Snapshot pass — one-level only (no recursion in this iteration per scope).
    const files: File[] = []
    try {
      // handle.values() returns an async iterator over FileSystemHandle entries.
      const iter = (handle as unknown as {
        values: () => AsyncIterableIterator<{
          kind: 'file' | 'directory'
          name: string
          getFile?: () => Promise<File>
        }>
      }).values()
      for await (const entry of iter) {
        if (entry.kind !== 'file' || !entry.getFile) continue
        // Filter by name only (no MIME yet — we haven't read the file).
        if (!isAccepted({ name: entry.name, type: '' } as File)) continue
        const f = await entry.getFile()
        files.push(f)
      }
    } catch {
      // T-WF-04: directory enumeration failed (permission revoked mid-iteration?).
      pushToast('Watch folder access revoked')
      return
    }

    await ingest(files)
    pushToast(`Watching ${handle.name} (${files.length} files imported)`)

    // Observer path — only when FileSystemObserver is present.
    if (typeof window !== 'undefined' && 'FileSystemObserver' in window && window.FileSystemObserver) {
      const Ctor = window.FileSystemObserver
      const observer: FSObserver = new Ctor(async (records: FSORecord[]) => {
        try {
          for (const r of records) {
            // T-WF-04: permission revocation / access errors → clear + single toast.
            if (r.type === 'errored') {
              stopWatching()
              pushToast('Watch folder access revoked')
              return
            }
            if (r.type !== 'appeared' && r.type !== 'modified') continue
            const ch = r.changedHandle
            if (!ch || ch.kind !== 'file' || !ch.getFile) continue
            if (!isAccepted({ name: ch.name, type: '' } as File)) continue
            const f = await ch.getFile()
            await ingest([f])
            pushToast(`Added: ${f.name}`)
          }
        } catch {
          // T-WF-04: any throw inside the callback → revoke path.
          stopWatching()
          pushToast('Watch folder access revoked')
        }
      })
      try {
        await observer.observe(handle, { recursive: false })
        watchedFolderAtom.set({ name: handle.name, handle, observer })
      } catch {
        // observe() rejected (e.g. browser stub) — fall through to one-shot state.
        observer.disconnect()
        pushToast('Watch folder is one-shot in this browser (no live updates)')
        watchedFolderAtom.set({ name: handle.name, handle, observer: null })
      }
    } else {
      // No observer API — snapshot still landed; surface the limitation toast.
      pushToast('Watch folder is one-shot in this browser (no live updates)')
      watchedFolderAtom.set({ name: handle.name, handle, observer: null })
    }
  }

  return { startWatching, stopWatching, isWatching }
}
