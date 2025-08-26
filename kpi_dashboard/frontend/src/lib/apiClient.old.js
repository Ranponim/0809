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

// === 사용자 설정 동기화 API 함수들 ===

/**
 * 서버에서 사용자 설정을 조회합니다 (GET /api/preference/settings)
 * @param {string} userId - 사용자 ID
 * @returns {Promise} 사용자 설정 데이터
 */
export const getUserPreferences = async (userId = 'default') => {
  console.log('📥 사용자 설정 조회:', { userId })
  
  try {
    const response = await apiClient.get('/api/preference/settings', {
      params: { user_id: userId }
    })
    
    console.log('✅ 사용자 설정 조회 성공')
    return { success: true, data: response.data }
  } catch (error) {
    // 404는 정상적인 경우 (처음 사용자)
    if (error?.response?.status === 404) {
      console.log('ℹ️ 사용자 설정이 없음 (신규 사용자)')
      return { success: true, data: null, isNew: true }
    }
    
    console.error('❌ 사용자 설정 조회 실패:', error)
    return { 
      success: false, 
      error: error?.response?.data?.detail || error?.message || 'Failed to get preferences' 
    }
  }
}

/**
 * 서버에 사용자 설정을 저장합니다 (PUT /api/preference/settings)
 * @param {string} userId - 사용자 ID
 * @param {Object} preferenceData - 저장할 설정 데이터
 * @returns {Promise} 저장 결과
 */
export const saveUserPreferences = async (userId = 'default', preferenceData) => {
  console.log('📤 사용자 설정 저장:', { userId, hasData: !!preferenceData })
  
  try {
    const response = await apiClient.put('/api/preference/settings', preferenceData, {
      params: { user_id: userId }
    })
    
    console.log('✅ 사용자 설정 저장 성공')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('❌ 사용자 설정 저장 실패:', error)
    return { 
      success: false, 
      error: error?.response?.data?.detail || error?.message || 'Failed to save preferences' 
    }
  }
}

/**
 * 서버에 새로운 사용자 설정을 생성합니다 (POST /api/preference/settings)
 * @param {Object} preferenceData - 생성할 설정 데이터 (user_id 포함)
 * @returns {Promise} 생성 결과
 */
export const createUserPreferences = async (preferenceData) => {
  console.log('🆕 사용자 설정 생성:', { userId: preferenceData.user_id || preferenceData.userId })
  
  try {
    const response = await apiClient.post('/api/preference/settings', preferenceData)
    
    console.log('✅ 사용자 설정 생성 성공')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('❌ 사용자 설정 생성 실패:', error)
    return { 
      success: false, 
      error: error?.response?.data?.detail || error?.message || 'Failed to create preferences' 
    }
  }
}

/**
 * 서버에서 사용자 설정을 삭제합니다 (DELETE /api/preference/settings)
 * @param {string} userId - 사용자 ID
 * @returns {Promise} 삭제 결과
 */
export const deleteUserPreferences = async (userId = 'default') => {
  console.log('🗑️ 사용자 설정 삭제:', { userId })
  
  try {
    await apiClient.delete('/api/preference/settings', {
      params: { user_id: userId }
    })
    
    console.log('✅ 사용자 설정 삭제 성공')
    return { success: true }
  } catch (error) {
    console.error('❌ 사용자 설정 삭제 실패:', error)
    return { 
      success: false, 
      error: error?.response?.data?.detail || error?.message || 'Failed to delete preferences' 
    }
  }
}

/**
 * 설정 내보내기 (GET /api/preference/export)
 * @param {string} userId - 사용자 ID
 * @returns {Promise} 내보내기 결과
 */
export const exportUserPreferences = async (userId = 'default') => {
  console.log('📦 사용자 설정 내보내기:', { userId })
  
  try {
    const response = await apiClient.get('/api/preference/export', {
      params: { user_id: userId }
    })
    
    console.log('✅ 사용자 설정 내보내기 성공')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('❌ 사용자 설정 내보내기 실패:', error)
    return { 
      success: false, 
      error: error?.response?.data?.detail || error?.message || 'Failed to export preferences' 
    }
  }
}

/**
 * 설정 가져오기 (POST /api/preference/import)
 * @param {string} userId - 사용자 ID
 * @param {File} file - 가져올 설정 파일
 * @param {boolean} overwrite - 기존 설정 덮어쓰기 여부
 * @returns {Promise} 가져오기 결과
 */
export const importUserPreferences = async (userId = 'default', file, overwrite = false) => {
  console.log('📥 사용자 설정 가져오기:', { userId, fileName: file.name, overwrite })
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/api/preference/import', formData, {
      params: { user_id: userId, overwrite },
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    console.log('✅ 사용자 설정 가져오기 성공')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('❌ 사용자 설정 가져오기 실패:', error)
    return { 
      success: false, 
      error: error?.response?.data?.detail || error?.message || 'Failed to import preferences' 
    }
  }
}


