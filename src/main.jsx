import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/design-tokens.css'
import './styles/landing.css'
import './styles/auth.css'
import './styles/v2-demo.css'
import './styles/system.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
