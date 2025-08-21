/**
 * usePreference 커스텀 훅
 * 
 * Preference Context를 기반으로 한 고수준 커스텀 훅입니다.
 * 사용자 설정의 관리, 디바운싱된 자동 저장, 유효성 검증 등을 제공합니다.
 * 
 * 주요 기능:
 * - 실시간 설정 업데이트 및 자동 저장
 * - 설정 유효성 검증
 * - Import/Export 기능
 * - 변경 히스토리 추적
 * 
 * 사용법:
 * ```jsx
 * const { settings, updateSettings, save, loading } = usePreference()
 * ```
 */

import { useCallback, useMemo, useRef } from 'react'
import { usePreference as usePreferenceContext } from '@/contexts/PreferenceContext.jsx'
import { toast } from 'sonner'

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
// 메인 커스텀 훅
// ================================

export const usePreference = () => {
  const context = usePreferenceContext()
  const validationErrorsRef = useRef({})

  // ================================
  // 유효성 검증 함수
  // ================================

  const validateSettings = useCallback((settings, section = null) => {
    const errors = {}
    
    // section이 지정되었지만 해당 규칙이 없으면 검증을 건너뜀
    if (section && !validationRules[section]) {
      return errors
    }
    
    const rulesToCheck = section ? { [section]: validationRules[section] } : validationRules

    Object.entries(rulesToCheck).forEach(([sectionKey, sectionRules]) => {
      if (!settings[sectionKey]) return

      Object.entries(sectionRules).forEach(([fieldKey, rule]) => {
        const value = settings[sectionKey][fieldKey]
        const fieldPath = `${sectionKey}.${fieldKey}`

        // Required 검증
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors[fieldPath] = rule.message || `${fieldKey}는 필수 항목입니다.`
          return
        }

        // 값이 없으면 나머지 검증 스킵
        if (value === undefined || value === null || value === '') return

        // Type 검증
        if (rule.type === 'array' && !Array.isArray(value)) {
          errors[fieldPath] = rule.message || `${fieldKey}는 배열이어야 합니다.`
          return
        }

        if (rule.type === 'number' && typeof value !== 'number') {
          errors[fieldPath] = rule.message || `${fieldKey}는 숫자여야 합니다.`
          return
        }

        if (rule.type === 'string' && typeof value !== 'string') {
          errors[fieldPath] = rule.message || `${fieldKey}는 문자열이어야 합니다.`
          return
        }

        // 값 범위 검증
        if (rule.type === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            errors[fieldPath] = rule.message || `${fieldKey}는 ${rule.min} 이상이어야 합니다.`
            return
          }
          if (rule.max !== undefined && value > rule.max) {
            errors[fieldPath] = rule.message || `${fieldKey}는 ${rule.max} 이하여야 합니다.`
            return
          }
        }

        if (rule.type === 'array') {
          if (rule.minLength !== undefined && value.length < rule.minLength) {
            errors[fieldPath] = rule.message || `${fieldKey}는 최소 ${rule.minLength}개 항목이 필요합니다.`
            return
          }
          if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            errors[fieldPath] = rule.message || `${fieldKey}는 최대 ${rule.maxLength}개 항목만 허용됩니다.`
            return
          }
        }

        if (rule.type === 'string') {
          if (rule.minLength !== undefined && value.length < rule.minLength) {
            errors[fieldPath] = rule.message || `${fieldKey}는 최소 ${rule.minLength}자 이상이어야 합니다.`
            return
          }
          if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            errors[fieldPath] = rule.message || `${fieldKey}는 최대 ${rule.maxLength}자까지 허용됩니다.`
            return
          }
        }
      })
    })

    return errors
  }, [])

  // ================================
  // 설정 업데이트 함수 (검증 포함)
  // ================================

  const updateSettingsWithValidation = useCallback((newSettings, section = null) => {
    context.logInfo('설정 업데이트 및 검증 시작', { newSettings, section })

    // 검증할 설정 결합
    const settingsToValidate = section 
      ? { 
          ...context.settings,
          [section]: {
            ...context.settings[section],
            ...newSettings[section]
          }
        }
      : { ...context.settings, ...newSettings }

    // 유효성 검증 (section이 지정된 경우 해당 섹션만 검증)
    const validationErrors = validateSettings(settingsToValidate, section)
    validationErrorsRef.current = validationErrors

    // 검증 오류가 있으면 알림 표시 후 반환
    if (Object.keys(validationErrors).length > 0) {
      context.logError('설정 유효성 검증 실패', validationErrors)
      
      const firstError = Object.values(validationErrors)[0]
      if (context.settings.notificationSettings?.errorNotification) {
        toast.error(`설정 오류: ${firstError}`)
      }
      
      return false
    }

    // 검증 통과 시 설정 업데이트
    context.updateSettings(newSettings)
    context.logInfo('설정 업데이트 완료')
    
    return true
  }, [context, validateSettings])

  // ================================
  // Import/Export 기능
  // ================================

  const exportSettings = useCallback((filename = null, partial = null) => {
    try {
      const dataToExport = {
        settings: partial && Object.keys(partial).length > 0 ? { ...context.settings, ...partial } : context.settings,
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          userId: context.userId
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
      
      context.logInfo('설정 내보내기 완료', { filename: link.download })
      
      if (context.settings.notificationSettings?.enableToasts) {
        toast.success('설정이 파일로 내보내졌습니다')
      }
      
      return true
    } catch (error) {
      context.logError('설정 내보내기 실패', error)
      
      if (context.settings.notificationSettings?.errorNotification) {
        toast.error('설정 내보내기 실패: ' + error.message)
      }
      
      return false
    }
  }, [context])

  const importSettings = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result)
          
          // 데이터 구조 검증
          if (!importedData.settings) {
            throw new Error('유효하지 않은 설정 파일 형식입니다.')
          }
          
          // derivedPegSettings가 누락되지 않도록 기본값 병합
          const mergedSettings = {
            ...context.settings,
            ...importedData.settings,
            derivedPegSettings: importedData.settings.derivedPegSettings || context.settings.derivedPegSettings || { formulas: [], settings: {} }
          }

          // 설정 유효성 검증
          const validationErrors = validateSettings(mergedSettings)
          
          if (Object.keys(validationErrors).length > 0) {
            const errorMessage = Object.values(validationErrors).join(', ')
            throw new Error(`설정 유효성 검증 실패: ${errorMessage}`)
          }
          
          // 설정 업데이트
          context.updateSettings(mergedSettings)
          
          context.logInfo('설정 가져오기 완료', importedData.settings)
          
          if (context.settings.notificationSettings?.enableToasts) {
            toast.success('설정이 성공적으로 가져와졌습니다')
          }
          
          resolve(importedData.settings)
        } catch (error) {
          context.logError('설정 가져오기 실패', error)
          
          if (context.settings.notificationSettings?.errorNotification) {
            toast.error('설정 가져오기 실패: ' + error.message)
          }
          
          reject(error)
        }
      }
      
      reader.onerror = () => {
        const error = new Error('파일 읽기 실패')
        context.logError('파일 읽기 실패', error)
        
        if (context.settings.notificationSettings?.errorNotification) {
          toast.error('파일을 읽을 수 없습니다')
        }
        
        reject(error)
      }
      
      reader.readAsText(file)
    })
  }, [context, validateSettings])

  // ================================
  // 계산된 값들
  // ================================

  const validationErrors = useMemo(() => validationErrorsRef.current, [validationErrorsRef.current])
  
  const hasValidationErrors = useMemo(() => {
    return Object.keys(validationErrors).length > 0
  }, [validationErrors])

  const isValid = useMemo(() => {
    return !hasValidationErrors
  }, [hasValidationErrors])

  // ================================
  // 반환 값 정의
  // ================================

  return {
    // 기본 상태와 설정
    ...context,
    
    // 검증 관련
    validationErrors,
    hasValidationErrors,
    isValid,
    validateSettings,
    
    // 개선된 업데이트 함수
    updateSettings: updateSettingsWithValidation,
    
    // Import/Export 기능
    exportSettings,
    importSettings,
    
    // 빠른 접근을 위한 별칭들 - PRD 호환 구조에서 추출
    dashboardSettings: context.settings.preferences?.dashboard || context.settings.dashboardSettings || {},
    statisticsSettings: context.settings.preferences?.charts || context.settings.statisticsSettings || {},
    notificationSettings: context.settings.notificationSettings || {},
    generalSettings: context.settings.generalSettings || {}
  }
}

// ================================
// 특화된 훅들 (기존 Context에서 제공하는 것들을 래핑)
// ================================

/**
 * Dashboard 설정 전용 훅
 */
export const useDashboardSettings = () => {
  const {
    dashboardSettings: rawDashboardSettings,
    updateSettings,
    saving,
    error,
    validationErrors,
    logInfo
  } = usePreference()

  // 디버깅: rawDashboardSettings 값 확인
  console.log('[useDashboardSettings] rawDashboardSettings:', rawDashboardSettings)

  // dashboardSettings가 undefined일 때 기본값 제공
  const dashboardSettings = rawDashboardSettings || {
    selectedPegs: [],
    defaultNe: '',
    defaultCellId: '',
    autoRefreshInterval: 30,
    chartStyle: 'line',
    showLegend: true,
    showGrid: true
  }

  // 디버깅: 최종 dashboardSettings 값 확인
  console.log('[useDashboardSettings] final dashboardSettings:', dashboardSettings)

  const updateDashboardSettings = useCallback((newSettings) => {
    logInfo('Dashboard 설정 업데이트', newSettings)
    return updateSettings({
      dashboardSettings: newSettings
    }, 'dashboardSettings')
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
    }, 'statisticsSettings')
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
    }, 'notificationSettings')
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
