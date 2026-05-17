// Phase 03 — STORE-04: runtimeAtom + startRun/stopRun/pushToast/dismissToast. Source: 03-01-PLAN.md
import { map } from 'nanostores'

export interface Toast {
  id: string
  msg: string
  meta?: string
}

interface RuntimeState {
  running: boolean
  toasts: Toast[]
}

export const runtimeAtom = map<RuntimeState>({
  running: false,
  toasts: [],
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
