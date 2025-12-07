import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Homepage from './components/homepage/Homepage.jsx'

// LMS는 필요할 때만 로드 (Firebase 에러 방지)
const App = lazy(() => import('./App.jsx'))

// 로딩 화면
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }}></div>
        <p>로딩 중...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 메인 홈페이지 */}
        <Route path="/" element={<Homepage />} />
        
        {/* LMS (학습관리시스템) - 필요할 때만 로드 */}
        <Route path="/lms" element={
          <Suspense fallback={<LoadingScreen />}>
            <App />
          </Suspense>
        } />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
