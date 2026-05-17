// Phase 03 — STORE-03 (action bodies filled). Source: 03-01-PLAN.md
// CIRCULAR ESM GUARD: ui.ts MUST NOT import files.ts, runtime.ts, or settings.ts
import { map } from 'nanostores'

export type View = 'Batch' | 'Compare' | 'Report'
export type Tab = 'codec' | 'svgo' | 'output' | 'report'

interface UiState {
  open: string | null
  view: View
  tab: Tab
  split: number
  zoom: number
  cmdkOpen: boolean
  cmdkQ: string
  cmdkSel: number
  rowMenu: string | null
  theme: 'dark' | 'light'
}

export const uiAtom = map<UiState>({
  open: null,
  view: 'Batch',
  tab: 'codec',
  split: 50,
  zoom: 100,
  cmdkOpen: false,
  cmdkQ: '',
  cmdkSel: 0,
  rowMenu: null,
  theme: 'dark',
})

export function setRowMenu(id: string | null): void {
  uiAtom.setKey('rowMenu', id)
}

export function setOpen(key: string | null): void {
  uiAtom.setKey('open', key)
}

export function setView(v: View): void {
  uiAtom.setKey('view', v)
}

export function setTab(t: Tab): void {
  uiAtom.setKey('tab', t)
}

export function setSplit(pct: number): void {
  uiAtom.setKey('split', pct)
}

export function setZoom(z: number): void {
  uiAtom.setKey('zoom', z)
}

export function openCmdk(): void {
  uiAtom.setKey('cmdkOpen', true)
  uiAtom.setKey('cmdkQ', '')
  uiAtom.setKey('cmdkSel', 0)
}

export function closeCmdk(): void {
  uiAtom.setKey('cmdkOpen', false)
}

export function setCmdkQuery(q: string): void {
  uiAtom.setKey('cmdkQ', q)
}

export function setCmdkSel(n: number): void {
  uiAtom.setKey('cmdkSel', n)
}

export function setTheme(t: 'dark' | 'light'): void {
  uiAtom.setKey('theme', t)
}
