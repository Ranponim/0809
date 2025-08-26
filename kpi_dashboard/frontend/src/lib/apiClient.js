/**
 * API 클라이언트 모듈 - 리팩토링된 버전
 * 
 * 백엔드 API와의 통신을 담당하는 axios 기반 클라이언트입니다.
 * 런타임 설정, 에러 처리, 로깅 기능을 포함합니다.
 * 
 * 주요 기능:
 * - 런타임 설정 기반 API 엔드포인트 구성
 * - 통합된 에러 처리 및 사용자 피드백
 * - LLM 분석 API 함수들
 * - 사용자 설정 동기화 API 함수들
 * 
 * 사용법:
 * ```javascript
 * import apiClient, { triggerLLMAnalysis, getUserPreferences } from '@/lib/apiClient.js'
 * ```
 */

import axios from 'axios'
import { toast } from 'sonner'

// ================================
// 로깅 유틸리티
// ================================

/**
 * 로그 레벨별 출력 함수
 * @param {string} level - 로그 레벨 (info, error, warn, debug)
 * @param {string} message - 로그 메시지
 * @param {any} data - 추가 데이터
 */
const logApiClient = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[ApiClient:${timestamp}]`
  
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
// 설정 및 초기화
// ================================

/**
 * 런타임 설정에서 API 기본 URL을 가져옵니다
 * @returns {string} API 기본 URL
 */
const getBaseURL = () => {
  try {
    // 런타임 구성(window.__RUNTIME_CONFIG__) → Vite env → 기본값 순으로 사용
    // DOCKER RUN 시 -e BACKEND_BASE_URL="http://host:port" 또는 -e VITE_API_BASE_URL 로 주입하면 런타임에 즉시 반영됩니다.
    const runtimeCfg = typeof window !== 'undefined' ? (window.__RUNTIME_CONFIG__ || {}) : {}
    const runtimeBase = runtimeCfg.BACKEND_BASE_URL || runtimeCfg.VITE_API_BASE_URL
    const baseURL = (runtimeBase && String(runtimeBase).trim()) || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    
    logApiClient('info', 'API 기본 URL 설정', { baseURL, runtimeCfg: Object.keys(runtimeCfg) })
    return baseURL
  } catch (error) {
    logApiClient('error', 'API 기본 URL 설정 오류', error)
    return 'http://localhost:8000'
  }
}

/**
 * 안전한 에러 메시지 추출 함수
 * @param {Error} error - 에러 객체
 * @returns {string} 사용자 친화적인 에러 메시지
 */
const getErrorMessage = (error) => {
  try {
    if (error?.response?.data?.detail) {
      return error.response.data.detail
    }
    if (error?.message) {
      return error.message
    }
    return '알 수 없는 오류가 발생했습니다.'
  } catch (e) {
    logApiClient('error', '에러 메시지 추출 실패', e)
    return '알 수 없는 오류가 발생했습니다.'
  }
}

/**
 * 민감한 정보를 숨기는 함수
 * @param {Object} obj - 객체
 * @param {string[]} sensitiveKeys - 숨길 키 목록
 * @returns {Object} 민감한 정보가 숨겨진 객체
 */
const sanitizeObject = (obj, sensitiveKeys = ['password', 'token', 'secret']) => {
  if (!obj || typeof obj !== 'object') return obj
  
  const sanitized = { ...obj }
  sensitiveKeys.forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '[HIDDEN]'
    }
  })
  return sanitized
}

// ================================
// API 클라이언트 생성
// ================================

const baseURL = getBaseURL()

const apiClient = axios.create({
  baseURL,
  timeout: 15000,
})

logApiClient('info', 'API 클라이언트 초기화 완료', { baseURL, timeout: 15000 })

// ================================
// 인터셉터 설정
// ================================

/**
 * 요청 인터셉터: 요청 로깅
 */
apiClient.interceptors.request.use(
  (config) => {
    logApiClient('debug', 'API 요청 시작', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      hasData: !!config.data,
      hasParams: !!config.params
    })
    return config
  },
  (error) => {
    logApiClient('error', 'API 요청 인터셉터 오류', error)
    return Promise.reject(error)
  }
)

/**
 * 응답 인터셉터: 에러 처리 및 사용자 피드백
 */
apiClient.interceptors.response.use(
  (response) => {
    logApiClient('debug', 'API 응답 성공', {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase()
    })
    return response
  },
  (error) => {
    const errorMessage = getErrorMessage(error)
    logApiClient('error', 'API 응답 오류', {
      status: error?.response?.status,
      url: error?.config?.url,
      method: error?.config?.method?.toUpperCase(),
      message: errorMessage
    })
    
    // 사용자에게 명확한 피드백 제공
    toast.error(`요청 실패: ${errorMessage}`)
    return Promise.reject(error)
  }
)

// ================================
// LLM 분석 API 함수들
// ================================

/**
 * LLM 분석을 트리거합니다
 * @param {Object} dbConfig - PostgreSQL 데이터베이스 설정
 * @param {Object} analysisParams - 분석 파라미터
 * @param {string} userId - 사용자 ID (기본값: 'default')
 * @returns {Promise<Object>} 분석 요청 응답
 */
export const triggerLLMAnalysis = async (dbConfig, analysisParams, userId = 'default') => {
  logApiClient('info', 'LLM 분석 요청 시작', { 
    dbConfig: sanitizeObject(dbConfig), 
    analysisParams,
    userId 
  })
  
  try {
    const response = await apiClient.post('/api/analysis/trigger-llm-analysis', {
      user_id: userId,
      db_config: dbConfig,
      ...analysisParams
    })
    
    logApiClient('info', 'LLM 분석 트리거 성공', { analysisId: response.data?.analysis_id })
    return response.data
  } catch (error) {
    logApiClient('error', 'LLM 분석 트리거 실패', error)
    throw error
  }
}

/**
 * 특정 LLM 분석 결과를 조회합니다
 * @param {string} analysisId - 분석 ID
 * @returns {Promise<Object>} 분석 결과
 */
export const getLLMAnalysisResult = async (analysisId) => {
  logApiClient('info', 'LLM 분석 결과 조회', { analysisId })
  
  try {
    const response = await apiClient.get(`/api/analysis/llm-analysis/${analysisId}`)
    
    logApiClient('info', 'LLM 분석 결과 조회 성공', { 
      analysisId,
      hasData: !!response.data 
    })
    return response.data
  } catch (error) {
    logApiClient('error', 'LLM 분석 결과 조회 실패', { analysisId, error })
    throw error
  }
}

/**
 * 분석 결과 목록에서 LLM 분석 결과도 포함하여 조회합니다
 * 기존 getAnalysisResults에 type 필터 추가
 * @param {Object} params - 쿼리 파라미터
 * @returns {Promise<Object>} 분석 결과 목록
 */
export const getAnalysisResults = async (params = {}) => {
  logApiClient('info', '분석 결과 목록 조회', { params })
  
  try {
    const response = await apiClient.get('/api/analysis/results', { params })
    
    logApiClient('info', '분석 결과 목록 조회 성공', { 
      resultCount: response.data?.results?.length || 0 
    })
    return response.data
  } catch (error) {
    logApiClient('error', '분석 결과 목록 조회 실패', error)
    throw error
  }
}

/**
 * Database 연결 테스트
 * @param {Object} dbConfig - 데이터베이스 설정
 * @returns {Promise<Object>} 연결 테스트 결과
 */
export const testDatabaseConnection = async (dbConfig) => {
  logApiClient('info', 'Database 연결 테스트', { dbConfig: sanitizeObject(dbConfig) })
  
  try {
    const response = await apiClient.post('/api/master/test-connection', dbConfig)
    logApiClient('info', 'Database 연결 성공')
    return { success: true, data: response.data }
  } catch (error) {
    logApiClient('error', 'Database 연결 실패', error)
    return { 
      success: false, 
      error: getErrorMessage(error)
    }
  }
}

// ================================
// 사용자 설정 동기화 API 함수들
// ================================

/**
 * 서버에서 사용자 설정을 조회합니다 (GET /api/preference/settings)
 * @param {string} userId - 사용자 ID (기본값: 'default')
 * @returns {Promise<Object>} 사용자 설정 데이터
 */
export const getUserPreferences = async (userId = 'default') => {
  logApiClient('info', '사용자 설정 조회', { userId })
  
  try {
    const response = await apiClient.get('/api/preference/settings', {
      params: { user_id: userId }
    })
    
    logApiClient('info', '사용자 설정 조회 성공', { userId })
    return { success: true, data: response.data }
  } catch (error) {
    // 404는 정상적인 경우 (처음 사용자)
    if (error?.response?.status === 404) {
      logApiClient('info', '사용자 설정이 없음 (신규 사용자)', { userId })
      return { success: true, data: null, isNew: true }
    }
    
    logApiClient('error', '사용자 설정 조회 실패', { userId, error })
    return { 
      success: false, 
      error: getErrorMessage(error)
    }
  }
}

/**
 * 서버에 사용자 설정을 저장합니다 (PUT /api/preference/settings)
 * @param {string} userId - 사용자 ID (기본값: 'default')
 * @param {Object} preferenceData - 저장할 설정 데이터
 * @returns {Promise<Object>} 저장 결과
 */
export const saveUserPreferences = async (userId = 'default', preferenceData) => {
  logApiClient('info', '사용자 설정 저장', { 
    userId, 
    hasData: !!preferenceData,
    dataKeys: preferenceData ? Object.keys(preferenceData) : []
  })
  
  try {
    const response = await apiClient.put('/api/preference/settings', preferenceData, {
      params: { user_id: userId }
    })
    
    logApiClient('info', '사용자 설정 저장 성공', { userId })
    return { success: true, data: response.data }
  } catch (error) {
    logApiClient('error', '사용자 설정 저장 실패', { userId, error })
    return { 
      success: false, 
      error: getErrorMessage(error)
    }
  }
}

/**
 * 서버에 새로운 사용자 설정을 생성합니다 (POST /api/preference/settings)
 * @param {Object} preferenceData - 생성할 설정 데이터 (user_id 포함)
 * @returns {Promise<Object>} 생성 결과
 */
export const createUserPreferences = async (preferenceData) => {
  const userId = preferenceData.user_id || preferenceData.userId
  logApiClient('info', '사용자 설정 생성', { userId })
  
  try {
    const response = await apiClient.post('/api/preference/settings', preferenceData)
    
    logApiClient('info', '사용자 설정 생성 성공', { userId })
    return { success: true, data: response.data }
  } catch (error) {
    logApiClient('error', '사용자 설정 생성 실패', { userId, error })
    return { 
      success: false, 
      error: getErrorMessage(error)
    }
  }
}

/**
 * 서버에서 사용자 설정을 삭제합니다 (DELETE /api/preference/settings)
 * @param {string} userId - 사용자 ID (기본값: 'default')
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteUserPreferences = async (userId = 'default') => {
  logApiClient('info', '사용자 설정 삭제', { userId })
  
  try {
    await apiClient.delete('/api/preference/settings', {
      params: { user_id: userId }
    })
    
    logApiClient('info', '사용자 설정 삭제 성공', { userId })
    return { success: true }
  } catch (error) {
    logApiClient('error', '사용자 설정 삭제 실패', { userId, error })
    return { 
      success: false, 
      error: getErrorMessage(error)
    }
  }
}

/**
 * 설정 내보내기 (GET /api/preference/export)
 * @param {string} userId - 사용자 ID (기본값: 'default')
 * @returns {Promise<Object>} 내보내기 결과
 */
export const exportUserPreferences = async (userId = 'default') => {
  logApiClient('info', '사용자 설정 내보내기', { userId })
  
  try {
    const response = await apiClient.get('/api/preference/export', {
      params: { user_id: userId }
    })
    
    logApiClient('info', '사용자 설정 내보내기 성공', { userId })
    return { success: true, data: response.data }
  } catch (error) {
    logApiClient('error', '사용자 설정 내보내기 실패', { userId, error })
    return { 
      success: false, 
      error: getErrorMessage(error)
    }
  }
}

/**
 * 설정 가져오기 (POST /api/preference/import)
 * @param {string} userId - 사용자 ID (기본값: 'default')
 * @param {File} file - 가져올 설정 파일
 * @param {boolean} overwrite - 기존 설정 덮어쓰기 여부 (기본값: false)
 * @returns {Promise<Object>} 가져오기 결과
 */
export const importUserPreferences = async (userId = 'default', file, overwrite = false) => {
  logApiClient('info', '사용자 설정 가져오기', { 
    userId, 
    fileName: file?.name, 
    fileSize: file?.size,
    overwrite 
  })
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/api/preference/import', formData, {
      params: { user_id: userId, overwrite },
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    logApiClient('info', '사용자 설정 가져오기 성공', { userId })
    return { success: true, data: response.data }
  } catch (error) {
    logApiClient('error', '사용자 설정 가져오기 실패', { userId, error })
    return { 
      success: false, 
      error: getErrorMessage(error)
    }
  }
}

// ================================
// 내보내기
// ================================

export default apiClient


