import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { App } from './App'
import { StoreProvider } from './store'
import { ToastProvider } from './ui'
import { CrashGuard } from './crash'

// Une nouvelle version s'installe seule, mais jamais pendant une saisie en cours.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const apply = () => {
      if (document.querySelector('dialog[open]')) setTimeout(apply, 4000)
      else void updateSW(true)
    }
    apply()
  },
})

// Hauteur du clavier virtuel, pour garder les feuilles au-dessus de lui (iOS ne redimensionne pas la page).
const vv = window.visualViewport
if (vv) {
  const sync = () => {
    const root = document.documentElement.style
    root.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`)
    root.setProperty('--vvh', `${Math.round(vv.height)}px`)
  }
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)
  sync()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashGuard>
      <StoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
    </CrashGuard>
  </StrictMode>,
)
