// change:add-black-box-e2e-suite — read nanostores state from inside the page.
//
// Module specifiers are passed INTO each evaluate callback (see page-modules.ts for why the
// '/src/*.ts' form is required and why it must stay non-literal). A callback is serialized
// and cannot close over Node-side scope, so the specifier travels as an argument.
import type { Page } from '@playwright/test'
import { FILES_MOD, UI_MOD, SETTINGS_STORE_MOD, RUNTIME_MOD } from './page-modules'

type FilesModule = typeof import('../../stores/files')
type UiModule = typeof import('../../stores/ui')
type SettingsModule = typeof import('../../stores/settings')
type RuntimeModule = typeof import('../../stores/runtime')

export interface FileSnapshot {
  id: string
  name: string
  type: string
  orig: number
  opt: number
  status: string
  error?: string
  target?: string
  hasEncodedBuffer: boolean
  encodedSize: number | null
  ssim: number | null
  butteraugli: number | null
}

export interface FilesSnapshot {
  entries: FileSnapshot[]
  selectedId: string | null
  filterQuery: string
  sortBy: string
}

/**
 * Snapshot of filesAtom, flattened to structured-cloneable values.
 *
 * ArrayBuffers cannot cross the page boundary, so `encodedBuffer` is reported as a presence
 * flag plus byteLength — which is what assertions actually need ("did a re-encode produce
 * different bytes?").
 */
export async function getFiles(page: Page): Promise<FilesSnapshot> {
  return page.evaluate(async (mod: string) => {
    const { filesAtom } = (await import(mod)) as FilesModule
    const s = filesAtom.get()
    return {
      entries: s.entries.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        orig: e.orig,
        opt: e.opt,
        status: e.status as string,
        error: e.error,
        target: e.target,
        hasEncodedBuffer: e.encodedBuffer != null,
        encodedSize: e.encodedBuffer != null ? e.encodedBuffer.byteLength : null,
        // metrics is nested and tri-state: undefined = pending, null = failed, number = computed.
        ssim: e.metrics?.ssim ?? null,
        butteraugli: e.metrics?.butteraugli ?? null,
      })),
      selectedId: s.selectedId,
      filterQuery: s.filterQuery,
      sortBy: s.sortBy as string,
    }
  }, FILES_MOD)
}

/** Snapshot of uiAtom (view, tab, zoom, stageBg, theme, panes, command-palette state). */
export async function getUi(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async (mod: string) => {
    const { uiAtom } = (await import(mod)) as UiModule
    return JSON.parse(JSON.stringify(uiAtom.get())) as Record<string, unknown>
  }, UI_MOD)
}

/** Snapshot of the global settingsAtom (defaults, not per-file overrides). */
export async function getSettings(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async (mod: string) => {
    const { settingsAtom } = (await import(mod)) as SettingsModule
    return JSON.parse(JSON.stringify(settingsAtom.get())) as Record<string, unknown>
  }, SETTINGS_STORE_MOD)
}

/** Snapshot of runtimeAtom (job counts, versions, caps, worker concurrency). */
export async function getRuntime(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async (mod: string) => {
    const { runtimeAtom } = (await import(mod)) as RuntimeModule
    return JSON.parse(JSON.stringify(runtimeAtom.get())) as Record<string, unknown>
  }, RUNTIME_MOD)
}

/** Per-file settings for one entry — the object CodecPanel and SvgoPanel actually mutate. */
export async function getFileSettings(
  page: Page,
  id: string,
): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    async ({ mod, fileId }: { mod: string; fileId: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)
      return entry?.settings
        ? (JSON.parse(JSON.stringify(entry.settings)) as Record<string, unknown>)
        : null
    },
    { mod: FILES_MOD, fileId: id },
  )
}

/** Resolve a file id by name — lets a spec address a row without matching on visible text. */
export async function fileIdByName(page: Page, name: string): Promise<string> {
  const id = await page.evaluate(
    async ({ mod, n }: { mod: string; n: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      return filesAtom.get().entries.find((e) => e.name === n)?.id ?? null
    },
    { mod: FILES_MOD, n: name },
  )
  if (id === null) throw new Error(`no file entry named "${name}"`)
  return id
}
