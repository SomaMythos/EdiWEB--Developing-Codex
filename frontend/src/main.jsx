import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/theme-legacy.css'
import './styles/theme-custom.css'
import './index.css'
import './styles/notification-tokens.css'
import { ThemeSkinProvider } from './theme/ThemeSkinProvider.jsx'
import { applyThemeSkinToDocument, readStoredThemeSkin } from './theme/skin.js'

applyThemeSkinToDocument(readStoredThemeSkin())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeSkinProvider>
      <App />
    </ThemeSkinProvider>
  </React.StrictMode>,
)
