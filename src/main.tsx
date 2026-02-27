import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ActionLogProvider } from './ActionLogContext'
import { LanguageProvider } from './translations'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ActionLogProvider>
        <App />
      </ActionLogProvider>
    </LanguageProvider>
  </StrictMode>,
)
