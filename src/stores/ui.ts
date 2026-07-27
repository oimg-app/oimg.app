// Phase 03 — STORE-03 (action bodies filled). Source: 03-01-PLAN.md
// Phase 03 — $cmdFlat + registerCommands added. Source: 03-03-PLAN.md
// CIRCULAR ESM GUARD: ui.ts MUST NOT import files.ts, runtime.ts, or settings.ts
// TYPE-ONLY import of CommandItem is safe — erased at build time, no runtime cycle
import { map, computed } from 'nanostores'
import type { CommandItem } from '@/lib/commands'

export type View = 'Batch' | 'Compare' | 'Report'
export type Tab = 'codec' | 'output' | 'report'
export type StageBg = 'checker-dark' | 'checker-light' | 'black' | 'white'

// Per-pane visibility gate for the three-column shell (Left FilesPane / Center CenterPane / Right InspectorPane).
// Backed by three independent booleans (not a single "active view" enum) so the user can hide any subset.
export interface PaneVisibility {
  batch: boolean      // Left — FilesPane
  compare: boolean    // Center — CenterPane
  inspector: boolean  // Right — InspectorPane (labelled "Inspector view" in the menu; formerly "Report view")
}

interface UiState {
  open: string | null
  view: View
  tab: Tab
  split: number
  zoom: number | 'fit'
  cmdkOpen: boolean
  cmdkQ: string
  cmdkSel: number
  rowMenu: string | null
  theme: 'dark' | 'light'
  stageBg: StageBg
  panes: PaneVisibility
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
  stageBg: 'checker-dark',
  panes: { batch: true, compare: true, inspector: true },
})

// Toggle a single pane's visibility. Guardrail: refuse to hide the last visible pane —
// that would leave a blank shell with no way for the user to bring anything back except
// the menu itself (which is fine but visually alarming). If someone really needs a
// blank shell, they can toggle multiple in sequence — this stops the accidental "hid
// them all" click chain, not deliberate use.
export function togglePane(key: keyof PaneVisibility): void {
  const current = uiAtom.get().panes
  const next = { ...current, [key]: !current[key] }
  if (!next.batch && !next.compare && !next.inspector) return
  uiAtom.setKey('panes', next)
}

export function setStageBg(bg: StageBg): void {
  uiAtom.setKey('stageBg', bg)
}

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

export function setZoom(z: number | 'fit'): void {
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

export function selectCodec(codec: string): void {
  // stub — real handler wires codec selection in v2
  void codec
}

export function openDocs(): void {
  // stub — open documentation in v2
}

export function openShortcuts(): void {
  // stub — open keyboard shortcuts panel in v2
}

export function openChangelog(): void {
  // stub — open changelog in v2
}

export function setAutoTarget(target: number): void {
  // stub — set quality target for Auto mode in v2
  void target
}

// ── STORE-03 completion / STORE-07 injection ────────────────────────────────
// Commands are injected at boot from main.tsx via registerCommands to avoid
// a runtime ESM cycle (commands.ts → ui.ts → commands.ts).
let _allCommands: CommandItem[] = []

export function registerCommands(cmds: CommandItem[]): void {
  _allCommands = cmds
}

export const $cmdFlat = computed(uiAtom, (s) =>
  s.cmdkQ
    ? _allCommands.filter((i) => i.label.toLowerCase().includes(s.cmdkQ.toLowerCase()))
    : _allCommands,
)
