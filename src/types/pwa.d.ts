// Phase 14 — Wave 0 (PWA-05): ambient declaration for the `virtual:pwa-register`
// module exposed by vite-plugin-pwa at build/runtime. Mirrors the plugin's own
// shipped client types so consumers (src/lib/register-sw.ts in Plan 02) can
// `import { registerSW } from 'virtual:pwa-register'` without `tsc -b` errors
// before the plugin is wired into vite.config.ts (Plan 01).
//
// Analog: src/types/globals.d.ts (single-purpose ambient .d.ts, zero-runtime).
// Source: vite-plugin-pwa client types (verified 14-RESEARCH.md §Code Examples).

declare module 'virtual:pwa-register' {
  export type RegisterSWOptions = {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegistrationError?: (error: unknown) => void
  }
  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>
}
