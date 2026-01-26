import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ComponentDemo from './ComponentDemo'
import './globals.css'
import './styles.css'
import { initializeTheme } from './lib/theme'

// Initialize theme before render to prevent flash
initializeTheme()

// Check if demo mode is requested via URL param (?demo) or env var
const isDemo = window.location.search.includes('demo') ||
  import.meta.env.VITE_DEMO_MODE === 'true'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDemo ? <ComponentDemo /> : <App />}
  </React.StrictMode>
)
