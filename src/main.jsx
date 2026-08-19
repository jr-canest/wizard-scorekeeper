import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { isTestMode } from './utils/testMode'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Test-mode ribbon — pinned to the bottom so it never covers the
        sticky phase status bar at the top. */}
    {isTestMode() && (
      <div className="fixed bottom-0 inset-x-0 z-[90] bg-purple-900/90 border-t border-purple-500/40 text-purple-200 text-[11px] font-semibold py-1 text-center pointer-events-none">
        🧪 TEST GAME — nothing is saved to history
      </div>
    )}
  </StrictMode>,
)
