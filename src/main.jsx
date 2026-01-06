import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Homepage from './components/homepage/Homepage.jsx'
import AboutPage from './components/homepage/pages/AboutPage.jsx'
import NewsPage from './components/homepage/pages/NewsPage.jsx'
import NoticePage from './components/homepage/pages/NoticePage.jsx'
import ContactPage from './components/homepage/pages/ContactPage.jsx'
import DaechiPage from './components/homepage/pages/DaechiPage.jsx'
import DarakbangPage from './components/homepage/pages/DarakbangPage.jsx'
import PrivacyPage from './components/homepage/pages/PrivacyPage.jsx'
import ParentReport from './components/homepage/pages/ParentReport.jsx'

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
        
        {/* 서브 페이지들 */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/notice" element={<NoticePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/daechi" element={<DaechiPage />} />
        <Route path="/darakbang" element={<DarakbangPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/parent-report" element={<ParentReport />} />
        
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
