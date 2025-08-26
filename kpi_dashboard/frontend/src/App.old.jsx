import { useState, useEffect } from 'react'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.optimized.jsx' // 7단계: 실제 Dashboard 컴포넌트 활성화
import Statistics from './components/Statistics.jsx' // 8단계: Statistics 컴포넌트 활성화
import PreferenceManager from './components/PreferenceManager.jsx' // 9단계: PreferenceManager 컴포넌트 활성화
import ResultsList from './components/ResultsList.jsx' // 10단계: ResultsList 컴포넌트 활성화
import LLMAnalysisManager from './components/LLMAnalysisManager.jsx' // 11단계: LLMAnalysisManager 컴포넌트 활성화
// 모든 주요 컴포넌트 활성화 완료!

// import {
//   SuspenseDashboard as Dashboard,
//   SuspenseStatistics as Statistics,
//   SuspensePreferenceManager as PreferenceManager,
//   SuspenseResultsList as ResultsList,
//   SuspenseLLMAnalysisManager as LLMAnalysisManager
// } from './components/LazyComponents.jsx'
// import Preference from './components/Preference.jsx'
// import PreferenceTest from './components/PreferenceTest.jsx'
// import UserSettingsTest from './components/UserSettingsTest.jsx'
import { PreferenceProvider } from './contexts/PreferenceContext.jsx' // 3단계: PreferenceProvider 활성화
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './App.css'

function App() {
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [isReady, setIsReady] = useState(false)

  // 안전한 초기화를 위한 지연
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('🔄 App 초기화 완료')
      
      // React 상태 확인
      if (typeof window !== 'undefined') {
        console.log('🔍 React 상태 확인:', {
          hasReact: !!window.React,
          hasReactDOM: !!window.ReactDOM,
          hasStrictMode: !!window.React?.StrictMode,
          hasCreateRoot: !!window.ReactDOM?.createRoot,
          hasPreferenceContext: !!window.hasPreferenceContext
        })
      }
      
      setIsReady(true)
    }, 500) // 짧은 지연

    return () => clearTimeout(timer)
  }, [])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">앱 초기화 중...</span>
      </div>
    )
  }

  const renderContent = () => {
    // Dashboard 메뉴일 때 실제 Dashboard 컴포넌트 렌더링
    if (activeMenu === 'dashboard') {
      return <Dashboard />
    }

    // Statistics 메뉴일 때 Statistics 컴포넌트 렌더링
    if (activeMenu === 'statistics') {
      return <Statistics />
    }

    // Preference 메뉴일 때 PreferenceManager 컴포넌트 렌더링
    if (activeMenu === 'preference') {
      return <PreferenceManager />
    }

    // Results 메뉴일 때 ResultsList 컴포넌트 렌더링
    if (activeMenu === 'results') {
      return <ResultsList />
    }

    // LLM Analysis 메뉴일 때 LLMAnalysisManager 컴포넌트 렌더링
    if (activeMenu === 'llm-analysis') {
      return <LLMAnalysisManager />
    }

    // 다른 메뉴들에 대해서는 기본 메시지
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            🎉 KPI Dashboard - 11단계 진행 중!
          </h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ✅ Layout + PreferenceProvider + Dashboard + Statistics + PreferenceManager + ResultsList + LLMAnalysisManager 조합 테스트
            </h2>
            <p className="text-gray-600 mb-4">
              현재 선택된 메뉴: <strong>{activeMenu}</strong>
            </p>
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-800">
                <strong>안정성 테스트 완료!</strong> 기본 구조가 정상적으로 작동하고 있습니다.
              </p>
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800 text-sm">
                모든 주요 컴포넌트가 활성화되었습니다! 🚀
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PreferenceProvider>
        <Layout activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
          {renderContent()}
        </Layout>
      </PreferenceProvider>
    </ErrorBoundary>
  )
}

export default App
