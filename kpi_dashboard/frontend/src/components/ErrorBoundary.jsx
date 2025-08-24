import React from 'react'

/**
 * React Error Boundary 컴포넌트
 * 
 * 순환참조나 초기화 오류가 발생해도 앱이 완전히 크래시되지 않도록 보호합니다.
 * 에러 발생 시 사용자 친화적인 오류 메시지를 표시하고 복구 옵션을 제공합니다.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error) {
    // 에러가 발생하면 상태를 업데이트하여 다음 렌더링에서 폴백 UI를 표시
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // 상세한 에러 로깅
    console.error('🚨 ErrorBoundary에서 에러 발생:', error)
    console.error('🚨 에러 메시지:', error.message)
    console.error('🚨 에러 스택:', error.stack)
    console.error('🚨 에러 정보:', errorInfo)
    console.error('🚨 컴포넌트 스택:', errorInfo.componentStack)
    
    // 에러 메시지를 제목에도 출력 (더 눈에 띄게)
    console.error(`🚨🚨🚨 === ERROR SUMMARY === 🚨🚨🚨`)
    console.error(`📝 Error Type: ${error.name}`)
    console.error(`📝 Error Message: ${error.message}`)
    console.error(`📝 First Stack Line: ${error.stack?.split('\n')?.[1] || 'N/A'}`)
    console.error(`🚨🚨🚨 =================== 🚨🚨🚨`)
    
    // 에러 객체의 모든 속성 출력
    console.error('🚨 에러 객체 전체:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      fileName: error.fileName,
      lineNumber: error.lineNumber,
      columnNumber: error.columnNumber
    })
    
    // 에러 객체의 모든 열거 가능한 속성 출력
    console.error('🚨 에러 객체 모든 속성:')
    for (const key in error) {
      try {
        console.error(`  ${key}:`, error[key])
      } catch (e) {
        console.error(`  ${key}: [접근 불가]`)
      }
    }
    
    // 에러 객체의 프로토타입 체인 확인
    console.error('🚨 에러 객체 프로토타입 체인:')
    let current = error
    let level = 0
    while (current && level < 5) {
      console.error(`  Level ${level}:`, Object.getPrototypeOf(current)?.constructor?.name || 'Unknown')
      current = Object.getPrototypeOf(current)
      level++
    }
    
    // 에러 타입별 상세 분석
    if (error.name === 'ReferenceError') {
      console.error('🔍 ReferenceError 상세 분석:')
      console.error('  - 변수/함수가 정의되지 않았거나 접근할 수 없음')
      console.error('  - 모듈 import 순서 문제 가능성')
      console.error('  - 호이스팅 문제 가능성')
    }
    
    if (error.name === 'TypeError') {
      console.error('🔍 TypeError 상세 분석:')
      console.error('  - 객체가 null/undefined인데 속성에 접근 시도')
      console.error('  - 함수가 아닌 것을 함수로 호출')
      console.error('  - 잘못된 타입의 값 사용')
    }
    
    // 에러 타입별 분석
    if (error.message.includes('Cannot access')) {
      console.error('🔍 순환참조 또는 초기화 순서 문제로 추정됩니다.')
      console.error('🔍 해결 방안: 모듈 import 순서 확인, 지연 초기화 적용')
    }
    if (error.message.includes('before initialization')) {
      console.error('🔍 변수/함수 초기화 순서 문제로 추정됩니다.')
      console.error('🔍 해결 방안: 함수 선언을 상단으로 이동, 호이스팅 확인')
    }
    if (error.message.includes('is not a function')) {
      console.error('🔍 함수 호출 문제로 추정됩니다.')
      console.error('🔍 해결 방안: 함수 존재 여부 확인, import 확인')
    }
    
    // 추가 디버깅 정보
    console.error('🔍 현재 URL:', window.location.href)
    console.error('🔍 User Agent:', navigator.userAgent)
    console.error('🔍 현재 시간:', new Date().toISOString())
    
    // 에러 발생 시점의 전역 상태 확인
    if (typeof window !== 'undefined') {
      console.error('🔍 window 객체 상태:', {
        hasReact: !!window.React,
        hasReactDOM: !!window.ReactDOM,
        hasPreferenceContext: !!window.__PREFERENCE_CONTEXT_DEBUG__,
        runtimeConfig: window.__RUNTIME_CONFIG__
      })
    }
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    })

    // 에러를 서버로 전송 (선택적)
    if (process.env.NODE_ENV === 'production') {
      // 실제 운영 환경에서는 에러 추적 서비스로 전송
      // Example: logErrorToService(error, errorInfo)
    }
  }

  handleRetry = () => {
    console.log('🔄 앱 재시도 중...')
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  handleReload = () => {
    console.log('🔄 페이지 새로고침 중...')
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // 에러 발생 시 폴백 UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              {/* 에러 아이콘 */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg 
                  className="h-6 w-6 text-red-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                  />
                </svg>
              </div>

              {/* 에러 메시지 */}
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                앱 초기화 중 문제가 발생했습니다
              </h2>
              
              <p className="text-sm text-gray-600 mb-6">
                순환참조나 초기화 오류로 인해 앱을 로드할 수 없습니다. 
                아래 버튼을 클릭하여 다시 시도해주세요.
              </p>

              {/* 개발 환경에서만 상세 에러 정보 표시 */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    개발자용: 에러 상세 정보
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-red-600 overflow-auto max-h-32">
                    <div><strong>에러:</strong> {this.state.error.toString()}</div>
                    {this.state.errorInfo && (
                      <div className="mt-2">
                        <strong>스택 트레이스:</strong>
                        <pre className="whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* 액션 버튼들 */}
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  다시 시도 ({this.state.retryCount + 1}번째)
                </button>
                
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  페이지 새로고침
                </button>
              </div>

              {/* 추가 도움말 */}
              <div className="mt-4 text-xs text-gray-500">
                <p>문제가 지속되면 브라우저 캐시를 정리해보세요.</p>
                <p>Chrome: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)</p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // 정상적인 경우 자식 컴포넌트 렌더링
    return this.props.children
  }
}

export default ErrorBoundary
