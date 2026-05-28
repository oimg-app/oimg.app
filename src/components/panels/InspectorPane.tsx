import { useStore } from '@nanostores/react'
import { uiAtom, setTab } from '@/stores/ui'
import type { Tab } from '@/stores/ui'
import { filesAtom, $selectedFile } from '@/stores/files'
import { applyToAll } from '@/stores/settings'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { CodecPanel } from './inspector/CodecPanel'
import { OutputPanel } from './inspector/OutputPanel'
import { ReportPanel } from './inspector/ReportPanel'

const TABS: Tab[] = ['codec', 'output', 'report']

export function InspectorPane() {
  const { tab } = useStore(uiAtom)
  const selectedFile = useStore($selectedFile)
  const { entries } = useStore(filesAtom)

  function handleApplyToAll() {
    // WR-01: await the (lazily-imported, async) mutation so the toast reflects what actually
    // happened rather than firing before the store changes. The caption already warns this
    // overwrites per-file settings; we report completion once the copy has landed.
    const count = entries.length
    void applyToAll().then(() => {
      toast.success('Applied settings to ' + count + ' files')
    })
  }

  return (
    <div
      data-testid="inspector-pane"
      className="flex flex-col h-full bg-[var(--color-bg-0)]"
    >
      {/* Pane header */}
      <header className="flex items-center h-8 px-3.5 border-b border-[var(--color-line)] shrink-0 bg-[var(--color-bg-1)]">
        <span className="font-mono text-[11px] font-semibold text-[var(--color-fg-2)] uppercase tracking-wider">
          INSPECTOR
        </span>
      </header>

      {!selectedFile ? (
        <div className="flex items-center justify-center h-full text-[11px] font-mono text-[var(--color-fg-3)]">
          Select a file to adjust settings
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Tab bar — bottom-border accent style per example-ui */}
          <div className="flex shrink-0 border-b border-[var(--color-line)] bg-[var(--color-bg-1)] px-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'appearance-none bg-transparent font-mono text-[11px] font-medium tracking-[0.06em] uppercase py-[9px] px-2.5 border-b-2 -mb-px cursor-default transition-colors',
                  tab === t
                    ? 'text-[var(--color-fg-0)] border-b-[var(--color-accent)]'
                    : 'text-[var(--color-fg-2)] border-b-transparent hover:text-[var(--color-fg-0)]',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Inspector context label (D-03) — UI-SPEC §1 */}
          <div
            aria-live="polite"
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-2)] border-b border-[var(--color-line)] shrink-0"
          >
            {/* 6px accent dot — decorative */}
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-accent)]"
            />
            <span className="font-mono text-[11px] font-semibold text-[var(--color-fg-0)] truncate">
              {selectedFile.name}
            </span>
            <span className="font-mono text-[10px] text-[var(--color-fg-3)] shrink-0">
              &middot;&nbsp;&nbsp;currently editing
            </span>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto pb-20">
            {tab === 'codec' && <CodecPanel />}
            {tab === 'output' && <OutputPanel />}
            {tab === 'report' && <ReportPanel />}
          </div>

          {/* Apply-to-all (D-02) — pinned to the bottom, codec tab only, when >= 2 files */}
          {tab === 'codec' && entries.length >= 2 && (
            <div className="px-3 py-2 shrink-0 border-t border-[var(--color-line)] bg-[var(--color-bg-1)]">
              <button
                type="button"
                aria-label="Apply global codec settings to all files in queue"
                onClick={handleApplyToAll}
                className="w-full h-7 rounded-[4px] bg-[var(--color-accent-dim)] hover:bg-[var(--color-accent)] text-[var(--color-accent)] hover:text-[var(--color-accent-fg)] font-mono text-[11px] font-semibold transition-colors cursor-default"
              >
                Apply to all files
              </button>
              <p className="font-mono text-[10px] text-[var(--color-fg-3)] pt-1">
                Overwrites per-file settings
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
