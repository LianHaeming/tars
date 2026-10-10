import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@tars/ui/globals.css'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) navigator.serviceWorker.register(import.meta.env.BASE_URL + 'app-sw.js').catch(() => {})
