/**
 * React 성능 최적화 유틸리티
 * 
 * 컴포넌트 성능 측정, 메모이제이션 도구, 렌더링 최적화 헬퍼 함수들을 제공합니다.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react'

/**
 * 컴포넌트 렌더링 성능 측정 훅
 */
export function useRenderPerformance(componentName) {
  const renderStartTime = useRef(performance.now())
  const renderCount = useRef(0)
  
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current
    renderCount.current += 1
    
    console.log(`🔍 [${componentName}] 렌더링 #${renderCount.current} - ${renderTime.toFixed(2)}ms`)
    
    // 렌더링이 50ms 이상 걸리면 경고
    if (renderTime > 50) {
      console.warn(`⚠️ [${componentName}] 느린 렌더링 감지: ${renderTime.toFixed(2)}ms`)
    }
    
    renderStartTime.current = performance.now()
  })
}

/**
 * API 호출 성능 측정 래퍼
 */
export function measureApiCall(apiCall, apiName) {
  return async (...args) => {
    const startTime = performance.now()
    
    try {
      const result = await apiCall(...args)
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.log(`📡 [${apiName}] API 호출 완료 - ${duration.toFixed(2)}ms`)
      
      // API 호출이 1초 이상 걸리면 경고
      if (duration > 1000) {
        console.warn(`⚠️ [${apiName}] 느린 API 호출: ${duration.toFixed(2)}ms`)
      }
      
      return result
    } catch (error) {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.error(`❌ [${apiName}] API 호출 실패 - ${duration.toFixed(2)}ms:`, error)
      throw error
    }
  }
}

/**
 * 안정적인 의존성 배열 생성 (깊은 비교)
 */
export function useDeepMemo(factory, deps) {
  const ref = useRef()
  
  // 의존성 배열의 깊은 비교
  if (!ref.current || !isDeepEqual(deps, ref.current.deps)) {
    ref.current = {
      deps,
      value: factory()
    }
  }
  
  return ref.current.value
}

/**
 * 깊은 비교 함수
 */
function isDeepEqual(a, b) {
  if (a === b) return true
  
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => isDeepEqual(item, b[index]))
  }
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => isDeepEqual(a[key], b[key]))
  }
  
  return false
}

/**
 * 디바운스된 콜백 훅
 */
export function useDebouncedCallback(callback, delay) {
  const timeoutRef = useRef(null)
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])
}

/**
 * 쓰로틀된 콜백 훅
 */
export function useThrottledCallback(callback, delay) {
  const lastRun = useRef(Date.now())
  
  return useCallback((...args) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args)
      lastRun.current = Date.now()
    }
  }, [callback, delay])
}

/**
 * 안정적인 객체 레퍼런스 생성
 */
export function useStableObject(obj) {
  return useMemo(() => obj, [JSON.stringify(obj)])
}

/**
 * 메모이제이션된 이벤트 핸들러 생성
 */
export function useEventHandler(handler, deps) {
  return useCallback(handler, deps)
}

/**
 * 컴포넌트 마운트/언마운트 추적
 */
export function useComponentLifecycle(componentName) {
  useEffect(() => {
    console.log(`🚀 [${componentName}] 컴포넌트 마운트`)
    
    return () => {
      console.log(`🔄 [${componentName}] 컴포넌트 언마운트`)
    }
  }, [componentName])
}

/**
 * 렌더링 최적화를 위한 조건부 메모이제이션
 */
export function useConditionalMemo(factory, condition, deps) {
  const memoizedValue = useMemo(factory, deps)
  const previousValue = useRef(memoizedValue)
  
  if (condition) {
    previousValue.current = memoizedValue
    return memoizedValue
  }
  
  return previousValue.current
}

/**
 * 리스트 아이템 키 생성기
 */
export function createStableKey(item, index) {
  if (item && typeof item === 'object') {
    return item.id || item.key || item._id || `item-${index}`
  }
  return `item-${index}-${String(item)}`
}

/**
 * 성능 메트릭 수집기
 */
export class PerformanceCollector {
  constructor() {
    this.metrics = new Map()
  }
  
  measure(name, fn) {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    
    const duration = end - start
    const existing = this.metrics.get(name) || { count: 0, total: 0, avg: 0, min: Infinity, max: 0 }
    
    existing.count += 1
    existing.total += duration
    existing.avg = existing.total / existing.count
    existing.min = Math.min(existing.min, duration)
    existing.max = Math.max(existing.max, duration)
    
    this.metrics.set(name, existing)
    
    return result
  }
  
  async measureAsync(name, fn) {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    
    const duration = end - start
    const existing = this.metrics.get(name) || { count: 0, total: 0, avg: 0, min: Infinity, max: 0 }
    
    existing.count += 1
    existing.total += duration
    existing.avg = existing.total / existing.count
    existing.min = Math.min(existing.min, duration)
    existing.max = Math.max(existing.max, duration)
    
    this.metrics.set(name, existing)
    
    return result
  }
  
  getMetrics() {
    const result = {}
    this.metrics.forEach((value, key) => {
      result[key] = { ...value }
    })
    return result
  }
  
  logMetrics() {
    console.group('📊 성능 메트릭')
    this.metrics.forEach((value, key) => {
      console.log(`${key}:`, {
        count: value.count,
        average: `${value.avg.toFixed(2)}ms`,
        min: `${value.min.toFixed(2)}ms`,
        max: `${value.max.toFixed(2)}ms`,
        total: `${value.total.toFixed(2)}ms`
      })
    })
    console.groupEnd()
  }
  
  clear() {
    this.metrics.clear()
  }
}

// 전역 성능 수집기 인스턴스
export const globalPerformanceCollector = new PerformanceCollector()

/**
 * 컴포넌트별 성능 측정 훅
 */
export function usePerformanceMetrics(componentName) {
  const collector = useRef(new PerformanceCollector())
  
  const measure = useCallback((name, fn) => {
    return collector.current.measure(`${componentName}.${name}`, fn)
  }, [componentName])
  
  const measureAsync = useCallback((name, fn) => {
    return collector.current.measureAsync(`${componentName}.${name}`, fn)
  }, [componentName])
  
  const logMetrics = useCallback(() => {
    collector.current.logMetrics()
  }, [])
  
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 메트릭 로그 출력
      if (collector.current.metrics.size > 0) {
        console.log(`📊 [${componentName}] 최종 성능 메트릭:`)
        collector.current.logMetrics()
      }
    }
  }, [componentName])
  
  return { measure, measureAsync, logMetrics }
}

