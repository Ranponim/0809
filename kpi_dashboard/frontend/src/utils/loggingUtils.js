/**
 * Logging Utilities
 * 
 * 동기화 시스템에서 사용할 일관된 로깅 유틸리티입니다.
 * 개발 환경에서는 콘솔에 출력하고, 프로덕션에서는 조건부로 출력합니다.
 * 
 * Task 8.1: Initial Load Server-First Sync를 위한 로깅 시스템
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
  DEBUG: 3
}

// 환경에 따른 로그 레벨 설정
const getCurrentLogLevel = () => {
  if (import.meta.env.MODE === 'development') {
    return LOG_LEVELS.DEBUG
  } else if (import.meta.env.MODE === 'production') {
    return LOG_LEVELS.WARNING
  }
  return LOG_LEVELS.INFO
}

const currentLogLevel = getCurrentLogLevel()

/**
 * 로그 메시지를 포맷팅합니다
 * @param {string} level - 로그 레벨
 * @param {string} message - 메시지
 * @param {any} data - 추가 데이터
 * @returns {Object} 포맷된 로그 객체
 */
const formatLogMessage = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level,
    message,
    component: 'PreferenceSync'
  }

  if (data !== null && data !== undefined) {
    logEntry.data = data
  }

  return logEntry
}

/**
 * 콘솔에 로그를 출력합니다
 * @param {string} level - 로그 레벨
 * @param {Object} logEntry - 로그 엔트리
 */
const outputToConsole = (level, logEntry) => {
  const prefix = `🔄 [${logEntry.timestamp}] ${level.toUpperCase()}:`
  
  switch (level) {
    case 'error':
      console.error(prefix, logEntry.message, logEntry.data || '')
      break
    case 'warning':
      console.warn(prefix, logEntry.message, logEntry.data || '')
      break
    case 'info':
      console.info(prefix, logEntry.message, logEntry.data || '')
      break
    case 'debug':
      console.log(prefix, logEntry.message, logEntry.data || '')
      break
    default:
      console.log(prefix, logEntry.message, logEntry.data || '')
  }
}

/**
 * 에러 로그를 출력합니다
 * @param {string} message - 에러 메시지
 * @param {any} error - 에러 객체 또는 데이터
 */
export const logError = (message, error = null) => {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    const logEntry = formatLogMessage('error', message, error)
    outputToConsole('error', logEntry)
    
    // 에러는 항상 기록 (개발자 도구에서 추적 가능)
    if (error instanceof Error) {
      console.trace('Error stack trace:', error)
    }
  }
}

/**
 * 경고 로그를 출력합니다
 * @param {string} message - 경고 메시지
 * @param {any} data - 추가 데이터
 */
export const logWarning = (message, data = null) => {
  if (currentLogLevel >= LOG_LEVELS.WARNING) {
    const logEntry = formatLogMessage('warning', message, data)
    outputToConsole('warning', logEntry)
  }
}

/**
 * 정보 로그를 출력합니다
 * @param {string} message - 정보 메시지
 * @param {any} data - 추가 데이터
 */
export const logInfo = (message, data = null) => {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    const logEntry = formatLogMessage('info', message, data)
    outputToConsole('info', logEntry)
  }
}

/**
 * 디버그 로그를 출력합니다
 * @param {string} message - 디버그 메시지
 * @param {any} data - 추가 데이터
 */
export const logDebug = (message, data = null) => {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    const logEntry = formatLogMessage('debug', message, data)
    outputToConsole('debug', logEntry)
  }
}

/**
 * 동기화 작업의 시작을 로그로 남깁니다
 * @param {string} operation - 작업명
 * @param {Object} context - 작업 컨텍스트
 */
export const logSyncStart = (operation, context = {}) => {
  logInfo(`🚀 동기화 시작: ${operation}`, context)
}

/**
 * 동기화 작업의 성공을 로그로 남깁니다
 * @param {string} operation - 작업명
 * @param {Object} result - 작업 결과
 */
export const logSyncSuccess = (operation, result = {}) => {
  logInfo(`✅ 동기화 성공: ${operation}`, result)
}

/**
 * 동기화 작업의 실패를 로그로 남깁니다
 * @param {string} operation - 작업명
 * @param {any} error - 에러 정보
 */
export const logSyncError = (operation, error) => {
  logError(`❌ 동기화 실패: ${operation}`, error)
}

/**
 * API 호출 시작을 로그로 남깁니다
 * @param {string} method - HTTP 메서드
 * @param {string} url - API URL
 * @param {Object} params - 요청 파라미터
 */
export const logApiCall = (method, url, params = {}) => {
  logDebug(`🌐 API 호출: ${method.toUpperCase()} ${url}`, params)
}

/**
 * API 응답을 로그로 남깁니다
 * @param {string} method - HTTP 메서드
 * @param {string} url - API URL
 * @param {number} status - 응답 상태 코드
 * @param {any} data - 응답 데이터 (민감한 정보 제외)
 */
export const logApiResponse = (method, url, status, data = null) => {
  const message = `📨 API 응답: ${method.toUpperCase()} ${url} - ${status}`
  if (status >= 200 && status < 300) {
    logDebug(message, data)
  } else {
    logWarning(message, data)
  }
}

/**
 * 현재 로그 레벨을 반환합니다
 * @returns {number} 현재 로그 레벨
 */
export const getCurrentLevel = () => currentLogLevel

/**
 * 로그 레벨 상수를 반환합니다
 * @returns {Object} 로그 레벨 상수
 */
export const getLogLevels = () => ({ ...LOG_LEVELS })
