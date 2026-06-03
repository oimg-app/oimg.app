// Phase 12 Wave 0 — shared clipboard mocks for D-14/D-15 chokepoint.
// Captures both code paths:
//   1. navigator.clipboard.writeText — recorded into window.__clipboardWrites
//   2. document.execCommand('copy') over textarea — recorded into window.__execCopyCalls
//
// Consumed by:
//   - src/tests/clipboard.test.ts (unit) — happy path + fallback fork
//   - src/tests/output-panel-live.spec.ts (e2e, Plan 03)
//   - src/tests/toolbar-snippets.spec.ts (e2e, Plan 04)
//   - src/tests/file-row-snippets.spec.ts (e2e, Plan 05)
//
// Mode reference:
//   - 'native'    : navigator.clipboard.writeText resolves; execCommand never reached.
//   - 'fallback'  : navigator.clipboard is deleted; execCommand path is the only available.
//   - 'fail-both' : native rejects + execCommand returns false (D-14 failure toast).
//
// VALIDATION.md Wave-0 cleanup contract: addInitScript is per-page; if a spec mixes
// save-file-mocks + clipboard-mocks, isolate via fresh `page` context. Do NOT install
// an afterEach cleanup here — page.close() rebuilds the renderer state.
import type { Page } from '@playwright/test'

export type ClipboardMockMode = 'native' | 'fallback' | 'fail-both'

export interface ClipboardMockGlobals {
  /** Strings handed to navigator.clipboard.writeText (or the textarea fallback value). */
  __clipboardWrites?: string[]
  /** Active-element textarea values captured by the execCommand('copy') spy. */
  __execCopyCalls?: string[]
  /** True after installClipboardMocks has run in this page. */
  __clipboardMocksInstalled?: boolean
}

export async function installClipboardMocks(
  page: Page,
  opts: { mode?: ClipboardMockMode } = {},
): Promise<void> {
  const mode: ClipboardMockMode = opts.mode ?? 'native'

  await page.addInitScript(
    ({ mode: m }: { mode: ClipboardMockMode }) => {
      type Win = Window & ClipboardMockGlobals & {
        __originalExecCommand?: typeof document.execCommand
      }
      const w = window as unknown as Win

      w.__clipboardWrites = []
      w.__execCopyCalls = []
      w.__clipboardMocksInstalled = true

      if (m === 'fallback' || m === 'fail-both') {
        // Force the fallback path by deleting / nullifying the clipboard API.
        Object.defineProperty(navigator, 'clipboard', {
          value: undefined,
          configurable: true,
        })
      } else {
        // 'native' mode — stub writeText to record + resolve.
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: async (text: string) => {
              ;(w.__clipboardWrites ?? (w.__clipboardWrites = [])).push(text)
            },
          },
          configurable: true,
        })
      }

      // execCommand spy (always installed; records the active textarea value).
      w.__originalExecCommand = document.execCommand
      document.execCommand = function patched(cmd: string): boolean {
        if (cmd === 'copy') {
          const ta = document.activeElement as HTMLTextAreaElement | null
          if (ta && 'value' in ta) {
            ;(w.__execCopyCalls ?? (w.__execCopyCalls = [])).push(ta.value)
          }
          return m === 'fail-both' ? false : true
        }
        return w.__originalExecCommand!.call(document, cmd)
      } as typeof document.execCommand
    },
    { mode },
  )
}
