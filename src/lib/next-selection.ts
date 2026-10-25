// change:remove-dead-ui-and-fix-a11y — roving selection for the keyboard-operable file queue
// (design D5). Pure so the Node unit runner can test it; no wrap at either end, matching
// native single-select listbox behavior.

/** Returns the id to select for `key`, or null when the key is not a navigation key or the list is empty. */
export function nextSelection(ids: readonly string[], currentId: string | null, key: string): string | null {
  if (ids.length === 0) return null
  const last = ids.length - 1
  const i = currentId === null ? -1 : ids.indexOf(currentId)
  switch (key) {
    case 'Home':
      return ids[0]
    case 'End':
      return ids[last]
    case 'ArrowDown':
      return i < 0 ? ids[0] : ids[Math.min(i + 1, last)]
    case 'ArrowUp':
      return i < 0 ? ids[0] : ids[Math.max(i - 1, 0)]
    default:
      return null
  }
}
