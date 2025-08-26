/**
 * usePreference 커스텀 훅 - 리팩토링된 버전
 * 
 * Preference Context를 기반으로 한 고수준 커스텀 훅입니다.
 * 사용자 설정의 관리, 유효성 검증, Import/Export 기능을 제공합니다.
 * 
 * 주요 기능:
 * - 실시간 설정 업데이트
 * - 설정 유효성 검증
 * - Import/Export 기능
 * - 안전한 설정 접근
 * 
 * 사용법:
 * ```jsx
 * const { settings, updateSettings, saveSettings, loading } = usePreference()
 * ```
 */

import { useCallback, useMemo, useState, useRef } from 'react'
import { usePreference as usePreferenceContext } from '@/contexts/PreferenceContext.jsx'
import { toast } from 'sonner'

// ================================
// 로깅 유틸리티
// ================================

/**
 * 로그 레벨별 출력 함수
 * @param {string} level - 로그 레벨 (info, error, warn, debug)
 * @param {string} message - 로그 메시지
 * @param {any} data - 추가 데이터
 */
const logPreference = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[usePreference:${timestamp}]`
  
  switch (level) {
    case 'info':
      console.log(`${prefix} ${message}`, data)
      break
    case 'error':
      console.error(`${prefix} ${message}`, data)
      break
    case 'warn':
      console.warn(`${prefix} ${message}`, data)
      break
    case 'debug':
      console.debug(`${prefix} ${message}`, data)
      break
    default:
      console.log(`${prefix} ${message}`, data)
  }
}

// ================================
// 설정 유효성 검증 규칙
// ================================

const validationRules = {
  dashboardSettings: {
    selectedPegs: {
      required: true,
      type: 'array',
      minLength: 1,
      message: '최소 하나의 PEG를 선택해야 합니다.'
    },
    autoRefreshInterval: {
      required: true,
      type: 'number',
      min: 5,
      max: 300,
      message: '자동 새로고침 간격은 5초~300초 사이여야 합니다.'
    },
    defaultNe: {
      type: 'string',
      maxLength: 50,
      message: 'NE ID는 50자를 초과할 수 없습니다.'
    },
    defaultCellId: {
      type: 'string',
      maxLength: 50,
      message: 'Cell ID는 50자를 초과할 수 없습니다.'
    }
  },
  statisticsSettings: {
    defaultDateRange: {
      required: true,
      type: 'number',
      min: 1,
      max: 365,
      message: '기본 날짜 범위는 1일~365일 사이여야 합니다.'
    },
    decimalPlaces: {
      required: true,
      type: 'number',
      min: 0,
      max: 6,
      message: '소수점 자릿수는 0~6자리 사이여야 합니다.'
    },
    defaultPegs: {
      required: true,
      type: 'array',
      minLength: 1,
      message: '최소 하나의 기본 PEG를 선택해야 합니다.'
    }
  }
}

// ================================
// 유효성 검증 함수
// ================================

/**
 * 설정 유효성 검증 함수
 * @param {object} settings - 검증할 설정 객체
 * @param {string} section - 특정 섹션만 검증할 경우 섹션명
 * @returns {object} 검증 오류 객체
 */
const validateSettings = (settings, section = null) => {
  logPreference('debug', '설정 유효성 검증 시작', { section, settings })
  
  const errors = {}
  
  // section이 지정되었지만 해당 규칙이 없으면 검증을 건너뜀
  if (section && !validationRules[section]) {
    logPreference('warn', `검증 규칙이 없는 섹션: ${section}`)
    return errors
  }
  
  const rulesToCheck = section ? { [section]: validationRules[section] } : validationRules

  Object.entries(rulesToCheck).forEach(([sectionKey, sectionRules]) => {
    if (!settings[sectionKey]) {
      logPreference('debug', `섹션 ${sectionKey}가 설정에 없음`)
      return
    }

    Object.entries(sectionRules).forEach(([fieldKey, rule]) => {
      const value = settings[sectionKey][fieldKey]
      const fieldPath = `${sectionKey}.${fieldKey}`

      // Required 검증
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors[fieldPath] = rule.message || `${fieldKey}는 필수 항목입니다.`
        logPreference('error', `필수 필드 누락: ${fieldPath}`)
        return
      }

      // 값이 없으면 나머지 검증 스킵
      if (value === undefined || value === null || value === '') {
        logPreference('debug', `필드 ${fieldPath} 값이 없어 검증 스킵`)
        return
      }

      // Type 검증
      if (rule.type === 'array' && !Array.isArray(value)) {
        errors[fieldPath] = rule.message || `${fieldKey}는 배열이어야 합니다.`
        logPreference('error', `타입 오류: ${fieldPath}는 배열이어야 함`)
        return
      }

      if (rule.type === 'number' && typeof value !== 'number') {
        errors[fieldPath] = rule.message || `${fieldKey}는 숫자여야 합니다.`
        logPreference('error', `타입 오류: ${fieldPath}는 숫자여야 함`)
        return
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        errors[fieldPath] = rule.message || `${fieldKey}는 문자열이어야 합니다.`
        logPreference('error', `타입 오류: ${fieldPath}는 문자열이어야 함`)
        return
      }

      // 값 범위 검증
      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors[fieldPath] = rule.message || `${fieldKey}는 ${rule.min} 이상이어야 합니다.`
          logPreference('error', `범위 오류: ${fieldPath}는 ${rule.min} 이상이어야 함`)
          return
        }
        if (rule.max !== undefined && value > rule.max) {
          errors[fieldPath] = rule.message || `${fieldKey}는 ${rule.max} 이하여야 합니다.`
          logPreference('error', `범위 오류: ${fieldPath}는 ${rule.max} 이하여야 함`)
          return
        }
      }

      if (rule.type === 'array') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최소 ${rule.minLength}개 항목이 필요합니다.`
          logPreference('error', `배열 길이 오류: ${fieldPath}는 최소 ${rule.minLength}개 필요`)
          return
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최대 ${rule.maxLength}개 항목만 허용됩니다.`
          logPreference('error', `배열 길이 오류: ${fieldPath}는 최대 ${rule.maxLength}개만 허용`)
          return
        }
      }

      if (rule.type === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최소 ${rule.minLength}자 이상이어야 합니다.`
          logPreference('error', `문자열 길이 오류: ${fieldPath}는 최소 ${rule.minLength}자 필요`)
          return
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최대 ${rule.maxLength}자까지 허용됩니다.`
          logPreference('error', `문자열 길이 오류: ${fieldPath}는 최대 ${rule.maxLength}자만 허용`)
          return
        }
      }
    })
  })

  logPreference('debug', '설정 유효성 검증 완료', { errors })
  return errors
}

// ================================
// 메인 커스텀 훅
// ================================

export const usePreference = () => {
  // 초기화 로깅을 debug 레벨로 변경하고 한 번만 출력
  const initRef = useRef(false)
  if (!initRef.current) {
    logPreference('debug', 'usePreference 훅 초기화')
    initRef.current = true
  }
  
  const context = usePreferenceContext()
  const [validationErrors, setValidationErrors] = useState({})

  // 안전한 설정 접근
  const settings = useMemo(() => {
    const contextSettings = context?.settings || {}
    logPreference('debug', '설정 접근', { hasSettings: !!contextSettings })
    return contextSettings
  }, [context?.settings])

  // 안전한 함수들
  const updateSettings = useCallback((newSettings) => {
    logPreference('info', '설정 업데이트 시작', { newSettings })
    
    if (context?.updateSetting) {
      // 단순화된 updateSetting 사용
      Object.entries(newSettings).forEach(([section, sectionSettings]) => {
        if (typeof sectionSettings === 'object') {
          Object.entries(sectionSettings).forEach(([key, value]) => {
            logPreference('debug', `설정 업데이트: ${section}.${key}`, { value })
            context.updateSetting(section, key, value)
          })
        }
      })
      logPreference('info', '설정 업데이트 완료')
    } else {
      logPreference('error', 'updateSetting 함수를 사용할 수 없음')
    }
  }, [context?.updateSetting])

  const saveSettings = useCallback(async () => {
    logPreference('info', '설정 저장 시작')
    
    if (context?.saveSettings) {
      try {
        const result = await context.saveSettings()
        logPreference('info', '설정 저장 완료', { result })
        return result
      } catch (error) {
        logPreference('error', '설정 저장 실패', error)
        throw error
      }
    } else {
      logPreference('error', 'saveSettings 함수를 사용할 수 없음')
      return false
    }
  }, [context?.saveSettings])

  const loadSettings = useCallback(async () => {
    logPreference('info', '설정 로드 시작')
    
    if (context?.loadSettings) {
      try {
        const result = await context.loadSettings()
        logPreference('info', '설정 로드 완료', { result })
        return result
      } catch (error) {
        logPreference('error', '설정 로드 실패', error)
        throw error
      }
    } else {
      logPreference('error', 'loadSettings 함수를 사용할 수 없음')
      return false
    }
  }, [context?.loadSettings])

  const resetSettings = useCallback(async (sections) => {
    logPreference('info', '설정 리셋 시작', { sections })
    
    if (context?.resetSettings) {
      try {
        const result = await context.resetSettings(sections)
        logPreference('info', '설정 리셋 완료', { result })
        return result
      } catch (error) {
        logPreference('error', '설정 리셋 실패', error)
        return { success: false, error: error.message }
      }
    } else {
      logPreference('error', 'resetSettings 함수를 사용할 수 없음')
      return { success: false, error: 'resetSettings 함수를 사용할 수 없습니다' }
    }
  }, [context?.resetSettings])

  // ================================
  // 설정 업데이트 함수 (검증 포함)
  // ================================

  const updateSettingsWithValidation = useCallback((newSettings, section = null) => {
    logPreference('info', '설정 업데이트 및 검증 시작', { newSettings, section })

    // 검증할 설정 결합
    const settingsToValidate = section 
      ? { 
          ...settings,
          [section]: {
            ...settings[section],
            ...newSettings[section]
          }
        }
      : { ...settings, ...newSettings }

    // 유효성 검증 (section이 지정된 경우 해당 섹션만 검증)
    const validationErrors = validateSettings(settingsToValidate, section)
    setValidationErrors(validationErrors)

    // 검증 오류가 있으면 알림 표시 후 반환
    if (Object.keys(validationErrors).length > 0) {
      logPreference('error', '설정 유효성 검증 실패', validationErrors)
      
      const firstError = Object.values(validationErrors)[0]
      if (settings.notificationSettings?.errorNotification) {
        toast.error(`설정 오류: ${firstError}`)
      }
      
      return false
    }

    // 검증 통과 시 설정 업데이트
    updateSettings(newSettings)
    logPreference('info', '설정 업데이트 완료')
    
    return true
  }, [settings, updateSettings])

  // ================================
  // Import/Export 기능
  // ================================

  const exportSettings = useCallback((filename = null, partial = null) => {
    logPreference('info', '설정 내보내기 시작', { filename, partial })
    
    try {
      const dataToExport = {
        settings: partial && Object.keys(partial).length > 0 ? { ...settings, ...partial } : settings,
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          userId: context?.userId || 'default'
        }
      }

      const dataStr = JSON.stringify(dataToExport, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename || `preference-settings-${new Date().toISOString().split('T')[0]}.json`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(link.href)
      
      logPreference('info', '설정 내보내기 완료', { filename: link.download })
      
      if (settings.notificationSettings?.enableToasts) {
        toast.success('설정이 파일로 내보내졌습니다')
      }
      
      return true
    } catch (error) {
      logPreference('error', '설정 내보내기 실패', error)
      
      if (settings.notificationSettings?.errorNotification) {
        toast.error('설정 내보내기 실패: ' + error.message)
      }
      
      return false
    }
  }, [settings, context?.userId])

  const importSettings = useCallback((file) => {
    logPreference('info', '설정 가져오기 시작', { filename: file.name })
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          
          if (!data.settings) {
            throw new Error('유효하지 않은 설정 파일입니다.')
          }
          
          // 설정 업데이트
          updateSettings(data.settings)
          
          logPreference('info', '설정 가져오기 완료', { filename: file.name })
          
          if (settings.notificationSettings?.enableToasts) {
            toast.success('설정이 성공적으로 가져와졌습니다')
          }
          
          resolve(data)
        } catch (error) {
          logPreference('error', '설정 가져오기 실패', error)
          
          if (settings.notificationSettings?.errorNotification) {
            toast.error('설정 가져오기 실패: ' + error.message)
          }
          
          reject(error)
        }
      }
      
      reader.onerror = () => {
        const error = new Error('파일 읽기 실패')
        logPreference('error', '설정 가져오기 실패', error)
        reject(error)
      }
      
      reader.readAsText(file)
    })
  }, [settings, updateSettings])

  // ================================
  // 반환값
  // ================================

  const returnValue = {
    // 설정 데이터
    settings,
    dashboardSettings: settings.dashboardSettings || {},
    statisticsSettings: settings.statisticsSettings || {},
    databaseSettings: settings.databaseSettings || {},
    notificationSettings: settings.notificationSettings || {},
    generalSettings: settings.generalSettings || {},
    
    // 상태
    loading: context?.loading || false,
    saving: context?.saving || false,
    error: context?.error || null,
    initialized: context?.initialized || false,
    
    // 함수들
    updateSettings,
    updateSettingsWithValidation,
    saveSettings,
    loadSettings,
    exportSettings,
    importSettings,
    resetSettings,
    
    // 유효성 검증
    validationErrors,
    validateSettings: (settings, section) => validateSettings(settings, section),
    
    // 로깅
    logInfo: (message, data) => logPreference('info', message, data),
    logError: (message, error) => logPreference('error', message, error)
  }

  logPreference('debug', 'usePreference 훅 반환값 생성 완료')
  return returnValue
}

// ================================
// 특화된 훅들
// ================================

/**
 * Dashboard 설정 전용 훅
 */
export const useDashboardSettings = () => {
  // 초기화 로깅을 debug 레벨로 변경하고 한 번만 출력
  const initRef = useRef(false)
  if (!initRef.current) {
    logPreference('debug', 'useDashboardSettings 훅 초기화')
    initRef.current = true
  }
  
  const {
    dashboardSettings: rawDashboardSettings,
    updateSettings,
    saving,
    error,
    validationErrors,
    logInfo
  } = usePreference()

  const dashboardSettings = useMemo(() => {
    const defaults = {
      selectedPegs: [],
      defaultNe: '',
      defaultCellId: '',
      autoRefreshInterval: 30,
      chartStyle: 'line',
      showLegend: true,
      showGrid: true,
    }

    const settings = { ...defaults, ...rawDashboardSettings }

    // selectedPegs가 null, undefined 또는 빈 배열이 아닌 유효한 배열인지 확인
    if (Array.isArray(rawDashboardSettings?.selectedPegs) && rawDashboardSettings.selectedPegs.length > 0) {
      settings.selectedPegs = rawDashboardSettings.selectedPegs
    } else {
      settings.selectedPegs = defaults.selectedPegs
    }

    logPreference('debug', 'Dashboard 설정 처리 완료', { settings })
    return settings
  }, [rawDashboardSettings])

  const updateDashboardSettings = useCallback((newSettings) => {
    logInfo('Dashboard 설정 업데이트', newSettings)
    return updateSettings({
      dashboardSettings: newSettings
    })
  }, [updateSettings, logInfo])

  const dashboardValidationErrors = useMemo(() => {
    return Object.fromEntries(
      Object.entries(validationErrors).filter(([key]) => key.startsWith('dashboardSettings.'))
    )
  }, [validationErrors])

  return {
    settings: dashboardSettings,
    updateSettings: updateDashboardSettings,
    saving,
    error,
    validationErrors: dashboardValidationErrors,
    hasErrors: Object.keys(dashboardValidationErrors).length > 0
  }
}

/**
 * Statistics 설정 전용 훅
 */
export const useStatisticsSettings = () => {
  // 초기화 로깅을 debug 레벨로 변경하고 한 번만 출력
  const initRef = useRef(false)
  if (!initRef.current) {
    logPreference('debug', 'useStatisticsSettings 훅 초기화')
    initRef.current = true
  }
  
  const {
    statisticsSettings,
    updateSettings,
    saving,
    error,
    validationErrors,
    logInfo
  } = usePreference()

  const updateStatisticsSettings = useCallback((newSettings) => {
    logInfo('Statistics 설정 업데이트', newSettings)
    return updateSettings({
      statisticsSettings: newSettings
    })
  }, [updateSettings, logInfo])

  const statisticsValidationErrors = useMemo(() => {
    return Object.fromEntries(
      Object.entries(validationErrors).filter(([key]) => key.startsWith('statisticsSettings.'))
    )
  }, [validationErrors])

  return {
    settings: statisticsSettings,
    updateSettings: updateStatisticsSettings,
    saving,
    error,
    validationErrors: statisticsValidationErrors,
    hasErrors: Object.keys(statisticsValidationErrors).length > 0
  }
}

/**
 * Notification 설정 전용 훅
 */
export const useNotificationSettings = () => {
  logPreference('info', 'useNotificationSettings 훅 초기화')
  
  const {
    notificationSettings,
    updateSettings,
    saving,
    error,
    validationErrors,
    logInfo
  } = usePreference()

  const updateNotificationSettings = useCallback((newSettings) => {
    logInfo('Notification 설정 업데이트', newSettings)
    return updateSettings({
      notificationSettings: newSettings
    })
  }, [updateSettings, logInfo])

  const notificationValidationErrors = useMemo(() => {
    return Object.fromEntries(
      Object.entries(validationErrors).filter(([key]) => key.startsWith('notificationSettings.'))
    )
  }, [validationErrors])

  return {
    settings: notificationSettings,
    updateSettings: updateNotificationSettings,
    saving,
    error,
    validationErrors: notificationValidationErrors,
    hasErrors: Object.keys(notificationValidationErrors).length > 0
  }
}

export default usePreference
