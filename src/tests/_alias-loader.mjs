// Phase 12, Plan 02 — Node ESM resolve hook that rewrites the project's `@/*` Vite alias
// to `<repo>/src/*` (appending `.ts` when no extension is present) so unit tests
// (raw `node --experimental-strip-types …`) can import production source that uses the alias.
// Pure dev-time helper; not shipped to the browser.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, extname } from 'node:path'
import { existsSync } from 'node:fs'

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
