/**
 * 단순화된 Preference Context Provider
 * 
 * 사용자 설정을 전역적으로 관리하는 React Context입니다.
 * 복잡한 로직은 별도 훅으로 분리하여 안정성을 높였습니다.
 * 
 * 주요 기능:
 * - 단순한 상태 관리
 * - 기본 설정값 제공
 * - 안전한 초기화
 * - 에러 처리
 * 
 * 사용법:
 * - App.jsx에서 <PreferenceProvider>로 앱을 감싸기
 * - 컴포넌트에서 usePreference() 훅 사용
 * 
 * 리팩토링 버전: 복잡한 로직을 분리하여 안정성 향상
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { logPreference, createDefaultSettings, mergeSettings, validateSettings } from '@/utils/preferenceUtils'
import usePreferenceStorage from '@/hooks/usePreferenceStorage'
import usePreferenceAPI from '@/hooks/usePreferenceAPI'

// ================================
// Context 생성
// ================================

const PreferenceContext = createContext(null)

// ================================
// Provider 컴포넌트 (단순화)
// ================================

export const PreferenceProvider = ({ children }) => {
  // 기본 설정값 생성 (메모이제이션으로 불필요한 재생성 방지)
  const defaultSettings = useMemo(() => createDefaultSettings(), [])
  
  // 상태 관리 (단순화)
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastModified, setLastModified] = useState(null)
  
  // 마운트 상태 추적
  const mountedRef = useRef(false)
  
  // 분리된 훅들 사용
  const storage = usePreferenceStorage()
  const api = usePreferenceAPI()

  // ================================
  // 초기화 로직
  // ================================

  useEffect(() => {
    logPreference('info', 'PreferenceProvider 초기화 시작')
    mountedRef.current = true

    const initializeProvider = async () => {
      try {
        setLoading(true)
        setError(null)

        // 지연된 초기화로 안정성 확보
        await new Promise(resolve => setTimeout(resolve, 100))
        
        if (!mountedRef.current) return

        // localStorage에서 설정 로드
        if (storage.isAvailable) {
          try {
            logPreference('info', '초기화 시 localStorage에서 설정 로드 시작')
            const loadResult = await storage.loadSettings()
            
            if (loadResult.success && loadResult.settings) {
              // 기본값과 병합
              const mergedSettings = mergeSettings(loadResult.settings, defaultSettings)
              setSettings(mergedSettings)
              setHasUnsavedChanges(false)
              logPreference('info', '초기화 시 설정 로드 완료', {
                settingsKeys: Object.keys(mergedSettings)
              })
            } else {
              logPreference('info', '저장된 설정 없음 - 기본값 사용')
              setSettings(defaultSettings)
            }
          } catch (error) {
            logPreference('warn', '초기화 시 설정 로드 실패, 기본값 사용', error.message)
            setSettings(defaultSettings)
          }
        } else {
          logPreference('warn', 'localStorage 사용 불가 - 기본값 사용')
          setSettings(defaultSettings)
        }

        setInitialized(true)
        logPreference('info', 'PreferenceProvider 초기화 완료')
      } catch (error) {
        logPreference('error', 'PreferenceProvider 초기화 오류', error.message)
        setError(error.message)
        setSettings(defaultSettings)
        setInitialized(true)
      } finally {
        setLoading(false)
      }
    }

    initializeProvider()

    return () => {
      mountedRef.current = false
    }
  }, [storage.isAvailable])

  // ================================
  // 설정 업데이트 함수들
  // ================================

  /**
   * 단일 설정 업데이트
   * @param {string} section - 설정 섹션
   * @param {string} key - 설정 키
   * @param {any} value - 설정 값
   */
  const updateSetting = useCallback((section, key, value) => {
    logPreference('info', '설정 업데이트', { section, key, value })
    
    setSettings(prevSettings => {
      const newSettings = {
        ...prevSettings,
        [section]: {
          ...prevSettings[section],
          [key]: value
        }
      }
      
      setHasUnsavedChanges(true)
      setLastModified(new Date())
      
      logPreference('info', '설정 업데이트 완료', { section, key })
      return newSettings
    })
  }, [])

  /**
   * 여러 설정 한번에 업데이트
   * @param {Object} newSettings - 업데이트할 설정들
   */
  const updateSettings = useCallback((newSettings) => {
    logPreference('info', '다중 설정 업데이트 시작', { 
      newSettingsKeys: Object.keys(newSettings)
    })
    
    setSettings(prevSettings => {
      const updatedSettings = { ...prevSettings }
      
      Object.entries(newSettings).forEach(([section, sectionSettings]) => {
        if (typeof sectionSettings === 'object') {
          updatedSettings[section] = {
            ...updatedSettings[section],
            ...sectionSettings
          }
        }
      })
      
      setHasUnsavedChanges(true)
      setLastModified(new Date())
      
      logPreference('info', '다중 설정 업데이트 완료')
      return updatedSettings
    })
  }, [])

  // ================================
  // 저장/로드 함수들
  // ================================

  /**
   * 설정을 localStorage에 저장
   */
  const saveSettings = useCallback(async () => {
    logPreference('info', '설정 저장 시작')
    
    try {
      setSaving(true)
      setError(null)

      const result = await storage.saveSettings(settings)
      
      if (result.success) {
        setHasUnsavedChanges(false)
        logPreference('info', '설정 저장 완료')
        return { success: true }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      const errorMessage = error.message
      setError(errorMessage)
      logPreference('error', '설정 저장 실패', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setSaving(false)
    }
  }, [settings, storage])

  /**
   * localStorage에서 설정 로드
   */
  const loadSettings = useCallback(async () => {
    logPreference('info', '설정 로드 시작')
    
    try {
      setLoading(true)
      setError(null)

      const result = await storage.loadSettings()
      
      if (result.success) {
        if (result.settings) {
          const mergedSettings = mergeSettings(result.settings, defaultSettings)
          setSettings(mergedSettings)
          setHasUnsavedChanges(false)
          logPreference('info', '설정 로드 완료', {
            settingsKeys: Object.keys(mergedSettings)
          })
        } else {
          logPreference('info', '저장된 설정 없음')
        }
        return { success: true, settings: result.settings }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      const errorMessage = error.message
      setError(errorMessage)
      logPreference('error', '설정 로드 실패', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [defaultSettings, storage])

  /**
   * 설정 초기화
   */
  const resetSettings = useCallback(async (sections = null) => {
    logPreference('info', '설정 초기화 시작', { sections })
    
    try {
      setLoading(true)
      setError(null)

      let newSettings = defaultSettings
      
      if (sections && Array.isArray(sections)) {
        // 특정 섹션만 초기화
        newSettings = { ...settings }
        sections.forEach(section => {
          if (defaultSettings[section]) {
            newSettings[section] = { ...defaultSettings[section] }
          }
        })
      }

      setSettings(newSettings)
      setHasUnsavedChanges(true)
      setLastModified(new Date())

      // localStorage에서도 제거
      if (sections === null) {
        await storage.clearSettings()
      }

      logPreference('info', '설정 초기화 완료')
      return { success: true }
    } catch (error) {
      const errorMessage = error.message
      setError(errorMessage)
      logPreference('error', '설정 초기화 실패', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [defaultSettings, settings, storage])

  // ================================
  // 유효성 검증
  // ================================

  /**
   * 설정 유효성 검증
   */
  const validateCurrentSettings = useCallback((section = null) => {
    logPreference('info', '설정 유효성 검증 시작', { section })
    
    const errors = validateSettings(settings, section)
    
    if (Object.keys(errors).length > 0) {
      logPreference('warn', '설정 유효성 검증 실패', errors)
      setError(`설정 오류: ${Object.values(errors)[0]}`)
    } else {
      logPreference('info', '설정 유효성 검증 통과')
      setError(null)
    }
    
    return errors
  }, [settings])

  // ================================
  // Context 값 구성
  // ================================

  const contextValue = {
    // 상태
    state: {
      settings,
      loading: loading || storage.loading || api.loading,
      saving: saving || storage.saving || api.saving,
      error: error || storage.error || api.error,
      initialized,
      hasUnsavedChanges,
      lastModified,
      lastSaved: storage.lastSaved,
      lastSync: api.lastSync,
      localStorageAvailable: storage.isAvailable
    },
    
    // 설정 데이터 (편의를 위한 직접 접근)
    settings,
    dashboardSettings: settings.dashboardSettings || {},
    statisticsSettings: settings.statisticsSettings || {},
    databaseSettings: settings.databaseSettings || {},
    notificationSettings: settings.notificationSettings || {},
    generalSettings: settings.generalSettings || {},
    
    // 기본 함수들
    updateSetting,
    updateSettings,
    saveSettings,
    loadSettings,
    resetSettings,
    validateCurrentSettings,
    
    // Storage 관련
    storage,
    
    // API 관련
    api
  }

  return (
    <PreferenceContext.Provider value={contextValue}>
      {children}
    </PreferenceContext.Provider>
  )
}

// ================================
// 커스텀 훅
// ================================

/**
 * Preference Context를 사용하는 커스텀 훅
 * 
 * @returns {Object} 설정 상태와 관리 함수들
 */
export const usePreference = () => {
  const context = useContext(PreferenceContext)
  
  if (!context) {
    // 에러 대신 기본값 반환
    logPreference('warn', 'usePreference: PreferenceProvider 외부에서 사용됨 - 기본값 반환')
    
    const defaultSettings = createDefaultSettings()
    
    return {
      state: {
        settings: defaultSettings,
        loading: false,
        saving: false,
        error: null,
        initialized: false,
        hasUnsavedChanges: false,
        lastModified: null,
        lastSaved: null,
        lastSync: null,
        localStorageAvailable: false
      },
      settings: defaultSettings,
      dashboardSettings: defaultSettings.dashboardSettings || {},
      statisticsSettings: defaultSettings.statisticsSettings || {},
      databaseSettings: defaultSettings.databaseSettings || {},
      notificationSettings: defaultSettings.notificationSettings || {},
      generalSettings: defaultSettings.generalSettings || {},
      updateSetting: () => {},
      updateSettings: () => {},
      saveSettings: () => Promise.resolve({ success: false }),
      loadSettings: () => Promise.resolve({ success: false }),
      resetSettings: () => Promise.resolve({ success: false }),
      validateCurrentSettings: () => ({}),
      storage: {
        isAvailable: false,
        saveSettings: () => Promise.resolve({ success: false }),
        loadSettings: () => Promise.resolve({ success: false }),
        clearSettings: () => Promise.resolve({ success: false }),
        error: null
      },
      api: {
        loading: false,
        error: null,
        getUserPreferences: () => Promise.resolve({ success: false }),
        saveUserPreferences: () => Promise.resolve({ success: false }),
        clearError: () => {}
      }
    }
  }
  
  return context
}

// ================================
// 내보내기
// ================================

export default PreferenceContext

