import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { registerCommands } from '@/stores/ui'
import { ALL_COMMANDS } from '@/lib/commands'

export const isCrossOriginIsolated: boolean = crossOriginIsolated
if (!isCrossOriginIsolated) {
  console.error(
    '[oimg] crossOriginIsolated is false. ' +
    'COOP/COEP headers are missing or a cross-origin resource is blocking COEP. ' +
    'Codec workers will not function in Phase 2+.'
  )
}

// Inject ALL_COMMANDS into ui.ts before first render so $cmdFlat is populated immediately.
registerCommands(ALL_COMMANDS.flatMap(g => g.items))

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[oimg] #root element not found — check index.html')
}
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
