import '../styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HudApp } from './HudApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HudApp />
  </StrictMode>
)
