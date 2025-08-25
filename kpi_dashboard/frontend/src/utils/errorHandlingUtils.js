// kpi_dashboard/frontend/src/utils/errorHandlingUtils.js

import { logInfo, logError, logWarn } from './loggingUtils';
import { toast } from 'sonner';

// ================================
// 에러 타입 및 심각도 정의
// ================================

export const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',           // 네트워크 연결 문제
  SERVER_ERROR: 'SERVER_ERROR',             // 서버 응답 에러 (5xx)
  CLIENT_ERROR: 'CLIENT_ERROR',             // 클라이언트 요청 에러 (4xx)
  DATA_CORRUPTION: 'DATA_CORRUPTION',       // 데이터 손상/파싱 에러
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',         // LocalStorage 용량 초과
  SYNC_CONFLICT: 'SYNC_CONFLICT',           // 동기화 충돌
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',           // 요청 타임아웃
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'            // 알 수 없는 에러
};

export const ERROR_SEVERITY = {
  LOW: 'low',           // 사용자에게 미미한 영향
  MEDIUM: 'medium',     // 일부 기능 제한
  HIGH: 'high',         // 주요 기능 장애
  CRITICAL: 'critical'  // 앱 사용 불가
};

export const RECOVERY_STRATEGIES = {
  RETRY: 'retry',                    // 재시도
  FALLBACK_LOCAL: 'fallback_local',  // 로컬 데이터로 폴백
  FALLBACK_DEFAULT: 'fallback_default', // 기본값으로 폴백
  USER_ACTION: 'user_action',        // 사용자 개입 필요
  IGNORE: 'ignore'                   // 무시 (로그만 기록)
};

// ================================
// 에러 분류 및 분석
// ================================

/**
 * 에러를 분석하여 타입, 심각도, 복구 전략을 결정합니다.
 * @param {Error|Object} error - 발생한 에러
 * @param {string} context - 에러 발생 컨텍스트 (예: 'sync', 'localStorage', 'api')
 * @returns {Object} 분석된 에러 정보
 */
export const analyzeError = (error, context = 'unknown') => {
  logInfo('에러 분석 시작', { error: error?.message, context });

  const analysis = {
    originalError: error,
    context,
    type: ERROR_TYPES.UNKNOWN_ERROR,
    severity: ERROR_SEVERITY.MEDIUM,
    recoveryStrategy: RECOVERY_STRATEGIES.USER_ACTION,
    isRetryable: false,
    userMessage: '알 수 없는 오류가 발생했습니다.',
    technicalDetails: error?.message || 'No error message',
    suggestions: [],
    estimatedRecoveryTime: null // ms
  };

  try {
    // 1. 네트워크 에러 분석
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('fetch') || !navigator.onLine) {
      analysis.type = ERROR_TYPES.NETWORK_ERROR;
      analysis.severity = ERROR_SEVERITY.HIGH;
      analysis.recoveryStrategy = RECOVERY_STRATEGIES.FALLBACK_LOCAL;
      analysis.isRetryable = true;
      analysis.userMessage = '네트워크 연결을 확인해주세요.';
      analysis.suggestions = ['Wi-Fi 또는 모바일 데이터 연결 상태 확인', '잠시 후 다시 시도'];
      analysis.estimatedRecoveryTime = 5000; // 5초 후 재시도
    }
    // 2. HTTP 상태 코드 기반 분석
    else if (error?.response?.status) {
      const status = error.response.status;
      if (status >= 500) {
        analysis.type = ERROR_TYPES.SERVER_ERROR;
        analysis.severity = ERROR_SEVERITY.HIGH;
        analysis.recoveryStrategy = RECOVERY_STRATEGIES.RETRY;
        analysis.isRetryable = true;
        analysis.userMessage = '서버에 일시적인 문제가 발생했습니다.';
        analysis.suggestions = ['잠시 후 다시 시도해주세요', '문제가 지속되면 관리자에게 문의'];
        analysis.estimatedRecoveryTime = 10000; // 10초 후 재시도
      } else if (status >= 400) {
        analysis.type = ERROR_TYPES.CLIENT_ERROR;
        analysis.severity = status === 404 ? ERROR_SEVERITY.LOW : ERROR_SEVERITY.MEDIUM;
        analysis.recoveryStrategy = status === 404 ? RECOVERY_STRATEGIES.FALLBACK_DEFAULT : RECOVERY_STRATEGIES.USER_ACTION;
        analysis.isRetryable = false;
        analysis.userMessage = status === 404 ? '요청한 데이터를 찾을 수 없습니다.' : '요청 처리 중 문제가 발생했습니다.';
        analysis.suggestions = ['페이지를 새로고침해보세요', '로그인 상태를 확인해주세요'];
      }
    }
    // 3. LocalStorage 관련 에러 분석
    else if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
      analysis.type = ERROR_TYPES.QUOTA_EXCEEDED;
      analysis.severity = ERROR_SEVERITY.MEDIUM;
      analysis.recoveryStrategy = RECOVERY_STRATEGIES.USER_ACTION;
      analysis.isRetryable = false;
      analysis.userMessage = '브라우저 저장 공간이 부족합니다.';
      analysis.suggestions = ['브라우저 캐시를 정리해주세요', '불필요한 데이터를 삭제해주세요'];
    }
    // 4. 데이터 파싱/손상 에러 분석
    else if (error?.name === 'SyntaxError' || error?.message?.includes('JSON') || error?.message?.includes('parse')) {
      analysis.type = ERROR_TYPES.DATA_CORRUPTION;
      analysis.severity = ERROR_SEVERITY.HIGH;
      analysis.recoveryStrategy = RECOVERY_STRATEGIES.FALLBACK_DEFAULT;
      analysis.isRetryable = false;
      analysis.userMessage = '저장된 설정 데이터에 문제가 있어 기본값으로 복원합니다.';
      analysis.suggestions = ['기본 설정으로 초기화됩니다', '이전 설정을 다시 구성해주세요'];
    }
    // 5. 타임아웃 에러 분석
    else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      analysis.type = ERROR_TYPES.TIMEOUT_ERROR;
      analysis.severity = ERROR_SEVERITY.MEDIUM;
      analysis.recoveryStrategy = RECOVERY_STRATEGIES.RETRY;
      analysis.isRetryable = true;
      analysis.userMessage = '요청 시간이 초과되었습니다.';
      analysis.suggestions = ['네트워크 연결 상태를 확인해주세요', '잠시 후 다시 시도해주세요'];
      analysis.estimatedRecoveryTime = 3000; // 3초 후 재시도
    }
    // 6. 동기화 충돌 에러 분석
    else if (context === 'sync' && (error?.message?.includes('conflict') || error?.message?.includes('concurrent'))) {
      analysis.type = ERROR_TYPES.SYNC_CONFLICT;
      analysis.severity = ERROR_SEVERITY.MEDIUM;
      analysis.recoveryStrategy = RECOVERY_STRATEGIES.USER_ACTION;
      analysis.isRetryable = true;
      analysis.userMessage = '설정 동기화 중 충돌이 발생했습니다.';
      analysis.suggestions = ['페이지를 새로고침하여 최신 데이터를 가져오세요', '다른 탭이나 기기에서 동시에 변경했는지 확인하세요'];
      analysis.estimatedRecoveryTime = 2000; // 2초 후 재시도
    }

    // 컨텍스트별 심각도 조정
    if (context === 'background_sync') {
      analysis.severity = Math.max(ERROR_SEVERITY.LOW, analysis.severity - 1); // 백그라운드 동기화는 심각도 낮춤
    } else if (context === 'initial_load') {
      analysis.severity = Math.min(ERROR_SEVERITY.CRITICAL, analysis.severity + 1); // 초기 로드는 심각도 높임
    }

    logInfo('에러 분석 완료', analysis);
    return analysis;

  } catch (analysisError) {
    logError('에러 분석 중 예외 발생', analysisError);
    analysis.technicalDetails = `Analysis failed: ${analysisError.message}`;
    return analysis;
  }
};

// ================================
// 에러 복구 전략 실행
// ================================

/**
 * 에러 분석 결과에 따라 적절한 복구 전략을 실행합니다.
 * @param {Object} errorAnalysis - analyzeError의 결과
 * @param {Object} context - 복구에 필요한 컨텍스트 정보
 * @returns {Promise<Object>} 복구 결과
 */
export const executeRecoveryStrategy = async (errorAnalysis, context = {}) => {
  const { recoveryStrategy, isRetryable, estimatedRecoveryTime } = errorAnalysis;
  const { retryFunction, fallbackData, defaultData, onUserAction } = context;

  logInfo('에러 복구 전략 실행', { strategy: recoveryStrategy, isRetryable });

  const result = {
    success: false,
    strategy: recoveryStrategy,
    data: null,
    requiresUserAction: false,
    message: '복구 시도 중...'
  };

  try {
    switch (recoveryStrategy) {
      case RECOVERY_STRATEGIES.RETRY:
        if (isRetryable && retryFunction) {
          if (estimatedRecoveryTime) {
            logInfo(`${estimatedRecoveryTime}ms 후 재시도`);
            await new Promise(resolve => setTimeout(resolve, estimatedRecoveryTime));
          }
          
          const retryResult = await retryFunction();
          result.success = !!retryResult;
          result.data = retryResult;
          result.message = result.success ? '재시도 성공' : '재시도 실패';
          
          logInfo('재시도 결과', { success: result.success });
        } else {
          result.message = '재시도 불가능한 에러입니다.';
          logWarn('재시도 조건 불충족', { isRetryable, hasRetryFunction: !!retryFunction });
        }
        break;

      case RECOVERY_STRATEGIES.FALLBACK_LOCAL:
        if (fallbackData) {
          result.success = true;
          result.data = fallbackData;
          result.message = '로컬 데이터로 복구했습니다.';
          logInfo('로컬 데이터 폴백 성공');
        } else {
          result.message = '로컬 폴백 데이터가 없습니다.';
          logWarn('로컬 폴백 데이터 없음');
        }
        break;

      case RECOVERY_STRATEGIES.FALLBACK_DEFAULT:
        if (defaultData) {
          result.success = true;
          result.data = defaultData;
          result.message = '기본값으로 복구했습니다.';
          logInfo('기본값 폴백 성공');
        } else {
          result.message = '기본값 데이터가 없습니다.';
          logWarn('기본값 데이터 없음');
        }
        break;

      case RECOVERY_STRATEGIES.USER_ACTION:
        result.requiresUserAction = true;
        result.message = '사용자 개입이 필요합니다.';
        if (onUserAction) {
          await onUserAction(errorAnalysis);
        }
        logInfo('사용자 액션 요청');
        break;

      case RECOVERY_STRATEGIES.IGNORE:
        result.success = true;
        result.message = '에러를 무시하고 계속 진행합니다.';
        logInfo('에러 무시');
        break;

      default:
        result.message = '알 수 없는 복구 전략입니다.';
        logError('알 수 없는 복구 전략', recoveryStrategy);
        break;
    }

    logInfo('에러 복구 전략 실행 완료', result);
    return result;

  } catch (recoveryError) {
    logError('에러 복구 중 예외 발생', recoveryError);
    return {
      ...result,
      success: false,
      message: `복구 중 오류 발생: ${recoveryError.message}`
    };
  }
};

// ================================
// 통합 에러 핸들러
// ================================

/**
 * 통합 에러 핸들러 - 에러 분석부터 복구까지 자동 처리
 * @param {Error|Object} error - 발생한 에러
 * @param {string} context - 에러 컨텍스트
 * @param {Object} recoveryContext - 복구 컨텍스트
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Object>} 처리 결과
 */
export const handleError = async (error, context = 'unknown', recoveryContext = {}, options = {}) => {
  const {
    showToast = true,
    logError: shouldLogError = true,
    autoRecover = true,
    maxRetries = 3
  } = options;

  let currentRetries = recoveryContext.currentRetries || 0;

  logInfo('통합 에러 핸들러 시작', { context, currentRetries, maxRetries });

  if (shouldLogError) {
    logError(`[${context}] 에러 발생`, error);
  }

  // 1. 에러 분석
  const analysis = analyzeError(error, context);

  // 2. 최대 재시도 횟수 체크
  if (analysis.isRetryable && currentRetries >= maxRetries) {
    analysis.isRetryable = false;
    analysis.recoveryStrategy = RECOVERY_STRATEGIES.USER_ACTION;
    analysis.userMessage = `최대 재시도 횟수(${maxRetries})를 초과했습니다. ${analysis.userMessage}`;
    logWarn('최대 재시도 횟수 초과', { currentRetries, maxRetries });
  }

  // 3. 사용자에게 토스트 알림 (옵션)
  if (showToast) {
    const toastType = analysis.severity === ERROR_SEVERITY.CRITICAL ? 'error' :
                     analysis.severity === ERROR_SEVERITY.HIGH ? 'error' :
                     analysis.severity === ERROR_SEVERITY.MEDIUM ? 'warning' : 'info';

    const toastOptions = {
      description: analysis.suggestions.join('. '),
      duration: analysis.severity === ERROR_SEVERITY.CRITICAL ? 10000 : 5000
    };

    // 재시도 가능한 경우 액션 버튼 추가
    if (analysis.isRetryable && recoveryContext.retryFunction) {
      toastOptions.action = {
        label: '다시 시도',
        onClick: () => {
          handleError(error, context, {
            ...recoveryContext,
            currentRetries: currentRetries + 1
          }, options);
        }
      };
    }

    toast[toastType](analysis.userMessage, toastOptions);
  }

  // 4. 자동 복구 시도 (옵션)
  let recoveryResult = null;
  if (autoRecover) {
    recoveryResult = await executeRecoveryStrategy(analysis, {
      ...recoveryContext,
      currentRetries
    });

    // 재시도에 실패했지만 재시도 가능한 경우, 재귀 호출
    if (!recoveryResult.success && analysis.isRetryable && currentRetries < maxRetries) {
      logInfo('재시도 준비', { nextRetry: currentRetries + 1 });
      return await handleError(error, context, {
        ...recoveryContext,
        currentRetries: currentRetries + 1
      }, options);
    }
  }

  const finalResult = {
    analysis,
    recovery: recoveryResult,
    handled: true,
    retryAttempts: currentRetries
  };

  logInfo('통합 에러 핸들러 완료', finalResult);
  return finalResult;
};

// ================================
// 특화된 에러 핸들러들
// ================================

/**
 * 동기화 관련 에러 전용 핸들러
 * @param {Error} error - 동기화 에러
 * @param {Function} syncFunction - 동기화 함수
 * @param {Object} fallbackData - 폴백 데이터
 * @returns {Promise<Object>} 처리 결과
 */
export const handleSyncError = async (error, syncFunction, fallbackData = null) => {
  return await handleError(error, 'sync', {
    retryFunction: syncFunction,
    fallbackData,
    onUserAction: async (analysis) => {
      // 동기화 에러 시 사용자 액션 - 페이지 새로고침 제안
      if (analysis.type === ERROR_TYPES.SYNC_CONFLICT) {
        const userConfirmed = window.confirm(
          '설정 동기화 충돌이 발생했습니다. 페이지를 새로고침하여 최신 데이터를 가져오시겠습니까?'
        );
        if (userConfirmed) {
          window.location.reload();
        }
      }
    }
  }, {
    showToast: true,
    maxRetries: 2 // 동기화는 재시도 횟수 제한
  });
};

/**
 * LocalStorage 관련 에러 전용 핸들러
 * @param {Error} error - LocalStorage 에러
 * @param {Object} defaultData - 기본 데이터
 * @returns {Promise<Object>} 처리 결과
 */
export const handleLocalStorageError = async (error, defaultData = null) => {
  return await handleError(error, 'localStorage', {
    defaultData,
    onUserAction: async (analysis) => {
      // LocalStorage 에러 시 사용자 액션
      if (analysis.type === ERROR_TYPES.QUOTA_EXCEEDED) {
        const userConfirmed = window.confirm(
          '브라우저 저장 공간이 부족합니다. 브라우저 설정에서 저장 공간을 정리하시겠습니까?'
        );
        if (userConfirmed) {
          // 브라우저 설정 페이지로 이동 (Chrome 기준)
          if (navigator.userAgent.includes('Chrome')) {
            window.open('chrome://settings/content/all');
          }
        }
      }
    }
  }, {
    showToast: true,
    maxRetries: 1, // LocalStorage는 재시도 의미 없음
    autoRecover: true
  });
};

/**
 * API 호출 관련 에러 전용 핸들러
 * @param {Error} error - API 에러
 * @param {Function} apiFunction - API 함수
 * @returns {Promise<Object>} 처리 결과
 */
export const handleApiError = async (error, apiFunction = null) => {
  return await handleError(error, 'api', {
    retryFunction: apiFunction,
    onUserAction: async (analysis) => {
      // API 에러 시 사용자 액션
      if (analysis.type === ERROR_TYPES.CLIENT_ERROR && error?.response?.status === 401) {
        const userConfirmed = window.confirm(
          '인증이 만료되었습니다. 로그인 페이지로 이동하시겠습니까?'
        );
        if (userConfirmed) {
          // 로그인 페이지로 리다이렉트 (구체적 경로는 앱에 따라 조정)
          window.location.href = '/login';
        }
      }
    }
  }, {
    showToast: true,
    maxRetries: 3,
    autoRecover: true
  });
};

// ================================
// 에러 상태 관리
// ================================

/**
 * 글로벌 에러 상태 관리를 위한 클래스
 */
export class ErrorStateManager {
  constructor() {
    this.errors = new Map(); // context -> error info
    this.listeners = new Set();
  }

  /**
   * 에러 상태 추가/업데이트
   * @param {string} context - 에러 컨텍스트
   * @param {Object} errorInfo - 에러 정보
   */
  setError(context, errorInfo) {
    this.errors.set(context, {
      ...errorInfo,
      timestamp: new Date().toISOString()
    });
    this._notifyListeners();
    logInfo('에러 상태 업데이트', { context, errorInfo });
  }

  /**
   * 에러 상태 제거
   * @param {string} context - 에러 컨텍스트
   */
  clearError(context) {
    const removed = this.errors.delete(context);
    if (removed) {
      this._notifyListeners();
      logInfo('에러 상태 제거', { context });
    }
  }

  /**
   * 모든 에러 상태 제거
   */
  clearAllErrors() {
    const count = this.errors.size;
    this.errors.clear();
    if (count > 0) {
      this._notifyListeners();
      logInfo('모든 에러 상태 제거', { count });
    }
  }

  /**
   * 특정 컨텍스트의 에러 상태 조회
   * @param {string} context - 에러 컨텍스트
   * @returns {Object|null} 에러 정보
   */
  getError(context) {
    return this.errors.get(context) || null;
  }

  /**
   * 모든 에러 상태 조회
   * @returns {Array} 에러 정보 배열
   */
  getAllErrors() {
    return Array.from(this.errors.entries()).map(([context, errorInfo]) => ({
      context,
      ...errorInfo
    }));
  }

  /**
   * 에러 상태 변경 리스너 등록
   * @param {Function} listener - 리스너 함수
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * 에러 상태 변경 리스너 제거
   * @param {Function} listener - 리스너 함수
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  _notifyListeners() {
    const errors = this.getAllErrors();
    this.listeners.forEach(listener => {
      try {
        listener(errors);
      } catch (error) {
        logError('에러 리스너 호출 중 예외', error);
      }
    });
  }
}

// 글로벌 에러 상태 매니저 인스턴스
export const globalErrorManager = new ErrorStateManager();

// ================================
// React Hook 지원
// ================================

/**
 * React Hook에서 사용할 수 있는 에러 핸들러
 * @param {string} context - 에러 컨텍스트
 * @returns {Function} 에러 핸들러 함수
 */
export const useErrorHandler = (context) => {
  const handleErrorInContext = async (error, recoveryContext = {}, options = {}) => {
    const result = await handleError(error, context, recoveryContext, options);
    
    // 글로벌 에러 상태 업데이트
    if (!result.recovery?.success) {
      globalErrorManager.setError(context, {
        analysis: result.analysis,
        recovery: result.recovery,
        retryAttempts: result.retryAttempts
      });
    } else {
      globalErrorManager.clearError(context);
    }
    
    return result;
  };

  return handleErrorInContext;
};

/**
 * 특정 에러 타입들을 무시하는 필터
 * @param {Array<string>} ignoredTypes - 무시할 에러 타입들
 * @returns {Function} 필터링된 에러 핸들러
 */
export const createErrorFilter = (ignoredTypes = []) => {
  return async (error, context, recoveryContext, options) => {
    const analysis = analyzeError(error, context);
    
    if (ignoredTypes.includes(analysis.type)) {
      logInfo('에러 타입이 무시 목록에 있어 스킵', { type: analysis.type, context });
      return {
        analysis,
        recovery: { success: true, strategy: RECOVERY_STRATEGIES.IGNORE, message: '무시된 에러' },
        handled: true,
        retryAttempts: 0
      };
    }
    
    return await handleError(error, context, recoveryContext, options);
  };
};
