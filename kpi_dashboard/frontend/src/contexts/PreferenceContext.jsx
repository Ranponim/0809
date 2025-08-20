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
import apiClient from '@/lib/apiClient.js'

// ================================
// 초기 상태 정의 (런타임 환경변수 주입)
// ================================

// 브라우저 런타임에 엔트리포인트가 생성한 window.__RUNTIME_CONFIG__에서 DB 접속 기본값을 읽습니다.
// 서버 빌드/정적 배포에서도 안전하도록 방어적 접근을 사용합니다.
const runtimeConfig = typeof window !== 'undefined' && window.__RUNTIME_CONFIG__ ? window.__RUNTIME_CONFIG__ : {}
const runtimeDbDefaults = {
  host: runtimeConfig.DB_HOST || '',
  port: (() => {
    const p = parseInt(runtimeConfig.DB_PORT, 10)
    return Number.isFinite(p) ? p : 5432
  })(),
  user: runtimeConfig.DB_USER || 'postgres',
  password: runtimeConfig.DB_PASSWORD || '',
  dbname: runtimeConfig.DB_NAME || 'postgres',
  table: 'summary'
}

const defaultSettings = {
  dashboardSettings: {
    selectedPegs: [],
    defaultNe: '',
    defaultCellId: '',
    autoRefreshInterval: 30, // 초 단위
    chartStyle: 'line',
    showLegend: true,
    showGrid: true,
    theme: 'light'
  },
  statisticsSettings: {
    defaultDateRange: 7, // 일 단위
    comparisonEnabled: true,
    showDelta: true,
    showRsd: true,
    defaultPegs: ['availability', 'rrc'],
    chartType: 'bar',
    decimalPlaces: 2,
    autoAnalysis: false
  },
  databaseSettings: {
    // 런타임 설정이 제공되면 이를 기본값으로 사용합니다.
    host: runtimeDbDefaults.host,
    port: runtimeDbDefaults.port,
    user: runtimeDbDefaults.user,
    password: runtimeDbDefaults.password,
    dbname: runtimeDbDefaults.dbname,
    table: runtimeDbDefaults.table
  },
  notificationSettings: {
    enableToasts: true,
    enableSounds: false,
    saveNotification: true,
    errorNotification: true
  },
  generalSettings: {
    language: 'ko',
    timezone: 'Asia/Seoul',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'comma'
  }
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
  initialized: false
}

// ================================
// Reducer 정의
// ================================

const preferenceReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        error: action.payload ? null : state.error
      }

    case 'SET_SAVING':
      return {
        ...state,
        saving: action.payload
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
        saving: false
      }

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: action.payload,
        error: null,
        initialized: true,
        hasUnsavedChanges: false
      }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload
        },
        hasUnsavedChanges: true
      }

    case 'SAVE_SUCCESS':
      return {
        ...state,
        saving: false,
        error: null,
        lastSaved: new Date(),
        hasUnsavedChanges: false
      }

    case 'RESET_SETTINGS':
      return {
        ...state,
        settings: defaultSettings,
        hasUnsavedChanges: true
      }

    default:
      return state
  }
}

// ================================
// Context 생성
// ================================

const PreferenceContext = createContext(null)

// ================================
// Provider 컴포넌트
// ================================

export const PreferenceProvider = ({ children }) => {
  const [state, dispatch] = useReducer(preferenceReducer, initialState)
  const saveTimeoutRef = useRef(null)
  const mountedRef = useRef(true)

  // ================================
  // 로깅 유틸리티
  // ================================

  const logInfo = useCallback((message, data = null) => {
    console.log(`[PreferenceContext] ${message}`, data ? data : '')
  }, [])

  const logError = useCallback((message, error = null) => {
    console.error(`[PreferenceContext] ${message}`, error)
  }, [])

  // ================================
  // API 통신 함수들
  // ================================

  /**
   * 서버에서 사용자 설정 로드
   */
  const loadSettings = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      logInfo('사용자 설정 로드 시작')

      // TODO: API 수정되면 실제 API 호출로 변경
      // const response = await apiClient.get('/api/preference/settings', {
      //   params: { user_id: state.userId }
      // })

      // Mock 데이터 사용 (API 수정될 때까지 임시)
      logInfo('Mock 데이터 사용 (API 문제로 인한 임시 조치)')
      
      const mockSettings = {
        ...defaultSettings
      }

      await new Promise(resolve => setTimeout(resolve, 500)) // 로딩 시뮬레이션

      if (!mountedRef.current) return

      dispatch({ type: 'SET_SETTINGS', payload: mockSettings })
      logInfo('사용자 설정 로드 완료', mockSettings)

      if (state.settings.notificationSettings?.enableToasts) {
        toast.success('설정을 불러왔습니다')
      }

    } catch (error) {
      logError('설정 로드 실패', error)
      dispatch({ type: 'SET_ERROR', payload: '설정을 불러오는데 실패했습니다.' })
      
      if (state.settings.notificationSettings?.enableToasts) {
        toast.error('설정 로드 실패: ' + (error.message || '알 수 없는 오류'))
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.userId, state.settings.notificationSettings?.enableToasts, logInfo, logError])

  /**
   * 서버에 사용자 설정 저장
   */
  const saveSettings = useCallback(async (settingsToSave = null) => {
    if (!mountedRef.current) return

    const settings = settingsToSave || state.settings

    try {
      dispatch({ type: 'SET_SAVING', payload: true })
      logInfo('사용자 설정 저장 시작', settings)

      // TODO: API 수정되면 실제 API 호출로 변경
      // const response = await apiClient.put('/api/preference/settings', {
      //   user_id: state.userId,
      //   settings: settings
      // })

      // Mock 저장 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 300))

      if (!mountedRef.current) return

      dispatch({ type: 'SAVE_SUCCESS' })
      logInfo('사용자 설정 저장 완료')

      if (settings.notificationSettings?.saveNotification) {
        toast.success('설정이 저장되었습니다')
      }

    } catch (error) {
      logError('설정 저장 실패', error)
      dispatch({ type: 'SET_ERROR', payload: '설정 저장에 실패했습니다.' })
      
      if (settings.notificationSettings?.errorNotification) {
        toast.error('설정 저장 실패: ' + (error.message || '알 수 없는 오류'))
      }
    }
  }, [state.settings, state.userId, logInfo, logError])

  // ================================
  // 디바운싱된 자동 저장
  // ================================

  const debouncedSave = useCallback((settings) => {
    // 이전 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 새 타이머 설정 (500ms 지연)
    saveTimeoutRef.current = setTimeout(() => {
      logInfo('디바운싱된 자동 저장 실행')
      saveSettings(settings)
    }, 500)
  }, [saveSettings, logInfo])

  /**
   * 특정 섹션만 로컬 상태로 업데이트(자동 저장 없음)
   * - 수동 저장 UI(저장 버튼)와 같이 사용할 때 씁니다
   */
  const updateSectionLocal = useCallback((sectionKey, sectionSettings) => {
    logInfo(`로컬 섹션 업데이트(자동 저장 없음): ${sectionKey}`, sectionSettings)
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        [sectionKey]: sectionSettings
      }
    })
  }, [logInfo])

  // ================================
  // 공개 API 함수들
  // ================================

  /**
   * 설정 업데이트 (디바운싱된 자동 저장 포함)
   */
  const updateSettings = useCallback((newSettings) => {
    logInfo('설정 업데이트', newSettings)
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings })
    
    // 디바운싱된 자동 저장 트리거
    const updatedSettings = {
      ...state.settings,
      ...newSettings
    }
    debouncedSave(updatedSettings)
  }, [state.settings, debouncedSave, logInfo])

  /**
   * 즉시 저장
   */
  const saveImmediately = useCallback(() => {
    // 디바운싱 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    
    logInfo('즉시 저장 실행')
    return saveSettings()
  }, [saveSettings, logInfo])

  /**
   * 설정 초기화
   */
  const resetSettings = useCallback(() => {
    logInfo('설정 초기화')
    dispatch({ type: 'RESET_SETTINGS' })
    debouncedSave(defaultSettings)
    
    if (state.settings.notificationSettings?.enableToasts) {
      toast.info('설정이 초기화되었습니다')
    }
  }, [debouncedSave, state.settings.notificationSettings?.enableToasts, logInfo])

  /**
   * 에러 상태 클리어
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [])

  // ================================
  // 생명주기 관리
  // ================================

  // 컴포넌트 마운트 시 설정 로드
  useEffect(() => {
    logInfo('PreferenceProvider 초기화 시작')
    loadSettings()
    
    return () => {
      mountedRef.current = false
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      logInfo('PreferenceProvider 정리 완료')
    }
  }, [loadSettings, logInfo])

  // ================================
  // Context 값 정의
  // ================================

  const contextValue = {
    // 상태
    ...state,
    
    // 액션 함수들
    updateSettings,
    updateSectionLocal,
    saveImmediately,
    resetSettings,
    clearError,
    loadSettings,
    
    // 유틸리티
    defaultSettings,
    logInfo,
    logError
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
    throw new Error('usePreference는 PreferenceProvider 내부에서만 사용할 수 있습니다.')
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
    dashboardSettings: settings.dashboardSettings,
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

