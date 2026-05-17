// Phase 03 — STORE-07: ALL_COMMANDS registry (Actions / View / Palette groups). Source: 03-03-PLAN.md
// CIRCULAR ESM GUARD: import action functions only — never atoms — to prevent runtime cycle.
// Relative imports used so Node --experimental-strip-types can resolve without Vite alias.
import { setView, setTheme, openCmdk } from '../stores/ui.ts'
import { startRun } from '../stores/runtime.ts'

export interface CommandItem {
  label: string
  meta?: string
  group: string
  do: () => void
}

export interface CommandGroup {
  group: string
  items: CommandItem[]
}

export const ALL_COMMANDS: CommandGroup[] = [
  {
    group: 'Actions',
    items: [
      { label: 'Add files', meta: 'A', group: 'Actions', do: () => {} },
      { label: 'Optimize all', meta: 'O', group: 'Actions', do: startRun },
    ],
  },
  {
    group: 'View',
    items: [
      { label: 'Batch view', group: 'View', do: () => setView('Batch') },
      { label: 'Compare view', group: 'View', do: () => setView('Compare') },
      { label: 'Report view', group: 'View', do: () => setView('Report') },
      { label: 'Light theme', group: 'View', do: () => setTheme('light') },
      { label: 'Dark theme', group: 'View', do: () => setTheme('dark') },
    ],
  },
  {
    group: 'Palette',
    items: [
      { label: 'Open command palette', meta: '⌘K', group: 'Palette', do: openCmdk },
    ],
  },
]
