// Phase 03 — STORE-04: runtimeAtom + startRun/stopRun/pushToast/dismissToast. Source: 03-01-PLAN.md
import { map } from 'nanostores'

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
  svgoVersion: string
  codecVersion: string
  wasmInfo: string
}

export const runtimeAtom = map<RuntimeState>({
  running: false,
  runningJobs: 0,
  queuedJobs: 0,
  toasts: [],
  svgoVersion: '4.0.1',
  codecVersion: '0.6.0',
  wasmInfo: 'WASM ready · 312 KB',
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
