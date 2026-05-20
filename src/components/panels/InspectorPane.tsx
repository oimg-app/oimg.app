// Phase 04 — INSP-01: InspectorPane shell + tab bar + auto-switch. Source: 04-02-PLAN.md
import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { uiAtom, setTab } from '@/stores/ui'
import type { Tab } from '@/stores/ui'
import { $selectedFile } from '@/stores/files'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CodecPanel } from './inspector/CodecPanel'
import { SvgoPanel } from './inspector/SvgoPanel'

export function InspectorPane() {
  const { tab } = useStore(uiAtom)
  const selectedFile = useStore($selectedFile)

  // Auto-switch tab based on file type. Dep array excludes `tab` to prevent infinite loop.
  // Read current store value imperatively inside effect to avoid stale closure on `tab`.
  useEffect(() => {
    if (!selectedFile) return
    if (selectedFile.type === 'svg') {
      setTab('svgo')
    } else if (uiAtom.get().tab === 'svgo') {
      setTab('codec')
    }
  }, [selectedFile?.id, selectedFile?.type])

  return (
    <div
      data-testid="inspector-pane"
      className="flex flex-col h-full bg-[var(--color-bg-0)]"
    >
      {/* Pane header */}
      <header className="flex items-center justify-between h-8 px-3.5 border-b border-[var(--color-line)] shrink-0 bg-[var(--color-bg-1)]">
        <span className="font-mono text-[11px] font-semibold text-[var(--color-fg-2)] uppercase tracking-wider">
          INSPECTOR
        </span>
      </header>

      {!selectedFile ? (
        /* Empty state */
        <div className="flex items-center justify-center h-full text-[11px] font-mono text-[var(--color-fg-3)]">
          Select a file to adjust settings
        </div>
      ) : (
        /* Tab bar + content */
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="w-full rounded-none bg-[var(--color-bg-1)] border-b border-[var(--color-line)] px-2 h-auto justify-start gap-0">
            {(['codec', 'svgo', 'output', 'report'] as Tab[]).map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-none py-2.5 px-2.5 font-mono text-[11px] tracking-wider uppercase data-[state=active]:font-semibold data-[state=active]:text-[var(--color-fg-0)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-accent)] text-[var(--color-fg-2)] data-[state=active]:bg-transparent"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto pb-20">
            <TabsContent value="codec">
              <CodecPanel />
            </TabsContent>
            <TabsContent value="svgo">
              <SvgoPanel />
            </TabsContent>
            <TabsContent value="output">
              <div className="p-3 text-xs text-[var(--color-fg-3)]">Output — coming in Phase 6</div>
            </TabsContent>
            <TabsContent value="report">
              <div className="p-3 text-xs text-[var(--color-fg-3)]">Report — coming in Phase 6</div>
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  )
}
