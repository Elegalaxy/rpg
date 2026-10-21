import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.tsx'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Unable to mount RPG: root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
