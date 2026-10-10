// change:add-black-box-e2e-suite — inspector navigation and control manipulation.
import { expect, type Locator, type Page } from '@playwright/test'
import { UI_MOD } from './page-modules'

type UiModule = typeof import('../../stores/ui')

export type InspectorTab = 'codec' | 'output' | 'report'

/** Switches inspector tabs and waits for uiAtom.tab to follow. */
export async function openInspectorTab(page: Page, tab: InspectorTab): Promise<void> {
  await page.getByTestId(`inspector-tab-${tab}`).click()
  await page.waitForFunction(
    async ({ mod, wanted }: { mod: string; wanted: string }) => {
      const { uiAtom } = (await import(mod)) as UiModule
      return uiAtom.get().tab === wanted
    },
    { mod: UI_MOD, wanted: tab },
    { timeout: 5_000 },
  )
}

/**
 * Picks one option of a SegControl.
 *
 * SegControl puts `data-value` on every option button (see its data-testid contract), so
 * options are addressable by value rather than by the label they happen to render.
 */
export function segOption(page: Page, segTestId: string, value: string): Locator {
  return page.locator(`[data-testid="${segTestId}"] [data-value="${value}"]`)
}

/** Clicks a SegControl option and asserts it ended up checked. */
export async function pickSegOption(page: Page, segTestId: string, value: string): Promise<void> {
  const option = segOption(page, segTestId, value)
  await option.click()
  await expect(option).toHaveAttribute('aria-checked', 'true')
}

/** Selects an output codec via the format SegControl. */
export async function pickCodec(page: Page, codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'): Promise<void> {
  await pickSegOption(page, 'codec-format', codec)
}

/**
 * Moves a Radix slider with the keyboard.
 *
 * Keyboard rather than mouse drag: drag needs real geometry and goes flaky under a headless
 * viewport, while ArrowRight/ArrowLeft move exactly one `step` per press — deterministic.
 * For wide ranges (Colors is 1–256) prefer `setSliderToEnd`, which is one keypress.
 *
 * ponytail: one keypress per step, so keep `steps` small; Home/End cover the extremes.
 */
export async function nudgeSlider(page: Page, testId: string, steps: number): Promise<void> {
  const thumb = page.getByTestId(testId).getByRole('slider')
  await thumb.focus()
  const key = steps < 0 ? 'ArrowLeft' : 'ArrowRight'
  for (let i = 0; i < Math.abs(steps); i++) await thumb.press(key)
}

/** Sends a slider to its min or max in a single keypress. */
export async function setSliderToEnd(page: Page, testId: string, end: 'min' | 'max'): Promise<void> {
  const thumb = page.getByTestId(testId).getByRole('slider')
  await thumb.focus()
  await thumb.press(end === 'min' ? 'Home' : 'End')
}

/** Reads a Radix slider's current value off its thumb. */
export async function sliderValue(page: Page, testId: string): Promise<number> {
  const raw = await page.getByTestId(testId).getByRole('slider').getAttribute('aria-valuenow')
  return raw === null ? Number.NaN : Number(raw)
}

/** Flips a Switch and asserts the new checked state landed. */
export async function toggleSwitch(page: Page, testId: string, on: boolean): Promise<void> {
  const el = page.getByTestId(testId)
  const current = (await el.getAttribute('data-state')) === 'checked'
  if (current !== on) await el.click()
  await expect(el).toHaveAttribute('data-state', on ? 'checked' : 'unchecked')
}

/** Toggles one SVGO plugin by id and returns its resulting aria-pressed state. */
export async function toggleSvgoPlugin(page: Page, pluginId: string): Promise<boolean> {
  const btn = page.getByTestId(`svgo-plugin-${pluginId}`)
  const before = await btn.getAttribute('aria-pressed')
  await btn.click()
  const after = before === 'true' ? 'false' : 'true'
  await expect(btn).toHaveAttribute('aria-pressed', after)
  return after === 'true'
}
