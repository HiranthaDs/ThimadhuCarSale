import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tailwind.css'
import './index.css'
import App from './App.jsx'
import PwaUpdate from './components/PwaUpdate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PwaUpdate />
  </StrictMode>,
)
