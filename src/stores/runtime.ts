// Phase 03 — STORE-04: runtimeAtom + startRun/stopRun/pushToast/dismissToast. Source: 03-01-PLAN.md
// Phase 09 — Plan 03: encodingFileId + setEncodingFile for DeltaStrip in-flight shimmer (UI-SPEC §4)
// Quick 260603-s2x: watchedFolderAtom — active "Watch folder" state (handle + observer).
// Phase 13 — DIA-01/DIA-02 (D-05/D-06): retire svgoVersion/codecVersion/wasmInfo strings;
//   replace with structured `versions: BUILD_VERSIONS` + `caps: Caps`. Phase 16 appends
//   versions.ssim; Phase 17 appends versions.butteraugli.buildHash.
import { atom, map } from 'nanostores'
import { BUILD_VERSIONS } from '@/lib/versions'
import type { Caps } from '@/lib/caps'

export interface Toast {
  id: string
  msg: string
  meta?: string
}

interface RuntimeState {
  running: boolean
  runningJobs: number
  queuedJobs: number
  toasts: Toast[]
  versions: typeof BUILD_VERSIONS
  caps: Caps
  encodingFileId: string | null  // tracks in-flight file for DeltaStrip shimmer (UI-SPEC §4)
}

// Phase 13 — D-04: safe-zero baseline. main.tsx overwrites pre-render via setCaps(probeCaps()).
const INITIAL_CAPS: Caps = {
  simd: false,
  threads: false,
  crossOriginIsolated: false,
  hardwareConcurrency: 1,
  offlineReady: false,
}

export const runtimeAtom = map<RuntimeState>({
  running: false,
  runningJobs: 0,
  queuedJobs: 0,
  toasts: [],
  versions: BUILD_VERSIONS,
  caps: INITIAL_CAPS,
  encodingFileId: null,
})

export function startRun(): void {
  runtimeAtom.setKey('running', true)
}

export function stopRun(): void {
  runtimeAtom.setKey('running', false)
}

export function pushToast(msg: string, meta?: string): void {
  const id = String(Date.now() + Math.random())
  const toast: Toast = { id, msg, ...(meta !== undefined ? { meta } : {}) }
  runtimeAtom.setKey('toasts', [...runtimeAtom.get().toasts, toast])
}

export function dismissToast(id: string): void {
  runtimeAtom.setKey('toasts', runtimeAtom.get().toasts.filter((t) => t.id !== id))
}

export function setWorkerCount(n: number): void {
  // stub — configure worker pool size in v2
  void n
}

// Phase 08 — PIPE-04: called by WorkerPool.onCountChange to reflect real running/queued state.
// `running` (boolean) remains the BackpressureIndicator contract — derived from counts.
// CR-01 fix: atomic setKey per field — eliminates read-modify-write race under concurrent pushToast
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.setKey('runningJobs', running)
  runtimeAtom.setKey('queuedJobs', queued)
  runtimeAtom.setKey('running', running > 0 || queued > 0)
}

// Phase 09 — Plan 03: CR-01 atomic setKey — drives DeltaStrip in-flight shimmer (UI-SPEC §4)
export function setEncodingFile(id: string | null): void {
  runtimeAtom.setKey('encodingFileId', id)
}

// Phase 13 — DIA-02 (D-04): called once from main.tsx pre-render with the boot probe result.
// CR-01 atomic setKey precedent (line 60-64). Same pattern as setEncodingFile.
export function setCaps(c: Caps): void {
  runtimeAtom.setKey('caps', c)
}

// Quick 260603-s2x: "Watch folder" active state — directory handle + (optional) observer.
// T-WF-03: observer ref stored here so stopWatching() can disconnect before a new pick.
// Future "Stop watching" UI affordance reads this atom; out of scope for this task.
// FileSystemObserver is not yet in lib.dom.d.ts (Chrome 132+ behind flag); typed loosely.
export interface WatchedFolderState {
  name: string
  handle: FileSystemDirectoryHandle
  observer: { disconnect: () => void } | null
}

export const watchedFolderAtom = atom<WatchedFolderState | null>(null)
