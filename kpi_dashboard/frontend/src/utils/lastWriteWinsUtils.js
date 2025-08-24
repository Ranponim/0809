/**
 * Last Write Wins Conflict Resolution Utilities
 * 
 * Task 8.3: 'Last Write Wins' 충돌 해결 전략의 고급 구현
 * 타임스탬프 기반 충돌 해결을 위한 정교한 유틸리티 함수들
 */

import { logInfo, logDebug, logWarning } from './loggingUtils.js'
import { compareTimestamps } from './preferenceModelMapper.js'
import { CONFLICT_SEVERITY } from './dataComparisonUtils.js'
import { LWW_STRATEGIES, CONFIDENCE_LEVELS } from './constants.js'

/**
 * 타임스탬프 분석 결과 인터페이스
 */
const createTimestampAnalysis = (localTimestamp, serverTimestamp) => {
  const comparison = compareTimestamps(localTimestamp, serverTimestamp)
  const localDate = localTimestamp ? new Date(localTimestamp) : null
  const serverDate = serverTimestamp ? new Date(serverTimestamp) : null
  
  let timeDifference = 0
  if (localDate && serverDate) {
    timeDifference = Math.abs(localDate.getTime() - serverDate.getTime())
  }

  return {
    comparison,
    localTimestamp,
    serverTimestamp,
    localDate,
    serverDate,
    timeDifference,
    timeDifferenceMinutes: timeDifference / (1000 * 60),
    timeDifferenceHours: timeDifference / (1000 * 60 * 60),
    hasValidTimestamps: !!(localDate && serverDate),
    isRecentConflict: timeDifference < (5 * 60 * 1000), // 5분 이내
    isSignificantGap: timeDifference > (24 * 60 * 60 * 1000) // 24시간 이상
  }
}

/**
 * 엄격한 타임스탬프 기반 Last Write Wins
 * @param {Object} localSettings - 로컬 설정
 * @param {Object} serverSettings - 서버 설정  
 * @returns {Object} 해결 결과
 */
export const strictTimestampLWW = (localSettings, serverSettings) => {
  logDebug('엄격한 타임스탬프 LWW 분석 시작')

  const analysis = createTimestampAnalysis(
    localSettings?.metadata?.lastModified,
    serverSettings?.metadata?.lastModified
  )

  const result = {
    strategy: LWW_STRATEGIES.STRICT_TIMESTAMP,
    winner: null,
    action: 'maintain_current',
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    reasoning: '',
    metadata: analysis
  }

  // 타임스탬프가 없는 경우 처리
  if (!analysis.hasValidTimestamps) {
    if (localSettings && !serverSettings) {
      result.winner = 'local'
      result.action = 'apply_local'
      result.confidence = CONFIDENCE_LEVELS.HIGH
      result.reasoning = '서버 설정이 없어 로컬 설정을 적용합니다.'
    } else if (!localSettings && serverSettings) {
      result.winner = 'server'
      result.action = 'apply_server'
      result.confidence = CONFIDENCE_LEVELS.HIGH
      result.reasoning = '로컬 설정이 없어 서버 설정을 적용합니다.'
    } else {
      result.confidence = CONFIDENCE_LEVELS.VERY_LOW
      result.reasoning = '타임스탬프 정보가 없어 판단할 수 없습니다.'
    }
    return result
  }

  // 타임스탬프 비교 결과에 따른 처리
  switch (analysis.comparison) {
    case 1: // 로컬이 더 최신
      result.winner = 'local'
      result.action = 'apply_local'
      result.reasoning = `로컬 설정이 ${analysis.timeDifferenceMinutes.toFixed(1)}분 더 최신입니다.`
      
      // 신뢰도 계산
      if (analysis.isSignificantGap) {
        result.confidence = CONFIDENCE_LEVELS.VERY_HIGH
      } else if (analysis.isRecentConflict) {
        result.confidence = CONFIDENCE_LEVELS.MEDIUM // 최근 충돌은 신중히
      } else {
        result.confidence = CONFIDENCE_LEVELS.HIGH
      }
      break

    case -1: // 서버가 더 최신
      result.winner = 'server'
      result.action = 'apply_server'
      result.reasoning = `서버 설정이 ${analysis.timeDifferenceMinutes.toFixed(1)}분 더 최신입니다.`
      
      // 신뢰도 계산
      if (analysis.isSignificantGap) {
        result.confidence = CONFIDENCE_LEVELS.VERY_HIGH
      } else if (analysis.isRecentConflict) {
        result.confidence = CONFIDENCE_LEVELS.MEDIUM
      } else {
        result.confidence = CONFIDENCE_LEVELS.HIGH
      }
      break

    case 0: // 타임스탬프 동일
      result.winner = null
      result.action = 'maintain_current'
      result.confidence = CONFIDENCE_LEVELS.VERY_LOW
      result.reasoning = '타임스탬프가 동일하여 추가 분석이 필요합니다.'
      break
  }

  logInfo('엄격한 타임스탬프 LWW 분석 완료', {
    winner: result.winner,
    confidence: result.confidence,
    timeDifference: analysis.timeDifferenceMinutes
  })

  return result
}

/**
 * 필드별 Last Write Wins 분석
 * @param {Object} localSettings - 로컬 설정
 * @param {Object} serverSettings - 서버 설정
 * @param {Array} differences - 8.2에서 분석한 차이점 목록
 * @returns {Object} 필드별 해결 결과
 */
export const fieldLevelLWW = (localSettings, serverSettings, differences) => {
  logDebug('필드별 LWW 분석 시작', { differenceCount: differences.length })

  const fieldResolutions = []
  const summary = {
    strategy: LWW_STRATEGIES.FIELD_LEVEL_LWW,
    totalFields: differences.length,
    localWins: 0,
    serverWins: 0,
    conflicts: 0,
    confidence: CONFIDENCE_LEVELS.MEDIUM
  }

  for (const diff of differences) {
    const fieldResult = analyzeFieldConflict(diff, localSettings, serverSettings)
    fieldResolutions.push(fieldResult)

    // 통계 집계
    switch (fieldResult.winner) {
      case 'local':
        summary.localWins++
        break
      case 'server':
        summary.serverWins++
        break
      default:
        summary.conflicts++
    }
  }

  // 전체 신뢰도 계산
  const totalResolved = summary.localWins + summary.serverWins
  const resolutionRate = totalResolved / summary.totalFields
  
  if (resolutionRate >= 0.9) {
    summary.confidence = CONFIDENCE_LEVELS.HIGH
  } else if (resolutionRate >= 0.7) {
    summary.confidence = CONFIDENCE_LEVELS.MEDIUM
  } else {
    summary.confidence = CONFIDENCE_LEVELS.LOW
  }

  // 주도권 결정
  if (summary.localWins > summary.serverWins) {
    summary.overallWinner = 'local'
    summary.recommendedAction = 'apply_local_with_server_updates'
  } else if (summary.serverWins > summary.localWins) {
    summary.overallWinner = 'server'
    summary.recommendedAction = 'apply_server_with_local_updates'
  } else {
    summary.overallWinner = null
    summary.recommendedAction = 'manual_review'
  }

  logInfo('필드별 LWW 분석 완료', summary)

  return {
    summary,
    fieldResolutions,
    strategy: LWW_STRATEGIES.FIELD_LEVEL_LWW
  }
}

/**
 * 개별 필드 충돌 분석
 * @param {Object} difference - 필드 차이점 정보
 * @param {Object} localSettings - 로컬 설정
 * @param {Object} serverSettings - 서버 설정
 * @returns {Object} 필드 해결 결과
 */
const analyzeFieldConflict = (difference, localSettings, serverSettings) => {
  const { path, severity, type } = difference

  const result = {
    path,
    type,
    severity,
    winner: null,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    reasoning: ''
  }

  // 필드별 타임스탬프가 있다면 활용 (향후 확장 가능)
  // 현재는 전체 타임스탬프 기반으로 판단

  const timestampAnalysis = createTimestampAnalysis(
    localSettings?.metadata?.lastModified,
    serverSettings?.metadata?.lastModified
  )

  // 타입별 처리
  switch (type) {
    case 'missing_local':
      result.winner = 'server'
      result.confidence = CONFIDENCE_LEVELS.HIGH
      result.reasoning = '로컬에 없는 설정은 서버 값을 사용'
      break

    case 'missing_server':
      result.winner = 'local'
      result.confidence = CONFIDENCE_LEVELS.HIGH
      result.reasoning = '서버에 없는 설정은 로컬 값을 사용'
      break

    case 'value_mismatch':
      // 심각도와 타임스탬프 기반 판단
      if (timestampAnalysis.comparison > 0) {
        result.winner = 'local'
        result.reasoning = '로컬이 더 최신'
      } else if (timestampAnalysis.comparison < 0) {
        result.winner = 'server'
        result.reasoning = '서버가 더 최신'
      } else {
        // 타임스탬프 동일 시 심각도 기반 판단
        if (severity >= CONFLICT_SEVERITY.HIGH) {
          result.winner = null
          result.confidence = CONFIDENCE_LEVELS.VERY_LOW
          result.reasoning = '중요 설정 충돌로 수동 확인 필요'
        } else {
          result.winner = 'local' // 기본값: 로컬 우선
          result.confidence = CONFIDENCE_LEVELS.LOW
          result.reasoning = '타임스탬프 동일하여 로컬 우선 적용'
        }
      }
      break

    case 'type_mismatch':
      result.winner = null
      result.confidence = CONFIDENCE_LEVELS.VERY_LOW
      result.reasoning = '데이터 타입 불일치로 수동 확인 필요'
      break

    default:
      result.confidence = CONFIDENCE_LEVELS.LOW
      result.reasoning = '알 수 없는 충돌 유형'
  }

  return result
}

/**
 * 스마트 병합 전략
 * @param {Object} localSettings - 로컬 설정
 * @param {Object} serverSettings - 서버 설정
 * @param {Array} differences - 차이점 목록
 * @returns {Object} 병합된 설정과 메타데이터
 */
export const smartMergeStrategy = (localSettings, serverSettings, differences) => {
  logDebug('스마트 병합 전략 시작')

  // 필드별 분석 먼저 수행
  const fieldAnalysis = fieldLevelLWW(localSettings, serverSettings, differences)
  
  // 기본 설정으로 서버 설정 사용 (일반적으로 더 안정적)
  const mergedSettings = JSON.parse(JSON.stringify(serverSettings))

  const mergeLog = []
  let conflictCount = 0

  // 필드별 해결 결과를 기반으로 병합
  for (const fieldResult of fieldAnalysis.fieldResolutions) {
    const { path, winner, confidence, reasoning } = fieldResult

    if (winner === 'local' && confidence >= CONFIDENCE_LEVELS.MEDIUM) {
      // 로컬 값 적용
      const value = getNestedValue(localSettings, path)
      setNestedValue(mergedSettings, path, value)
      
      mergeLog.push({
        path,
        action: 'applied_local',
        confidence,
        reasoning
      })
    } else if (winner === null || confidence < CONFIDENCE_LEVELS.MEDIUM) {
      // 충돌 또는 낮은 신뢰도
      conflictCount++
      mergeLog.push({
        path,
        action: 'needs_review',
        confidence,
        reasoning
      })
    }
    // server winner이거나 높은 신뢰도의 경우는 이미 서버 값이 적용됨
  }

  // 메타데이터 업데이트
  mergedSettings.metadata = {
    ...mergedSettings.metadata,
    lastModified: new Date().toISOString(),
    mergeTimestamp: new Date().toISOString(),
    mergeStrategy: LWW_STRATEGIES.SMART_MERGE,
    conflictCount,
    mergeLog: mergeLog.slice(0, 10) // 최대 10개만 로그 보관
  }

  const result = {
    strategy: LWW_STRATEGIES.SMART_MERGE,
    mergedSettings,
    conflictCount,
    totalChanges: mergeLog.length,
    confidence: conflictCount === 0 ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.MEDIUM,
    mergeLog,
    requiresReview: conflictCount > 0
  }

  logInfo('스마트 병합 전략 완료', {
    conflictCount,
    totalChanges: mergeLog.length,
    confidence: result.confidence
  })

  return result
}

/**
 * 중첩된 객체에서 값 가져오기
 * @param {Object} obj - 대상 객체
 * @param {string} path - 경로 (예: 'preferences.dashboard.theme')
 * @returns {any} 값
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}

/**
 * 중첩된 객체에 값 설정하기
 * @param {Object} obj - 대상 객체
 * @param {string} path - 경로
 * @param {any} value - 설정할 값
 */
const setNestedValue = (obj, path, value) => {
  const keys = path.split('.')
  const lastKey = keys.pop()
  
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }
    return current[key]
  }, obj)
  
  target[lastKey] = value
}

/**
 * 종합적인 Last Write Wins 해결
 * @param {Object} localSettings - 로컬 설정
 * @param {Object} serverSettings - 서버 설정
 * @param {Object} conflictAnalysis - 8.2에서 생성한 충돌 분석
 * @param {string} preferredStrategy - 선호하는 전략
 * @returns {Object} 최종 해결 결과
 */
export const comprehensiveLWW = (localSettings, serverSettings, conflictAnalysis, preferredStrategy = LWW_STRATEGIES.HYBRID_METADATA) => {
  logInfo('종합적인 LWW 해결 시작', { 
    strategy: preferredStrategy,
    hasConflict: conflictAnalysis.hasConflict 
  })

  if (!conflictAnalysis.hasConflict) {
    return {
      strategy: 'no_conflict',
      action: 'maintain_current',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      reasoning: '충돌이 없어 해결이 불필요합니다.'
    }
  }

  let result

  switch (preferredStrategy) {
    case LWW_STRATEGIES.STRICT_TIMESTAMP:
      result = strictTimestampLWW(localSettings, serverSettings)
      break

    case LWW_STRATEGIES.FIELD_LEVEL_LWW:
      const fieldResult = fieldLevelLWW(localSettings, serverSettings, conflictAnalysis.differences)
      result = {
        strategy: fieldResult.strategy,
        action: fieldResult.summary.recommendedAction,
        confidence: fieldResult.summary.confidence,
        reasoning: `필드별 분석 결과: 로컬 ${fieldResult.summary.localWins}승, 서버 ${fieldResult.summary.serverWins}승`,
        details: fieldResult
      }
      break

    case LWW_STRATEGIES.SMART_MERGE:
      const mergeResult = smartMergeStrategy(localSettings, serverSettings, conflictAnalysis.differences)
      result = {
        strategy: mergeResult.strategy,
        action: mergeResult.requiresReview ? 'apply_merge_with_review' : 'apply_merge',
        confidence: mergeResult.confidence,
        reasoning: `스마트 병합 완료 (충돌 ${mergeResult.conflictCount}개)`,
        mergedSettings: mergeResult.mergedSettings,
        details: mergeResult
      }
      break

    case LWW_STRATEGIES.HYBRID_METADATA:
    default:
      // 하이브리드: 타임스탬프 먼저, 그다음 필드별 분석
      const timestampResult = strictTimestampLWW(localSettings, serverSettings)
      
      if (timestampResult.confidence >= CONFIDENCE_LEVELS.HIGH) {
        result = timestampResult
      } else {
        // 타임스탬프로 확실하지 않으면 필드별 분석
        const fieldFallback = fieldLevelLWW(localSettings, serverSettings, conflictAnalysis.differences)
        result = {
          strategy: LWW_STRATEGIES.HYBRID_METADATA,
          action: fieldFallback.summary.recommendedAction,
          confidence: Math.min(timestampResult.confidence, fieldFallback.summary.confidence),
          reasoning: `하이브리드 분석: 타임스탬프 불확실(${timestampResult.confidence}) → 필드별 분석 적용`,
          timestampAnalysis: timestampResult,
          fieldAnalysis: fieldFallback
        }
      }
      break
  }

  logInfo('종합적인 LWW 해결 완료', {
    strategy: result.strategy,
    action: result.action,
    confidence: result.confidence
  })

  return result
}
