import axios from 'axios'
import { toast } from 'sonner'

// 공용 API 클라이언트: 런타임 구성(window.__RUNTIME_CONFIG__) → Vite env → 기본값 순으로 사용
// DOCKER RUN 시 -e BACKEND_BASE_URL="http://host:port" 또는 -e VITE_API_BASE_URL 로 주입하면 런타임에 즉시 반영됩니다.
const runtimeCfg = typeof window !== 'undefined' ? (window.__RUNTIME_CONFIG__ || {}) : {}
const runtimeBase = runtimeCfg.BACKEND_BASE_URL || runtimeCfg.VITE_API_BASE_URL
const baseURL = (runtimeBase && String(runtimeBase).trim()) || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const apiClient = axios.create({
  baseURL,
  timeout: 15000,
})

// 에러 인터셉터: 사용자에게 명확한 피드백 제공
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg = error?.response?.data?.detail || error?.message || '알 수 없는 오류가 발생했습니다.'
    toast.error(`요청 실패: ${msg}`)
    return Promise.reject(error)
  }
)

export default apiClient

// === LLM 분석 API 함수들 ===

/**
 * LLM 분석을 트리거합니다
 * @param {Object} dbConfig - PostgreSQL 데이터베이스 설정
 * @param {Object} analysisParams - 분석 파라미터
 * @returns {Promise} 분석 요청 응답
 */
export const triggerLLMAnalysis = async (dbConfig, analysisParams, userId = 'default') => {
  console.log('🤖 LLM 분석 요청 시작:', { dbConfig: { ...dbConfig, password: '[HIDDEN]' }, analysisParams })
  
  const response = await apiClient.post('/api/analysis/trigger-llm-analysis', {
    user_id: userId,
    db_config: dbConfig,
    ...analysisParams
  })
  
  console.log('✅ LLM 분석 트리거 성공:', response.data)
  return response.data
}

/**
 * 특정 LLM 분석 결과를 조회합니다
 * @param {string} analysisId - 분석 ID
 * @returns {Promise} 분석 결과
 */
export const getLLMAnalysisResult = async (analysisId) => {
  console.log('📊 LLM 분석 결과 조회:', analysisId)
  
  const response = await apiClient.get(`/api/analysis/llm-analysis/${analysisId}`)
  
  console.log('✅ LLM 분석 결과 조회 성공')
  return response.data
}

/**
 * 분석 결과 목록에서 LLM 분석 결과도 포함하여 조회합니다
 * 기존 getAnalysisResults에 type 필터 추가
 * @param {Object} params - 쿼리 파라미터
 * @returns {Promise} 분석 결과 목록
 */
export const getAnalysisResults = async (params = {}) => {
  console.log('📋 분석 결과 목록 조회:', params)
  
  const response = await apiClient.get('/api/analysis/results', { params })
  
  console.log('✅ 분석 결과 목록 조회 성공:', response.data)
  return response.data
}

/**
 * Database 연결 테스트
 * @param {Object} dbConfig - 데이터베이스 설정
 * @returns {Promise} 연결 테스트 결과
 */
export const testDatabaseConnection = async (dbConfig) => {
  console.log('🔌 Database 연결 테스트:', { ...dbConfig, password: '[HIDDEN]' })
  
  try {
    const response = await apiClient.post('/api/master/test-connection', dbConfig)
    console.log('✅ Database 연결 성공')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('❌ Database 연결 실패:', error)
    return { 
      success: false, 
      error: error?.response?.data?.detail || error?.message || 'Connection failed' 
    }
  }
}


