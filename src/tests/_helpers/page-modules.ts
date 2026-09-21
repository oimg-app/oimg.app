// change:add-black-box-e2e-suite — how helpers import app modules inside page.evaluate.
//
// THE RULE: a dynamic import inside a page.evaluate callback runs in the BROWSER and
// resolves against the page URL (http://localhost:5174/), NOT against this file. So a
// relative specifier like '../../stores/files' resolves to /stores/files and 404s. The
// Vite dev server serves source modules under /src/, extension included:
//
//     '/src/stores/files.ts'        correct
//     '../../stores/files'          404 — resolves to /stores/files
//
// The second problem is TypeScript: `src/tests/_helpers/` is inside tsconfig.app.json's
// `include` (only *.spec.ts and *.test.ts are excluded), so these files ARE typechecked,
// and tsc cannot resolve a literal '/src/...' specifier.
//
// Both are solved by importing through a non-literal specifier — tsc leaves a computed
// import alone and hands back `any` — then casting to the module's static type, which
// keeps full type safety at the call site:
//
//     const { filesAtom } = (await import(FILES_MOD)) as typeof import('../../stores/files')
//
// The relative path in that `typeof import(...)` is a compile-time type query only; it is
// erased and never reaches the browser.
//
// These constants are typed `string` (not literal) precisely so tsc will not try to
// resolve them. Do not add `as const`.

export const FILES_MOD: string = '/src/stores/files.ts'
export const UI_MOD: string = '/src/stores/ui.ts'
export const SETTINGS_STORE_MOD: string = '/src/stores/settings.ts'
export const RUNTIME_MOD: string = '/src/stores/runtime.ts'
export const SETTINGS_LIB_MOD: string = '/src/lib/settings.ts'
