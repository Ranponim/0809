import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from '@/components/ui/sonner.jsx'
import { measureWebVitals } from './utils/webVitals.js'

// Web Vitals 측정 시작
if (typeof window !== 'undefined') {
  measureWebVitals()
  
  // 5초 후 성능 리포트 생성
  setTimeout(() => {
    import('./utils/webVitals.js').then(({ generatePerformanceReport }) => {
      generatePerformanceReport()
    })
  }, 5000)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster position="top-right" richColors />
  </StrictMode>,
)
