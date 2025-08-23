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
  clearSettingsFromLocalStorage,
  checkLocalStorageAvailability
} from '@/utils/localStorageUtils'
import {
  mapUserSettingsToBackend,
  mapBackendToUserSettings,
  compareTimestamps
} from '@/utils/preferenceModelMapper.js'
import {
  analyzeSettingsConflict,
  generateConflictResolution,
  formatConflictMessage,
  CONFLICT_TYPES,
  CONFLICT_SEVERITY
} from '@/utils/dataComparisonUtils.js'
import {
  comprehensiveLWW,
  strictTimestampLWW,
  fieldLevelLWW,
  smartMergeStrategy,
  LWW_STRATEGIES,
  CONFIDENCE_LEVELS
} from '@/utils/lastWriteWinsUtils.js'
import {
  logInfo as logInfoUtil,
  logError as logErrorUtil,
  logDebug,
  logSyncStart,
  logSyncSuccess,
  logSyncError
} from '@/utils/loggingUtils.js'
import {
  createBackgroundSync,
  SYNC_STRATEGIES,
  SYNC_STATES,
  getNetworkInfo
} from '@/utils/backgroundSyncUtils.js'

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
  // ================================
  // PRD 호환 userSettings 구조 
  // ================================
  
  preferences: {
    // 기존 dashboardSettings와 호환
    dashboard: {
      selectedPegs: [],
      defaultNe: '',
      defaultCellId: '',
      autoRefreshInterval: 30, // 초 단위
      chartStyle: 'line',
      showLegend: true,
      showGrid: true,
      theme: 'light'
    },
    // 기존 statisticsSettings와 호환
    charts: {
      defaultDateRange: 7, // 일 단위
      comparisonEnabled: true,
      showDelta: true,
      showRsd: true,
      chartType: 'bar',
      decimalPlaces: 2,
      autoAnalysis: false
    },
    // 필터링 및 표시 설정
    filters: {
      dateFormat: 'YYYY-MM-DD',
      numberFormat: 'comma',
      language: 'ko',
      timezone: 'Asia/Seoul'
    }
  },
  
  pegConfigurations: [
    // PEG 설정 배열 (초기값 비어있음, 사용자가 추가)
    // 예시 구조:
    // {
    //   id: 'availability_001',
    //   name: 'Availability',
    //   enabled: true,
    //   parameters: { threshold: 95, unit: '%' },
    //   dependencies: []
    // }
  ],
  
  statisticsConfigurations: [
    // Statistics 설정 배열 (초기값 비어있음, 사용자가 추가)
    // 예시 구조:
    // {
    //   id: 'rrc_stats_001', 
    //   name: 'RRC Statistics',
    //   enabled: true,
    //   parameters: { aggregation: 'avg', period: 'daily' },
    //   dependencies: []
    // }
  ],

  // ================================
  // 기존 설정들 (하위 호환성)
  // ================================
  
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
  // 메타데이터 (PRD 요구사항 추가)
  userId: 'default',
  initialized: false,
  lastModified: null,
  version: 1,
  // LocalStorage 상태
  localStorageAvailable: true,
  syncStatus: 'idle', // 'idle', 'syncing', 'error', 'offline'
  // Task 8.2: 충돌 분석 상태
  conflictAnalysis: null,
  conflictResolution: null,
  hasActiveConflict: false,
  lastConflictCheck: null,
  // Task 8.4: 백그라운드 동기화 상태
  backgroundSync: {
    enabled: false,
    strategy: SYNC_STRATEGIES.HYBRID,
    state: SYNC_STATES.IDLE,
    lastSyncTime: null,
    retryCount: 0,
    isOnline: true,
    networkInfo: null
  }
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
        hasUnsavedChanges: true,
        lastModified: new Date().toISOString(),
        version: state.version + 1
      }

    case 'SET_SYNC_STATUS':
      return {
        ...state,
        syncStatus: action.payload
      }

    case 'SET_LOCAL_STORAGE_STATUS':
      return {
        ...state,
        localStorageAvailable: action.payload
      }

    // Task 8.2: 충돌 분석 관련 액션들
    case 'SET_CONFLICT_ANALYSIS':
      return {
        ...state,
        conflictAnalysis: action.payload,
        hasActiveConflict: action.payload?.hasConflict || false,
        lastConflictCheck: new Date().toISOString()
      }

    case 'SET_CONFLICT_RESOLUTION':
      return {
        ...state,
        conflictResolution: action.payload
      }

    case 'CLEAR_CONFLICT':
      return {
        ...state,
        conflictAnalysis: null,
        conflictResolution: null,
        hasActiveConflict: false
      }

    // Task 8.4: 백그라운드 동기화 관련 액션들
    case 'SET_BACKGROUND_SYNC_STATE':
      return {
        ...state,
        backgroundSync: {
          ...state.backgroundSync,
          ...action.payload
        }
      }

    case 'ENABLE_BACKGROUND_SYNC':
      return {
        ...state,
        backgroundSync: {
          ...state.backgroundSync,
          enabled: true,
          strategy: action.payload.strategy || state.backgroundSync.strategy
        }
      }

    case 'DISABLE_BACKGROUND_SYNC':
      return {
        ...state,
        backgroundSync: {
          ...state.backgroundSync,
          enabled: false,
          state: SYNC_STATES.IDLE
        }
      }

    case 'UPDATE_NETWORK_INFO':
      return {
        ...state,
        backgroundSync: {
          ...state.backgroundSync,
          isOnline: action.payload.isOnline,
          networkInfo: action.payload.networkInfo
        }
      }

    case 'UPDATE_METADATA':
      return {
        ...state,
        ...action.payload
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
  // Task 8.4: 백그라운드 동기화 매니저 레퍼런스
  const backgroundSyncManagerRef = useRef(null)
  const lastChangeDetectionRef = useRef(null)

  // ================================
  // LocalStorage 지속성 상수
  // ================================
  
  const STORAGE_KEY = 'kpi_dashboard_user_settings'
  const STORAGE_VERSION = '1.0.0'

  // ================================
  // 로깅 유틸리티
  // ================================

  const logInfo = useCallback((message, data = null) => {
    logInfoUtil(`[PreferenceContext] ${message}`, data)
  }, [])

  const logError = useCallback((message, error = null) => {
    logErrorUtil(`[PreferenceContext] ${message}`, error)
  }, [])

  // ================================
  // LocalStorage 유틸리티 함수들
  // ================================

  /**
   * LocalStorage에서 설정 로드 (새로운 유틸리티 사용)
   */
  const loadFromLocalStorage = useCallback(() => {
    try {
      const result = loadSettingsFromLocalStorage()
      
      if (!result.status.available) {
        logError('LocalStorage 로드 실패', result.status.errorMessage)
        return null
      }

      if (result.settings) {
        // UserSettings를 기존 설정 구조로 변환
        const convertedSettings = {
          dashboardSettings: result.settings.preferences?.dashboard || {},
          statisticsSettings: result.settings.preferences?.dashboard || {},
          databaseSettings: state.settings.databaseSettings || {},
          notificationSettings: state.settings.notificationSettings || {},
          pegConfigurations: result.settings.pegConfigurations || [],
          statisticsConfigurations: result.settings.statisticsConfigurations || []
        }
        
        logInfo('LocalStorage에서 설정 로드 성공', convertedSettings)
        return convertedSettings
      }

      logInfo('LocalStorage에 저장된 설정이 없습니다')
      return null

    } catch (error) {
      logError('LocalStorage 설정 로드 중 예외 발생', error)
      return null
    }
  }, [logInfo, logError, state.settings])

  /**
   * LocalStorage에 설정 저장 (새로운 유틸리티 사용)
   */
  const saveToLocalStorage = useCallback((settings) => {
    try {
      // 기존 설정을 UserSettings 형식으로 변환
      const userSettings = {
        userId: state.userId || 'default',
        preferences: {
          dashboard: settings.dashboardSettings || {},
          charts: settings.chartSettings || {},
          filters: settings.filterSettings || {}
        },
        pegConfigurations: settings.pegConfigurations || [],
        statisticsConfigurations: settings.statisticsConfigurations || [],
        metadata: {
          version: state.version || 1,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }
      }

      const result = saveSettingsToLocalStorage(userSettings)
      
      if (!result.available) {
        if (result.error === 'QUOTA_EXCEEDED') {
          if (state.settings.notificationSettings?.errorNotification) {
            toast.error('저장 공간 부족', {
              description: '브라우저 저장 공간이 부족합니다. 캐시를 정리해주세요.',
              duration: 5000,
              action: {
                label: '도움말',
                onClick: () => {
                  toast.info('브라우저 설정에서 저장된 데이터를 정리하거나, 시크릿 모드를 사용해보세요.')
                }
              }
            })
          }
        } else {
          logError('LocalStorage 설정 저장 실패', result.errorMessage)
        }
        return false
      }

      logInfo('LocalStorage에 설정 저장 완료')
      return true

    } catch (error) {
      logError('LocalStorage 설정 저장 중 예외 발생', error)
      return false
    }
  }, [logInfo, logError, state.userId, state.version, state.settings.notificationSettings?.errorNotification])

  /**
   * LocalStorage 설정 제거 (새로운 유틸리티 사용)
   */
  const clearLocalStorage = useCallback(() => {
    try {
      const result = clearSettingsFromLocalStorage()
      
      if (!result.available) {
        logError('LocalStorage 설정 제거 실패', result.errorMessage)
        return false
      }

      logInfo('LocalStorage 설정 제거 완료')
      return true
    } catch (error) {
      logError('LocalStorage 설정 제거 중 예외 발생', error)
      return false
    }
  }, [logInfo, logError])

  // ================================
  // API 통신 함수들
  // ================================

  /**
   * 하이브리드 설정 로드 (LocalStorage 우선, 서버 폴백)
   */
  const loadSettings = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      logInfo('하이브리드 설정 로드 시작')

      // Task 8.1: Server-First Sync - 서버 우선 초기 로드 구현
      
      // 1. 먼저 서버에서 설정 로드 시도 (Server-First Strategy)
      logInfo('서버 우선 설정 로드 시작')
      
      const serverResponse = await getUserPreferences(state.userId)
      
      if (serverResponse.success && !serverResponse.isNew) {
        // 서버에 설정이 있는 경우
        const serverUserSettings = mapBackendToUserSettings(serverResponse.data)
        
        // 2. LocalStorage에서도 설정 확인
        const localSettings = loadFromLocalStorage()
        
        if (localSettings) {
          // 두 설정 모두 있으면 타임스탬프 비교
          const comparison = compareTimestamps(
            localSettings?.metadata?.lastModified,
            serverUserSettings?.metadata?.lastModified
          )
          
          if (comparison > 0) {
            // 로컬이 더 최신
            logInfo('로컬 설정이 더 최신 - 로컬 설정 적용 후 서버 동기화')
            dispatch({ type: 'SET_SETTINGS', payload: localSettings })
            
            // 백그라운드에서 서버에 업로드
            setTimeout(() => syncWithServer(localSettings), 100)
            
            if (localSettings.notificationSettings?.enableToasts) {
              toast.success('저장된 설정을 복원했습니다')
            }
          } else {
            // 서버가 더 최신 또는 같음
            logInfo('서버 설정이 최신 - 서버 설정 적용')
            dispatch({ type: 'SET_SETTINGS', payload: serverUserSettings })
            saveToLocalStorage(serverUserSettings)
            
            if (serverUserSettings.notificationSettings?.enableToasts) {
              toast.success('서버에서 최신 설정을 불러왔습니다')
            }
          }
        } else {
          // 로컬 설정 없음 - 서버 설정 적용
          logInfo('로컬 설정 없음 - 서버 설정 적용')
          dispatch({ type: 'SET_SETTINGS', payload: serverUserSettings })
          saveToLocalStorage(serverUserSettings)
          
          if (serverUserSettings.notificationSettings?.enableToasts) {
            toast.success('설정을 불러왔습니다')
          }
        }
        
        return
      }
      
      // 3. 서버에 설정이 없는 경우 (신규 사용자)
      logInfo('신규 사용자 - LocalStorage 또는 기본 설정 사용')
      
      const localSettings = loadFromLocalStorage()
      
      if (localSettings) {
        // LocalStorage에 설정이 있으면 사용하고 서버에 업로드
        logInfo('LocalStorage 설정 복원 후 서버 업로드')
        dispatch({ type: 'SET_SETTINGS', payload: localSettings })
        
        // 백그라운드에서 서버에 업로드
        setTimeout(() => syncWithServer(localSettings), 100)
        
        if (localSettings.notificationSettings?.enableToasts) {
          toast.success('저장된 설정을 복원했습니다')
        }
      } else {
        // 완전히 새로운 사용자 - 기본 설정 사용
        logInfo('완전히 새로운 사용자 - 기본 설정 사용')
        dispatch({ type: 'SET_SETTINGS', payload: defaultSettings })
        saveToLocalStorage(defaultSettings)
        
        // 기본 설정을 서버에도 저장
        setTimeout(() => syncWithServer(defaultSettings), 100)
        
        if (defaultSettings.notificationSettings?.enableToasts) {
          toast.info('기본 설정으로 시작합니다')
        }
      }

    } catch (error) {
      logError('설정 로드 실패, 기본값 사용', error)
      
      // 서버 로드 실패 시 기본 설정 사용
      dispatch({ type: 'SET_SETTINGS', payload: defaultSettings })
      saveToLocalStorage(defaultSettings)
      
      if (defaultSettings.notificationSettings?.enableToasts) {
        toast.warning('서버 연결 실패로 기본 설정을 사용합니다')
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.userId, loadFromLocalStorage, saveToLocalStorage, logInfo, logError])

  /**
   * 서버와 동기화 (백그라운드)
   */
  const syncWithServer = useCallback(async (localSettings = null) => {
    try {
      logSyncStart('서버와 설정 동기화')
      
      // 1. 서버에서 최신 설정 조회
      const serverResponse = await getUserPreferences(state.userId)
      
      if (!serverResponse.success) {
        logSyncError('서버 설정 조회 실패', serverResponse.error)
        return
      }

      // 2. 신규 사용자인 경우 로컬 설정을 서버에 업로드
      if (serverResponse.isNew) {
        logInfo('신규 사용자 - 로컬 설정을 서버에 업로드')
        
        if (localSettings) {
          const backendData = mapUserSettingsToBackend(localSettings)
          backendData.user_id = state.userId // user_id 확실히 설정
          
          const createResult = await createUserPreferences(backendData)
          if (createResult.success) {
            logSyncSuccess('로컬 설정 서버 업로드 완료')
          } else {
            logSyncError('로컬 설정 서버 업로드 실패', createResult.error)
          }
        }
        return
      }

      // 3. 서버 설정을 userSettings 형태로 변환
      const serverUserSettings = mapBackendToUserSettings(serverResponse.data)
      
      // 4. 로컬 설정이 없으면 서버 설정 적용
      if (!localSettings) {
        logInfo('로컬 설정 없음 - 서버 설정 적용')
        dispatch({ type: 'SET_SETTINGS', payload: serverUserSettings })
        saveToLocalStorage(serverUserSettings)
        
        if (serverUserSettings.notificationSettings?.enableToasts) {
          toast.info('서버에서 설정을 복원했습니다')
        }
        
        logSyncSuccess('서버 설정 적용 완료')
        return
      }

      // 5. Task 8.2: 고급 충돌 분석 수행
      const conflictAnalysis = analyzeSettingsConflict(localSettings, serverUserSettings)
      
      // 충돌 분석 결과를 상태에 저장
      dispatch({ type: 'SET_CONFLICT_ANALYSIS', payload: conflictAnalysis })
      
      logInfo('충돌 분석 완료', {
        conflictType: conflictAnalysis.conflictType,
        severity: conflictAnalysis.severity,
        hasConflict: conflictAnalysis.hasConflict,
        differenceCount: conflictAnalysis.differences.length
      })

      // 충돌이 없는 경우
      if (!conflictAnalysis.hasConflict) {
        logInfo('충돌 없음 - 동기화 불필요')
        logSyncSuccess('설정 동기화 확인 완료')
        return
      }

      // Task 8.3: 고급 LWW 로직 적용
      logInfo('고급 LWW 충돌 해결 시작')

      // 포괄적인 LWW 해결 수행
      const lwwResult = comprehensiveLWW(localSettings, serverUserSettings, conflictAnalysis, LWW_STRATEGIES.HYBRID_METADATA)
      
      // LWW 결과를 상태에 저장
      dispatch({ 
        type: 'SET_CONFLICT_RESOLUTION', 
        payload: {
          ...lwwResult,
          resolvedAt: new Date().toISOString(),
          syncContext: true // syncWithServer에서 실행됨을 표시
        }
      })

      logInfo('LWW 충돌 해결 완료', {
        strategy: lwwResult.strategy,
        action: lwwResult.action,
        confidence: lwwResult.confidence
      })

      // 신뢰도 기반 자동/수동 판단
      if (lwwResult.confidence < CONFIDENCE_LEVELS.MEDIUM) {
        const conflictMessage = formatConflictMessage(conflictAnalysis)
        
        toast.warning(conflictMessage.title, {
          description: `${conflictMessage.message} (신뢰도: ${(lwwResult.confidence * 100).toFixed(1)}%)`,
          duration: 8000,
          action: {
            label: '수동 해결',
            onClick: () => logInfo('수동 해결 필요', { lwwResult, conflictAnalysis })
          }
        })
        
        logSyncError('신뢰도가 낮아 수동 해결 필요', lwwResult.reasoning)
        return
      }

      // 고신뢰도 자동 해결 수행
      try {
        switch (lwwResult.action) {
          case 'apply_local':
            logInfo('LWW 자동 해결: 로컬 설정 우승 → 서버 업로드')
            const backendData = mapUserSettingsToBackend(localSettings)
            const saveResult = await saveUserPreferences(state.userId, backendData)
            
            if (saveResult.success) {
              logSyncSuccess('LWW: 로컬 설정 서버 업로드 완료')
              if (localSettings.notificationSettings?.enableToasts) {
                toast.success('로컬 설정이 서버에 저장되었습니다')
              }
            } else {
              logSyncError('LWW: 로컬 설정 서버 업로드 실패', saveResult.error)
            }
            break

          case 'apply_server':
            logInfo('LWW 자동 해결: 서버 설정 우승 → 로컬 업데이트')
            dispatch({ type: 'SET_SETTINGS', payload: serverUserSettings })
            saveToLocalStorage(serverUserSettings)
            
            if (serverUserSettings.notificationSettings?.enableToasts) {
              toast.success('서버에서 최신 설정을 가져왔습니다')
            }
            
            logSyncSuccess('LWW: 서버 설정 로컬 적용 완료')
            break

          case 'apply_merge':
          case 'apply_merge_with_review':
            if (lwwResult.mergedSettings) {
              logInfo('LWW 자동 해결: 스마트 병합 적용')
              dispatch({ type: 'SET_SETTINGS', payload: lwwResult.mergedSettings })
              saveToLocalStorage(lwwResult.mergedSettings)
              
              // 병합된 설정을 서버에도 저장
              const mergedBackendData = mapUserSettingsToBackend(lwwResult.mergedSettings)
              const mergeSaveResult = await saveUserPreferences(state.userId, mergedBackendData)
              
              if (mergeSaveResult.success) {
                logSyncSuccess('LWW: 병합된 설정 적용 완료')
                if (lwwResult.mergedSettings.notificationSettings?.enableToasts) {
                  toast.success('설정이 지능적으로 병합되었습니다')
                }
              } else {
                logSyncError('LWW: 병합된 설정 서버 저장 실패', mergeSaveResult.error)
              }
            }
            break

          case 'maintain_current':
          default:
            logInfo('LWW 자동 해결: 현재 설정 유지')
            logSyncSuccess('LWW: 현재 설정 유지')
            break
        }

        // 해결 완료 후 충돌 상태 정리 (지연 실행)
        setTimeout(() => {
          dispatch({ type: 'CLEAR_CONFLICT' })
        }, 2000)

      } catch (resolutionError) {
        logSyncError('LWW 자동 해결 실패', resolutionError)
        toast.error('고급 충돌 해결 중 오류가 발생했습니다')
      }
      
    } catch (error) {
      logSyncError('서버 동기화 중 예외 발생', error)
      // 동기화 실패는 조용히 처리하여 사용자 경험 방해하지 않음
    }
  }, [state.userId, saveToLocalStorage, logInfo])

  /**
   * 하이브리드 설정 저장 (LocalStorage + 서버)
   */
  const saveSettings = useCallback(async (settingsToSave = null) => {
    if (!mountedRef.current) return

    const settings = settingsToSave || state.settings

    try {
      dispatch({ type: 'SET_SAVING', payload: true })
      logInfo('하이브리드 설정 저장 시작', settings)

      // 1. 먼저 LocalStorage에 즉시 저장 (빠른 응답)
      const localSaveSuccess = saveToLocalStorage(settings)
      
      if (localSaveSuccess) {
        logInfo('LocalStorage 저장 완료')
      }

      // 2. 서버에도 저장 시도
      try {

        await apiClient.put(`/api/preference/settings?userId=${state.userId}`, {
          dashboardSettings: settings.dashboardSettings || {},
          statisticsSettings: settings.statisticsSettings || {},
          databaseSettings: settings.databaseSettings || {},
          notificationSettings: settings.notificationSettings || {},
          theme: settings.theme || 'light',
          language: settings.language || 'ko'
        })

        if (!mountedRef.current) return

        dispatch({ type: 'SAVE_SUCCESS' })
        logInfo('서버 저장 완료')

        if (settings.notificationSettings?.saveNotification) {
          toast.success('설정이 저장되었습니다', {
          description: `${new Date().toLocaleTimeString()}에 저장 완료`,
          duration: 3000
        })
        }

      } catch (serverError) {
        // 서버 저장 실패해도 LocalStorage는 성공했으므로 부분 성공
        logError('서버 저장 실패 (LocalStorage는 성공)', serverError)
        
        dispatch({ type: 'SAVE_SUCCESS' }) // LocalStorage 저장은 성공
        
        if (settings.notificationSettings?.errorNotification) {
          toast.warning('오프라인 상태입니다. 설정이 로컬에 저장되었습니다.')
        }
      }

    } catch (error) {
      logError('설정 저장 실패', error)
      dispatch({ type: 'SET_ERROR', payload: '설정 저장에 실패했습니다.' })
      
      if (settings.notificationSettings?.errorNotification) {
        toast.error('설정 저장 실패', {
          description: error.message || '알 수 없는 오류가 발생했습니다',
          duration: 5000,
          action: {
            label: '다시 시도',
            onClick: () => {
              // 자동 재시도 로직은 나중에 구현
              window.location.reload()
            }
          }
        })
      }
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false })
    }
  }, [state.settings, state.userId, saveToLocalStorage, logInfo, logError])

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
   * 설정 초기화 (LocalStorage도 함께)
   */
  const resetSettings = useCallback(() => {
    logInfo('설정 초기화')
    
    // LocalStorage도 초기화
    clearLocalStorage()
    
    dispatch({ type: 'RESET_SETTINGS' })
    debouncedSave(defaultSettings)
    
    if (state.settings.notificationSettings?.enableToasts) {
      toast.info('설정이 초기화되었습니다')
    }
  }, [debouncedSave, clearLocalStorage, state.settings.notificationSettings?.enableToasts, logInfo])

  /**
   * 에러 상태 클리어
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [])

  // ================================
  // 새로운 userSettings 관리 함수들
  // ================================

  /**
   * PEG 설정 추가/업데이트
   */
  const updatePegConfiguration = useCallback((pegId, config) => {
    logInfo('PEG 설정 업데이트', { pegId, config })
    
    const currentPegs = state.settings.pegConfigurations || []
    const existingIndex = currentPegs.findIndex(peg => peg.id === pegId)
    
    let updatedPegs
    if (existingIndex >= 0) {
      // 기존 PEG 업데이트
      updatedPegs = [...currentPegs]
      updatedPegs[existingIndex] = { ...updatedPegs[existingIndex], ...config }
    } else {
      // 새 PEG 추가
      updatedPegs = [...currentPegs, { id: pegId, ...config }]
    }
    
    const newSettings = {
      ...state.settings,
      pegConfigurations: updatedPegs
    }
    
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings })
    debouncedSave(newSettings)
  }, [state.settings, debouncedSave, logInfo])

  /**
   * Statistics 설정 추가/업데이트
   */
  const updateStatisticsConfiguration = useCallback((statsId, config) => {
    logInfo('Statistics 설정 업데이트', { statsId, config })
    
    const currentStats = state.settings.statisticsConfigurations || []
    const existingIndex = currentStats.findIndex(stats => stats.id === statsId)
    
    let updatedStats
    if (existingIndex >= 0) {
      // 기존 Statistics 업데이트
      updatedStats = [...currentStats]
      updatedStats[existingIndex] = { ...updatedStats[existingIndex], ...config }
    } else {
      // 새 Statistics 추가
      updatedStats = [...currentStats, { id: statsId, ...config }]
    }
    
    const newSettings = {
      ...state.settings,
      statisticsConfigurations: updatedStats
    }
    
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings })
    debouncedSave(newSettings)
  }, [state.settings, debouncedSave, logInfo])

  /**
   * PEG 설정 제거
   */
  const removePegConfiguration = useCallback((pegId) => {
    logInfo('PEG 설정 제거', pegId)
    
    const updatedPegs = state.settings.pegConfigurations?.filter(peg => peg.id !== pegId) || []
    
    const newSettings = {
      ...state.settings,
      pegConfigurations: updatedPegs
    }
    
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings })
    debouncedSave(newSettings)
  }, [state.settings, debouncedSave, logInfo])

  /**
   * Statistics 설정 제거
   */
  const removeStatisticsConfiguration = useCallback((statsId) => {
    logInfo('Statistics 설정 제거', statsId)
    
    const updatedStats = state.settings.statisticsConfigurations?.filter(stats => stats.id !== statsId) || []
    
    const newSettings = {
      ...state.settings,
      statisticsConfigurations: updatedStats
    }
    
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings })
    debouncedSave(newSettings)
  }, [state.settings, debouncedSave, logInfo])

  // ================================
  // Task 8.2: 고급 충돌 분석 함수들
  // ================================

  /**
   * 수동으로 충돌 분석을 수행합니다
   * @param {Object} customLocalSettings - 선택적 로컬 설정 (기본값: 현재 설정)
   * @returns {Promise<Object>} 충돌 분석 결과
   */
  const performConflictAnalysis = useCallback(async (customLocalSettings = null) => {
    try {
      logInfo('수동 충돌 분석 시작')
      
      const localSettings = customLocalSettings || state.settings
      
      // 서버에서 최신 설정 조회
      const serverResponse = await getUserPreferences(state.userId)
      
      if (!serverResponse.success || serverResponse.isNew) {
        logInfo('서버 설정 없음 - 충돌 없음')
        return {
          conflictType: CONFLICT_TYPES.NO_CONFLICT,
          hasConflict: false,
          message: '서버에 설정이 없어 충돌이 없습니다.'
        }
      }

      const serverUserSettings = mapBackendToUserSettings(serverResponse.data)
      const conflictAnalysis = analyzeSettingsConflict(localSettings, serverUserSettings)
      
      // 상태에 저장
      dispatch({ type: 'SET_CONFLICT_ANALYSIS', payload: conflictAnalysis })
      
      logInfo('수동 충돌 분석 완료', {
        hasConflict: conflictAnalysis.hasConflict,
        conflictType: conflictAnalysis.conflictType,
        severity: conflictAnalysis.severity
      })
      
      return conflictAnalysis

    } catch (error) {
      logError('수동 충돌 분석 실패', error)
      return {
        conflictType: CONFLICT_TYPES.CORRUPTION_DETECTED,
        hasConflict: true,
        error: error.message,
        message: '충돌 분석 중 오류가 발생했습니다.'
      }
    }
  }, [state.settings, state.userId, logInfo, logError])

  /**
   * 충돌 해결을 수동으로 적용합니다
   * @param {string} resolutionAction - 해결 액션 ('apply_local', 'apply_server', 'use_defaults')
   * @returns {Promise<boolean>} 성공 여부
   */
  const applyConflictResolution = useCallback(async (resolutionAction) => {
    try {
      logInfo('충돌 해결 적용 시작', { action: resolutionAction })

      if (!state.conflictAnalysis || !state.conflictAnalysis.hasConflict) {
        logInfo('적용할 충돌이 없습니다')
        return false
      }

      switch (resolutionAction) {
        case 'apply_local':
          // 로컬 설정을 서버에 업로드
          const backendData = mapUserSettingsToBackend(state.settings)
          const saveResult = await saveUserPreferences(state.userId, backendData)
          
          if (saveResult.success) {
            logInfo('로컬 설정 서버 업로드 성공')
            toast.success('로컬 설정이 서버에 저장되었습니다')
          } else {
            throw new Error(saveResult.error)
          }
          break

        case 'apply_server':
          // 서버 설정을 로컬에 적용
          const serverResponse = await getUserPreferences(state.userId)
          if (serverResponse.success && !serverResponse.isNew) {
            const serverUserSettings = mapBackendToUserSettings(serverResponse.data)
            dispatch({ type: 'SET_SETTINGS', payload: serverUserSettings })
            saveToLocalStorage(serverUserSettings)
            
            logInfo('서버 설정 로컬 적용 성공')
            toast.success('서버 설정이 적용되었습니다')
          } else {
            throw new Error('서버 설정을 가져올 수 없습니다')
          }
          break

        case 'use_defaults':
          // 기본 설정 사용
          dispatch({ type: 'SET_SETTINGS', payload: defaultSettings })
          saveToLocalStorage(defaultSettings)
          
          logInfo('기본 설정 적용 성공')
          toast.info('기본 설정으로 초기화되었습니다')
          break

        default:
          throw new Error(`알 수 없는 해결 액션: ${resolutionAction}`)
      }

      // 충돌 상태 정리
      dispatch({ type: 'CLEAR_CONFLICT' })
      
      logInfo('충돌 해결 적용 완료')
      return true

    } catch (error) {
      logError('충돌 해결 적용 실패', error)
      toast.error('충돌 해결 중 오류가 발생했습니다')
      return false
    }
  }, [state.settings, state.userId, state.conflictAnalysis, saveToLocalStorage, logInfo, logError])

  /**
   * 충돌 상태를 수동으로 클리어합니다
   */
  const clearConflictState = useCallback(() => {
    logInfo('충돌 상태 수동 클리어')
    dispatch({ type: 'CLEAR_CONFLICT' })
  }, [logInfo])

  /**
   * 충돌 분석 결과의 상세 정보를 반환합니다
   * @returns {Object|null} 충돌 상세 정보
   */
  const getConflictDetails = useCallback(() => {
    if (!state.conflictAnalysis || !state.conflictAnalysis.hasConflict) {
      return null
    }

    const { conflictAnalysis, conflictResolution } = state
    const conflictMessage = formatConflictMessage(conflictAnalysis)

    return {
      analysis: conflictAnalysis,
      resolution: conflictResolution,
      message: conflictMessage,
      summary: {
        type: conflictAnalysis.conflictType,
        severity: conflictAnalysis.severity,
        differenceCount: conflictAnalysis.differences.length,
        requiresUserInput: conflictResolution?.requiresUserInput || false,
        recommendedAction: conflictResolution?.action || 'unknown'
      }
    }
  }, [state.conflictAnalysis, state.conflictResolution])

  // ================================
  // Task 8.3: 고급 Last Write Wins 함수들
  // ================================

  /**
   * 포괄적인 Last Write Wins 충돌 해결
   * @param {string} strategy - LWW 전략 (기본값: HYBRID_METADATA)
   * @param {Object} customLocalSettings - 선택적 로컬 설정
   * @returns {Promise<Object>} LWW 해결 결과
   */
  const resolveLWWConflict = useCallback(async (strategy = LWW_STRATEGIES.HYBRID_METADATA, customLocalSettings = null) => {
    try {
      logInfo('LWW 충돌 해결 시작', { strategy })

      // 충돌 분석이 없으면 먼저 수행
      let conflictAnalysis = state.conflictAnalysis
      if (!conflictAnalysis) {
        conflictAnalysis = await performConflictAnalysis(customLocalSettings)
      }

      if (!conflictAnalysis.hasConflict) {
        return {
          success: true,
          strategy: 'no_conflict',
          message: '해결할 충돌이 없습니다.'
        }
      }

      const localSettings = customLocalSettings || state.settings

      // 서버에서 최신 설정 조회
      const serverResponse = await getUserPreferences(state.userId)
      if (!serverResponse.success || serverResponse.isNew) {
        return {
          success: false,
          error: '서버 설정을 가져올 수 없습니다.'
        }
      }

      const serverUserSettings = mapBackendToUserSettings(serverResponse.data)

      // 포괄적인 LWW 해결 수행
      const lwwResult = comprehensiveLWW(localSettings, serverUserSettings, conflictAnalysis, strategy)

      // 해결 결과를 상태에 저장
      dispatch({ 
        type: 'SET_CONFLICT_RESOLUTION', 
        payload: {
          ...lwwResult,
          resolvedAt: new Date().toISOString(),
          strategy: lwwResult.strategy
        }
      })

      logInfo('LWW 충돌 해결 완료', {
        strategy: lwwResult.strategy,
        action: lwwResult.action,
        confidence: lwwResult.confidence
      })

      return {
        success: true,
        result: lwwResult
      }

    } catch (error) {
      logError('LWW 충돌 해결 실패', error)
      return {
        success: false,
        error: error.message
      }
    }
  }, [state.conflictAnalysis, state.settings, state.userId, performConflictAnalysis, logInfo, logError])

  /**
   * LWW 결과를 실제 설정에 적용
   * @param {Object} lwwResult - resolveLWWConflict의 결과
   * @returns {Promise<boolean>} 적용 성공 여부
   */
  const applyLWWResolution = useCallback(async (lwwResult) => {
    try {
      logInfo('LWW 해결 결과 적용 시작', { action: lwwResult.action })

      switch (lwwResult.action) {
        case 'apply_local':
          // 로컬 설정을 서버에 업로드
          const backendData = mapUserSettingsToBackend(state.settings)
          const saveResult = await saveUserPreferences(state.userId, backendData)
          
          if (saveResult.success) {
            toast.success('로컬 설정이 서버에 저장되었습니다')
            logInfo('로컬 설정 서버 업로드 성공')
          } else {
            throw new Error(saveResult.error)
          }
          break

        case 'apply_server':
          // 서버 설정을 로컬에 적용
          const serverResponse = await getUserPreferences(state.userId)
          if (serverResponse.success && !serverResponse.isNew) {
            const serverUserSettings = mapBackendToUserSettings(serverResponse.data)
            dispatch({ type: 'SET_SETTINGS', payload: serverUserSettings })
            saveToLocalStorage(serverUserSettings)
            
            toast.success('서버 설정이 적용되었습니다')
            logInfo('서버 설정 로컬 적용 성공')
          } else {
            throw new Error('서버 설정을 가져올 수 없습니다')
          }
          break

        case 'apply_merge':
        case 'apply_merge_with_review':
          // 병합된 설정 적용
          if (lwwResult.mergedSettings) {
            dispatch({ type: 'SET_SETTINGS', payload: lwwResult.mergedSettings })
            saveToLocalStorage(lwwResult.mergedSettings)
            
            // 서버에도 병합된 설정 저장
            const mergedBackendData = mapUserSettingsToBackend(lwwResult.mergedSettings)
            const mergeSaveResult = await saveUserPreferences(state.userId, mergedBackendData)
            
            if (mergeSaveResult.success) {
              toast.success('병합된 설정이 적용되었습니다')
              logInfo('병합된 설정 적용 성공')
            } else {
              logError('병합된 설정 서버 저장 실패', mergeSaveResult.error)
              toast.warning('로컬 적용은 성공했으나 서버 저장에 실패했습니다')
            }
          }
          break

        case 'maintain_current':
          logInfo('현재 설정 유지')
          toast.info('현재 설정을 유지합니다')
          break

        default:
          throw new Error(`알 수 없는 LWW 액션: ${lwwResult.action}`)
      }

      // 충돌 상태 정리
      dispatch({ type: 'CLEAR_CONFLICT' })
      
      logInfo('LWW 해결 결과 적용 완료')
      return true

    } catch (error) {
      logError('LWW 해결 결과 적용 실패', error)
      toast.error('충돌 해결 적용 중 오류가 발생했습니다')
      return false
    }
  }, [state.settings, state.userId, saveToLocalStorage, logInfo, logError])

  /**
   * 자동 LWW 해결 (높은 신뢰도일 때만)
   * @param {string} strategy - LWW 전략
   * @param {number} minConfidence - 최소 신뢰도 (기본값: 0.8)
   * @returns {Promise<Object>} 자동 해결 결과
   */
  const autoResolveLWW = useCallback(async (strategy = LWW_STRATEGIES.HYBRID_METADATA, minConfidence = CONFIDENCE_LEVELS.HIGH) => {
    try {
      logInfo('자동 LWW 해결 시작', { strategy, minConfidence })

      const lwwResult = await resolveLWWConflict(strategy)
      
      if (!lwwResult.success) {
        return lwwResult
      }

      const { result } = lwwResult

      // 신뢰도 확인
      if (result.confidence < minConfidence) {
        logInfo('신뢰도가 낮아 자동 해결 중단', {
          confidence: result.confidence,
          minConfidence
        })
        return {
          success: true,
          autoApplied: false,
          reason: 'low_confidence',
          result,
          message: `신뢰도가 낮아 수동 확인이 필요합니다 (${(result.confidence * 100).toFixed(1)}%)`
        }
      }

      // 자동 적용
      const applied = await applyLWWResolution(result)
      
      return {
        success: true,
        autoApplied: applied,
        result,
        message: applied ? '자동으로 충돌이 해결되었습니다' : '해결은 되었으나 적용에 실패했습니다'
      }

    } catch (error) {
      logError('자동 LWW 해결 실패', error)
      return {
        success: false,
        error: error.message
      }
    }
  }, [resolveLWWConflict, applyLWWResolution, logInfo, logError])

  /**
   * LWW 전략별 미리보기
   * @param {Array} strategies - 테스트할 LWW 전략 배열
   * @returns {Promise<Object>} 전략별 결과 미리보기
   */
  const previewLWWStrategies = useCallback(async (strategies = [LWW_STRATEGIES.STRICT_TIMESTAMP, LWW_STRATEGIES.FIELD_LEVEL_LWW, LWW_STRATEGIES.SMART_MERGE]) => {
    try {
      logInfo('LWW 전략 미리보기 시작', { strategies })

      // 충돌 분석 먼저 수행
      let conflictAnalysis = state.conflictAnalysis
      if (!conflictAnalysis) {
        conflictAnalysis = await performConflictAnalysis()
      }

      if (!conflictAnalysis.hasConflict) {
        return {
          hasConflict: false,
          message: '충돌이 없어 미리보기가 불필요합니다.'
        }
      }

      // 서버 설정 조회
      const serverResponse = await getUserPreferences(state.userId)
      if (!serverResponse.success) {
        throw new Error('서버 설정을 가져올 수 없습니다')
      }

      const serverUserSettings = mapBackendToUserSettings(serverResponse.data)
      const previews = {}

      // 각 전략별 결과 미리보기
      for (const strategy of strategies) {
        const result = comprehensiveLWW(state.settings, serverUserSettings, conflictAnalysis, strategy)
        previews[strategy] = {
          strategy,
          action: result.action,
          confidence: result.confidence,
          reasoning: result.reasoning,
          summary: {
            confidenceLevel: result.confidence >= CONFIDENCE_LEVELS.HIGH ? 'high' : 
                           result.confidence >= CONFIDENCE_LEVELS.MEDIUM ? 'medium' : 'low',
            recommendAutoApply: result.confidence >= CONFIDENCE_LEVELS.HIGH,
            riskLevel: result.confidence >= CONFIDENCE_LEVELS.HIGH ? 'low' : 
                      result.confidence >= CONFIDENCE_LEVELS.MEDIUM ? 'medium' : 'high'
          }
        }
      }

      logInfo('LWW 전략 미리보기 완료', { strategiesCount: strategies.length })

      return {
        hasConflict: true,
        conflictAnalysis,
        previews
      }

    } catch (error) {
      logError('LWW 전략 미리보기 실패', error)
      return {
        error: error.message
      }
    }
  }, [state.conflictAnalysis, state.settings, state.userId, performConflictAnalysis, logInfo, logError])

  // ================================
  // Task 8.4: 백그라운드 동기화 함수들
  // ================================

  /**
   * 백그라운드 동기화 시작
   * @param {string} strategy - 동기화 전략
   * @param {Object} options - 추가 옵션
   */
  const startBackgroundSync = useCallback((strategy = SYNC_STRATEGIES.HYBRID, options = {}) => {
    try {
      logInfo('백그라운드 동기화 시작 요청', { strategy, enabled: state.backgroundSync.enabled })

      if (state.backgroundSync.enabled && backgroundSyncManagerRef.current) {
        logInfo('백그라운드 동기화가 이미 실행 중입니다')
        return
      }

      // 기본 옵션
      const defaultOptions = {
        strategy,
        pollingInterval: 30000,      // 30초
        changeDebounceTime: 2000,    // 2초
        maxRetries: 3,
        enableLogging: true,
        ...options
      }

      // 백그라운드 동기화 매니저 생성
      backgroundSyncManagerRef.current = createBackgroundSync(defaultOptions)

      // 동기화 콜백 함수 (8.1-8.3의 syncWithServer 재사용)
      const syncCallback = async () => {
        logDebug('백그라운드 동기화 콜백 실행')
        return await syncWithServer()
      }

      // 변경 감지 함수
      const changeDetector = async () => {
        if (!mountedRef.current) return false

        const currentSettings = state.settings
        const lastSettings = lastChangeDetectionRef.current

        // 첫 실행이거나 설정이 변경된 경우
        if (!lastSettings || JSON.stringify(currentSettings) !== JSON.stringify(lastSettings)) {
          lastChangeDetectionRef.current = currentSettings
          return true
        }

        return false
      }

      // 상태 변경 콜백
      const stateChangeCallback = (newSyncState, oldSyncState) => {
        dispatch({
          type: 'SET_BACKGROUND_SYNC_STATE',
          payload: {
            state: newSyncState,
            lastSyncTime: newSyncState === SYNC_STATES.SYNCING ? null : new Date().toISOString()
          }
        })

        logDebug('백그라운드 동기화 상태 변경', { from: oldSyncState, to: newSyncState })
      }

      // 동기화 시작
      backgroundSyncManagerRef.current.start(syncCallback, changeDetector, stateChangeCallback)

      // 네트워크 정보 업데이트
      const networkInfo = getNetworkInfo()
      dispatch({
        type: 'UPDATE_NETWORK_INFO',
        payload: {
          isOnline: networkInfo.isOnline,
          networkInfo
        }
      })

      // 상태 업데이트
      dispatch({
        type: 'ENABLE_BACKGROUND_SYNC',
        payload: { strategy }
      })

      logInfo('백그라운드 동기화 시작 완료', { strategy })

    } catch (error) {
      logError('백그라운드 동기화 시작 실패', error)
    }
  }, [state.backgroundSync.enabled, state.settings, syncWithServer, logInfo, logError])

  /**
   * 백그라운드 동기화 중지
   */
  const stopBackgroundSync = useCallback(() => {
    try {
      logInfo('백그라운드 동기화 중지 요청')

      if (backgroundSyncManagerRef.current) {
        backgroundSyncManagerRef.current.stop()
        backgroundSyncManagerRef.current = null
      }

      lastChangeDetectionRef.current = null

      dispatch({ type: 'DISABLE_BACKGROUND_SYNC' })

      logInfo('백그라운드 동기화 중지 완료')

    } catch (error) {
      logError('백그라운드 동기화 중지 실패', error)
    }
  }, [logInfo, logError])

  /**
   * 백그라운드 동기화 전략 변경
   * @param {string} newStrategy - 새로운 전략
   */
  const changeBackgroundSyncStrategy = useCallback((newStrategy) => {
    try {
      logInfo('백그라운드 동기화 전략 변경', { 
        from: state.backgroundSync.strategy, 
        to: newStrategy 
      })

      if (backgroundSyncManagerRef.current) {
        backgroundSyncManagerRef.current.changeStrategy(newStrategy)
      }

      dispatch({
        type: 'SET_BACKGROUND_SYNC_STATE',
        payload: { strategy: newStrategy }
      })

      logInfo('백그라운드 동기화 전략 변경 완료')

    } catch (error) {
      logError('백그라운드 동기화 전략 변경 실패', error)
    }
  }, [state.backgroundSync.strategy, logInfo, logError])

  /**
   * 수동 백그라운드 동기화 실행
   * @returns {Promise<boolean>} 성공 여부
   */
  const forceBackgroundSync = useCallback(async () => {
    try {
      logInfo('수동 백그라운드 동기화 실행')

      if (!backgroundSyncManagerRef.current) {
        logInfo('백그라운드 동기화가 활성화되지 않음')
        return false
      }

      const result = await backgroundSyncManagerRef.current.forcSync()
      
      logInfo('수동 백그라운드 동기화 완료', { success: result })
      return result

    } catch (error) {
      logError('수동 백그라운드 동기화 실패', error)
      return false
    }
  }, [logInfo, logError])

  /**
   * 백그라운드 동기화 상태 조회
   * @returns {Object} 상태 정보
   */
  const getBackgroundSyncStatus = useCallback(() => {
    const managerStatus = backgroundSyncManagerRef.current?.getStatus() || null
    
    return {
      ...state.backgroundSync,
      managerStatus,
      isActive: !!backgroundSyncManagerRef.current
    }
  }, [state.backgroundSync])

  /**
   * 네트워크 상태 업데이트
   */
  const updateNetworkInfo = useCallback(() => {
    const networkInfo = getNetworkInfo()
    
    dispatch({
      type: 'UPDATE_NETWORK_INFO',
      payload: {
        isOnline: networkInfo.isOnline,
        networkInfo
      }
    })

    logDebug('네트워크 정보 업데이트', networkInfo)
  }, [logDebug])

  /**
   * 순서 독립적 설정 검증
   */
  const validateOrderIndependentSettings = useCallback((settingsToValidate = null) => {
    const settings = settingsToValidate || state.settings
    const validationResults = {
      isValid: true,
      errors: [],
      suggestions: []
    }

    // PEG 설정 검증
    const pegs = settings.pegConfigurations || []
    const stats = settings.statisticsConfigurations || []

    // 기본 검증: 최소 하나의 PEG 또는 Statistics 설정이 있어야 함
    if (pegs.length === 0 && stats.length === 0) {
      validationResults.isValid = false
      validationResults.errors.push('최소 하나의 PEG 또는 Statistics 설정이 필요합니다.')
      validationResults.suggestions.push('PEG 또는 Statistics 설정을 추가해주세요.')
    }

    // PEG 의존성 검증 (순서 무관)
    pegs.forEach(peg => {
      if (peg.dependencies && peg.dependencies.length > 0) {
        const missingDeps = peg.dependencies.filter(depId => 
          !pegs.find(p => p.id === depId) && !stats.find(s => s.id === depId)
        )
        
        if (missingDeps.length > 0) {
          validationResults.isValid = false
          validationResults.errors.push(`PEG '${peg.name}'에 필요한 의존성이 없습니다: ${missingDeps.join(', ')}`)
          validationResults.suggestions.push(`의존성을 먼저 설정하거나 PEG '${peg.name}'의 의존성을 제거해주세요.`)
        }
      }
    })

    // Statistics 의존성 검증 (순서 무관)
    stats.forEach(stat => {
      if (stat.dependencies && stat.dependencies.length > 0) {
        const missingDeps = stat.dependencies.filter(depId => 
          !pegs.find(p => p.id === depId) && !stats.find(s => s.id === depId)
        )
        
        if (missingDeps.length > 0) {
          validationResults.isValid = false
          validationResults.errors.push(`Statistics '${stat.name}'에 필요한 의존성이 없습니다: ${missingDeps.join(', ')}`)
          validationResults.suggestions.push(`의존성을 먼저 설정하거나 Statistics '${stat.name}'의 의존성을 제거해주세요.`)
        }
      }
    })

    logInfo('순서 독립적 설정 검증 완료', validationResults)
    return validationResults
  }, [state.settings, logInfo])

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
    
    // LocalStorage 관련 함수들
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
    syncWithServer,
    
    // PRD 요구사항 함수들
    updatePegConfiguration,
    updateStatisticsConfiguration,
    removePegConfiguration,
    removeStatisticsConfiguration,
    validateOrderIndependentSettings,

    // Task 8.2: 고급 충돌 분석 함수들
    performConflictAnalysis,
    applyConflictResolution,
    clearConflictState,
    getConflictDetails,

    // Task 8.3: 고급 Last Write Wins 함수들
    resolveLWWConflict,
    applyLWWResolution,
    autoResolveLWW,
    previewLWWStrategies,

    // Task 8.4: 백그라운드 동기화 함수들
    startBackgroundSync,
    stopBackgroundSync,
    changeBackgroundSyncStrategy,
    forceBackgroundSync,
    getBackgroundSyncStatus,
    updateNetworkInfo,
    
    // 유틸리티
    defaultSettings,
    logInfo,
    logError
  }

  // ================================
  // Effect: 백그라운드 동기화 생명주기 관리
  // ================================
  useEffect(() => {
    // 컴포넌트 마운트 시 백그라운드 동기화 자동 시작
    if (state.initialized && !state.backgroundSync.enabled) {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          logInfo('자동 백그라운드 동기화 시작')
          startBackgroundSync(SYNC_STRATEGIES.HYBRID, {
            pollingInterval: 60000, // 1분 간격
            changeDebounceTime: 3000 // 3초 디바운스
          })
        }
      }, 2000) // 초기화 후 2초 대기

      return () => clearTimeout(timer)
    }
  }, [state.initialized, state.backgroundSync.enabled, startBackgroundSync, logInfo])

  // ================================
  // Effect: 컴포넌트 언마운트 시 정리
  // ================================
  useEffect(() => {
    return () => {
      mountedRef.current = false
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      // 백그라운드 동기화 정리
      if (backgroundSyncManagerRef.current) {
        logInfo('컴포넌트 언마운트 - 백그라운드 동기화 중지')
        backgroundSyncManagerRef.current.stop()
        backgroundSyncManagerRef.current = null
      }
    }
  }, [logInfo])

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

