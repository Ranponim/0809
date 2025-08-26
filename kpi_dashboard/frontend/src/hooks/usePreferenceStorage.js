/**
 * 설정 localStorage 관리 커스텀 훅
 * 
 * localStorage를 사용한 설정 저장/로드 기능을 제공합니다.
 * - localStorage 사용 가능 여부 확인
 * - 설정 저장/로드/삭제
 * - 에러 처리 및 로깅
 * - 안전한 데이터 검증
 * 
 * 사용법:
 * ```jsx
 * const { saveSettings, loadSettings, clearSettings, isAvailable } = usePreferenceStorage()
 * ```
 */

import { useCallback, useState, useEffect } from 'react'
import { logPreference } from '@/utils/preferenceUtils'

// ================================
// 상수 정의
// ================================

const STORAGE_KEY = 'kpi-dashboard-preferences'

// ================================
// localStorage 유틸리티 함수들
// ================================

/**
 * localStorage 사용 가능 여부를 확인합니다
 * @returns {boolean} 사용 가능 여부
 */
const isLocalStorageAvailable = () => {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (e) {
    logPreference('warn', 'localStorage 사용 불가', e.message)
    return false
  }
}

/**
 * 설정을 localStorage에 저장합니다
 * @param {Object} settings - 저장할 설정 객체
 * @returns {Object} 저장 결과
 */
const saveToLocalStorage = (settings) => {
  logPreference('info', 'localStorage 저장 시작', { hasSettings: !!settings })
  
  if (!isLocalStorageAvailable()) {
    const error = 'localStorage를 사용할 수 없습니다'
    logPreference('error', 'localStorage 저장 실패', error)
    throw new Error(error)
  }

  try {
    const dataToSave = {
      settings,
      lastSaved: new Date().toISOString(),
      version: 1
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
    logPreference('info', 'localStorage 저장 완료', { 
      lastSaved: dataToSave.lastSaved,
      settingsKeys: Object.keys(settings)
    })
    return { success: true, lastSaved: dataToSave.lastSaved }
  } catch (error) {
    logPreference('error', 'localStorage 저장 실패', error.message)
    throw new Error(`설정 저장 실패: ${error.message}`)
  }
}

/**
 * localStorage에서 설정을 로드합니다
 * @returns {Object|null} 로드된 설정 또는 null
 */
const loadFromLocalStorage = () => {
  logPreference('info', 'localStorage 로드 시작')
  
  if (!isLocalStorageAvailable()) {
    logPreference('warn', 'localStorage 사용 불가 - null 반환')
    return null
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      logPreference('info', 'localStorage에 저장된 설정 없음')
      return null
    }

    const parsed = JSON.parse(stored)
    logPreference('info', 'localStorage 로드 완료', { 
      lastSaved: parsed.lastSaved,
      version: parsed.version,
      settingsKeys: Object.keys(parsed.settings || {})
    })
    return parsed.settings
  } catch (error) {
    logPreference('error', 'localStorage 로드 실패', error.message)
    // 손상된 데이터 제거
    try {
      localStorage.removeItem(STORAGE_KEY)
      logPreference('info', '손상된 데이터 제거 완료')
    } catch (e) {
      logPreference('error', '손상된 데이터 제거 실패', e.message)
    }
    throw new Error(`설정 로드 실패: ${error.message}`)
  }
}

/**
 * localStorage에서 설정을 삭제합니다
 * @returns {Object} 삭제 결과
 */
const clearFromLocalStorage = () => {
  logPreference('info', 'localStorage 삭제 시작')
  
  if (!isLocalStorageAvailable()) {
    const error = 'localStorage를 사용할 수 없습니다'
    logPreference('error', 'localStorage 삭제 실패', error)
    return { success: false, error }
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
    logPreference('info', 'localStorage 삭제 완료')
    return { success: true }
  } catch (error) {
    logPreference('error', 'localStorage 삭제 실패', error.message)
    return { success: false, error: error.message }
  }
}

// ================================
// 메인 커스텀 훅
// ================================

/**
 * 설정 localStorage 관리 커스텀 훅
 * @returns {Object} localStorage 관리 함수들과 상태
 */
export const usePreferenceStorage = () => {
  const [isAvailable, setIsAvailable] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [error, setError] = useState(null)

  // localStorage 사용 가능 여부 확인
  useEffect(() => {
    logPreference('info', 'localStorage 사용 가능 여부 확인 시작')
    const available = isLocalStorageAvailable()
    setIsAvailable(available)
    logPreference('info', 'localStorage 사용 가능 여부 확인 완료', { available })
  }, [])

  // 설정 저장 함수
  const saveSettings = useCallback(async (settings) => {
    logPreference('info', '설정 저장 시작', { hasSettings: !!settings })
    setError(null)

    try {
      const result = saveToLocalStorage(settings)
      setLastSaved(result.lastSaved)
      logPreference('info', '설정 저장 완료', result)
      return { success: true, lastSaved: result.lastSaved }
    } catch (error) {
      const errorMessage = error.message
      setError(errorMessage)
      logPreference('error', '설정 저장 실패', errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  // 설정 로드 함수
  const loadSettings = useCallback(async () => {
    logPreference('info', '설정 로드 시작')
    setError(null)

    try {
      const settings = loadFromLocalStorage()
      logPreference('info', '설정 로드 완료', { hasSettings: !!settings })
      return { success: true, settings }
    } catch (error) {
      const errorMessage = error.message
      setError(errorMessage)
      logPreference('error', '설정 로드 실패', errorMessage)
      return { success: false, error: errorMessage, settings: null }
    }
  }, [])

  // 설정 삭제 함수
  const clearSettings = useCallback(async () => {
    logPreference('info', '설정 삭제 시작')
    setError(null)

    try {
      const result = clearFromLocalStorage()
      if (result.success) {
        setLastSaved(null)
        logPreference('info', '설정 삭제 완료')
      } else {
        setError(result.error)
        logPreference('error', '설정 삭제 실패', result.error)
      }
      return result
    } catch (error) {
      const errorMessage = error.message
      setError(errorMessage)
      logPreference('error', '설정 삭제 실패', errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  // 설정 백업 함수
  const backupSettings = useCallback(async (settings, filename = null) => {
    logPreference('info', '설정 백업 시작', { hasSettings: !!settings })
    setError(null)

    try {
      const dataToExport = {
        settings,
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          type: 'backup'
        }
      }

      const dataStr = JSON.stringify(dataToExport, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename || `preference-backup-${new Date().toISOString().split('T')[0]}.json`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(link.href)
      
      logPreference('info', '설정 백업 완료', { filename: link.download })
      return { success: true, filename: link.download }
    } catch (error) {
      const errorMessage = error.message
      setError(errorMessage)
      logPreference('error', '설정 백업 실패', errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  // 설정 복원 함수
  const restoreSettings = useCallback(async (file) => {
    logPreference('info', '설정 복원 시작', { fileName: file?.name })
    setError(null)

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          
          if (!data.settings) {
            throw new Error('유효하지 않은 백업 파일입니다.')
          }
          
          logPreference('info', '설정 복원 완료', { 
            fileName: file.name,
            settingsKeys: Object.keys(data.settings)
          })
          
          resolve({ success: true, settings: data.settings, metadata: data.metadata })
        } catch (error) {
          const errorMessage = error.message
          setError(errorMessage)
          logPreference('error', '설정 복원 실패', errorMessage)
          reject(error)
        }
      }
      
      reader.onerror = () => {
        const error = new Error('파일 읽기 실패')
        setError(error.message)
        logPreference('error', '설정 복원 실패', error.message)
        reject(error)
      }
      
      reader.readAsText(file)
    })
  }, [])

  // 설정 동기화 상태 확인
  const checkSyncStatus = useCallback(() => {
    logPreference('info', '동기화 상태 확인 시작')
    
    if (!isAvailable) {
      logPreference('warn', 'localStorage 사용 불가 - 동기화 불가')
      return { synced: false, reason: 'localStorage_unavailable' }
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        logPreference('info', '저장된 설정 없음 - 동기화 불필요')
        return { synced: true, reason: 'no_data' }
      }

      const parsed = JSON.parse(stored)
      const hasData = !!parsed.settings
      
      logPreference('info', '동기화 상태 확인 완료', { 
        synced: hasData,
        lastSaved: parsed.lastSaved,
        hasData
      })
      
      return { 
        synced: hasData, 
        lastSaved: parsed.lastSaved,
        reason: hasData ? 'synced' : 'no_data'
      }
    } catch (error) {
      logPreference('error', '동기화 상태 확인 실패', error.message)
      return { synced: false, reason: 'error', error: error.message }
    }
  }, [isAvailable])

  return {
    // 상태
    isAvailable,
    lastSaved,
    error,
    
    // 함수들
    saveSettings,
    loadSettings,
    clearSettings,
    backupSettings,
    restoreSettings,
    checkSyncStatus,
    
    // 유틸리티
    isLocalStorageAvailable
  }
}

// ================================
// 내보내기
// ================================

export default usePreferenceStorage
