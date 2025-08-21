/**
 * LocalStorage 유틸리티 함수들
 * 
 * 사용자 설정의 LocalStorage 저장/로드를 위한 타입 안전한 유틸리티 함수들입니다.
 * 에러 처리, 데이터 검증, 버전 관리를 포함합니다.
 */

import { 
  UserSettings, 
  LocalStorageSettings, 
  SerializationResult, 
  DeserializationResult,
  LocalStorageError,
  LocalStorageStatus
} from '@/types/userSettings'

// 상수 정의
export const STORAGE_KEY = 'kpi_dashboard_user_settings'
export const STORAGE_VERSION = '1.0.0'
export const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * 로깅 유틸리티
 */
const logInfo = (message: string, data?: any) => {
  console.info(`[LocalStorageUtils] ${message}`, data ? data : '')
}

const logError = (message: string, error?: any) => {
  console.error(`[LocalStorageUtils] ${message}`, error ? error : '')
}

/**
 * 간단한 체크섬 생성 (무결성 검증용)
 */
const generateChecksum = (data: string): string => {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32비트 정수로 변환
  }
  return Math.abs(hash).toString(36)
}

/**
 * UserSettings를 LocalStorage 형식으로 직렬화
 */
export const serializeSettings = (settings: UserSettings): SerializationResult => {
  try {
    // 현재 시간으로 메타데이터 업데이트
    const updatedSettings: UserSettings = {
      ...settings,
      metadata: {
        ...settings.metadata,
        lastModified: new Date().toISOString()
      }
    }

    // LocalStorage 구조로 래핑
    const localStorageData: LocalStorageSettings = {
      data: updatedSettings,
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString()
    }

    // JSON 문자열로 변환
    const jsonString = JSON.stringify(localStorageData)
    
    // 체크섬 추가
    localStorageData.checksum = generateChecksum(jsonString)
    const finalJsonString = JSON.stringify(localStorageData)

    // 크기 체크
    if (finalJsonString.length > MAX_STORAGE_SIZE) {
      logError('데이터 크기가 제한을 초과했습니다', {
        size: finalJsonString.length,
        limit: MAX_STORAGE_SIZE
      })
      return {
        success: false,
        error: 'QUOTA_EXCEEDED'
      }
    }

    logInfo('설정 직렬화 성공', {
      size: finalJsonString.length,
      version: STORAGE_VERSION
    })

    return {
      success: true,
      data: finalJsonString
    }

  } catch (error) {
    logError('설정 직렬화 실패', error)
    return {
      success: false,
      error: 'UNKNOWN_ERROR'
    }
  }
}

/**
 * LocalStorage에서 UserSettings로 역직렬화
 */
export const deserializeSettings = (jsonString: string): DeserializationResult => {
  try {
    if (!jsonString || jsonString.trim() === '') {
      return {
        success: false,
        error: 'INVALID_FORMAT'
      }
    }

    // JSON 파싱
    const parsed: LocalStorageSettings = JSON.parse(jsonString)

    // 기본 구조 검증
    if (!parsed.data || !parsed.version || !parsed.timestamp) {
      logError('LocalStorage 데이터 구조가 올바르지 않습니다', parsed)
      return {
        success: false,
        error: 'INVALID_FORMAT'
      }
    }

    // 버전 호환성 검증
    if (parsed.version !== STORAGE_VERSION) {
      logError('LocalStorage 버전이 호환되지 않습니다', {
        stored: parsed.version,
        current: STORAGE_VERSION
      })
      return {
        success: false,
        error: 'VERSION_MISMATCH'
      }
    }

    // 체크섬 검증 (있는 경우)
    if (parsed.checksum) {
      const dataWithoutChecksum = { ...parsed }
      delete dataWithoutChecksum.checksum
      const expectedChecksum = generateChecksum(JSON.stringify(dataWithoutChecksum))
      
      if (parsed.checksum !== expectedChecksum) {
        logError('체크섬 불일치 - 데이터 무결성 오류', {
          stored: parsed.checksum,
          expected: expectedChecksum
        })
        return {
          success: false,
          error: 'CHECKSUM_FAILED'
        }
      }
    }

    logInfo('설정 역직렬화 성공', {
      version: parsed.version,
      timestamp: parsed.timestamp
    })

    return {
      success: true,
      data: parsed
    }

  } catch (error) {
    logError('설정 역직렬화 실패', error)
    return {
      success: false,
      error: 'PARSE_ERROR'
    }
  }
}

/**
 * LocalStorage에 설정 저장
 */
export const saveSettingsToLocalStorage = (settings: UserSettings): LocalStorageStatus => {
  const status: LocalStorageStatus = {
    available: true,
    lastOperation: 'save',
    lastOperationTime: new Date().toISOString()
  }

  try {
    // 직렬화
    const serializedResult = serializeSettings(settings)
    if (!serializedResult.success || !serializedResult.data) {
      return {
        ...status,
        available: false,
        error: serializedResult.error as LocalStorageError,
        errorMessage: `직렬화 실패: ${serializedResult.error}`
      }
    }

    // LocalStorage에 저장
    localStorage.setItem(STORAGE_KEY, serializedResult.data)
    
    logInfo('LocalStorage 저장 성공')
    return status

  } catch (error: any) {
    let storageError: LocalStorageError = 'UNKNOWN_ERROR'
    let errorMessage = error.message || '알 수 없는 오류'

    if (error.name === 'QuotaExceededError') {
      storageError = 'QUOTA_EXCEEDED'
      errorMessage = 'LocalStorage 저장 공간이 부족합니다'
    }

    logError('LocalStorage 저장 실패', error)
    
    return {
      ...status,
      available: false,
      error: storageError,
      errorMessage
    }
  }
}

/**
 * LocalStorage에서 설정 로드
 */
export const loadSettingsFromLocalStorage = (): { 
  status: LocalStorageStatus; 
  settings?: UserSettings 
} => {
  const status: LocalStorageStatus = {
    available: true,
    lastOperation: 'load',
    lastOperationTime: new Date().toISOString()
  }

  try {
    // LocalStorage에서 데이터 읽기
    const stored = localStorage.getItem(STORAGE_KEY)
    
    if (!stored) {
      logInfo('LocalStorage에 저장된 설정이 없습니다')
      return { status }
    }

    // 역직렬화
    const deserializedResult = deserializeSettings(stored)
    if (!deserializedResult.success || !deserializedResult.data) {
      return {
        status: {
          ...status,
          available: false,
          error: deserializedResult.error as LocalStorageError,
          errorMessage: `역직렬화 실패: ${deserializedResult.error}`
        }
      }
    }

    logInfo('LocalStorage 로드 성공')
    return {
      status,
      settings: deserializedResult.data.data
    }

  } catch (error: any) {
    logError('LocalStorage 로드 실패', error)
    
    return {
      status: {
        ...status,
        available: false,
        error: 'UNKNOWN_ERROR',
        errorMessage: error.message || '알 수 없는 오류'
      }
    }
  }
}

/**
 * LocalStorage 설정 삭제
 */
export const clearSettingsFromLocalStorage = (): LocalStorageStatus => {
  const status: LocalStorageStatus = {
    available: true,
    lastOperation: 'clear',
    lastOperationTime: new Date().toISOString()
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
    logInfo('LocalStorage 설정 삭제 성공')
    return status

  } catch (error: any) {
    logError('LocalStorage 설정 삭제 실패', error)
    
    return {
      ...status,
      available: false,
      error: 'UNKNOWN_ERROR',
      errorMessage: error.message || '알 수 없는 오류'
    }
  }
}

/**
 * LocalStorage 가용성 검사
 */
export const checkLocalStorageAvailability = (): LocalStorageStatus => {
  try {
    const testKey = 'test_localstorage_availability'
    const testValue = 'test'
    
    localStorage.setItem(testKey, testValue)
    const retrieved = localStorage.getItem(testKey)
    localStorage.removeItem(testKey)
    
    if (retrieved === testValue) {
      return {
        available: true
      }
    } else {
      return {
        available: false,
        error: 'UNKNOWN_ERROR',
        errorMessage: 'LocalStorage 테스트 실패'
      }
    }

  } catch (error: any) {
    let storageError: LocalStorageError = 'UNKNOWN_ERROR'
    let errorMessage = error.message || '알 수 없는 오류'

    if (error.name === 'QuotaExceededError') {
      storageError = 'QUOTA_EXCEEDED'
      errorMessage = 'LocalStorage 저장 공간이 부족합니다'
    }

    return {
      available: false,
      error: storageError,
      errorMessage
    }
  }
}

/**
 * LocalStorage 사용량 정보 조회 (근사치)
 */
export const getLocalStorageUsage = (): {
  used: number;
  total: number;
  percentage: number;
  available: number;
} => {
  let used = 0
  
  try {
    // 전체 LocalStorage 데이터 크기 계산
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length
      }
    }
  } catch (error) {
    logError('LocalStorage 사용량 계산 실패', error)
  }

  const total = MAX_STORAGE_SIZE
  const available = total - used
  const percentage = (used / total) * 100

  return {
    used,
    total,
    percentage,
    available
  }
}
