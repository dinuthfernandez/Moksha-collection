import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { applyTheme, getInitialTheme } from './utils/theme'
import './styles/theme.css'

// Applied synchronously, before the first paint, so the correct theme is
// visible immediately instead of flashing dark-then-light (or vice versa).
applyTheme(getInitialTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
