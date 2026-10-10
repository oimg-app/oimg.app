// change:add-black-box-e2e-suite — showDirectoryPicker / FileSystemObserver mocks.
//
// Shape lifted from src/tests/watch-folder.spec.ts. Installed via addInitScript so the
// fakes exist before React mounts useWatchFolder. No spec ever touches the real filesystem.
import type { Page } from '@playwright/test'
import { PNG_1x1 } from './fixtures'

export interface MockDirFile {
  name: string
  /** base64 image bytes; defaults to PNG_1x1. */
  b64?: string
  mime?: string
}

export interface MockDirOptions {
  /** Drop window.FileSystemObserver to exercise the one-shot fallback path. */
  noObserver?: boolean
  /** Install a recording FileSystemObserver (callback lands on window.__fsoCb). */
  withObserver?: boolean
}

/**
 * Installs a fake directory handle that yields `files`.
 *
 * With `withObserver`, the observer callback is parked on `window.__fsoCb` so a spec can
 * later fire a synthetic change record via `emitDirectoryChange`.
 */
export async function mockDirectoryHandle(
  page: Page,
  files: MockDirFile[],
  { noObserver = false, withObserver = true }: MockDirOptions = {},
): Promise<void> {
  const payload = files.map((f) => ({
    name: f.name,
    b64: f.b64 ?? PNG_1x1,
    mime: f.mime ?? 'image/png',
  }))

  await page.addInitScript(
    ({ entries, noObserver, withObserver }) => {
      const w = window as unknown as {
        __fsoCb?: (records: unknown[]) => void
        __fsoCalls?: { observed: number; disconnected: number }
        showDirectoryPicker?: () => Promise<unknown>
        FileSystemObserver?: unknown
      }
      w.__fsoCalls = { observed: 0, disconnected: 0 }

      function toFile(entry: { name: string; b64: string; mime: string }): File {
        const bin = atob(entry.b64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return new File([bytes], entry.name, { type: entry.mime })
      }

      function fileHandle(entry: { name: string; b64: string; mime: string }) {
        return { kind: 'file', name: entry.name, getFile: async () => toFile(entry) }
      }

      const dirHandle = {
        kind: 'directory',
        name: 'mock-watch-dir',
        async *values() {
          for (const entry of entries) yield fileHandle(entry)
        },
      }

      w.showDirectoryPicker = async () => dirHandle

      if (noObserver) {
        delete w.FileSystemObserver
      } else if (withObserver) {
        w.FileSystemObserver = class {
          constructor(cb: (records: unknown[]) => void) {
            w.__fsoCb = cb
          }
          observe() {
            w.__fsoCalls!.observed++
          }
          disconnect() {
            w.__fsoCalls!.disconnected++
          }
        }
      }
    },
    { entries: payload, noObserver, withObserver },
  )
}

/** Fires a synthetic observer record, as if a file appeared in the watched folder. */
export async function emitDirectoryChange(
  page: Page,
  file: MockDirFile,
  type: 'appeared' | 'modified' | 'disappeared' = 'appeared',
): Promise<void> {
  await page.evaluate(
    ({ entry, changeType }) => {
      const w = window as unknown as { __fsoCb?: (records: unknown[]) => void }
      if (w.__fsoCb === undefined) throw new Error('no FileSystemObserver callback registered')

      const bin = atob(entry.b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const asFile = new File([bytes], entry.name, { type: entry.mime })

      w.__fsoCb([
        {
          type: changeType,
          changedHandle: { kind: 'file', name: entry.name, getFile: async () => asFile },
        },
      ])
    },
    {
      entry: { name: file.name, b64: file.b64 ?? PNG_1x1, mime: file.mime ?? 'image/png' },
      changeType: type,
    },
  )
}

/** Observer bookkeeping — how many observe()/disconnect() calls the app made. */
export async function directoryObserverCalls(
  page: Page,
): Promise<{ observed: number; disconnected: number }> {
  return page.evaluate(() => {
    const w = window as unknown as { __fsoCalls?: { observed: number; disconnected: number } }
    return w.__fsoCalls ?? { observed: 0, disconnected: 0 }
  })
}
