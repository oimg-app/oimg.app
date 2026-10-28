// change:remove-dead-ui-and-fix-a11y — below 900 px the shell shows one pane at a time (design D8).
import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 899.98px)'

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
