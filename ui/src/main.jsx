import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/tokens.scss'
import './index.css'
import ThemeProvider from './lib/theme-provider.jsx'

const rawBasePath = import.meta.env.VITE_APP_BASE_PATH || '/administracion'
const withLeadingSlash = rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`
const appBasePath = withLeadingSlash.replace(/\/+$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter basename={appBasePath}>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
