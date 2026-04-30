// Phase 2 — store barrel (re-export the three sliced stores).
export { useFilesStore } from './files'
export type { FileEntryWithBlob } from './files'
export { useSettingsStore } from './settings'
export { useRuntimeStore, POOL_SIZE } from './runtime'
