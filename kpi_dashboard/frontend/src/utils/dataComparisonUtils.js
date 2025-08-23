/**
 * Data Comparison Utilities
 * 
 * 로컬과 서버 설정 간의 세밀한 비교를 위한 유틸리티 함수들입니다.
 * Task 8.2: Local-Server Data Comparison & Pre-Conflict Logic 구현
 */

import { logInfo, logDebug, logWarning } from './loggingUtils.js'
import { compareTimestamps } from './preferenceModelMapper.js'

/**
 * 충돌 유형 상수
 */
export const CONFLICT_TYPES = {
  NO_CONFLICT: 'no_conflict',
  TIMESTAMP_CONFLICT: 'timestamp_conflict',
  DATA_MISMATCH: 'data_mismatch',
  MISSING_DATA: 'missing_data',
  VERSION_MISMATCH: 'version_mismatch',
  CORRUPTION_DETECTED: 'corruption_detected'
}

/**
 * 충돌 심각도 상수
 */
export const CONFLICT_SEVERITY = {
  NONE: 0,
  LOW: 1,      // 사소한 차이점 (예: UI 설정)
  MEDIUM: 2,   // 중요한 차이점 (예: 대시보드 설정)
  HIGH: 3,     // 중대한 차이점 (예: 데이터베이스 설정)
  CRITICAL: 4  // 치명적 차이점 (예: 데이터 손상)
}

/**
 * 설정 필드별 중요도 맵핑
 */
const FIELD_IMPORTANCE = {
  // 높은 중요도 (비즈니스 크리티컬)
  'preferences.dashboard.selectedPegs': CONFLICT_SEVERITY.HIGH,
  'databaseSettings': CONFLICT_SEVERITY.HIGH,
  'pegConfigurations': CONFLICT_SEVERITY.HIGH,
  'statisticsConfigurations': CONFLICT_SEVERITY.HIGH,
  
  // 중간 중요도 (사용자 경험)
  'preferences.dashboard.defaultNe': CONFLICT_SEVERITY.MEDIUM,
  'preferences.dashboard.defaultCellId': CONFLICT_SEVERITY.MEDIUM,
  'preferences.charts': CONFLICT_SEVERITY.MEDIUM,
  'notificationSettings': CONFLICT_SEVERITY.MEDIUM,
  
  // 낮은 중요도 (UI/UX)
  'preferences.dashboard.theme': CONFLICT_SEVERITY.LOW,
  'preferences.dashboard.chartStyle': CONFLICT_SEVERITY.LOW,
  'preferences.filters.language': CONFLICT_SEVERITY.LOW,
  'preferences.filters.timezone': CONFLICT_SEVERITY.LOW
}

/**
 * 두 객체를 깊게 비교하여 차이점을 찾습니다
 * @param {Object} localData - 로컬 데이터
 * @param {Object} serverData - 서버 데이터
 * @param {string} path - 현재 비교 중인 경로 (디버깅용)
 * @returns {Array} 차이점 배열
 */
export const deepCompareObjects = (localData, serverData, path = '') => {
  const differences = []

  try {
    // null/undefined 체크
    if (localData === null && serverData === null) return differences
    if (localData === undefined && serverData === undefined) return differences
    
    if (localData === null || localData === undefined) {
      differences.push({
        path,
        type: 'missing_local',
        localValue: localData,
        serverValue: serverData,
        severity: getFieldSeverity(path)
      })
      return differences
    }
    
    if (serverData === null || serverData === undefined) {
      differences.push({
        path,
        type: 'missing_server',
        localValue: localData,
        serverValue: serverData,
        severity: getFieldSeverity(path)
      })
      return differences
    }

    // 타입이 다른 경우
    if (typeof localData !== typeof serverData) {
      differences.push({
        path,
        type: 'type_mismatch',
        localValue: localData,
        serverValue: serverData,
        localType: typeof localData,
        serverType: typeof serverData,
        severity: getFieldSeverity(path)
      })
      return differences
    }

    // 배열 비교
    if (Array.isArray(localData) && Array.isArray(serverData)) {
      const arrayDiffs = compareArrays(localData, serverData, path)
      differences.push(...arrayDiffs)
      return differences
    }

    // 객체 비교
    if (typeof localData === 'object' && typeof serverData === 'object') {
      const objectDiffs = compareObjects(localData, serverData, path)
      differences.push(...objectDiffs)
      return differences
    }

    // 원시 값 비교
    if (localData !== serverData) {
      differences.push({
        path,
        type: 'value_mismatch',
        localValue: localData,
        serverValue: serverData,
        severity: getFieldSeverity(path)
      })
    }

    return differences

  } catch (error) {
    logWarning('객체 비교 중 오류 발생', { path, error: error.message })
    differences.push({
      path,
      type: 'comparison_error',
      error: error.message,
      severity: CONFLICT_SEVERITY.CRITICAL
    })
    return differences
  }
}

/**
 * 객체의 속성들을 비교합니다
 * @param {Object} localObj - 로컬 객체
 * @param {Object} serverObj - 서버 객체
 * @param {string} basePath - 기본 경로
 * @returns {Array} 차이점 배열
 */
const compareObjects = (localObj, serverObj, basePath) => {
  const differences = []
  const allKeys = new Set([...Object.keys(localObj), ...Object.keys(serverObj)])

  for (const key of allKeys) {
    const currentPath = basePath ? `${basePath}.${key}` : key
    const localValue = localObj[key]
    const serverValue = serverObj[key]

    const keyDiffs = deepCompareObjects(localValue, serverValue, currentPath)
    differences.push(...keyDiffs)
  }

  return differences
}

/**
 * 배열을 비교합니다
 * @param {Array} localArray - 로컬 배열
 * @param {Array} serverArray - 서버 배열
 * @param {string} basePath - 기본 경로
 * @returns {Array} 차이점 배열
 */
const compareArrays = (localArray, serverArray, basePath) => {
  const differences = []

  // 길이 차이 체크
  if (localArray.length !== serverArray.length) {
    differences.push({
      path: `${basePath}.length`,
      type: 'array_length_mismatch',
      localValue: localArray.length,
      serverValue: serverArray.length,
      severity: getFieldSeverity(basePath)
    })
  }

  // 요소별 비교 (작은 배열 길이까지)
  const minLength = Math.min(localArray.length, serverArray.length)
  for (let i = 0; i < minLength; i++) {
    const currentPath = `${basePath}[${i}]`
    const elementDiffs = deepCompareObjects(localArray[i], serverArray[i], currentPath)
    differences.push(...elementDiffs)
  }

  // 추가 요소들 처리
  if (localArray.length > serverArray.length) {
    for (let i = serverArray.length; i < localArray.length; i++) {
      differences.push({
        path: `${basePath}[${i}]`,
        type: 'extra_local_element',
        localValue: localArray[i],
        serverValue: undefined,
        severity: getFieldSeverity(basePath)
      })
    }
  } else if (serverArray.length > localArray.length) {
    for (let i = localArray.length; i < serverArray.length; i++) {
      differences.push({
        path: `${basePath}[${i}]`,
        type: 'extra_server_element',
        localValue: undefined,
        serverValue: serverArray[i],
        severity: getFieldSeverity(basePath)
      })
    }
  }

  return differences
}

/**
 * 필드의 중요도를 가져옵니다
 * @param {string} fieldPath - 필드 경로
 * @returns {number} 중요도 레벨
 */
const getFieldSeverity = (fieldPath) => {
  // 정확한 매칭 먼저 시도
  if (FIELD_IMPORTANCE[fieldPath] !== undefined) {
    return FIELD_IMPORTANCE[fieldPath]
  }

  // 부분 매칭 시도
  for (const [pattern, severity] of Object.entries(FIELD_IMPORTANCE)) {
    if (fieldPath.includes(pattern) || fieldPath.startsWith(pattern)) {
      return severity
    }
  }

  // 기본값
  return CONFLICT_SEVERITY.MEDIUM
}

/**
 * 종합적인 설정 비교 및 충돌 분석을 수행합니다
 * @param {Object} localSettings - 로컬 userSettings
 * @param {Object} serverSettings - 서버에서 변환된 userSettings
 * @returns {Object} 종합 비교 결과
 */
export const analyzeSettingsConflict = (localSettings, serverSettings) => {
  try {
    logDebug('설정 충돌 분석 시작', { 
      hasLocal: !!localSettings, 
      hasServer: !!serverSettings 
    })

    const result = {
      conflictType: CONFLICT_TYPES.NO_CONFLICT,
      severity: CONFLICT_SEVERITY.NONE,
      hasConflict: false,
      differences: [],
      recommendations: [],
      metadata: {
        analysisTime: new Date().toISOString(),
        localTimestamp: localSettings?.metadata?.lastModified,
        serverTimestamp: serverSettings?.metadata?.lastModified,
        timestampComparison: null
      }
    }

    // 기본 유효성 검사
    if (!localSettings && !serverSettings) {
      result.conflictType = CONFLICT_TYPES.MISSING_DATA
      result.severity = CONFLICT_SEVERITY.CRITICAL
      result.hasConflict = true
      result.recommendations.push('Both local and server settings are missing. Initialize with default settings.')
      return result
    }

    if (!localSettings) {
      result.conflictType = CONFLICT_TYPES.MISSING_DATA
      result.severity = CONFLICT_SEVERITY.MEDIUM
      result.recommendations.push('Local settings missing. Use server settings.')
      return result
    }

    if (!serverSettings) {
      result.conflictType = CONFLICT_TYPES.MISSING_DATA
      result.severity = CONFLICT_SEVERITY.MEDIUM
      result.recommendations.push('Server settings missing. Upload local settings.')
      return result
    }

    // 타임스탬프 비교
    const timestampComparison = compareTimestamps(
      localSettings.metadata?.lastModified,
      serverSettings.metadata?.lastModified
    )
    result.metadata.timestampComparison = timestampComparison

    // 버전 비교
    const localVersion = localSettings.metadata?.version || 1
    const serverVersion = serverSettings.metadata?.version || 1
    
    if (localVersion !== serverVersion) {
      result.conflictType = CONFLICT_TYPES.VERSION_MISMATCH
      result.severity = CONFLICT_SEVERITY.HIGH
      result.hasConflict = true
      result.recommendations.push(`Version mismatch detected. Local: ${localVersion}, Server: ${serverVersion}`)
    }

    // 세밀한 데이터 비교
    const differences = deepCompareObjects(localSettings, serverSettings)
    result.differences = differences

    // 차이점이 있는 경우 충돌 분석
    if (differences.length > 0) {
      result.hasConflict = true
      
      // 가장 높은 심각도 계산
      const maxSeverity = Math.max(...differences.map(diff => diff.severity || CONFLICT_SEVERITY.LOW))
      result.severity = maxSeverity

      // 충돌 유형 결정
      if (timestampComparison !== 0) {
        result.conflictType = CONFLICT_TYPES.TIMESTAMP_CONFLICT
      } else {
        result.conflictType = CONFLICT_TYPES.DATA_MISMATCH
      }

      // 권장사항 생성
      if (timestampComparison > 0) {
        result.recommendations.push('Local settings are newer. Consider uploading to server.')
      } else if (timestampComparison < 0) {
        result.recommendations.push('Server settings are newer. Consider downloading from server.')
      } else {
        result.recommendations.push('Timestamps are equal but data differs. Manual resolution may be required.')
      }

      // 심각도별 권장사항
      if (maxSeverity >= CONFLICT_SEVERITY.HIGH) {
        result.recommendations.push('High-priority differences detected. Review carefully before resolving.')
      }
    }

    logInfo('설정 충돌 분석 완료', {
      conflictType: result.conflictType,
      severity: result.severity,
      hasConflict: result.hasConflict,
      differenceCount: differences.length
    })

    return result

  } catch (error) {
    logWarning('설정 충돌 분석 중 오류', error)
    return {
      conflictType: CONFLICT_TYPES.CORRUPTION_DETECTED,
      severity: CONFLICT_SEVERITY.CRITICAL,
      hasConflict: true,
      differences: [],
      recommendations: ['Analysis failed due to error. Use safe fallback strategy.'],
      error: error.message,
      metadata: {
        analysisTime: new Date().toISOString(),
        error: true
      }
    }
  }
}

/**
 * 충돌 해결 권장사항을 생성합니다
 * @param {Object} conflictAnalysis - analyzeSettingsConflict 결과
 * @returns {Object} 권장사항 객체
 */
export const generateConflictResolution = (conflictAnalysis) => {
  const resolution = {
    strategy: 'last_write_wins', // 기본값
    action: 'apply_server',       // 기본값
    reasoning: '',
    confidence: 0.5,              // 0-1 범위
    requiresUserInput: false
  }

  try {
    const { conflictType, severity, metadata, differences } = conflictAnalysis

    switch (conflictType) {
      case CONFLICT_TYPES.NO_CONFLICT:
        resolution.strategy = 'no_action'
        resolution.action = 'maintain_current'
        resolution.reasoning = 'No conflicts detected.'
        resolution.confidence = 1.0
        break

      case CONFLICT_TYPES.MISSING_DATA:
        resolution.strategy = 'use_available'
        resolution.action = metadata.localTimestamp ? 'apply_local' : 'apply_server'
        resolution.reasoning = 'Use available data source.'
        resolution.confidence = 0.9
        break

      case CONFLICT_TYPES.TIMESTAMP_CONFLICT:
        if (metadata.timestampComparison > 0) {
          resolution.action = 'apply_local'
          resolution.reasoning = 'Local settings are more recent.'
        } else {
          resolution.action = 'apply_server'
          resolution.reasoning = 'Server settings are more recent.'
        }
        resolution.confidence = 0.8
        break

      case CONFLICT_TYPES.DATA_MISMATCH:
        if (severity >= CONFLICT_SEVERITY.HIGH) {
          resolution.requiresUserInput = true
          resolution.strategy = 'manual_review'
          resolution.reasoning = 'High-priority conflicts require manual review.'
          resolution.confidence = 0.3
        } else {
          resolution.strategy = 'merge_strategy'
          resolution.reasoning = 'Low-priority conflicts can be auto-merged.'
          resolution.confidence = 0.6
        }
        break

      case CONFLICT_TYPES.VERSION_MISMATCH:
        resolution.requiresUserInput = true
        resolution.strategy = 'version_migration'
        resolution.reasoning = 'Version differences require careful handling.'
        resolution.confidence = 0.2
        break

      case CONFLICT_TYPES.CORRUPTION_DETECTED:
        resolution.strategy = 'safe_fallback'
        resolution.action = 'use_defaults'
        resolution.reasoning = 'Data corruption detected. Using safe defaults.'
        resolution.confidence = 0.1
        break
    }

    logDebug('충돌 해결 권장사항 생성', resolution)
    return resolution

  } catch (error) {
    logWarning('충돌 해결 권장사항 생성 중 오류', error)
    return {
      strategy: 'error_fallback',
      action: 'use_defaults',
      reasoning: 'Error occurred during conflict resolution analysis.',
      confidence: 0.0,
      requiresUserInput: true,
      error: error.message
    }
  }
}

/**
 * 충돌 분석 결과를 사용자 친화적인 메시지로 변환합니다
 * @param {Object} conflictAnalysis - 충돌 분석 결과
 * @returns {Object} 사용자 메시지 객체
 */
export const formatConflictMessage = (conflictAnalysis) => {
  const { conflictType, severity, differences, hasConflict } = conflictAnalysis

  if (!hasConflict) {
    return {
      title: '설정 동기화 완료',
      message: '로컬과 서버 설정이 일치합니다.',
      type: 'success'
    }
  }

  let title = '설정 차이점 발견'
  let message = ''
  let type = 'warning'

  switch (conflictType) {
    case CONFLICT_TYPES.TIMESTAMP_CONFLICT:
      title = '설정 충돌 감지'
      message = `로컬과 서버 설정에 시간 차이가 있습니다. (${differences.length}개 차이점)`
      type = severity >= CONFLICT_SEVERITY.HIGH ? 'error' : 'warning'
      break

    case CONFLICT_TYPES.DATA_MISMATCH:
      title = '설정 불일치'
      message = `설정 내용에 차이가 있습니다. (${differences.length}개 필드)`
      type = severity >= CONFLICT_SEVERITY.HIGH ? 'error' : 'info'
      break

    case CONFLICT_TYPES.VERSION_MISMATCH:
      title = '버전 불일치'
      message = '설정 버전이 다릅니다. 수동 확인이 필요할 수 있습니다.'
      type = 'error'
      break

    case CONFLICT_TYPES.MISSING_DATA:
      title = '설정 누락'
      message = '일부 설정 데이터가 누락되었습니다.'
      type = 'warning'
      break

    case CONFLICT_TYPES.CORRUPTION_DETECTED:
      title = '데이터 오류'
      message = '설정 데이터에 오류가 감지되었습니다.'
      type = 'error'
      break
  }

  return { title, message, type }
}
