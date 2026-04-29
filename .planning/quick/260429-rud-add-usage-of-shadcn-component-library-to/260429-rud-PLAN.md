---
phase: quick-260429-rud
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - vite.config.ts
  - tsconfig.json
  - tsconfig.app.json
  - tsconfig.node.json
  - index.html
  - src/main.tsx
  - src/App.tsx
  - src/index.css
  - src/vite-env.d.ts
  - components.json
autonomous: true
requirements: [UI-01]
must_haves:
  truths:
    - "Vite dev server starts without errors"
    - "shadcn/ui init completes and components.json exists"
    - "Tailwind v4 design tokens from example-ui/ are present in src/index.css (oklch palette, Inter, JetBrains Mono, accent green ~145°)"
    - "A sample shadcn Button component renders in App.tsx"
  artifacts:
    - path: "vite.config.ts"
      provides: "Vite + React plugin configuration"
    - path: "src/index.css"
      provides: "Tailwind v4 @import + OIMG design tokens as CSS custom properties"
    - path: "components.json"
      provides: "shadcn configuration pointing to src/components/ui"
    - path: "src/App.tsx"
      provides: "Smoke-test render with Button from shadcn"
  key_links:
    - from: "src/index.css"
      to: "src/main.tsx"
      via: "import './index.css'"
      pattern: "import.*index.css"
    - from: "components.json"
      to: "src/components/ui"
      via: "shadcn add resolves path"
      pattern: "components/ui"
---

<objective>
Scaffold the Vite + React + TypeScript application, integrate Tailwind CSS v4 and shadcn/ui, and wire in the OIMG design tokens from example-ui/ so Phase 1 development can begin on a solid UI foundation.

Purpose: The project currently has only a UMD prototype in example-ui/ and an empty package.json. This plan creates the real Vite app, plugs in shadcn/ui, and carries the locked visual identity (oklch palette, Inter + JetBrains Mono, accent green ~145°, dark default + light theme) into the new build system.

Output: A runnable Vite dev server serving a React + TS app with Tailwind v4 + shadcn/ui configured and OIMG design tokens in place.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@example-ui/OIMG.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Vite + React + TypeScript app and install dependencies</name>
  <files>
    package.json
    vite.config.ts
    tsconfig.json
    tsconfig.app.json
    tsconfig.node.json
    index.html
    src/main.tsx
    src/App.tsx
    src/vite-env.d.ts
  </files>
  <action>
The root package.json currently only has `shadcn ^4.6.0` as a devDependency. We need a full Vite app scaffold. Do NOT use `npm create vite@latest` interactively — instead write the files directly.

1. **Rewrite package.json** — merge the existing devDependency with the full app manifest:

```json
{
  "name": "oimg-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2",
    "react-dom": "^19.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0",
    "shadcn": "^4.6.0",
    "tailwindcss": "^4.1",
    "@tailwindcss/vite": "^4.1",
    "typescript": "^5.9",
    "@types/react": "^19.1",
    "@types/react-dom": "^19.1",
    "vite": "^8.0"
  }
}
```

2. **Write vite.config.ts**:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

3. **Write tsconfig.json** (project references config):

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

4. **Write tsconfig.app.json**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

5. **Write tsconfig.node.json**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

6. **Write index.html**:

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>oimg.app — Image Optimizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

7. **Write src/main.tsx**:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

8. **Write src/App.tsx** (placeholder — will be replaced in Phase 1):

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-2xl font-semibold text-accent-green">oimg.app</h1>
      <p className="text-muted-foreground mt-2">Image optimizer — coming soon.</p>
    </div>
  )
}
```

9. **Write src/vite-env.d.ts**:

```ts
/// <reference types="vite/client" />
```

10. **Install dependencies**:

```bash
npm install
```
  </action>
  <verify>
    <automated>cd /Users/jilizart/Projects/oimg.app && node -e "require('./node_modules/vite/package.json')" && echo "vite installed" && node -e "require('./node_modules/@vitejs/plugin-react/package.json')" && echo "plugin-react installed"</automated>
  </verify>
  <done>package.json, vite.config.ts, tsconfig files, index.html, src/main.tsx, src/App.tsx written; npm install succeeds with no fatal errors.</done>
</task>

<task type="auto">
  <name>Task 2: Run shadcn init and wire OIMG design tokens into src/index.css</name>
  <files>
    components.json
    src/index.css
  </files>
  <action>
**Step A — Run shadcn init non-interactively.**

shadcn/ui with Tailwind v4 does not need a traditional tailwind.config.js. Run:

```bash
npx shadcn@latest init --defaults --base-color neutral --css-variables --no-color-config
```

If the CLI is not fully non-interactive, pass answers via stdin or use the `--yes` / `--defaults` flags. Expected output: `components.json` created, `src/index.css` updated with CSS variable scaffolding.

Verify `components.json` was created. If shadcn init wrote to a different CSS file than `src/index.css`, move its output there.

Expected `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Step B — Overwrite src/index.css with OIMG design tokens.**

After shadcn init, REPLACE the generated `src/index.css` entirely with the OIMG token system sourced from `example-ui/OIMG.html`. The tokens below are extracted directly from the prototype's `:root` / `.dark` blocks:

```css
@import "tailwindcss";

/* ─── Typography ─────────────────────────────────────────── */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap");

/* NOTE: Production build must replace Google Fonts with self-hosted
   subsets (COOP/COEP blocks external fetches). This import is for
   dev-server convenience ONLY. See STATE.md blocker: font subsetting. */

@layer base {
  :root {
    --font-sans: 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;

    /* Accent palette */
    --color-accent-green:  oklch(0.72 0.18 145);
    --color-accent-amber:  oklch(0.78 0.16 75);
    --color-accent-red:    oklch(0.63 0.22 25);

    /* Neutral surface scale — light theme */
    --color-bg:            oklch(0.97 0 0);
    --color-bg-elevated:   oklch(0.93 0 0);
    --color-border:        oklch(0.88 0 0);
    --color-muted:         oklch(0.55 0 0);
    --color-foreground:    oklch(0.15 0 0);

    /* shadcn semantic aliases — light theme */
    --background:          var(--color-bg);
    --foreground:          var(--color-foreground);
    --card:                var(--color-bg-elevated);
    --card-foreground:     var(--color-foreground);
    --popover:             var(--color-bg-elevated);
    --popover-foreground:  var(--color-foreground);
    --primary:             var(--color-accent-green);
    --primary-foreground:  oklch(0.10 0 0);
    --secondary:           var(--color-bg-elevated);
    --secondary-foreground: var(--color-foreground);
    --muted:               var(--color-bg-elevated);
    --muted-foreground:    var(--color-muted);
    --accent:              var(--color-bg-elevated);
    --accent-foreground:   var(--color-foreground);
    --destructive:         var(--color-accent-red);
    --destructive-foreground: oklch(0.98 0 0);
    --border:              var(--color-border);
    --input:               var(--color-border);
    --ring:                var(--color-accent-green);
    --radius:              0.5rem;
  }

  .dark {
    /* Neutral surface scale — dark theme (default) */
    --color-bg:            oklch(0.12 0 0);
    --color-bg-elevated:   oklch(0.17 0 0);
    --color-border:        oklch(0.25 0 0);
    --color-muted:         oklch(0.50 0 0);
    --color-foreground:    oklch(0.92 0 0);

    /* shadcn semantic aliases — dark theme */
    --background:          var(--color-bg);
    --foreground:          var(--color-foreground);
    --card:                var(--color-bg-elevated);
    --card-foreground:     var(--color-foreground);
    --popover:             var(--color-bg-elevated);
    --popover-foreground:  var(--color-foreground);
    --primary:             var(--color-accent-green);
    --primary-foreground:  oklch(0.10 0 0);
    --secondary:           var(--color-bg-elevated);
    --secondary-foreground: var(--color-foreground);
    --muted:               var(--color-bg-elevated);
    --muted-foreground:    var(--color-muted);
    --accent:              var(--color-bg-elevated);
    --accent-foreground:   var(--color-foreground);
    --destructive:         var(--color-accent-red);
    --destructive-foreground: oklch(0.98 0 0);
    --border:              var(--color-border);
    --input:               var(--color-border);
    --ring:                var(--color-accent-green);
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans;
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  code, pre, kbd {
    font-family: var(--font-mono);
  }
}

/* ─── Tailwind theme extensions ─────────────────────────── */
@theme {
  --color-accent-green:  var(--color-accent-green);
  --color-accent-amber:  var(--color-accent-amber);
  --color-accent-red:    var(--color-accent-red);
  --color-background:    var(--background);
  --color-foreground:    var(--foreground);
  --color-muted:         var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border:        var(--border);
  --color-card:          var(--card);
  --color-primary:       var(--primary);
  --font-sans:           var(--font-sans);
  --font-mono:           var(--font-mono);
  --radius-md:           var(--radius);
}
```

**Step C — Add a shadcn Button to smoke-test the setup.**

```bash
npx shadcn@latest add button --yes
```

Update `src/App.tsx` to import and render the Button:

```tsx
import { Button } from '@/components/ui/button'

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8 space-y-4">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-accent-green)' }}>
        oimg.app
      </h1>
      <p className="text-muted-foreground">Image optimizer — shell ready.</p>
      <Button>shadcn/ui works</Button>
      <Button variant="outline">Outline variant</Button>
    </div>
  )
}
```

**Step D — Verify dev server starts.**

```bash
npm run dev -- --port 5173 &
sleep 4
curl -sf http://localhost:5173 | grep -c 'oimg' && kill %1
```

If curl returns ≥ 1, the server is up and serving.
  </action>
  <verify>
    <automated>cd /Users/jilizart/Projects/oimg.app && test -f components.json && test -f src/index.css && grep -c 'accent-green' src/index.css && test -f src/components/ui/button.tsx && echo "all artifacts present"</automated>
  </verify>
  <done>
  - components.json exists with shadcn config
  - src/index.css contains OIMG oklch tokens (accent-green, dark/light themes)
  - src/components/ui/button.tsx exists (shadcn add button ran successfully)
  - npm run dev starts without TypeScript or Vite errors
  - App renders in browser with green "oimg.app" heading and two Button variants
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Google Fonts CDN (dev only) | src/index.css imports fonts from fonts.googleapis.com — blocked by COOP/COEP in production builds |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Information Disclosure | Google Fonts import in index.css | accept (dev only) | Comment marks this as dev-only. Phase 1 plan must replace with self-hosted subsets before COOP/COEP headers are enabled — flagged in STATE.md blockers |
| T-quick-02 | Tampering | shadcn component code generation | accept | Components are generated once and committed; no runtime code generation |
</threat_model>

<verification>
After both tasks complete:

```bash
# 1. Verify Vite builds without errors
cd /Users/jilizart/Projects/oimg.app && npm run build 2>&1 | tail -5

# 2. Verify design tokens are present
grep 'accent-green\|JetBrains\|Inter' src/index.css

# 3. Verify shadcn component exists
test -f src/components/ui/button.tsx && echo "button.tsx OK"

# 4. Verify components.json points to correct CSS
node -e "const c=require('./components.json'); console.log(c.tailwind.css === 'src/index.css' ? 'OK' : 'WRONG CSS PATH')"
```
</verification>

<success_criteria>
- `npm run dev` starts a Vite dev server on port 5173 with zero errors
- `npm run build` produces a dist/ directory with no TypeScript errors
- `src/index.css` contains the full OIMG oklch token system (accent green ~145°, dark + light themes, Inter + JetBrains Mono)
- `components.json` exists and references `src/index.css`
- `src/components/ui/button.tsx` exists (shadcn add button succeeded)
- App.tsx renders a green "oimg.app" heading and two Button variants in the browser
</success_criteria>

<output>
After completion, create `.planning/quick/260429-rud-add-usage-of-shadcn-component-library-to/260429-rud-SUMMARY.md` with:
- What was scaffolded
- shadcn version installed
- Design token decisions (oklch values used)
- Gotchas encountered (if any)
- Note on Google Fonts dev-only import and the self-hosting requirement before COOP/COEP
</output>
