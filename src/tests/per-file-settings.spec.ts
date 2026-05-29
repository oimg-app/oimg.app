// Phase 09 — Plan 01: Wave 0 per-file settings D-01/D-02/D-03 test scaffold
// Tests assert FINAL expected behavior — RED until Plan 04 wires inspector to per-file settings.
// Analogs: src/tests/worker-pipeline.spec.ts, src/tests/inspector-tabs.spec.ts
// Phase 10, Plan 01 — D-05 migration: inject 2 fixture files before evaluates that need ≥2 entries
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

test.describe('per-file settings — D-01/D-02/D-03', () => {
  test('D-01: editing one file settings does not mutate another file settings', async ({ page }) => {
    await page.goto('/')

    // D-05: inject 2 fixture files so entries.length >= 2 (Pitfall 7)
    await ingestFixtureFiles(page, 2)

    // Use store actions directly via page.evaluate to test isolation
    const result = await page.evaluate(async () => {
      const { filesAtom, setFileSettings } = await import('/src/stores/files.ts')
      const { initFileSettings } = await import('/src/lib/stub-data.ts')
      const { settingsAtom } = await import('/src/stores/settings.ts')

      // Initialize two entries with identical default settings
      const defaults = settingsAtom.get()
      const entries = filesAtom.get().entries

      if (entries.length < 2) return { error: 'Need at least 2 entries' }

      const id1 = entries[0].id
      const id2 = entries[1].id

      // Give both entries their own settings copy
      await import('/src/stores/files.ts').then(({ filesAtom: fa }) => {
        fa.setKey('entries', fa.get().entries.map(e =>
          (e.id === id1 || e.id === id2)
            ? { ...e, settings: initFileSettings({ ...defaults, codec: 'WebP' as const }) }
            : e
        ))
      })

      // Now mutate only file 1's quality
      setFileSettings(id1, 'q', 42)

      const state = filesAtom.get()
      const entry1 = state.entries.find(e => e.id === id1)
      const entry2 = state.entries.find(e => e.id === id2)

      return {
        file1Q: entry1?.settings?.q,
        file2Q: entry2?.settings?.q,
      }
    })

    // File 1 should have q=42, file 2 should still have the original default q
    expect(result.file1Q).toBe(42)
    // File 2 must NOT have been mutated to 42
    expect(result.file2Q).not.toBe(42)
  })

  test('D-02: applyToAll copies global defaults into every entry settings', async ({ page }) => {
    await page.goto('/')

    // D-05: inject 1 fixture file so entries is non-empty
    await ingestFixtureFiles(page, 1)

    const result = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const { settingsAtom, applyToAll } = await import('/src/stores/settings.ts')

      // Change global defaults to a distinctive quality
      settingsAtom.setKey('q', 37)
      settingsAtom.setKey('codec', 'JPEG' as const)

      // Apply global defaults to all entries
      applyToAll()

      // Wait a tick for the lazy import + setKey to settle
      await new Promise(r => setTimeout(r, 50))

      const entries = filesAtom.get().entries
      const allHaveQ37 = entries.every(e => e.settings?.q === 37)
      const allHaveJpeg = entries.every(e => e.settings?.codec === 'JPEG')

      return { allHaveQ37, allHaveJpeg, entryCount: entries.length }
    })

    expect(result.entryCount).toBeGreaterThan(0)
    expect(result.allHaveQ37).toBe(true)
    expect(result.allHaveJpeg).toBe(true)
  })

  test('D-03: selecting a different file shows that file own settings in inspector', async ({ page }) => {
    await page.goto('/')

    // D-05: inject 2 fixture files so we can select between them
    await ingestFixtureFiles(page, 2)

    // Set up two files with different settings via the store, then observe the inspector UI
    await page.evaluate(async () => {
      const { filesAtom, setFileSettings } = await import('/src/stores/files.ts')
      const { initFileSettings } = await import('/src/lib/stub-data.ts')
      const { settingsAtom } = await import('/src/stores/settings.ts')

      const entries = filesAtom.get().entries
      if (entries.length < 2) return

      const defaults = settingsAtom.get()

      // Initialize both entries with settings
      filesAtom.setKey('entries', filesAtom.get().entries.map((e, i) =>
        i === 0 || i === 1
          ? { ...e, settings: initFileSettings({ ...defaults, codec: 'WebP' as const }) }
          : e
      ))

      // Give the two files distinct quality values
      setFileSettings(entries[0].id, 'q', 11)
      setFileSettings(entries[1].id, 'q', 99)
    })

    // Select file 1 — inspector should reflect its own settings (D-03)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()

    // Select file 2 — inspector should switch to file 2's settings
    await page.getByTestId('files-pane').getByText('fixture-1.png').click()

    // Verify via store that selected file has the correct per-file settings
    const selectedQ = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const state = filesAtom.get()
      const selected = state.entries.find(e => e.id === state.selectedId)
      return selected?.settings?.q ?? null
    })

    // File 2 should have q=99 (its own setting, not file 1's q=11)
    expect(selectedQ).toBe(99)
  })
})
