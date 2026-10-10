// change:add-black-box-e2e-suite — row selection without text coupling.
//
// Row testids embed the FileEntry uuid (`files-row-<id>`), so a spec resolves the id
// through the store first and addresses the row by testid — never by its filename text.
import { expect, type Locator, type Page } from '@playwright/test'
import { fileIdByName } from './store'
import { FILES_MOD } from './page-modules'

type FilesModule = typeof import('../../stores/files')

/** Locator for one row, by entry id. */
export function rowById(page: Page, id: string): Locator {
  return page.getByTestId(`files-row-${id}`)
}

/** Locator for one row, resolved from the entry's name via the store. */
export async function rowByName(page: Page, name: string): Promise<Locator> {
  return rowById(page, await fileIdByName(page, name))
}

/** Clicks a row and waits for filesAtom.selectedId to land on it. */
export async function selectRowById(page: Page, id: string): Promise<void> {
  await rowById(page, id).click()
  await page.waitForFunction(
    async ({ mod, wanted }: { mod: string; wanted: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      return filesAtom.get().selectedId === wanted
    },
    { mod: FILES_MOD, wanted: id },
    { timeout: 5_000 },
  )
}

/** Clicks the row for `name`. */
export async function selectRowByName(page: Page, name: string): Promise<string> {
  const id = await fileIdByName(page, name)
  await selectRowById(page, id)
  return id
}

/** Clicks the nth row in current queue order (post-filter, post-sort). */
export async function selectRowAt(page: Page, index: number): Promise<string> {
  const ids = await visibleRowIds(page)
  const id = ids[index]
  if (id === undefined) throw new Error(`no row at index ${index} (have ${ids.length})`)
  await selectRowById(page, id)
  return id
}

/** Opens one row's context menu via its three-dot button, waiting for the menu to mount. */
export async function openRowMenu(page: Page, id: string): Promise<Locator> {
  await page.getByTestId(`files-row-${id}-ctxbtn`).click()
  const menu = page.getByTestId('files-row-menu')
  await expect(menu).toBeVisible()
  return menu
}

/** Current queue order as entry ids — for asserting that a sort actually reordered. */
export async function visibleRowIds(page: Page): Promise<string[]> {
  return page.evaluate(async (mod: string) => {
    const { $filteredFiles } = (await import(mod)) as FilesModule
    return $filteredFiles.get().map((e) => e.id)
  }, FILES_MOD)
}
