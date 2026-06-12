// Phase 12, Plan 02 — Node ESM resolve hook that rewrites the project's `@/*` Vite alias
// to `<repo>/src/*` (appending `.ts` when no extension is present) so unit tests
// (raw `node --experimental-strip-types …`) can import production source that uses the alias.
// Pure dev-time helper; not shipped to the browser.
//
// Phase 15, Plan 01 — Also self-registers when used via `--import ./src/tests/_alias-loader.mjs`
// (Node 22+ deprecated `--experimental-loader`). Both invocation forms now activate the resolver:
//   node --experimental-strip-types --import ./src/tests/_alias-loader.mjs file.ts
//   node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs file.ts
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, extname } from 'node:path'
import { existsSync } from 'node:fs'
import { register } from 'node:module'

// Self-register so `--import ./src/tests/_alias-loader.mjs` actually wires the resolve hook.
// Guarded so `--experimental-loader` (which loads this module as a hook directly) does not
// double-register. When loaded as a hook, the registered hook would already be active and
// the second register() is a no-op for resolution but emits a warning — guard via globalThis.
const REG_FLAG = '__oimg_alias_loader_registered'
if (!(REG_FLAG in globalThis)) {
  Object.defineProperty(globalThis, REG_FLAG, { value: true, configurable: true })
  try {
    register(import.meta.url, pathToFileURL('./'))
  } catch {
    // If register fails (e.g. already wired as a loader-hook flag), fall through silently.
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(here, '..')

export async function resolve_(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let target = resolve(srcRoot, specifier.slice(2))
    if (!extname(target)) {
      if (existsSync(`${target}.ts`)) target = `${target}.ts`
      else if (existsSync(`${target}.tsx`)) target = `${target}.tsx`
      else if (existsSync(`${target}/index.ts`)) target = `${target}/index.ts`
    }
    return nextResolve(pathToFileURL(target).href, context)
  }
  return nextResolve(specifier, context)
}

export { resolve_ as resolve }
