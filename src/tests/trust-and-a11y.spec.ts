// change:remove-dead-ui-and-fix-a11y — regression cover for the 2026-10-25 critique P0/P1s:
// no inert controls, an honest palette + DeltaStrip, keyboard-operable file queue, and
// the narrow-viewport layout.
import { test, expect, type Page } from '@playwright/test'
import { injectEntries, ingestSvg } from './_helpers/ingest'
import { FILES_MOD } from './_helpers/page-modules'

type FilesModule = typeof import('../stores/files')

async function waitAllDone(page: Page, ids: string[]) {
  await page.waitForFunction(
    async ({ mod, ids }: { mod: string; ids: string[] }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const byId = new Map(filesAtom.get().entries.map((e) => [e.id, e.status]))
      return ids.every((id) => byId.get(id) === 'done')
    },
    { mod: FILES_MOD, ids },
    { timeout: 30_000 },
  )
}

async function openPaletteAt(page: Page, query: string) {
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('cmdk-input').fill(query)
}

test.describe('No inert controls', () => {
  test('TitleBar and Toolbar render only working controls', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('titlebar-menu-view')).toBeVisible()
    await expect(page.getByTestId('titlebar-menu-codec')).toHaveCount(0)
    await expect(page.getByTestId('titlebar-menu-help')).toHaveCount(0)
    await expect(page.locator('[data-testid^="toolbar-view-"]')).toHaveCount(0)
    await expect(page.getByTestId('toolbar-btn-auto')).toHaveCount(0)
    await expect(page.locator('[role="application"]')).toHaveCount(0)
  })

  test('palette lists no dead commands or unbound shortcut hints', async ({ page }) => {
    await page.goto('/')
    await openPaletteAt(page, '')
    const labels = await page.locator('[data-testid^="cmdk-option-"]').allInnerTexts()
    const text = labels.join('\n')
    for (const dead of ['Add files', 'Batch view', 'Compare view', 'Report view']) {
      expect(text).not.toContain(dead)
    }
    // Only ⌘K is a bound shortcut.
    for (const l of labels) {
      const hint = l.split('\n').slice(1).join('').trim()
      if (hint) expect(hint).toBe('⌘K')
    }
  })
})

test.describe('Honest status and numbers', () => {
  test('palette Optimize all is unavailable on an empty queue', async ({ page }) => {
    await page.goto('/')
    await openPaletteAt(page, 'optimize')
    const opt = page.getByTestId('cmdk-option-0')
    await expect(opt).toContainText('Optimize all')
    await expect(opt).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('statusbar')).toContainText('Idle')
    await expect(page.getByTestId('worker-pip')).toHaveAttribute('aria-label', 'Worker status: Idle')
  })

  test('palette Optimize all optimizes the queue and returns to Idle', async ({ page }) => {
    await page.goto('/')
    const ids = await injectEntries(page, 2, { status: 'queued' })
    await openPaletteAt(page, 'optimize')
    await page.keyboard.press('Enter')
    await waitAllDone(page, ids)
    await expect(page.getByTestId('worker-pip')).toHaveAttribute('aria-label', 'Worker status: Idle', {
      timeout: 10_000,
    })
  })

  test('DeltaStrip shows placeholders, not literals, with nothing selected', async ({ page }) => {
    await page.goto('/')
    for (const slug of ['ssim', 'butteraugli', 'decode']) {
      await expect(page.getByTestId(`center-delta-value-${slug}`)).toHaveText('—')
    }
  })
})

test.describe('Honest numbers — follow-ups', () => {
  test('Workers is read-only text, not a button', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('toolbar-btn-settings').click()
    const workers = page.getByTestId('settings-workers')
    await expect(workers).toHaveText(/^Workers: \d+ \(auto\)$/)
    expect(await workers.evaluate((el) => el.tagName)).toBe('P')
    await expect(page.getByTestId('settings-btn-workers')).toHaveCount(0)
  })

  test('DeltaStrip shows each file\'s own metric and band', async ({ page }) => {
    await page.goto('/')
    const ids = await injectEntries(page, 2)
    await page.evaluate(
      async ({ mod, ids }: { mod: string; ids: string[] }) => {
        const { setFileMetric } = (await import(mod)) as FilesModule
        setFileMetric(ids[0], 'ssim', 0.991)
        setFileMetric(ids[1], 'ssim', 0.81)
        setFileMetric(ids[1], 'butteraugli', null)
      },
      { mod: FILES_MOD, ids },
    )
    await page.getByTestId(`files-row-${ids[0]}`).click()
    await expect(page.getByTestId('center-delta-value-ssim')).toHaveText('0.991')
    await expect(page.getByTestId('center-delta-card-ssim')).toContainText('good')
    await page.getByTestId(`files-row-${ids[1]}`).click()
    await expect(page.getByTestId('center-delta-value-ssim')).toHaveText('0.810')
    await expect(page.getByTestId('center-delta-card-ssim')).toContainText('poor')
    await expect(page.getByTestId('center-delta-value-butteraugli')).toHaveText('N/A')
  })
})

test.describe('Keyboard-operable file queue', () => {
  test('arrow keys move selection and focus', async ({ page }) => {
    await page.goto('/')
    const ids = await injectEntries(page, 3)
    const list = page.getByTestId('files-list')
    await expect(list).toHaveAttribute('role', 'listbox')
    await page.getByTestId(`files-row-${ids[0]}`).focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    const third = page.getByTestId(`files-row-${ids[2]}`)
    await expect(third).toHaveAttribute('aria-selected', 'true')
    await expect(third).toBeFocused()
    await expect(page.getByTestId(`files-row-${ids[0]}`)).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByTestId('center-breadcrumb-name')).toContainText('fixture-2.png')
  })

  test('the list is a single tab stop that lands on the selected row', async ({ page }) => {
    await page.goto('/')
    const ids = await injectEntries(page, 3)
    const tabbable = await page
      .locator('[data-testid="files-list"] [tabindex="0"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
    expect(tabbable).toEqual([`files-row-${ids[0]}`])
  })

  test('Shift+F10 opens the row menu next to the row; Escape returns focus', async ({ page }) => {
    await page.goto('/')
    const ids = await injectEntries(page, 3)
    const row = page.getByTestId(`files-row-${ids[1]}`)
    await row.focus()
    await page.keyboard.press('Shift+F10')
    const menu = page.getByTestId('files-row-menu')
    await expect(menu).toBeVisible()
    const r = (await row.boundingBox())!
    const m = (await menu.boundingBox())!
    expect(Math.abs(m.y - (r.y + r.height))).toBeLessThan(40)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(row).toBeFocused()
  })

  test('row menu has only working items', async ({ page }) => {
    await page.goto('/')
    const ids = await injectEntries(page, 1)
    await page.getByTestId(`files-row-${ids[0]}`).click({ button: 'right' })
    const menu = page.getByTestId('files-row-menu')
    await expect(menu).toBeVisible()
    for (const t of ['files-row-menu-reoptimize', 'files-row-menu-reveal', 'files-row-menu-apply-to-all']) {
      await expect(page.getByTestId(t)).toHaveCount(0)
    }
    await expect(page.getByTestId('files-row-menu-remove')).toBeVisible()
  })
})

test.describe('Accessible shell semantics', () => {
  for (const kind of ['svg', 'png'] as const) test(`no focusable element lacks an accessible name (${kind} selected)`, async ({ page }) => {
    await page.goto('/')
    if (kind === 'svg') {
      await ingestSvg(page)
      await page.locator('[data-testid^="files-row-"][role="option"]').first().click()
      await expect(page.getByTestId('svgo-switch-aggressive')).toBeVisible()
    } else {
      await injectEntries(page, 1)
      await expect(page.getByTestId('codec-switch-lossless')).toBeVisible()
      // Reveal the conditional controls too.
      await page.getByTestId('codec-switch-resize').click()
      await page.getByTestId('codec-switch-colors').click()
    }
    const unnamed = await page.evaluate(() => {
      const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[role="separator"][tabindex]'
      const out: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (el.closest('[aria-hidden="true"]') || el.offsetParent === null) continue
        if ((el as HTMLInputElement).type === 'hidden' || el.dataset.radixFocusGuard !== undefined) continue
        const labelledBy = el.getAttribute('aria-labelledby')
        const name =
          el.getAttribute('aria-label') ||
          (labelledBy && document.getElementById(labelledBy)?.textContent) ||
          (el as HTMLInputElement).labels?.[0]?.textContent ||
          el.getAttribute('title') ||
          (el as HTMLInputElement).placeholder ||
          el.textContent
        if (!name || !name.trim()) out.push(el.outerHTML.slice(0, 120))
      }
      return out
    })
    expect(unnamed).toEqual([])
  })

  test('empty-queue StatusBar has no stray separator and announces no versions', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByTestId('statusbar')
    await expect(bar).toContainText('Idle')
    expect(await bar.innerText()).not.toMatch(/·\s*·/)
    expect(await bar.getAttribute('aria-live')).toBeNull()
    const live = await bar.locator('[aria-live]').allInnerTexts()
    expect(live.join(' ')).not.toContain('SVGO')
  })

  test('segmented-control focus ring is not clipped', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, 1)
    const opt = page.locator('[data-value="AVIF"]').first()
    await opt.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(opt).toBeFocused()
    const box = (await opt.boundingBox())!
    await page.screenshot({
      path: test.info().outputPath('segcontrol-focus.png'),
      clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
    })
    const shadow = await opt.evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).toContain('inset')
  })
})

test.describe('Narrow-viewport layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('one pane at a time behind a Files / Preview / Settings tab bar', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, 2)
    await expect(page.getByTestId('mobile-pane-tabs')).toBeVisible()
    await expect(page.getByTestId('files-pane')).toBeVisible()
    await expect(page.getByTestId('center-pane')).toHaveCount(0)
    await expect(page.getByTestId('inspector-pane')).toHaveCount(0)

    await page.getByTestId('mobile-tab-preview').click()
    await expect(page.getByTestId('center-pane')).toBeVisible()
    await expect(page.getByTestId('files-pane')).toHaveCount(0)
    await expect(page.getByTestId('mobile-tab-preview')).toHaveAttribute('aria-selected', 'true')

    // Arrow keys move between tabs (WAI-ARIA tabs pattern).
    await page.getByTestId('mobile-tab-preview').focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('inspector-pane')).toBeVisible()
    await expect(page.getByTestId('mobile-tab-settings')).toBeFocused()
  })

  test('nothing is clipped: overflow only inside scrollable containers', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, 2)
    for (const tab of ['files', 'preview', 'settings']) {
      await page.getByTestId(`mobile-tab-${tab}`).click()
      const result = await page.evaluate(() => {
        const vw = window.innerWidth
        const scrollable = (el: Element | null): boolean => {
          for (let n = el?.parentElement; n; n = n.parentElement) {
            const ox = getComputedStyle(n).overflowX
            if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) return true
          }
          return false
        }
        const clipped = [...document.body.querySelectorAll<HTMLElement>('*')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.right > vw + 1 && !scrollable(el)
        })
        return {
          docOverflow: document.documentElement.scrollWidth - vw,
          clipped: clipped.slice(0, 5).map((e) => e.getAttribute('data-testid') || e.tagName + '.' + e.className.toString().slice(0, 40)),
        }
      })
      expect(result.docOverflow, tab).toBeLessThanOrEqual(0)
      expect(result.clipped, tab).toEqual([])
    }
  })
})
