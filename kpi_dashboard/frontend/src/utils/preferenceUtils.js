/**
 * 설정 관련 유틸리티 함수 모음
 * 
 * 설정 관리에 필요한 순수 함수들을 제공합니다.
 * - 기본 설정값 정의
 * - 설정 유효성 검증
 * - 설정 병합 및 변환
 * - 로깅 유틸리티
 * 
 * 이 파일은 순수 함수들만 포함하므로 테스트하기 쉽고 재사용 가능합니다.
 */

// ================================
// 로깅 유틸리티
// ================================

/**
 * 설정 관련 로그를 출력합니다
 * @param {string} level - 로그 레벨 (info, warn, error)
 * @param {string} message - 로그 메시지
 * @param {any} data - 추가 데이터
 */
export const logPreference = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[PreferenceUtils] ${timestamp}`
  
  switch (level) {
    case 'info':
      console.log(`${prefix} ℹ️ ${message}`, data)
      break
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`, data)
      break
    case 'error':
      console.error(`${prefix} ❌ ${message}`, data)
      break
    default:
      console.log(`${prefix} ${message}`, data)
  }
}

// ================================
// 런타임 설정 접근
// ================================

/**
 * 안전한 런타임 설정 접근
 * @returns {Object} 런타임 설정 객체
 */
export const getRuntimeConfig = () => {
  try {
    logPreference('info', '런타임 설정 접근 시도')
    
    if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
      const config = window.__RUNTIME_CONFIG__
      logPreference('info', '런타임 설정 로드 성공', config)
      return config
    }
    
    logPreference('warn', '런타임 설정이 없음 - 기본값 사용')
    return {}
  } catch (error) {
    logPreference('error', '런타임 설정 접근 실패', error.message)
    return {}
  }
}

// ================================
// 기본 설정값 정의
// ================================

/**
 * 기본 설정값을 생성합니다
 * @returns {Object} 기본 설정 객체
 */
export const createDefaultSettings = () => {
  logPreference('info', '기본 설정값 생성 시작')
  
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
  
  logPreference('info', '기본 설정값 생성 완료', {
    sections: Object.keys(defaultSettings),
    runtimeConfigKeys: Object.keys(runtimeConfig)
  })
  
  return defaultSettings
}

// ================================
// 설정 유효성 검증
// ================================

/**
 * 설정 유효성 검증 규칙 정의
 */
export const validationRules = {
  dashboardSettings: {
    selectedPegs: {
      required: false,
      type: 'array',
      message: 'selectedPegs는 배열이어야 합니다.'
    },
    autoRefreshInterval: {
      required: false,
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
      required: false,
      type: 'number',
      min: 1,
      max: 365,
      message: '기본 날짜 범위는 1일~365일 사이여야 합니다.'
    },
    decimalPlaces: {
      required: false,
      type: 'number',
      min: 0,
      max: 6,
      message: '소수점 자릿수는 0~6자리 사이여야 합니다.'
    },
    defaultPegs: {
      required: false,
      type: 'array',
      message: 'defaultPegs는 배열이어야 합니다.'
    }
  }
}

/**
 * 설정 유효성을 검증합니다
 * @param {Object} settings - 검증할 설정 객체
 * @param {string} section - 검증할 섹션 (null이면 전체 검증)
 * @returns {Object} 검증 결과 (errors 객체)
 */
export const validateSettings = (settings, section = null) => {
  logPreference('info', '설정 유효성 검증 시작', { section, hasSettings: !!settings })
  
  const errors = {}
  
  if (!settings || typeof settings !== 'object') {
    logPreference('error', '설정 객체가 유효하지 않음')
    return { 'general': '설정 객체가 유효하지 않습니다.' }
  }
  
  // section이 지정되었지만 해당 규칙이 없으면 검증을 건너뜀
  if (section && !validationRules[section]) {
    logPreference('warn', '지정된 섹션에 대한 검증 규칙이 없음', section)
    return errors
  }
  
  const rulesToCheck = section ? { [section]: validationRules[section] } : validationRules

  Object.entries(rulesToCheck).forEach(([sectionKey, sectionRules]) => {
    if (!settings[sectionKey]) {
      logPreference('info', '섹션이 없음 - 검증 스킵', sectionKey)
      return
    }

    Object.entries(sectionRules).forEach(([fieldKey, rule]) => {
      const value = settings[sectionKey][fieldKey]
      const fieldPath = `${sectionKey}.${fieldKey}`

      // Required 검증
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors[fieldPath] = rule.message || `${fieldKey}는 필수 항목입니다.`
        logPreference('warn', '필수 필드 누락', { fieldPath, value })
        return
      }

      // 값이 없으면 나머지 검증 스킵
      if (value === undefined || value === null || value === '') {
        logPreference('info', '필드 값이 없음 - 검증 스킵', fieldPath)
        return
      }

      // Type 검증
      if (rule.type === 'array' && !Array.isArray(value)) {
        errors[fieldPath] = rule.message || `${fieldKey}는 배열이어야 합니다.`
        logPreference('warn', '타입 검증 실패 - 배열이 아님', { fieldPath, value, expectedType: 'array' })
        return
      }

      if (rule.type === 'number' && typeof value !== 'number') {
        errors[fieldPath] = rule.message || `${fieldKey}는 숫자여야 합니다.`
        logPreference('warn', '타입 검증 실패 - 숫자가 아님', { fieldPath, value, expectedType: 'number' })
        return
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        errors[fieldPath] = rule.message || `${fieldKey}는 문자열이어야 합니다.`
        logPreference('warn', '타입 검증 실패 - 문자열이 아님', { fieldPath, value, expectedType: 'string' })
        return
      }

      // 값 범위 검증
      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors[fieldPath] = rule.message || `${fieldKey}는 ${rule.min} 이상이어야 합니다.`
          logPreference('warn', '숫자 범위 검증 실패 - 최소값 미달', { fieldPath, value, min: rule.min })
          return
        }
        if (rule.max !== undefined && value > rule.max) {
          errors[fieldPath] = rule.message || `${fieldKey}는 ${rule.max} 이하여야 합니다.`
          logPreference('warn', '숫자 범위 검증 실패 - 최대값 초과', { fieldPath, value, max: rule.max })
          return
        }
      }

      if (rule.type === 'array') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최소 ${rule.minLength}개 항목이 필요합니다.`
          logPreference('warn', '배열 길이 검증 실패 - 최소 길이 미달', { fieldPath, length: value.length, minLength: rule.minLength })
          return
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최대 ${rule.maxLength}개 항목만 허용됩니다.`
          logPreference('warn', '배열 길이 검증 실패 - 최대 길이 초과', { fieldPath, length: value.length, maxLength: rule.maxLength })
          return
        }
      }

      if (rule.type === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최소 ${rule.minLength}자 이상이어야 합니다.`
          logPreference('warn', '문자열 길이 검증 실패 - 최소 길이 미달', { fieldPath, length: value.length, minLength: rule.minLength })
          return
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors[fieldPath] = rule.message || `${fieldKey}는 최대 ${rule.maxLength}자까지 허용됩니다.`
          logPreference('warn', '문자열 길이 검증 실패 - 최대 길이 초과', { fieldPath, length: value.length, maxLength: rule.maxLength })
          return
        }
      }
    })
  })

  const errorCount = Object.keys(errors).length
  logPreference('info', '설정 유효성 검증 완료', { 
    errorCount, 
    hasErrors: errorCount > 0,
    errorFields: Object.keys(errors)
  })
  
  return errors
}

// ================================
// 설정 병합 및 변환
// ================================

/**
 * 설정을 병합합니다 (기본값 + 저장된 값)
 * @param {Object} savedSettings - 저장된 설정
 * @param {Object} defaultSettings - 기본 설정
 * @returns {Object} 병합된 설정
 */
export const mergeSettings = (savedSettings, defaultSettings) => {
  logPreference('info', '설정 병합 시작', { 
    hasSavedSettings: !!savedSettings, 
    hasDefaultSettings: !!defaultSettings 
  })
  
  if (!savedSettings) {
    logPreference('info', '저장된 설정이 없음 - 기본값 반환')
    return defaultSettings
  }

  try {
    const merged = { ...defaultSettings }
    
    // 각 섹션별로 병합
    Object.keys(defaultSettings).forEach(section => {
      if (savedSettings[section] && typeof savedSettings[section] === 'object') {
        merged[section] = {
          ...defaultSettings[section],
          ...savedSettings[section]
        }
        logPreference('info', '섹션 병합 완료', { section, mergedKeys: Object.keys(merged[section]) })
      } else {
        logPreference('info', '섹션이 없거나 객체가 아님 - 기본값 사용', { section })
      }
    })

    logPreference('info', '설정 병합 완료', { 
      mergedSections: Object.keys(merged),
      totalSections: Object.keys(defaultSettings).length
    })
    return merged
  } catch (error) {
    logPreference('error', '설정 병합 실패', error.message)
    return defaultSettings
  }
}

/**
 * 설정을 안전하게 변환합니다
 * @param {any} settings - 변환할 설정
 * @param {Object} defaultSettings - 기본 설정 (템플릿)
 * @returns {Object} 변환된 설정
 */
export const sanitizeSettings = (settings, defaultSettings) => {
  logPreference('info', '설정 변환 시작')
  
  if (!settings || typeof settings !== 'object') {
    logPreference('warn', '설정이 유효하지 않음 - 기본값 반환')
    return defaultSettings
  }

  try {
    const sanitized = {}
    
    // 기본 설정의 구조를 따라 변환
    Object.keys(defaultSettings).forEach(section => {
      if (settings[section] && typeof settings[section] === 'object') {
        sanitized[section] = { ...defaultSettings[section], ...settings[section] }
        logPreference('info', '섹션 변환 완료', { section })
      } else {
        sanitized[section] = { ...defaultSettings[section] }
        logPreference('warn', '섹션이 유효하지 않음 - 기본값 사용', { section })
      }
    })

    logPreference('info', '설정 변환 완료')
    return sanitized
  } catch (error) {
    logPreference('error', '설정 변환 실패', error.message)
    return defaultSettings
  }
}

// ================================
// 설정 내보내기/가져오기 유틸리티
// ================================

/**
 * 설정을 내보내기용 데이터로 변환합니다
 * @param {Object} settings - 내보낼 설정
 * @param {string} userId - 사용자 ID
 * @returns {Object} 내보내기용 데이터
 */
export const prepareSettingsForExport = (settings, userId = 'default') => {
  logPreference('info', '설정 내보내기 준비 시작', { userId })
  
  try {
    const exportData = {
      settings,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        userId: userId
      }
    }
    
    logPreference('info', '설정 내보내기 준비 완료', { 
      hasSettings: !!settings,
      metadata: exportData.metadata
    })
    
    return exportData
  } catch (error) {
    logPreference('error', '설정 내보내기 준비 실패', error.message)
    throw error
  }
}

/**
 * 가져온 설정 데이터를 검증하고 변환합니다
 * @param {Object} importData - 가져온 데이터
 * @param {Object} defaultSettings - 기본 설정
 * @returns {Object} 검증된 설정
 */
export const validateAndTransformImportData = (importData, defaultSettings) => {
  logPreference('info', '가져온 설정 데이터 검증 시작')
  
  try {
    if (!importData || typeof importData !== 'object') {
      throw new Error('유효하지 않은 가져오기 데이터입니다.')
    }
    
    if (!importData.settings) {
      throw new Error('설정 데이터가 없습니다.')
    }
    
    // 설정 변환
    const transformedSettings = sanitizeSettings(importData.settings, defaultSettings)
    
    // 유효성 검증
    const validationErrors = validateSettings(transformedSettings)
    
    if (Object.keys(validationErrors).length > 0) {
      logPreference('warn', '가져온 설정에 유효성 오류가 있음', validationErrors)
      // 오류가 있어도 변환된 설정은 반환 (부분적 복구)
    }
    
    logPreference('info', '가져온 설정 데이터 검증 완료', {
      hasErrors: Object.keys(validationErrors).length > 0,
      errorCount: Object.keys(validationErrors).length
    })
    
    return {
      settings: transformedSettings,
      errors: validationErrors,
      metadata: importData.metadata || {}
    }
  } catch (error) {
    logPreference('error', '가져온 설정 데이터 검증 실패', error.message)
    throw error
  }
}

// ================================
// 내보내기
// ================================

export default {
  logPreference,
  getRuntimeConfig,
  createDefaultSettings,
  validationRules,
  validateSettings,
  mergeSettings,
  sanitizeSettings,
  prepareSettingsForExport,
  validateAndTransformImportData
}
