# Phase 01 — Deferred Items

## Out-of-Scope Issues Discovered During Execution

### vite 8 / rolldown native binding loader fails on darwin-arm64

**Discovered during:** Plan 01-02 (Playwright install)
**Status:** Pre-existing — not introduced by Plan 01-02

**Symptom:**
Running `npm run dev` (or any Vite CLI invocation) on macOS arm64 fails with:
```
Error: Cannot find native binding. npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828).
[cause]: Cannot find module '@rolldown/binding-darwin-x64'
```

The error chain only shows attempts for `darwin-universal` and `darwin-x64` — never `darwin-arm64`, despite `process.arch === 'arm64'` and `@rolldown/binding-darwin-arm64@1.0.0-rc.17` being installed in `node_modules/@rolldown/binding-darwin-arm64/`.

**Investigation:**
- `node -e "console.log(process.arch)"` → `arm64` (correct)
- `node -e "require('@rolldown/binding-darwin-arm64')"` → loads successfully
- The bundled `node_modules/rolldown/dist/shared/binding-BeU_1iEk.mjs` loader appears to have an `if/else if` chain where the darwin platform block's arm64 branch is unreachable when the prior win32 platform's `else if (process.arch === "arm64")` branch is the syntactic predecessor (post-bundling artifact).
- Reproduces in BOTH the main repo (`/Users/jilizart/Projects/oimg.app`) and this worktree.
- Persists after `rm -rf node_modules package-lock.json && npm install`.

**Impact on Plan 01-02:**
- `npx playwright test --list` works (no Vite needed) — 6 tests detected and parsed correctly.
- `npx playwright test` cannot run because Playwright's `webServer` config fails to start `npm run dev`.
- Plan 01-02's deliverables (config, specs, scripts) are otherwise complete.

**Resolution path:**
Plan 01-03 (or any subsequent plan that touches the Vite dev server) MUST fix this before E2E tests can run. Likely fixes:
1. Pin rolldown binding to a working version (downgrade rolldown-vite to a version pre-dating the broken loader).
2. Switch from `vite@^8.0` (Rolldown-Vite) to `vite@^7.x` (esbuild-based) until rolldown-vite stabilises.
3. Set `NAPI_RS_NATIVE_LIBRARY_PATH` env var to the explicit arm64 binding `.node` file.

**Reference:** https://github.com/npm/cli/issues/4828
