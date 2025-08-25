/**
 * Background Synchronization Utilities
 * 
 * Task 8.4: 백그라운드 동기화 메커니즘 개발
 * 지속적인 클라이언트-서버 동기화를 위한 유틸리티 함수들
 */

import { logInfo, logDebug, logError } from './loggingUtils.js'
import { SYNC_STRATEGIES, SYNC_STATES } from './constants.js'

/**
 * 백그라운드 동기화 매니저 클래스
 */
export class BackgroundSyncManager {
  constructor(options = {}) {
    // 기본 설정
    this.options = {
      strategy: SYNC_STRATEGIES.HYBRID,
      pollingInterval: 30000,               // 30초
      maxRetries: 3,
      retryDelay: 5000,                     // 5초
      onlineCheckInterval: 10000,           // 10초
      changeDebounceTime: 2000,             // 2초
      visibilityChangeDelay: 1000,          // 1초
      maxBackoffDelay: 300000,              // 5분
      enableLogging: true,
      ...options
    }

    // 상태 관리
    this.state = SYNC_STATES.IDLE
    this.isOnline = navigator.onLine
    this.retryCount = 0
    this.lastSyncTime = null
    this.currentStrategy = this.options.strategy

    // 타이머 및 핸들러
    this.pollingTimer = null
    this.changeTimer = null
    this.visibilityTimer = null
    this.onlineCheckTimer = null

    // 콜백 함수들
    this.syncCallback = null
    this.changeDetector = null
    this.stateChangeCallback = null

    // 이벤트 리스너 바인딩
    this._setupEventListeners()

    logInfo('백그라운드 동기화 매니저 초기화', {
      strategy: this.options.strategy,
      pollingInterval: this.options.pollingInterval
    })
  }

  /**
   * 이벤트 리스너 설정
   */
  _setupEventListeners() {
    // 온라인/오프라인 상태 감지
    window.addEventListener('online', this._handleOnline.bind(this))
    window.addEventListener('offline', this._handleOffline.bind(this))

    // 페이지 가시성 변경 감지
    document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this))

    // 포커스 이벤트
    window.addEventListener('focus', this._handleWindowFocus.bind(this))
    window.addEventListener('blur', this._handleWindowBlur.bind(this))

    // 페이지 언로드 시 정리
    window.addEventListener('beforeunload', this._cleanup.bind(this))

    logDebug('백그라운드 동기화 이벤트 리스너 설정 완료')
  }

  /**
   * 동기화 시작
   * @param {Function} syncCallback - 동기화 실행 함수
   * @param {Function} changeDetector - 변경 감지 함수
   * @param {Function} stateChangeCallback - 상태 변경 콜백
   */
  start(syncCallback, changeDetector, stateChangeCallback) {
    if (this.state !== SYNC_STATES.IDLE) {
      logInfo('백그라운드 동기화가 이미 실행 중입니다')
      return
    }

    this.syncCallback = syncCallback
    this.changeDetector = changeDetector
    this.stateChangeCallback = stateChangeCallback

    this._setState(SYNC_STATES.POLLING)

    // 전략별 시작
    switch (this.currentStrategy) {
      case SYNC_STRATEGIES.PERIODIC_POLLING:
        this._startPeriodicPolling()
        break

      case SYNC_STRATEGIES.VISIBILITY_BASED:
        this._startVisibilityBased()
        break

      case SYNC_STRATEGIES.CHANGE_TRIGGERED:
        this._startChangeTriggered()
        break

      case SYNC_STRATEGIES.HYBRID:
        this._startHybridSync()
        break

      default:
        logError('알 수 없는 동기화 전략', this.currentStrategy)
        break
    }

    // 온라인 상태 주기적 확인
    this._startOnlineCheck()

    logInfo('백그라운드 동기화 시작', {
      strategy: this.currentStrategy,
      isOnline: this.isOnline
    })
  }

  /**
   * 동기화 중지
   */
  stop() {
    this._setState(SYNC_STATES.IDLE)
    this._cleanup()
    logInfo('백그라운드 동기화 중지')
  }

  /**
   * 수동 동기화 실행
   * @returns {Promise<boolean>} 성공 여부
   */
  async forcSync() {
    if (!this.isOnline) {
      logInfo('오프라인 상태로 수동 동기화 불가')
      return false
    }

    return await this._executeSync(true)
  }

  /**
   * 주기적 폴링 시작
   */
  _startPeriodicPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
    }

    this.pollingTimer = setInterval(async () => {
      if (this.isOnline && this.state === SYNC_STATES.POLLING) {
        await this._executeSync()
      }
    }, this.options.pollingInterval)

    logDebug('주기적 폴링 시작', { interval: this.options.pollingInterval })
  }

  /**
   * 가시성 기반 동기화 시작
   */
  _startVisibilityBased() {
    // 페이지가 보일 때만 동기화
    if (!document.hidden && this.isOnline) {
      this._scheduleVisibilitySync()
    }
  }

  /**
   * 변경 감지 기반 동기화 시작
   */
  _startChangeTriggered() {
    this._startChangeDetection()
  }

  /**
   * 하이브리드 동기화 시작
   */
  _startHybridSync() {
    // 주기적 폴링 + 변경 감지 + 가시성 기반
    this._startPeriodicPolling()
    this._startChangeDetection()
    this._startVisibilityBased()
  }

  /**
   * 변경 감지 시작
   */
  _startChangeDetection() {
    if (!this.changeDetector) {
      logDebug('변경 감지 함수가 없어 변경 감지 동기화를 건너뜁니다')
      return
    }

    // 주기적으로 변경 사항 확인
    const checkChanges = async () => {
      try {
        if (this.isOnline && this.changeDetector) {
          const hasChanges = await this.changeDetector()
          if (hasChanges) {
            logDebug('변경 사항 감지됨 - 동기화 실행')
            await this._executeSync()
          }
        }
      } catch (error) {
        logError('변경 감지 중 오류', error)
      }

      // 다음 체크 스케줄링
      if (this.state === SYNC_STATES.POLLING) {
        this.changeTimer = setTimeout(checkChanges, this.options.changeDebounceTime)
      }
    }

    checkChanges()
  }

  /**
   * 온라인 상태 주기적 확인
   */
  _startOnlineCheck() {
    if (this.onlineCheckTimer) {
      clearInterval(this.onlineCheckTimer)
    }

    this.onlineCheckTimer = setInterval(() => {
      const wasOnline = this.isOnline
      this.isOnline = navigator.onLine

      if (!wasOnline && this.isOnline) {
        logInfo('온라인 상태 복구 - 동기화 재시작')
        this._handleOnline()
      } else if (wasOnline && !this.isOnline) {
        logInfo('오프라인 상태 감지')
        this._handleOffline()
      }
    }, this.options.onlineCheckInterval)
  }

  /**
   * 가시성 변경 기반 동기화 스케줄링
   */
  _scheduleVisibilitySync() {
    if (this.visibilityTimer) {
      clearTimeout(this.visibilityTimer)
    }

    this.visibilityTimer = setTimeout(async () => {
      if (!document.hidden && this.isOnline && this.state === SYNC_STATES.POLLING) {
        await this._executeSync()
      }
    }, this.options.visibilityChangeDelay)
  }

  /**
   * 동기화 실행
   * @param {boolean} isManual - 수동 실행 여부
   * @returns {Promise<boolean>} 성공 여부
   */
  async _executeSync(isManual = false) {
    if (this.state === SYNC_STATES.SYNCING) {
      logDebug('이미 동기화 중이므로 건너뜁니다')
      return false
    }

    if (!this.isOnline) {
      logDebug('오프라인 상태로 동기화 건너뜀')
      return false
    }

    if (!this.syncCallback) {
      logError('동기화 콜백이 설정되지 않음')
      return false
    }

    const prevState = this.state
    this._setState(SYNC_STATES.SYNCING)

    try {
      logDebug('백그라운드 동기화 실행 시작', { isManual })

      const result = await this.syncCallback()
      
      this.lastSyncTime = new Date().toISOString()
      this.retryCount = 0 // 성공 시 재시도 카운트 리셋

      logInfo('백그라운드 동기화 성공', {
        isManual,
        lastSyncTime: this.lastSyncTime
      })

      this._setState(prevState) // 이전 상태로 복원
      return true

    } catch (error) {
      logError('백그라운드 동기화 실패', error)

      this.retryCount++

      if (this.retryCount >= this.options.maxRetries) {
        logError('최대 재시도 횟수 초과', {
          retryCount: this.retryCount,
          maxRetries: this.options.maxRetries
        })
        this._setState(SYNC_STATES.ERROR)
        
        // 백오프 딜레이 후 상태 복원
        setTimeout(() => {
          if (this.state === SYNC_STATES.ERROR) {
            this.retryCount = 0
            this._setState(SYNC_STATES.POLLING)
          }
        }, this._getBackoffDelay())
      } else {
        // 재시도 스케줄링
        setTimeout(async () => {
          await this._executeSync(isManual)
        }, this.options.retryDelay)
        
        this._setState(SYNC_STATES.WAITING)
      }

      return false
    }
  }

  /**
   * 백오프 딜레이 계산
   * @returns {number} 딜레이 시간 (ms)
   */
  _getBackoffDelay() {
    const delay = Math.min(
      this.options.retryDelay * Math.pow(2, this.retryCount - 1),
      this.options.maxBackoffDelay
    )
    return delay
  }

  /**
   * 상태 변경
   * @param {string} newState - 새로운 상태
   */
  _setState(newState) {
    const oldState = this.state
    this.state = newState

    if (this.options.enableLogging && oldState !== newState) {
      logDebug('동기화 상태 변경', { from: oldState, to: newState })
    }

    if (this.stateChangeCallback) {
      try {
        this.stateChangeCallback(newState, oldState)
      } catch (error) {
        logError('상태 변경 콜백 오류', error)
      }
    }
  }

  /**
   * 온라인 상태 핸들러
   */
  _handleOnline() {
    this.isOnline = true
    if (this.state === SYNC_STATES.OFFLINE) {
      this._setState(SYNC_STATES.POLLING)
      // 온라인 복구 시 즉시 동기화
      setTimeout(() => this._executeSync(), 100)
    }
    logInfo('온라인 상태로 변경')
  }

  /**
   * 오프라인 상태 핸들러
   */
  _handleOffline() {
    this.isOnline = false
    if (this.state !== SYNC_STATES.OFFLINE) {
      this._setState(SYNC_STATES.OFFLINE)
    }
    logInfo('오프라인 상태로 변경')
  }

  /**
   * 가시성 변경 핸들러
   */
  _handleVisibilityChange() {
    if (document.hidden) {
      logDebug('페이지가 백그라운드로 이동')
      // 필요시 동기화 일시 중지 로직
    } else {
      logDebug('페이지가 포그라운드로 이동')
      if (this.currentStrategy === SYNC_STRATEGIES.VISIBILITY_BASED || 
          this.currentStrategy === SYNC_STRATEGIES.HYBRID) {
        this._scheduleVisibilitySync()
      }
    }
  }

  /**
   * 윈도우 포커스 핸들러
   */
  _handleWindowFocus() {
    logDebug('윈도우 포커스 획득')
    if (this.isOnline) {
      setTimeout(() => this._executeSync(), 500)
    }
  }

  /**
   * 윈도우 블러 핸들러
   */
  _handleWindowBlur() {
    logDebug('윈도우 포커스 상실')
  }

  /**
   * 리소스 정리
   */
  _cleanup() {
    // 모든 타이머 정리
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }

    if (this.changeTimer) {
      clearTimeout(this.changeTimer)
      this.changeTimer = null
    }

    if (this.visibilityTimer) {
      clearTimeout(this.visibilityTimer)
      this.visibilityTimer = null
    }

    if (this.onlineCheckTimer) {
      clearInterval(this.onlineCheckTimer)
      this.onlineCheckTimer = null
    }

    logDebug('백그라운드 동기화 리소스 정리 완료')
  }

  /**
   * 현재 상태 정보 반환
   * @returns {Object} 상태 정보
   */
  getStatus() {
    return {
      state: this.state,
      isOnline: this.isOnline,
      strategy: this.currentStrategy,
      lastSyncTime: this.lastSyncTime,
      retryCount: this.retryCount,
      options: { ...this.options }
    }
  }

  /**
   * 전략 변경
   * @param {string} newStrategy - 새로운 전략
   */
  changeStrategy(newStrategy) {
    if (this.currentStrategy === newStrategy) {
      return
    }

    logInfo('동기화 전략 변경', {
      from: this.currentStrategy,
      to: newStrategy
    })

    this._cleanup()
    this.currentStrategy = newStrategy

    if (this.state !== SYNC_STATES.IDLE) {
      // 새로운 전략으로 재시작
      setTimeout(() => {
        this.start(this.syncCallback, this.changeDetector, this.stateChangeCallback)
      }, 100)
    }
  }
}

/**
 * 간소화된 백그라운드 동기화 생성 함수
 * @param {Object} options - 설정 옵션
 * @returns {BackgroundSyncManager} 동기화 매니저 인스턴스
 */
export const createBackgroundSync = (options = {}) => {
  return new BackgroundSyncManager(options)
}

/**
 * 변경 사항 디바운싱 함수
 * @param {Function} func - 실행할 함수
 * @param {number} delay - 딜레이 시간
 * @returns {Function} 디바운스된 함수
 */
export const debounce = (func, delay) => {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

/**
 * 네트워크 상태 감지 유틸리티
 * @returns {Object} 네트워크 정보
 */
export const getNetworkInfo = () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  
  return {
    isOnline: navigator.onLine,
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0,
    saveData: connection?.saveData || false
  }
}
