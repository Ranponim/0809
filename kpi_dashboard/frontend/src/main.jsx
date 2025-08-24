import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from '@/components/ui/sonner.jsx'

// React를 전역에 등록 (디버깅용)
if (typeof window !== 'undefined') {
  try {
    window.React = { StrictMode }
    window.ReactDOM = { createRoot }
    window.hasReact = true
    window.hasReactDOM = true
    console.log('🔧 React 전역 등록 완료')
  } catch (error) {
    console.error('❌ React 전역 등록 실패:', error)
  }
}

// Web Vitals 측정을 안전하게 처리하는 함수
const initializeWebVitals = async () => {
  try {
    console.log('🔍 Web Vitals 측정 시작...')
    
    // DOM이 완전히 로드된 후에 web-vitals 측정 시작
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        await measureWebVitals()
      })
    } else {
      // DOM이 이미 로드된 경우 즉시 실행
      await measureWebVitals()
    }
    
    // 5초 후 성능 리포트 생성 (에러 핸들링 추가)
    setTimeout(async () => {
      try {
        const { generatePerformanceReport } = await import('./utils/webVitals.js')
        generatePerformanceReport()
      } catch (error) {
        console.warn('⚠️ 성능 리포트 생성 실패:', error)
      }
    }, 5000)
    
  } catch (error) {
    console.warn('⚠️ Web Vitals 초기화 실패:', error)
  }
}

// web-vitals 측정 함수를 안전하게 import하고 실행
const measureWebVitals = async () => {
  try {
    const { measureWebVitals: measureFn } = await import('./utils/webVitals.js')
    await measureFn()
  } catch (error) {
    console.warn('⚠️ Web Vitals 측정 실패:', error)
  }
}

// 브라우저 환경에서만 web-vitals 초기화
if (typeof window !== 'undefined') {
  // 약간의 지연을 두어 다른 초기화가 완료된 후 실행
  setTimeout(initializeWebVitals, 100)
}

// React 렌더링을 안전하게 처리
const initializeApp = () => {
  try {
    console.log('🔄 React 앱 렌더링 시작')
    
    const rootElement = document.getElementById('root')
    if (!rootElement) {
      console.error('❌ root 엘리먼트를 찾을 수 없습니다')
      return
    }
    
    console.log('✅ root 엘리먼트 발견:', rootElement)
    
    const root = createRoot(rootElement)
    console.log('✅ React Root 생성 완료')
    
    root.render(
      // StrictMode 일시 비활성화 - 초기화 순서 문제 해결
      <>
        <App />
        <Toaster position="top-right" richColors />
      </>
    )
    
    console.log('✅ React 앱 렌더링 완료')
    
  } catch (error) {
    console.error('❌ React 앱 렌더링 실패:', error)
    
    // 폴백 UI 표시
    const rootElement = document.getElementById('root')
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
          <div style="text-align: center; padding: 20px;">
            <h2>앱 초기화 중 문제가 발생했습니다</h2>
            <p>페이지를 새로고침해주세요.</p>
            <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
              새로고침
            </button>
          </div>
        </div>
      `
    }
  }
}

// DOM이 준비되면 앱 초기화 (극도로 단순화)
const startApp = () => {
  try {
    console.log('✅ 앱 초기화 시작')
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeApp, 100) // 100ms 지연
      })
    } else {
      // DOM이 이미 로드된 경우 즉시 실행
      setTimeout(initializeApp, 100)
    }
  } catch (error) {
    console.error('❌ startApp 실행 중 오류:', error)
    setTimeout(startApp, 500) // 오류 발생 시 재시도
  }
}

// 즉시 앱 시작
startApp()
