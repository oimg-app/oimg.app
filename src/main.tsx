import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'

if (!crossOriginIsolated) {
  console.error(
    '[oimg] crossOriginIsolated is false. ' +
    'COOP/COEP headers are missing or a cross-origin resource is blocking COEP. ' +
    'Codec workers will not function in Phase 2+.'
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
