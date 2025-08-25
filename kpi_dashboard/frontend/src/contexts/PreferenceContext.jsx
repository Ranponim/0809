/**
 * Preference Context Provider
 * 
 * 사용자 설정을 전역적으로 관리하는 React Context입니다.
 * 설정 상태, API 통신, 디바운싱된 자동 저장 기능을 제공합니다.
 * 
 * 사용법:
 * - App.jsx에서 <PreferenceProvider>로 앱을 감싸기
 * - 컴포넌트에서 usePreference() 훅 사용
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import apiClient, { 
  getUserPreferences, 
  saveUserPreferences, 
  createUserPreferences 
} from '@/lib/apiClient.js'
import { 
  saveSettingsToLocalStorage,
  loadSettingsFromLocalStorage,
  clearSettingsFromLocalStorage
} from '@/utils/localStorageUtils'
  // 유틸리티 로드 함수 - 완전히 비활성화
  const loadUtilities = async () => {
    console.log('🔄 유틸리티 함수들 로드 시작 (완전 비활성화)')
    console.log('✅ 유틸리티 함수들 로드 완료 (완전 비활성화)')
  }

// ================================
// LocalStorage 유틸리티 함수들
// ================================

const STORAGE_KEY = 'kpi-dashboard-preferences'

// localStorage 사용 가능 여부 확인
const isLocalStorageAvailable = () => {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (e) {
    console.warn('⚠️ localStorage 사용 불가:', e.message)
    return false
  }
}

// 설정을 localStorage에 저장
const saveToLocalStorage = (settings) => {
  if (!isLocalStorageAvailable()) {
    throw new Error('localStorage를 사용할 수 없습니다')
  }

  try {
    const dataToSave = {
      settings,
      lastSaved: new Date().toISOString(),
      version: 1
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
    console.log('💾 localStorage에 설정 저장 완료:', dataToSave.lastSaved)
    return true
  } catch (error) {
    console.error('❌ localStorage 저장 실패:', error)
    throw new Error(`설정 저장 실패: ${error.message}`)
  }
}

// localStorage에서 설정 로드
const loadFromLocalStorage = () => {
  if (!isLocalStorageAvailable()) {
    console.warn('⚠️ localStorage 사용 불가 - 기본값 사용')
    return null
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      console.log('📂 localStorage에 저장된 설정 없음')
      return null
    }

    const parsed = JSON.parse(stored)
    console.log('📂 localStorage에서 설정 로드 완료:', parsed.lastSaved)
    return parsed.settings
  } catch (error) {
    console.error('❌ localStorage 로드 실패:', error)
    // 손상된 데이터 제거
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.error('❌ 손상된 데이터 제거 실패:', e)
    }
    throw new Error(`설정 로드 실패: ${error.message}`)
  }
}

// 설정 병합 (기본값 + 저장된 값)
const mergeSettings = (savedSettings, defaultSettings) => {
  if (!savedSettings) return defaultSettings

  try {
    const merged = { ...defaultSettings }
    
    // 각 섹션별로 병합
    Object.keys(defaultSettings).forEach(section => {
      if (savedSettings[section] && typeof savedSettings[section] === 'object') {
        merged[section] = {
          ...defaultSettings[section],
          ...savedSettings[section]
        }
      }
    })

    console.log('🔄 설정 병합 완료')
    return merged
  } catch (error) {
    console.error('❌ 설정 병합 실패:', error)
    return defaultSettings
  }
}

  // ================================
// 초기 상태 정의 (단순화)
  // ================================
  
// 안전한 런타임 설정 접근
const getRuntimeConfig = () => {
  try {
    if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
      return window.__RUNTIME_CONFIG__
    }
  } catch (error) {
    console.warn('⚠️ 런타임 설정 접근 실패:', error)
  }
  return {}
}

const runtimeConfig = getRuntimeConfig()

const defaultSettings = {
  // 기본 대시보드 설정
  dashboardSettings: {
    selectedPegs: [],
    defaultNe: '',
    defaultCellId: '',
    autoRefreshInterval: 30,
    chartStyle: 'line',
    showLegend: true,
    showGrid: true,
    theme: 'light',
    // 기본시간 설정 추가
    defaultTimeRange: 30, // 기본값: 30분
    timeUnit: 'minutes', // minutes, hours
    time1Start: null, // Time1 시작 시간
    time1End: null, // Time1 끝 시간
    time2Start: null, // Time2 시작 시간
    time2End: null, // Time2 끝 시간
    enableTimeComparison: false // Time1/Time2 비교 활성화 여부
  },
  // 기본 통계 설정
  statisticsSettings: {
    defaultDateRange: 7,
    comparisonEnabled: true,
    showDelta: true,
    showRsd: true,
    defaultPegs: ['availability', 'rrc'],
    chartType: 'bar',
    decimalPlaces: 2,
    autoAnalysis: false
  },
  // 기본 데이터베이스 설정
  databaseSettings: {
    host: runtimeConfig.DB_HOST || 'postgres', // Docker 서비스명 사용
    port: parseInt(runtimeConfig.DB_PORT, 10) || 5432,
    user: runtimeConfig.DB_USER || 'postgres',
    password: runtimeConfig.DB_PASSWORD || 'postgres', // Docker Compose의 기본 비밀번호
    dbname: runtimeConfig.DB_NAME || 'netperf', // 실제 DB명 사용
    table: 'summary'
  },
  // 기본 알림 설정
  notificationSettings: {
    enableToasts: true,
    enableSounds: false,
    saveNotification: true,
    errorNotification: true
  },
  // 기본 일반 설정
  generalSettings: {
    language: 'ko',
    timezone: 'Asia/Seoul',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'comma'
  },
  // PEG 설정
  pegConfigurations: [],
  // 통계 설정
  statisticsConfigurations: []
}

const initialState = {
  // 설정 데이터
  settings: defaultSettings,
  // UI 상태
  loading: false,
  saving: false,
  error: null,
  lastSaved: null,
  hasUnsavedChanges: false,
  // 메타데이터
  userId: 'default',
  initialized: false,
  lastModified: null,
  version: 1,
  // LocalStorage 상태
  localStorageAvailable: true,
  syncStatus: 'idle',
  // 충돌 분석 상태
  conflictAnalysis: null,
  conflictResolution: null,
  hasActiveConflict: false,
  lastConflictCheck: null,
  // 백그라운드 동기화 상태
  backgroundSync: {
    enabled: false,
    strategy: 'hybrid',
    state: 'idle',
    lastSyncTime: null,
    retryCount: 0,
    isOnline: true,
    networkInfo: null
  }
}

// ================================
// Reducer 정의 (단순화)
// ================================

const preferenceReducer = (state, action) => {
  try {
    // 안전한 상태 체크
    if (!state || typeof state !== 'object') {
      console.error('❌ preferenceReducer: 잘못된 state:', state)
      return initialState
    }

  switch (action.type) {
    case 'SET_LOADING':
        return { ...state, loading: action.payload }

    case 'SET_SAVING':
        return { ...state, saving: action.payload }

    case 'SET_ERROR':
        return { ...state, error: action.payload }

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: action.payload,
          hasUnsavedChanges: true,
          lastModified: new Date()
      }

      case 'UPDATE_SETTING':
        const { section, key, value } = action.payload
      return {
        ...state,
        settings: {
          ...state.settings,
            [section]: {
              ...state.settings[section],
              [key]: value
            }
          },
        hasUnsavedChanges: true,
          lastModified: new Date()
        }
      
      case 'SET_INITIALIZED':
        return { ...state, initialized: action.payload }
      
      case 'SET_LAST_SAVED':
        return { ...state, lastSaved: action.payload }
      
      case 'SET_HAS_UNSAVED_CHANGES':
        return { ...state, hasUnsavedChanges: action.payload }
      
      case 'SET_LOCAL_STORAGE_AVAILABLE':
        return { ...state, localStorageAvailable: action.payload }

    default:
        console.warn('⚠️ preferenceReducer: 알 수 없는 액션:', action.type)
      return state
    }
  } catch (error) {
    console.error('❌ preferenceReducer 오류:', error)
    return initialState
  }
}

// ================================
// Context 생성
// ================================

const PreferenceContext = createContext(null)

// ================================
// Provider 컴포넌트 (단순화)
// ================================

export const PreferenceProvider = ({ children }) => {
  const [state, dispatch] = useReducer(preferenceReducer, initialState)
  const saveTimeoutRef = useRef(null)
  const mountedRef = useRef(false)

  // 안전한 초기화
  useEffect(() => {
    console.log('🔄 PreferenceProvider 초기화 시작')
    mountedRef.current = true

    const initializeProvider = async () => {
      try {
        // localStorage 사용 가능 여부 확인
        const storageAvailable = isLocalStorageAvailable()
        dispatch({ type: 'SET_LOCAL_STORAGE_AVAILABLE', payload: storageAvailable })
        
        // 지연된 초기화로 안정성 확보
        await new Promise(resolve => setTimeout(resolve, 100))
        
        if (!mountedRef.current) return

        // localStorage에서 설정 로드 (단순화)
        if (storageAvailable) {
          try {
            console.log('📂 초기화 시 설정 로드 시작...')
            const savedSettings = loadFromLocalStorage()
            if (savedSettings) {
              const mergedSettings = mergeSettings(savedSettings, defaultSettings)
              dispatch({ type: 'SET_SETTINGS', payload: mergedSettings })
              console.log('✅ 초기화 시 설정 로드 완료')
        } else {
              console.log('📂 저장된 설정 없음 - 기본값 사용')
            }
    } catch (error) {
            console.warn('⚠️ 초기화 시 설정 로드 실패, 기본값 사용:', error.message)
        }
      } else {
          console.log('⚠️ localStorage 사용 불가 - 기본값 사용')
        }

        console.log('✅ PreferenceProvider 초기화 완료')
        dispatch({ type: 'SET_INITIALIZED', payload: true })
    } catch (error) {
        console.error('❌ PreferenceProvider 초기화 오류:', error)
        dispatch({ type: 'SET_ERROR', payload: error.message })
      }
    }

    initializeProvider()

    return () => {
      mountedRef.current = false
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, []) // loadSettings 의존성 제거

  // 설정 변경 시 자동 저장 (임시 비활성화)
  // useEffect(() => {
  //   if (!state.initialized || !state.hasUnsavedChanges) return

  //   // 디바운싱: 2초 후 자동 저장
  //   if (saveTimeoutRef.current) {
  //     clearTimeout(saveTimeoutRef.current)
  //   }

  //   saveTimeoutRef.current = setTimeout(async () => {
  //     if (mountedRef.current && state.hasUnsavedChanges) {
  //       console.log('🔄 설정 변경 감지 - 자동 저장 시작...')
  //       await saveSettings()
  //     }
  //   }, 2000)

  //   return () => {
  //     if (saveTimeoutRef.current) {
  //       clearTimeout(saveTimeoutRef.current)
  //     }
  //   }
  // }, [state.settings, state.initialized, state.hasUnsavedChanges, saveSettings])

  // 나머지 함수들은 기존과 동일하게 유지하되 안전성 강화
  const saveSettings = useCallback(async () => {
    try {
      console.log('💾 설정 저장 시작...')
      dispatch({ type: 'SET_SAVING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      // 현재 설정을 localStorage에 저장
      saveToLocalStorage(state.settings)
      
      // 저장 성공 상태 업데이트
      dispatch({ type: 'SET_LAST_SAVED', payload: new Date() })
      dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false })
      
      console.log('✅ 설정 저장 완료')
      return { success: true }
    } catch (error) {
      console.error('❌ 설정 저장 실패:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
      return { success: false, error: error.message }
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false })
    }
  }, [state.settings])

  const loadSettings = useCallback(async () => {
    try {
      console.log('📂 설정 로드 시작...')
      dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

      // localStorage에서 설정 로드
      const savedSettings = await loadFromLocalStorage()
      
      // 기본값과 병합
      const mergedSettings = mergeSettings(savedSettings, defaultSettings)
      
      // 상태 업데이트
      dispatch({ type: 'SET_SETTINGS', payload: mergedSettings })
      dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: false })
      
      console.log('✅ 설정 로드 완료')
      return { success: true, settings: mergedSettings }
    } catch (error) {
      console.error('❌ 설정 로드 실패:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
      // 기본값 사용
          dispatch({ type: 'SET_SETTINGS', payload: defaultSettings })
      return { success: false, error: error.message, settings: defaultSettings }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const updateSetting = useCallback((section, key, value) => {
    dispatch({ type: 'UPDATE_SETTING', payload: { section, key, value } })
  }, [])

  // 설정 초기화 함수 추가
  const resetSettings = useCallback(async (sections = ['dashboardSettings', 'statisticsSettings', 'databaseSettings']) => {
    try {
      console.log('🔄 설정 초기화 시작...', sections)
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      // 지정된 섹션들을 기본값으로 초기화
      const resetSettings = { ...state.settings }
      sections.forEach(section => {
        if (defaultSettings[section]) {
          resetSettings[section] = { ...defaultSettings[section] }
        }
      })

      // 상태 업데이트
      dispatch({ type: 'SET_SETTINGS', payload: resetSettings })
      dispatch({ type: 'SET_HAS_UNSAVED_CHANGES', payload: true })

      // localStorage에서도 제거
      if (isLocalStorageAvailable()) {
        try {
          localStorage.removeItem(STORAGE_KEY)
          console.log('🗑️ localStorage에서 설정 제거 완료')
    } catch (error) {
          console.warn('⚠️ localStorage 제거 실패:', error.message)
        }
      }

      console.log('✅ 설정 초기화 완료')
      return { success: true, resetSections: sections }
    } catch (error) {
      console.error('❌ 설정 초기화 실패:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
      return { success: false, error: error.message }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.settings])

  const contextValue = {
    state,
    dispatch,
    saveSettings,
    loadSettings,
    updateSetting,
    resetSettings, // 초기화 함수 추가
    // 기타 필요한 함수들...
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
    console.warn('⚠️ usePreference: PreferenceProvider 외부에서 사용됨 - 기본값 반환')
    return {
      state: {
        loading: false,
        saving: false,
        error: null,
        settings: {
          dashboardSettings: {},
          statisticsSettings: {},
          databaseSettings: {},
          notificationSettings: {},
          generalSettings: {},
          pegConfigurations: [],
          statisticsConfigurations: []
        },
        initialized: false,
        hasUnsavedChanges: false,
        userId: 'default',
        version: 1
      },
      settings: {
        dashboardSettings: {},
        statisticsSettings: {},
        databaseSettings: {},
        notificationSettings: {},
        generalSettings: {},
        pegConfigurations: [],
        statisticsConfigurations: []
      },
      dispatch: () => {},
      saveSettings: () => Promise.resolve(),
      loadSettings: () => Promise.resolve(),
      resetSettings: () => {},
      updateSettings: () => {},
      getSetting: () => null,
      setSetting: () => {},
      hasUnsavedChanges: false,
      isLoading: false,
      isSaving: false,
      error: null,
      saving: false,
      lastSaved: null,
      saveImmediately: () => Promise.resolve()
    }
  }
  
  return context
}

// ================================
// 개별 설정 섹션별 훅들
// ================================

/**
 * Dashboard 설정만 관리하는 훅
 */
export const useDashboardSettings = () => {
  const { settings, updateSettings, saving, error } = usePreference()
  
  const updateDashboardSettings = useCallback((newSettings) => {
    updateSettings({
      dashboardSettings: {
        ...settings.dashboardSettings,
        ...newSettings
      }
    })
  }, [settings.dashboardSettings, updateSettings])
  
  return {
    dashboardSettings: settings.dashboardSettings || {},
    updateDashboardSettings,
    saving,
    error
  }
}

/**
 * Statistics 설정만 관리하는 훅
 */
export const useStatisticsSettings = () => {
  const { settings, updateSettings, saving, error } = usePreference()
  
  const updateStatisticsSettings = useCallback((newSettings) => {
    updateSettings({
      statisticsSettings: {
        ...settings.statisticsSettings,
        ...newSettings
      }
    })
  }, [settings.statisticsSettings, updateSettings])
  
  return {
    statisticsSettings: settings.statisticsSettings,
    updateStatisticsSettings,
    saving,
    error
  }
}

export default PreferenceContext

