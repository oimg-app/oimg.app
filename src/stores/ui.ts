// Phase 02 — STORE-03: uiAtom full shape with Phase 3 action stubs. Source: 02-01-PLAN.md
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

export function setOpen(_key: string | null): void { /* @TODO Phase 3 */ }
export function setView(_v: View): void { /* @TODO Phase 3 */ }
export function setTab(_t: Tab): void { /* @TODO Phase 3 */ }
export function setSplit(_pct: number): void { /* @TODO Phase 3 */ }
export function setZoom(_z: number): void { /* @TODO Phase 3 */ }
export function openCmdk(): void { /* @TODO Phase 3 */ }
export function closeCmdk(): void { /* @TODO Phase 3 */ }
export function setCmdkQuery(_q: string): void { /* @TODO Phase 3 */ }
export function setCmdkSel(_n: number): void { /* @TODO Phase 3 */ }
export function setTheme(_t: 'dark' | 'light'): void { /* @TODO Phase 3 */ }
