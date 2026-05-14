// Phase 01-foundation / Plan 05 — SHELL-01 skeleton pane
export function CenterPane() {
  return (
    <div
      data-testid="center-pane"
      className="h-full flex flex-col bg-[var(--color-bg-0)]"
    >
      <div className="h-[var(--height-pane-header)] flex items-center px-3 text-xs text-[var(--color-fg-2)] border-b border-[var(--color-line)]">
        Preview
      </div>
    </div>
  )
}
