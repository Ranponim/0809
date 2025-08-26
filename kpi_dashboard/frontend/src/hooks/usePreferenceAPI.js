/**
 * 설정 API 통신 커스텀 훅
 * 
 * 서버와의 설정 동기화를 위한 API 통신 기능을 제공합니다.
 * - 사용자 설정 조회/저장/생성/삭제
 * - 설정 내보내기/가져오기
 * - 에러 처리 및 로깅
 * - 네트워크 상태 관리
 * 
 * 사용법:
 * ```jsx
 * const { getUserPreferences, saveUserPreferences, loading, error } = usePreferenceAPI()
 * ```
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import apiClient, { 
  getUserPreferences as apiGetUserPreferences, 
  saveUserPreferences as apiSaveUserPreferences, 
  createUserPreferences as apiCreateUserPreferences,
  deleteUserPreferences as apiDeleteUserPreferences,
  exportUserPreferences as apiExportUserPreferences,
  importUserPreferences as apiImportUserPreferences
} from '@/lib/apiClient.js'
import { logPreference } from '@/utils/preferenceUtils'

// ================================
// 메인 커스텀 훅
// ================================

/**
 * 설정 API 통신 커스텀 훅
 * @returns {Object} API 통신 함수들과 상태
 */
export const usePreferenceAPI = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)

  // 로딩 상태 관리 헬퍼 함수
  const withLoading = useCallback(async (operation) => {
    logPreference('info', 'API 작업 시작')
    setLoading(true)
    setError(null)

    try {
      const result = await operation()
      setLastSync(new Date())
      logPreference('info', 'API 작업 완료', { success: true })
      return result
    } catch (error) {
      const errorMessage = error?.response?.data?.detail || error?.message || '알 수 없는 오류가 발생했습니다.'
      setError(errorMessage)
      logPreference('error', 'API 작업 실패', errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // 사용자 설정 조회
  const getUserPreferences = useCallback(async (userId = 'default') => {
    logPreference('info', '사용자 설정 조회 시작', { userId })
    
    return await withLoading(async () => {
      const result = await apiGetUserPreferences(userId)
      
      if (result.success) {
        logPreference('info', '사용자 설정 조회 성공', { 
          hasData: !!result.data,
          isNew: result.isNew
        })
        return result
      } else {
        throw new Error(result.error || '설정 조회 실패')
      }
    })
  }, [withLoading])

  // 사용자 설정 저장
  const saveUserPreferences = useCallback(async (userId = 'default', preferenceData) => {
    logPreference('info', '사용자 설정 저장 시작', { 
      userId, 
      hasData: !!preferenceData,
      dataKeys: preferenceData ? Object.keys(preferenceData) : []
    })
    
    return await withLoading(async () => {
      const result = await apiSaveUserPreferences(userId, preferenceData)
      
      if (result.success) {
        logPreference('info', '사용자 설정 저장 성공')
        toast.success('설정이 서버에 저장되었습니다')
        return result
      } else {
        throw new Error(result.error || '설정 저장 실패')
      }
    })
  }, [withLoading])

  // 사용자 설정 생성
  const createUserPreferences = useCallback(async (preferenceData) => {
    logPreference('info', '사용자 설정 생성 시작', { 
      userId: preferenceData.user_id || preferenceData.userId,
      hasData: !!preferenceData
    })
    
    return await withLoading(async () => {
      const result = await apiCreateUserPreferences(preferenceData)
      
      if (result.success) {
        logPreference('info', '사용자 설정 생성 성공')
        toast.success('새로운 설정이 생성되었습니다')
        return result
      } else {
        throw new Error(result.error || '설정 생성 실패')
      }
    })
  }, [withLoading])

  // 사용자 설정 삭제
  const deleteUserPreferences = useCallback(async (userId = 'default') => {
    logPreference('info', '사용자 설정 삭제 시작', { userId })
    
    return await withLoading(async () => {
      const result = await apiDeleteUserPreferences(userId)
      
      if (result.success) {
        logPreference('info', '사용자 설정 삭제 성공')
        toast.success('설정이 삭제되었습니다')
        return result
      } else {
        throw new Error(result.error || '설정 삭제 실패')
      }
    })
  }, [withLoading])

  // 설정 내보내기
  const exportUserPreferences = useCallback(async (userId = 'default') => {
    logPreference('info', '설정 내보내기 시작', { userId })
    
    return await withLoading(async () => {
      const result = await apiExportUserPreferences(userId)
      
      if (result.success) {
        logPreference('info', '설정 내보내기 성공')
        
        // 파일 다운로드 처리
        const dataStr = JSON.stringify(result.data, null, 2)
        const blob = new Blob([dataStr], { type: 'application/json' })
        
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `preference-export-${userId}-${new Date().toISOString().split('T')[0]}.json`
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        URL.revokeObjectURL(link.href)
        
        toast.success('설정이 파일로 내보내졌습니다')
        return { ...result, filename: link.download }
      } else {
        throw new Error(result.error || '설정 내보내기 실패')
      }
    })
  }, [withLoading])

  // 설정 가져오기
  const importUserPreferences = useCallback(async (userId = 'default', file, overwrite = false) => {
    logPreference('info', '설정 가져오기 시작', { 
      userId, 
      fileName: file?.name, 
      overwrite 
    })
    
    return await withLoading(async () => {
      const result = await apiImportUserPreferences(userId, file, overwrite)
      
      if (result.success) {
        logPreference('info', '설정 가져오기 성공')
        toast.success('설정이 성공적으로 가져와졌습니다')
        return result
      } else {
        throw new Error(result.error || '설정 가져오기 실패')
      }
    })
  }, [withLoading])

  // 설정 동기화 (로컬 → 서버)
  const syncToServer = useCallback(async (userId = 'default', localSettings) => {
    logPreference('info', '서버 동기화 시작', { 
      userId, 
      hasLocalSettings: !!localSettings 
    })
    
    return await withLoading(async () => {
      try {
        // 먼저 서버에서 기존 설정 확인
        const getResult = await apiGetUserPreferences(userId)
        
        if (getResult.success && getResult.data) {
          // 기존 설정이 있으면 업데이트
          const saveResult = await apiSaveUserPreferences(userId, localSettings)
          if (saveResult.success) {
            logPreference('info', '서버 동기화 완료 - 업데이트')
            toast.success('설정이 서버와 동기화되었습니다')
            return { success: true, action: 'updated' }
          } else {
            throw new Error(saveResult.error || '설정 업데이트 실패')
          }
        } else {
          // 기존 설정이 없으면 새로 생성
          const createData = { user_id: userId, ...localSettings }
          const createResult = await apiCreateUserPreferences(createData)
          if (createResult.success) {
            logPreference('info', '서버 동기화 완료 - 생성')
            toast.success('새로운 설정이 서버에 생성되었습니다')
            return { success: true, action: 'created' }
          } else {
            throw new Error(createResult.error || '설정 생성 실패')
          }
        }
      } catch (error) {
        logPreference('error', '서버 동기화 실패', error.message)
        throw error
      }
    })
  }, [withLoading])

  // 설정 동기화 (서버 → 로컬)
  const syncFromServer = useCallback(async (userId = 'default') => {
    logPreference('info', '서버에서 동기화 시작', { userId })
    
    return await withLoading(async () => {
      const result = await apiGetUserPreferences(userId)
      
      if (result.success) {
        logPreference('info', '서버에서 동기화 완료', { 
          hasData: !!result.data,
          isNew: result.isNew
        })
        
        if (result.data) {
          toast.success('서버에서 설정을 가져왔습니다')
        } else {
          toast.info('서버에 저장된 설정이 없습니다')
        }
        
        return result
      } else {
        throw new Error(result.error || '서버 동기화 실패')
      }
    })
  }, [withLoading])

  // 설정 충돌 해결
  const resolveConflict = useCallback(async (userId = 'default', localSettings, serverSettings, strategy = 'local') => {
    logPreference('info', '설정 충돌 해결 시작', { 
      userId, 
      strategy,
      hasLocalSettings: !!localSettings,
      hasServerSettings: !!serverSettings
    })
    
    return await withLoading(async () => {
      let resolvedSettings = null
      
      switch (strategy) {
        case 'local':
          resolvedSettings = localSettings
          logPreference('info', '로컬 설정으로 충돌 해결')
          break
        case 'server':
          resolvedSettings = serverSettings
          logPreference('info', '서버 설정으로 충돌 해결')
          break
        case 'merge':
          // 간단한 병합 전략 (서버 설정을 우선)
          resolvedSettings = { ...localSettings, ...serverSettings }
          logPreference('info', '설정 병합으로 충돌 해결')
          break
        default:
          throw new Error('알 수 없는 충돌 해결 전략입니다')
      }
      
      // 해결된 설정을 서버에 저장
      const saveResult = await apiSaveUserPreferences(userId, resolvedSettings)
      
      if (saveResult.success) {
        logPreference('info', '충돌 해결 완료')
        toast.success('설정 충돌이 해결되었습니다')
        return { success: true, resolvedSettings, strategy }
      } else {
        throw new Error(saveResult.error || '충돌 해결 실패')
      }
    })
  }, [withLoading])

  // 네트워크 연결 상태 확인
  const checkNetworkStatus = useCallback(async () => {
    logPreference('info', '네트워크 상태 확인 시작')
    
    try {
      // 간단한 헬스체크 요청
      const response = await apiClient.get('/api/health', { timeout: 5000 })
      const isOnline = response.status === 200
      
      logPreference('info', '네트워크 상태 확인 완료', { isOnline })
      return { isOnline, status: response.status }
    } catch (error) {
      logPreference('warn', '네트워크 상태 확인 실패', error.message)
      return { isOnline: false, error: error.message }
    }
  }, [])

  // 에러 초기화
  const clearError = useCallback(() => {
    logPreference('info', '에러 상태 초기화')
    setError(null)
  }, [])

  return {
    // 상태
    loading,
    error,
    lastSync,
    
    // 기본 CRUD 함수들
    getUserPreferences,
    saveUserPreferences,
    createUserPreferences,
    deleteUserPreferences,
    
    // 내보내기/가져오기
    exportUserPreferences,
    importUserPreferences,
    
    // 동기화 함수들
    syncToServer,
    syncFromServer,
    resolveConflict,
    
    // 유틸리티
    checkNetworkStatus,
    clearError
  }
}

// ================================
// 내보내기
// ================================

export default usePreferenceAPI
