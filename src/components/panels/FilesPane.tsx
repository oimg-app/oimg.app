// Phase 01-foundation / Plan 05 — SHELL-01 skeleton pane
export function FilesPane() {
  return (
    <div
      data-testid="files-pane"
      className="h-full flex flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-1)]"
    >
      <div className="h-[var(--height-pane-header)] flex items-center px-3 text-xs text-[var(--color-fg-2)] border-b border-[var(--color-line)]">
        Files
      </div>
    </div>
  )
}
