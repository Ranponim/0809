// kpi_dashboard/frontend/src/utils/edgeCaseHandlers.js

import { logInfo, logError, logWarn, logDebug } from './loggingUtils';
import { 
  handleSyncError, 
  handleLocalStorageError, 
  ERROR_TYPES, 
  ERROR_SEVERITY,
  globalErrorManager 
} from './errorHandlingUtils';
import { 
  analyzeSettingsConflict, 
  CONFLICT_TYPES, 
  CONFLICT_SEVERITY 
} from './dataComparisonUtils';
import { 
  comprehensiveLWW, 
  LWW_STRATEGIES, 
  CONFIDENCE_LEVELS 
} from './lastWriteWinsUtils';
import { toast } from 'sonner';

// ================================
// 엣지 케이스 타입 정의
// ================================

export const EDGE_CASE_TYPES = {
  INITIAL_SYNC_FAILURE: 'initial_sync_failure',           // 초기 동기화 실패
  CONCURRENT_MODIFICATION: 'concurrent_modification',     // 동시 수정
  OFFLINE_TO_ONLINE: 'offline_to_online',                // 오프라인→온라인 복구
  CORRUPTED_LOCAL_DATA: 'corrupted_local_data',          // 로컬 데이터 손상
  SERVER_ROLLBACK: 'server_rollback',                    // 서버 데이터 롤백
  MULTI_TAB_CONFLICT: 'multi_tab_conflict',              // 멀티탭 충돌
  RAPID_CHANGES: 'rapid_changes',                        // 빠른 연속 변경
  QUOTA_EXCEEDED_RECOVERY: 'quota_exceeded_recovery',    // 저장소 용량 초과 복구
  NETWORK_INSTABILITY: 'network_instability',           // 네트워크 불안정
  STALE_DATA_DETECTION: 'stale_data_detection'          // 오래된 데이터 감지
};

// ================================
// 초기 동기화 실패 처리
// ================================

/**
 * 앱 초기 로드 시 서버 동기화에 실패한 경우의 엣지 케이스 처리
 * @param {Object} localSettings - 로컬 설정 데이터
 * @param {Error} syncError - 동기화 에러
 * @param {Object} context - 추가 컨텍스트
 * @returns {Promise<Object>} 처리 결과
 */
export const handleInitialSyncFailure = async (localSettings, syncError, context = {}) => {
  logInfo('초기 동기화 실패 엣지 케이스 처리 시작', { 
    hasLocalSettings: !!localSettings, 
    error: syncError?.message 
  });

  const result = {
    strategy: 'unknown',
    appliedSettings: null,
    requiresUserNotification: false,
    backgroundRetryScheduled: false,
    message: ''
  };

  try {
    // 1. 로컬 설정이 있는 경우: 로컬 우선 + 백그라운드 재시도
    if (localSettings) {
      logInfo('로컬 설정 감지 - 로컬 우선 모드로 진행');
      
      result.strategy = 'local_first_with_background_retry';
      result.appliedSettings = localSettings;
      result.requiresUserNotification = true;
      result.backgroundRetryScheduled = true;
      result.message = '서버 연결 실패로 로컬 설정을 사용합니다. 백그라운드에서 동기화를 재시도합니다.';

      // 백그라운드 재시도 스케줄링 (30초 후, 2분 후, 5분 후)
      const retrySchedule = [30000, 120000, 300000]; // 30s, 2m, 5m
      scheduleBackgroundRetry(context.syncFunction, retrySchedule);

      // 사용자에게 알림
      toast.warning('서버 연결 실패', {
        description: '로컬에 저장된 설정을 사용합니다. 네트워크 연결을 확인해주세요.',
        duration: 8000,
        action: {
          label: '재시도',
          onClick: async () => {
            try {
              await context.syncFunction?.();
              toast.success('서버 동기화 성공');
            } catch (error) {
              toast.error('재시도 실패: ' + error.message);
            }
          }
        }
      });
    } 
    // 2. 로컬 설정이 없는 경우: 기본값 + 즉시 재시도
    else {
      logInfo('로컬 설정 없음 - 기본값 + 즉시 재시도 모드');
      
      result.strategy = 'default_with_immediate_retry';
      result.appliedSettings = context.defaultSettings || null;
      result.requiresUserNotification = true;
      result.backgroundRetryScheduled = false;
      result.message = '서버와 로컬 설정을 모두 사용할 수 없어 기본값을 적용합니다.';

      // 즉시 재시도 (3회)
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        retryCount++;
        logInfo(`초기 동기화 재시도 ${retryCount}/${maxRetries}`);
        
        try {
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // 지수 백오프
          const syncResult = await context.syncFunction?.();
          
          if (syncResult) {
            result.strategy = 'immediate_retry_success';
            result.appliedSettings = syncResult;
            result.requiresUserNotification = false;
            result.message = '재시도를 통해 서버 동기화에 성공했습니다.';
            
            toast.success('서버 연결 복구됨');
            logInfo('초기 동기화 재시도 성공');
            break;
          }
        } catch (retryError) {
          logWarn(`재시도 ${retryCount} 실패`, retryError.message);
          
          if (retryCount === maxRetries) {
            toast.error('서버 연결 실패', {
              description: '네트워크 연결을 확인하고 페이지를 새로고침해주세요.',
              duration: 10000
            });
          }
        }
      }
    }

    // 3. 글로벌 에러 상태 업데이트
    globalErrorManager.setError('initial_sync', {
      type: EDGE_CASE_TYPES.INITIAL_SYNC_FAILURE,
      strategy: result.strategy,
      timestamp: new Date().toISOString(),
      retryScheduled: result.backgroundRetryScheduled
    });

    logInfo('초기 동기화 실패 처리 완료', result);
    return result;

  } catch (handlerError) {
    logError('초기 동기화 실패 핸들러에서 예외 발생', handlerError);
    
    return {
      strategy: 'error_fallback',
      appliedSettings: context.defaultSettings || null,
      requiresUserNotification: true,
      backgroundRetryScheduled: false,
      message: `처리 중 오류 발생: ${handlerError.message}`
    };
  }
};

// ================================
// 동시 수정 감지 및 처리
// ================================

/**
 * 여러 탭이나 디바이스에서 동시에 설정을 수정한 경우 처리
 * @param {Object} localSettings - 현재 로컬 설정
 * @param {Object} serverSettings - 서버 설정
 * @param {Array} detectedSources - 감지된 변경 소스들
 * @returns {Promise<Object>} 처리 결과
 */
export const handleConcurrentModification = async (localSettings, serverSettings, detectedSources = []) => {
  logInfo('동시 수정 엣지 케이스 처리 시작', { 
    sources: detectedSources,
    hasLocal: !!localSettings,
    hasServer: !!serverSettings
  });

  try {
    // 1. 충돌 분석 수행
    const conflictAnalysis = analyzeSettingsConflict(localSettings, serverSettings);
    
    if (!conflictAnalysis.hasConflict) {
      logInfo('동시 수정 감지되었으나 실제 충돌 없음');
      return {
        strategy: 'no_actual_conflict',
        resolvedSettings: localSettings,
        requiresUserAction: false,
        message: '동시 수정이 감지되었으나 실제 충돌은 없습니다.'
      };
    }

    // 2. 충돌 심각도에 따른 처리 전략 결정
    const { severity, differences } = conflictAnalysis;
    let strategy = 'unknown';
    let requiresUserAction = false;
    let resolvedSettings = null;

    if (severity === CONFLICT_SEVERITY.LOW || severity === CONFLICT_SEVERITY.MEDIUM) {
      // 중간 이하 심각도: 자동 LWW 해결 시도
      logInfo('중간 이하 심각도 충돌 - 자동 LWW 해결 시도');
      
      const lwwResult = comprehensiveLWW(
        localSettings, 
        serverSettings, 
        conflictAnalysis, 
        LWW_STRATEGIES.SMART_MERGE
      );

      if (lwwResult.confidence >= CONFIDENCE_LEVELS.MEDIUM) {
        strategy = 'auto_lww_resolution';
        resolvedSettings = lwwResult.mergedSettings || 
                          (lwwResult.action === 'apply_local' ? localSettings : serverSettings);
        requiresUserAction = false;

        // 사용자에게 자동 해결 알림
        toast.info('동시 수정 감지됨', {
          description: `${differences.length}개 차이점을 자동으로 해결했습니다.`,
          duration: 5000
        });

        logInfo('자동 LWW 해결 성공', lwwResult);
      } else {
        strategy = 'low_confidence_manual';
        requiresUserAction = true;
        
        toast.warning('동시 수정 충돌', {
          description: '자동 해결이 어려워 사용자 확인이 필요합니다.',
          duration: 8000,
          action: {
            label: '해결하기',
            onClick: () => showConflictResolutionDialog(conflictAnalysis, lwwResult)
          }
        });
      }
    } else {
      // 높은 심각도: 사용자 개입 필수
      logInfo('높은 심각도 충돌 - 사용자 개입 필수');
      
      strategy = 'high_severity_manual';
      requiresUserAction = true;

      toast.error('심각한 설정 충돌', {
        description: '중요한 설정에 충돌이 발생했습니다. 즉시 확인이 필요합니다.',
        duration: 10000,
        action: {
          label: '해결하기',
          onClick: () => showConflictResolutionDialog(conflictAnalysis)
        }
      });
    }

    // 3. 동시 수정 이벤트 로깅 (분석용)
    logConcurrentModificationEvent({
      sources: detectedSources,
      conflictType: conflictAnalysis.conflictType,
      severity: conflictAnalysis.severity,
      differenceCount: differences.length,
      strategy,
      autoResolved: !requiresUserAction
    });

    const result = {
      strategy,
      resolvedSettings,
      requiresUserAction,
      conflictAnalysis,
      message: `동시 수정 감지: ${strategy} 전략 적용`
    };

    logInfo('동시 수정 처리 완료', result);
    return result;

  } catch (error) {
    logError('동시 수정 처리 중 예외 발생', error);
    
    return {
      strategy: 'error_fallback',
      resolvedSettings: localSettings, // 안전한 폴백
      requiresUserAction: true,
      message: `처리 중 오류 발생: ${error.message}`
    };
  }
};

// ================================
// 오프라인→온라인 복구 처리
// ================================

/**
 * 오프라인 상태에서 온라인으로 복구될 때의 데이터 동기화 처리
 * @param {Object} offlineChanges - 오프라인 중 변경된 데이터
 * @param {number} offlineDuration - 오프라인 지속 시간 (ms)
 * @param {Object} context - 동기화 컨텍스트
 * @returns {Promise<Object>} 처리 결과
 */
export const handleOfflineToOnlineRecovery = async (offlineChanges, offlineDuration, context = {}) => {
  logInfo('오프라인→온라인 복구 엣지 케이스 처리 시작', { 
    hasOfflineChanges: !!offlineChanges,
    offlineDuration: `${Math.round(offlineDuration / 1000)}초`
  });

  try {
    const result = {
      strategy: 'unknown',
      syncResult: null,
      dataLoss: false,
      conflictCount: 0,
      message: ''
    };

    // 1. 오프라인 지속 시간에 따른 위험도 평가
    const riskLevel = assessOfflineRisk(offlineDuration, offlineChanges);
    logInfo('오프라인 위험도 평가', riskLevel);

    // 2. 서버에서 최신 데이터 조회
    let serverData = null;
    try {
      serverData = await context.fetchServerData?.();
      logInfo('서버 데이터 조회 성공');
    } catch (fetchError) {
      logWarn('서버 데이터 조회 실패', fetchError.message);
      
      // 서버 조회 실패 시 로컬 변경사항만 적용
      result.strategy = 'local_only_recovery';
      result.syncResult = offlineChanges;
      result.message = '서버 연결 실패로 로컬 변경사항만 적용합니다.';
      
      toast.warning('부분 복구', {
        description: '서버 연결이 불안정하여 로컬 변경사항만 적용했습니다.',
        duration: 6000
      });
      
      return result;
    }

    // 3. 위험도별 복구 전략 수행
    switch (riskLevel.level) {
      case 'low':
        // 위험도 낮음: 자동 동기화
        result.strategy = 'auto_sync';
        result.syncResult = await performAutoSync(offlineChanges, serverData, context);
        result.message = '자동으로 동기화되었습니다.';
        
        toast.success('온라인 복구', {
          description: '오프라인 중 변경사항이 자동으로 동기화되었습니다.',
          duration: 4000
        });
        break;

      case 'medium':
        // 위험도 중간: 조건부 자동 동기화
        const quickAnalysis = analyzeSettingsConflict(offlineChanges, serverData);
        
        if (quickAnalysis.severity <= CONFLICT_SEVERITY.MEDIUM) {
          result.strategy = 'conditional_auto_sync';
          result.syncResult = await performAutoSync(offlineChanges, serverData, context);
          result.conflictCount = quickAnalysis.differences.length;
          result.message = `${quickAnalysis.differences.length}개 차이점을 자동으로 해결했습니다.`;
          
          toast.info('조건부 동기화', {
            description: `${quickAnalysis.differences.length}개 차이점이 있었으나 자동으로 해결되었습니다.`,
            duration: 5000
          });
        } else {
          result.strategy = 'manual_review_required';
          result.message = '복잡한 충돌로 인해 수동 검토가 필요합니다.';
          
          await showOfflineRecoveryDialog(offlineChanges, serverData, riskLevel);
        }
        break;

      case 'high':
        // 위험도 높음: 반드시 사용자 확인
        result.strategy = 'mandatory_manual_review';
        result.message = '장기간 오프라인으로 인해 수동 확인이 필요합니다.';
        
        toast.error('복잡한 오프라인 복구', {
          description: '장기간 오프라인으로 인해 데이터 검토가 필요합니다.',
          duration: 10000,
          action: {
            label: '검토하기',
            onClick: () => showOfflineRecoveryDialog(offlineChanges, serverData, riskLevel)
          }
        });
        break;
    }

    // 4. 복구 이벤트 로깅
    logOfflineRecoveryEvent({
      offlineDuration,
      riskLevel: riskLevel.level,
      strategy: result.strategy,
      conflictCount: result.conflictCount,
      dataLoss: result.dataLoss
    });

    logInfo('오프라인→온라인 복구 완료', result);
    return result;

  } catch (error) {
    logError('오프라인→온라인 복구 중 예외 발생', error);
    
    return {
      strategy: 'error_fallback',
      syncResult: offlineChanges, // 최소한 로컬 변경사항은 보존
      dataLoss: false,
      conflictCount: 0,
      message: `복구 중 오류 발생: ${error.message}`
    };
  }
};

// ================================
// 멀티탭 충돌 처리
// ================================

/**
 * 동일 브라우저의 여러 탭에서 동시에 설정을 변경한 경우 처리
 * @param {Array} tabChanges - 각 탭의 변경사항
 * @param {string} currentTabId - 현재 탭 ID
 * @returns {Promise<Object>} 처리 결과
 */
export const handleMultiTabConflict = async (tabChanges, currentTabId) => {
  logInfo('멀티탭 충돌 엣지 케이스 처리 시작', { 
    tabCount: tabChanges.length,
    currentTabId 
  });

  try {
    // 1. 탭별 변경사항 시간순 정렬
    const sortedChanges = tabChanges
      .filter(change => change.tabId !== currentTabId) // 현재 탭 제외
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // 최신순

    if (sortedChanges.length === 0) {
      logInfo('다른 탭의 변경사항 없음');
      return {
        strategy: 'no_conflict',
        resolvedSettings: null,
        message: '멀티탭 충돌 없음'
      };
    }

    // 2. 가장 최근 변경사항 식별
    const latestChange = sortedChanges[0];
    const timeDifference = Date.now() - new Date(latestChange.timestamp).getTime();

    logInfo('멀티탭 충돌 분석', {
      latestChangeTab: latestChange.tabId,
      timeDifference: `${Math.round(timeDifference / 1000)}초 전`,
      conflictingTabs: sortedChanges.length
    });

    // 3. 시간 차이에 따른 처리 전략
    let strategy = 'unknown';
    let resolvedSettings = null;

    if (timeDifference < 5000) { // 5초 이내 변경
      // 매우 최근 변경: 다른 탭 우선
      strategy = 'other_tab_priority';
      resolvedSettings = latestChange.settings;
      
      toast.info('다른 탭 변경 감지', {
        description: '다른 탭에서 최근에 변경된 설정을 적용합니다.',
        duration: 4000,
        action: {
          label: '되돌리기',
          onClick: () => {
            // 현재 탭의 변경사항으로 되돌리기
            logInfo('사용자가 멀티탭 충돌 해결을 되돌림');
          }
        }
      });
    } else if (timeDifference < 30000) { // 30초 이내 변경
      // 최근 변경: 사용자 선택
      strategy = 'user_choice_required';
      
      const userChoice = await showMultiTabConflictDialog(latestChange, currentTabId);
      resolvedSettings = userChoice.selectedSettings;
      
      logInfo('사용자 멀티탭 충돌 해결', userChoice);
    } else {
      // 오래된 변경: 현재 탭 우선
      strategy = 'current_tab_priority';
      resolvedSettings = null; // 현재 탭 설정 유지
      
      logInfo('오래된 멀티탭 변경사항 무시');
    }

    // 4. 다른 탭들에게 동기화 신호 전송
    await broadcastToOtherTabs({
      type: 'MULTI_TAB_CONFLICT_RESOLVED',
      resolvedSettings,
      strategy,
      currentTabId
    });

    const result = {
      strategy,
      resolvedSettings,
      conflictingTabCount: sortedChanges.length,
      message: `멀티탭 충돌 해결: ${strategy}`
    };

    logInfo('멀티탭 충돌 처리 완료', result);
    return result;

  } catch (error) {
    logError('멀티탭 충돌 처리 중 예외 발생', error);
    
    return {
      strategy: 'error_fallback',
      resolvedSettings: null,
      conflictingTabCount: 0,
      message: `처리 중 오류 발생: ${error.message}`
    };
  }
};

// ================================
// 헬퍼 함수들
// ================================

/**
 * 백그라운드 재시도 스케줄링
 */
const scheduleBackgroundRetry = (syncFunction, retrySchedule) => {
  if (!syncFunction || !Array.isArray(retrySchedule)) return;

  retrySchedule.forEach((delay, index) => {
    setTimeout(async () => {
      try {
        logInfo(`백그라운드 재시도 ${index + 1}/${retrySchedule.length} 실행`);
        const result = await syncFunction();
        
        if (result) {
          logInfo('백그라운드 재시도 성공');
          toast.success('서버 동기화 복구됨');
          globalErrorManager.clearError('initial_sync');
        }
      } catch (error) {
        logWarn(`백그라운드 재시도 ${index + 1} 실패`, error.message);
        
        if (index === retrySchedule.length - 1) {
          logError('모든 백그라운드 재시도 실패');
        }
      }
    }, delay);
  });
};

/**
 * 오프라인 위험도 평가
 */
const assessOfflineRisk = (duration, changes) => {
  const hours = duration / (1000 * 60 * 60);
  const changeCount = Object.keys(changes || {}).length;

  if (hours < 1 && changeCount < 5) {
    return { level: 'low', reason: '단시간 오프라인, 적은 변경사항' };
  } else if (hours < 24 && changeCount < 20) {
    return { level: 'medium', reason: '중간 시간 오프라인 또는 중간 변경사항' };
  } else {
    return { level: 'high', reason: '장시간 오프라인 또는 많은 변경사항' };
  }
};

/**
 * 자동 동기화 수행
 */
const performAutoSync = async (localChanges, serverData, context) => {
  try {
    // 기본적으로 LWW 전략 사용
    const conflictAnalysis = analyzeSettingsConflict(localChanges, serverData);
    
    if (!conflictAnalysis.hasConflict) {
      return localChanges; // 충돌 없음
    }

    const lwwResult = comprehensiveLWW(
      localChanges, 
      serverData, 
      conflictAnalysis, 
      LWW_STRATEGIES.HYBRID_METADATA
    );

    if (lwwResult.action === 'apply_local') {
      await context.saveToServer?.(localChanges);
      return localChanges;
    } else if (lwwResult.action === 'apply_server') {
      return serverData;
    } else if (lwwResult.mergedSettings) {
      await context.saveToServer?.(lwwResult.mergedSettings);
      return lwwResult.mergedSettings;
    }

    return localChanges; // 폴백
  } catch (error) {
    logError('자동 동기화 실패', error);
    return localChanges; // 안전한 폴백
  }
};

/**
 * 다른 탭들에게 브로드캐스트
 */
const broadcastToOtherTabs = async (message) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // LocalStorage 이벤트를 통한 탭 간 통신
      const broadcastData = {
        ...message,
        timestamp: new Date().toISOString(),
        broadcasterTabId: generateTabId()
      };
      
      localStorage.setItem('tab_broadcast', JSON.stringify(broadcastData));
      
      // 즉시 제거하여 다음 브로드캐스트를 위해 준비
      setTimeout(() => {
        localStorage.removeItem('tab_broadcast');
      }, 100);
      
      logDebug('다른 탭들에게 브로드캐스트 전송', broadcastData);
    }
  } catch (error) {
    logWarn('탭 브로드캐스트 실패', error.message);
  }
};

/**
 * 탭 ID 생성
 */
const generateTabId = () => {
  if (typeof window !== 'undefined') {
    if (!window.tabId) {
      window.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return window.tabId;
  }
  return 'unknown_tab';
};

// ================================
// 이벤트 로깅 함수들
// ================================

const logConcurrentModificationEvent = (eventData) => {
  logInfo('[ANALYTICS] 동시 수정 이벤트', {
    event: 'concurrent_modification',
    ...eventData,
    timestamp: new Date().toISOString()
  });
};

const logOfflineRecoveryEvent = (eventData) => {
  logInfo('[ANALYTICS] 오프라인 복구 이벤트', {
    event: 'offline_recovery',
    ...eventData,
    timestamp: new Date().toISOString()
  });
};

// ================================
// UI 다이얼로그 함수들 (구현 예정)
// ================================

const showConflictResolutionDialog = async (conflictAnalysis, lwwResult = null) => {
  // TODO: 충돌 해결 다이얼로그 구현
  logInfo('충돌 해결 다이얼로그 표시 요청', { conflictAnalysis, lwwResult });
  return new Promise(resolve => {
    // 임시로 confirm 사용
    const userChoice = confirm('설정 충돌이 발생했습니다. 로컬 설정을 적용하시겠습니까?');
    resolve(userChoice ? 'local' : 'server');
  });
};

const showOfflineRecoveryDialog = async (offlineChanges, serverData, riskLevel) => {
  // TODO: 오프라인 복구 다이얼로그 구현
  logInfo('오프라인 복구 다이얼로그 표시 요청', { riskLevel });
  return new Promise(resolve => {
    const userChoice = confirm('오프라인 중 변경된 설정이 있습니다. 서버와 동기화하시겠습니까?');
    resolve(userChoice ? 'sync' : 'keep_local');
  });
};

const showMultiTabConflictDialog = async (latestChange, currentTabId) => {
  // TODO: 멀티탭 충돌 다이얼로그 구현
  logInfo('멀티탭 충돌 다이얼로그 표시 요청', { latestChange, currentTabId });
  return new Promise(resolve => {
    const userChoice = confirm('다른 탭에서 설정이 변경되었습니다. 해당 변경사항을 적용하시겠습니까?');
    resolve({
      selectedSettings: userChoice ? latestChange.settings : null,
      choice: userChoice ? 'other_tab' : 'current_tab'
    });
  });
};
