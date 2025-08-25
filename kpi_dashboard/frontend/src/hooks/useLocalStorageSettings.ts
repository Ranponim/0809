/**
 * useLocalStorageSettings Hook
 * 
 * TypeScript 안전성과 고급 에러 처리를 제공하는 LocalStorage 전용 Hook입니다.
 * PreferenceContext와 함께 사용하여 하이브리드 저장을 지원합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  UserSettings, 
  LocalStorageStatus,
  LocalStorageError 
} from '@/types/userSettings'
import {
  saveSettingsToLocalStorage,
  loadSettingsFromLocalStorage,
  clearSettingsFromLocalStorage,
  checkLocalStorageAvailability,
  getLocalStorageUsage
} from '@/utils/localStorageUtils'

export interface UseLocalStorageSettingsOptions {
  /** 초기 로드 시 자동으로 설정을 불러올지 여부 */
  autoLoad?: boolean
  /** 에러 발생 시 콜백 함수 */
  onError?: (error: LocalStorageError, message: string) => void
  /** 설정 로드 성공 시 콜백 함수 */
  onLoad?: (settings: UserSettings) => void
  /** 설정 저장 성공 시 콜백 함수 */
  onSave?: (settings: UserSettings) => void
  /** 디버그 로깅 활성화 */
  enableDebugLog?: boolean
}

export interface UseLocalStorageSettingsReturn {
  /** 현재 설정 상태 */
  settings: UserSettings | null
  /** LocalStorage 상태 정보 */
  status: LocalStorageStatus
  /** 사용량 정보 */
  usage: {
    used: number
    total: number
    percentage: number
    available: number
  }
  /** 설정을 LocalStorage에 저장 */
  saveToLocal: (settings: UserSettings) => Promise<boolean>
  /** LocalStorage에서 설정 로드 */
  loadFromLocal: () => Promise<UserSettings | null>
  /** LocalStorage 설정 삭제 */
  clearLocal: () => Promise<boolean>
  /** LocalStorage 가용성 재검사 */
  checkAvailability: () => LocalStorageStatus
  /** 사용량 정보 새로고침 */
  refreshUsage: () => void
  /** 현재 로딩 중인지 여부 */
  isLoading: boolean
  /** 현재 저장 중인지 여부 */
  isSaving: boolean
}

/**
 * LocalStorage 전용 설정 관리 Hook
 */
export const useLocalStorageSettings = (
  options: UseLocalStorageSettingsOptions = {}
): UseLocalStorageSettingsReturn => {
  const {
    autoLoad = true,
    onError,
    onLoad,
    onSave,
    enableDebugLog = false
  } = options

  // 상태 관리
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [status, setStatus] = useState<LocalStorageStatus>({ available: true })
  const [usage, setUsage] = useState(() => getLocalStorageUsage())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Ref로 옵션 추적 (useEffect 의존성 최적화)
  const optionsRef = useRef(options)
  optionsRef.current = options

  /**
   * 디버그 로깅 함수
   */
  const debugLog = useCallback((message: string, data?: any) => {
    if (enableDebugLog) {
      console.log(`[useLocalStorageSettings] ${message}`, data || '')
    }
  }, [enableDebugLog])

  /**
   * 에러 처리 함수
   */
  const handleError = useCallback((error: LocalStorageError, message: string) => {
    debugLog(`에러 발생: ${error} - ${message}`)
    if (optionsRef.current.onError) {
      optionsRef.current.onError(error, message)
    }
  }, [debugLog])

  /**
   * LocalStorage에서 설정 로드
   */
  const loadFromLocal = useCallback(async (): Promise<UserSettings | null> => {
    setIsLoading(true)
    debugLog('LocalStorage에서 설정 로드 시작')

    try {
      const result = loadSettingsFromLocalStorage()
      setStatus(result.status)

      if (!result.status.available) {
        handleError(
          result.status.error || 'UNKNOWN_ERROR',
          result.status.errorMessage || '로드 실패'
        )
        return null
      }

      if (result.settings) {
        setSettings(result.settings)
        debugLog('설정 로드 성공', result.settings)
        
        if (optionsRef.current.onLoad) {
          optionsRef.current.onLoad(result.settings)
        }
        
        return result.settings
      }

      debugLog('저장된 설정이 없습니다')
      return null

    } catch (error: any) {
      const errorMessage = `로드 중 예외 발생: ${error.message}`
      handleError('UNKNOWN_ERROR', errorMessage)
      setStatus({
        available: false,
        error: 'UNKNOWN_ERROR',
        errorMessage,
        lastOperation: 'load',
        lastOperationTime: new Date().toISOString()
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [debugLog, handleError])

  /**
   * 설정을 LocalStorage에 저장
   */
  const saveToLocal = useCallback(async (settingsToSave: UserSettings): Promise<boolean> => {
    setIsSaving(true)
    debugLog('LocalStorage에 설정 저장 시작', settingsToSave)

    try {
      const saveStatus = saveSettingsToLocalStorage(settingsToSave)
      setStatus(saveStatus)

      if (!saveStatus.available) {
        handleError(
          saveStatus.error || 'UNKNOWN_ERROR',
          saveStatus.errorMessage || '저장 실패'
        )
        return false
      }

      setSettings(settingsToSave)
      debugLog('설정 저장 성공')
      
      // 사용량 정보 업데이트
      setUsage(getLocalStorageUsage())
      
      if (optionsRef.current.onSave) {
        optionsRef.current.onSave(settingsToSave)
      }
      
      return true

    } catch (error: any) {
      const errorMessage = `저장 중 예외 발생: ${error.message}`
      handleError('UNKNOWN_ERROR', errorMessage)
      setStatus({
        available: false,
        error: 'UNKNOWN_ERROR',
        errorMessage,
        lastOperation: 'save',
        lastOperationTime: new Date().toISOString()
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }, [debugLog, handleError])

  /**
   * LocalStorage 설정 삭제
   */
  const clearLocal = useCallback(async (): Promise<boolean> => {
    debugLog('LocalStorage 설정 삭제 시작')

    try {
      const clearStatus = clearSettingsFromLocalStorage()
      setStatus(clearStatus)

      if (!clearStatus.available) {
        handleError(
          clearStatus.error || 'UNKNOWN_ERROR',
          clearStatus.errorMessage || '삭제 실패'
        )
        return false
      }

      setSettings(null)
      setUsage(getLocalStorageUsage())
      debugLog('설정 삭제 성공')
      
      return true

    } catch (error: any) {
      const errorMessage = `삭제 중 예외 발생: ${error.message}`
      handleError('UNKNOWN_ERROR', errorMessage)
      return false
    }
  }, [debugLog, handleError])

  /**
   * LocalStorage 가용성 재검사
   */
  const checkAvailability = useCallback((): LocalStorageStatus => {
    debugLog('LocalStorage 가용성 검사')
    const availabilityStatus = checkLocalStorageAvailability()
    setStatus(availabilityStatus)
    return availabilityStatus
  }, [debugLog])

  /**
   * 사용량 정보 새로고침
   */
  const refreshUsage = useCallback(() => {
    debugLog('사용량 정보 새로고침')
    setUsage(getLocalStorageUsage())
  }, [debugLog])

  /**
   * 초기 로드 Effect
   */
  useEffect(() => {
    if (autoLoad) {
      debugLog('자동 로드 시작')
      loadFromLocal()
    }
  }, [autoLoad, loadFromLocal, debugLog])

  /**
   * 정기적 사용량 업데이트 (30초마다)
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setUsage(getLocalStorageUsage())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return {
    settings,
    status,
    usage,
    saveToLocal,
    loadFromLocal,
    clearLocal,
    checkAvailability,
    refreshUsage,
    isLoading,
    isSaving
  }
}
