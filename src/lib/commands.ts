// Phase 03 — STORE-07: ALL_COMMANDS registry (Actions / View / Palette groups). Source: 03-03-PLAN.md
// change:remove-dead-ui-and-fix-a11y — ALL_COMMANDS → buildCommands(deps) (design D2). Optimize all
//   is injected from main.tsx so this module stays free of worker/toast imports (Node unit runner),
//   and every listed command now does what it says: "Add files", the Batch/Compare/Report view
//   commands and the unbound A/O hints are gone.
// CIRCULAR ESM GUARD: import action functions only — never atoms — to prevent runtime cycle.
// Relative imports used so Node --experimental-strip-types can resolve without Vite alias.
import { setTheme, openCmdk } from '../stores/ui.ts'

export interface CommandItem {
  label: string
  meta?: string
  group: string
  do: () => void
  /** Evaluated at render/dispatch time; false renders the item disabled and inert. */
  enabled?: () => boolean
}

export interface CommandGroup {
  group: string
  items: CommandItem[]
}

export interface CommandDeps {
  optimizeAll: () => void
  hasFiles: () => boolean
}

export function buildCommands({ optimizeAll, hasFiles }: CommandDeps): CommandGroup[] {
  return [
    {
      group: 'Actions',
      items: [{ label: 'Optimize all', group: 'Actions', do: optimizeAll, enabled: hasFiles }],
    },
    {
      group: 'View',
      items: [
        { label: 'Light theme', group: 'View', do: () => setTheme('light') },
        { label: 'Dark theme', group: 'View', do: () => setTheme('dark') },
      ],
    },
    {
      group: 'Palette',
      items: [{ label: 'Open command palette', meta: '⌘K', group: 'Palette', do: openCmdk }],
    },
  ]
}
