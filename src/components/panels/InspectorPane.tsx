import { useStore } from '@nanostores/react'
import { uiAtom, setTab } from '@/stores/ui'
import type { Tab } from '@/stores/ui'
import { $selectedFile } from '@/stores/files'
import { cn } from '@/lib/utils'
import { CodecPanel } from './inspector/CodecPanel'
import { OutputPanel } from './inspector/OutputPanel'
import { ReportPanel } from './inspector/ReportPanel'

const TABS: Tab[] = ['codec', 'output', 'report']

export function InspectorPane() {
  const { tab } = useStore(uiAtom)
  const selectedFile = useStore($selectedFile)

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

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto pb-20">
            {tab === 'codec' && <CodecPanel />}
            {tab === 'output' && <OutputPanel />}
            {tab === 'report' && <ReportPanel />}
          </div>
        </div>
      )}
    </div>
  )
}
