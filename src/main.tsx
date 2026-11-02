import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.tsx'
import { applyTheme, storedTheme } from './ui/theme.ts'
import './ui/theme.css'

applyTheme(storedTheme())

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Unable to mount RPG: root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
