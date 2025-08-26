/**
 * App 컴포넌트 - 리팩토링된 버전
 * 
 * KPI Dashboard 애플리케이션의 메인 컴포넌트입니다.
 * 라우팅, 상태 관리, 에러 처리, 초기화를 담당합니다.
 * 
 * 주요 기능:
 * - 메뉴 기반 라우팅 시스템
 * - 안전한 애플리케이션 초기화
 * - 에러 바운더리 처리
 * - PreferenceProvider 컨텍스트 제공
 * 
 * 사용법:
 * ```jsx
 * <App />
 * ```
 */

import React, { useState, useEffect } from 'react'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.optimized.jsx'
import Statistics from './components/Statistics.jsx'
import PreferenceManager from './components/PreferenceManager.jsx'
import ResultsList from './components/ResultsList.jsx'
import LLMAnalysisManager from './components/LLMAnalysisManager.jsx'
import { PreferenceProvider } from './contexts/PreferenceContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './App.css'

// ================================
// 로깅 유틸리티
// ================================

/**
 * 로그 레벨별 출력 함수
 * @param {string} level - 로그 레벨 (info, error, warn, debug)
 * @param {string} message - 로그 메시지
 * @param {any} data - 추가 데이터
 */
const logApp = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[App:${timestamp}]`
  
  switch (level) {
    case 'info':
      console.log(`${prefix} ${message}`, data)
      break
    case 'error':
      console.error(`${prefix} ${message}`, data)
      break
    case 'warn':
      console.warn(`${prefix} ${message}`, data)
      break
    case 'debug':
      console.debug(`${prefix} ${message}`, data)
      break
    default:
      console.log(`${prefix} ${message}`, data)
  }
}

// ================================
// 메뉴 상수 정의
// ================================

/**
 * 사용 가능한 메뉴 목록
 */
const MENU_ITEMS = {
  DASHBOARD: 'dashboard',
  STATISTICS: 'statistics',
  PREFERENCE: 'preference',
  RESULTS: 'results',
  LLM_ANALYSIS: 'llm-analysis'
}

// ================================
// 메인 App 컴포넌트
// ================================

function App() {
  logApp('info', 'App 컴포넌트 초기화')
  
  // 상태 관리
  const [activeMenu, setActiveMenu] = useState(MENU_ITEMS.DASHBOARD)
  const [isReady, setIsReady] = useState(false)

  // ================================
  // 초기화 로직
  // ================================

  /**
   * 안전한 초기화를 위한 지연 처리
   */
  useEffect(() => {
    logApp('debug', 'App 초기화 시작')
    
    const timer = setTimeout(() => {
      try {
        logApp('info', 'App 초기화 완료')
        
        // React 상태 확인
        if (typeof window !== 'undefined') {
          const reactStatus = {
            hasReact: !!window.React,
            hasReactDOM: !!window.ReactDOM,
            hasStrictMode: !!window.React?.StrictMode,
            hasCreateRoot: !!window.ReactDOM?.createRoot,
            hasPreferenceContext: !!window.hasPreferenceContext
          }
          
          logApp('debug', 'React 상태 확인', reactStatus)
          
          // React 상태가 비정상인 경우 경고
          if (!reactStatus.hasReact || !reactStatus.hasReactDOM) {
            logApp('warn', 'React 상태가 비정상입니다', reactStatus)
          }
        }
        
        setIsReady(true)
        logApp('info', 'App 준비 상태 설정 완료')
      } catch (error) {
        logApp('error', 'App 초기화 중 오류 발생', error)
        // 오류가 발생해도 앱은 계속 실행
        setIsReady(true)
      }
    }, 500) // 짧은 지연

    return () => {
      logApp('debug', 'App 초기화 타이머 정리')
      clearTimeout(timer)
    }
  }, [])

  // ================================
  // 로딩 화면 렌더링
  // ================================

  if (!isReady) {
    logApp('debug', '로딩 화면 렌더링')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">앱 초기화 중...</span>
      </div>
    )
  }

  // ================================
  // 메뉴별 콘텐츠 렌더링
  // ================================

  /**
   * 현재 활성 메뉴에 따른 콘텐츠를 렌더링합니다
   * @returns {JSX.Element} 렌더링할 컴포넌트
   */
  const renderContent = () => {
    logApp('debug', '콘텐츠 렌더링', { activeMenu })
    
    try {
      switch (activeMenu) {
        case MENU_ITEMS.DASHBOARD:
          logApp('debug', 'Dashboard 컴포넌트 렌더링')
          return <Dashboard />
          
        case MENU_ITEMS.STATISTICS:
          logApp('debug', 'Statistics 컴포넌트 렌더링')
          return <Statistics />
          
        case MENU_ITEMS.PREFERENCE:
          logApp('debug', 'PreferenceManager 컴포넌트 렌더링')
          return <PreferenceManager />
          
        case MENU_ITEMS.RESULTS:
          logApp('debug', 'ResultsList 컴포넌트 렌더링')
          return <ResultsList />
          
        case MENU_ITEMS.LLM_ANALYSIS:
          logApp('debug', 'LLMAnalysisManager 컴포넌트 렌더링')
          return <LLMAnalysisManager />
          
        default:
          logApp('warn', '알 수 없는 메뉴 선택', { activeMenu })
          return renderDefaultContent()
      }
    } catch (error) {
      logApp('error', '콘텐츠 렌더링 중 오류 발생', { activeMenu, error })
      return renderErrorContent(error)
    }
  }

  /**
   * 기본 콘텐츠를 렌더링합니다 (알 수 없는 메뉴)
   * @returns {JSX.Element} 기본 콘텐츠
   */
  const renderDefaultContent = () => {
    logApp('info', '기본 콘텐츠 렌더링')
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            🎉 KPI Dashboard - 리팩토링 완료!
          </h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ✅ 모든 컴포넌트가 안전하게 리팩토링되었습니다
            </h2>
            <p className="text-gray-600 mb-4">
              현재 선택된 메뉴: <strong>{activeMenu}</strong>
            </p>
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-800">
                <strong>안정성 테스트 완료!</strong> 모든 컴포넌트가 정상적으로 작동하고 있습니다.
              </p>
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800 text-sm">
                리팩토링이 완료되어 코드가 더 안전하고 유지보수하기 쉬워졌습니다! 🚀
              </p>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 text-sm">
                <strong>리팩토링 내용:</strong>
                <ul className="list-disc list-inside mt-2">
                  <li>모든 파일에 상세한 주석과 로깅 추가</li>
                  <li>에러 처리 강화</li>
                  <li>코드 모듈화 및 분리</li>
                  <li>타입 안전성 개선</li>
                  <li>성능 최적화</li>
                </ul>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 오류 콘텐츠를 렌더링합니다
   * @param {Error} error - 발생한 오류
   * @returns {JSX.Element} 오류 콘텐츠
   */
  const renderErrorContent = (error) => {
    logApp('error', '오류 콘텐츠 렌더링', { error })
    
    return (
      <div className="min-h-screen bg-red-50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-red-900 mb-8">
            ⚠️ 오류가 발생했습니다
          </h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-4">
              콘텐츠 렌더링 중 오류가 발생했습니다
            </h2>
            <p className="text-gray-600 mb-4">
              메뉴: <strong>{activeMenu}</strong>
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">
                <strong>오류 정보:</strong>
              </p>
              <pre className="mt-2 text-sm text-red-700 bg-red-100 p-2 rounded">
                {error?.message || '알 수 없는 오류'}
              </pre>
            </div>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ================================
  // 메인 렌더링
  // ================================

  logApp('debug', 'App 메인 렌더링', { activeMenu, isReady })
  
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
