/**
 * LLM 분석 결과 데이터를 관리하는 커스텀 훅
 * 
 * 이 훅은 분석 결과 조회, 필터링, 페이지네이션 기능을 제공합니다.
 * Task 40: Frontend LLM 분석 결과 목록 UI 컴포넌트 개발
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import apiClient from '@/lib/apiClient.js'
import { toast } from 'sonner'

/**
 * 분석 결과 데이터를 관리하는 커스텀 훅
 * 
 * @param {Object} options - 옵션 객체
 * @param {number} options.initialLimit - 초기 페이지당 항목 수 (기본값: 20)
 * @param {boolean} options.autoFetch - 자동 데이터 조회 여부 (기본값: true)
 * @param {Object} options.initialFilters - 초기 필터 값
 * @returns {Object} 분석 결과 상태 및 관리 함수들
 */
export const useAnalysisResults = ({
  initialLimit = 20,
  autoFetch = true,
  initialFilters = {}
} = {}) => {
  
  // === 상태 관리 ===
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  
  // 페이지네이션 상태
  const [pagination, setPagination] = useState({
    limit: initialLimit,
    skip: 0,
    total: 0
  })
  
  // 필터 상태
  const [filters, setFilters] = useState({
    neId: '',
    cellId: '',
    startDate: null,
    endDate: null,
    status: '',
    ...initialFilters
  })
  
  // === 로깅 함수 ===
  const logInfo = useCallback((message, data = {}) => {
    console.log(`[useAnalysisResults] ${message}`, data)
  }, [])
  
  const logError = useCallback((message, error) => {
    console.error(`[useAnalysisResults] ${message}`, error)
  }, [])

  // === API 호출 함수 ===
  const fetchResults = useCallback(async ({
    limit = pagination.limit,
    skip = 0,
    append = false,
    showToast = true
  } = {}) => {
    try {
      setLoading(true)
      setError(null)
      
      logInfo('분석 결과 조회 시작', { limit, skip, filters })
      
      // API 요청 파라미터 구성
      const params = {
        limit,
        skip
      }
      
      // 필터 조건 추가
      if (filters.neId?.trim()) {
        params.neId = filters.neId.trim()
      }
      if (filters.cellId?.trim()) {
        params.cellId = filters.cellId.trim()
      }
      if (filters.startDate) {
        params.startDate = filters.startDate
      }
      if (filters.endDate) {
        params.endDate = filters.endDate
      }
      if (filters.status?.trim()) {
        params.status = filters.status.trim()
      }
      
      // API 호출
      const response = await apiClient.get('/api/analysis/results', { params })
      
      logInfo('분석 결과 조회 성공', {
        resultCount: response.data?.length || 0,
        totalRequested: limit
      })
      
      const newResults = response.data || []
      
      // 결과 업데이트
      if (append) {
        setResults(prevResults => [...prevResults, ...newResults])
      } else {
        setResults(newResults)
      }
      
      // 페이지네이션 상태 업데이트
      setPagination(prev => ({
        ...prev,
        skip: append ? prev.skip + newResults.length : skip + newResults.length,
        total: prev.total // 실제로는 response에서 total을 받아와야 하지만, 현재 API에서 제공하지 않음
      }))
      
      // 더 가져올 데이터가 있는지 확인
      setHasMore(newResults.length === limit)
      
      // 성공 메시지 (옵션)
      if (showToast && !append) {
        toast.success(`${newResults.length}개의 분석 결과를 불러왔습니다.`)
      }
      
      return newResults
      
    } catch (err) {
      const errorMessage = err?.response?.data?.error?.message || 
                          err?.message || 
                          '분석 결과를 불러오는 중 오류가 발생했습니다.'
      
      logError('분석 결과 조회 실패', err)
      setError(errorMessage)
      
      if (showToast) {
        toast.error(`데이터 조회 실패: ${errorMessage}`)
      }
      
      return []
      
    } finally {
      setLoading(false)
    }
  }, [pagination.limit, filters, logInfo, logError])

  // === 필터 관리 함수 ===
  const updateFilters = useCallback((newFilters) => {
    logInfo('필터 업데이트', { 이전: filters, 새로운: newFilters })
    
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }))
    
    // 필터 변경 시 페이지네이션 리셋
    setPagination(prev => ({
      ...prev,
      skip: 0
    }))
  }, [filters, logInfo])

  const clearFilters = useCallback(() => {
    logInfo('필터 초기화')
    
    setFilters({
      neId: '',
      cellId: '',
      startDate: null,
      endDate: null,
      status: ''
    })
    
    setPagination(prev => ({
      ...prev,
      skip: 0
    }))
  }, [logInfo])

  // === 페이지네이션 함수 ===
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      logInfo('추가 로딩 건너뜀', { loading, hasMore })
      return
    }
    
    logInfo('추가 결과 로딩 시작')
    await fetchResults({ 
      skip: pagination.skip, 
      append: true,
      showToast: false 
    })
  }, [loading, hasMore, fetchResults, pagination.skip, logInfo])

  const refresh = useCallback(async () => {
    logInfo('데이터 새로고침 시작')
    
    setPagination(prev => ({
      ...prev,
      skip: 0
    }))
    
    await fetchResults({ skip: 0, append: false })
  }, [fetchResults, logInfo])

  // === 특정 결과 삭제 ===
  const deleteResult = useCallback(async (resultId) => {
    try {
      logInfo('분석 결과 삭제 시작', { resultId })
      
      await apiClient.delete(`/api/analysis/results/${resultId}`)
      
      // 로컬 상태에서 제거
      setResults(prev => prev.filter(result => result.id !== resultId))
      
      logInfo('분석 결과 삭제 성공', { resultId })
      toast.success('분석 결과가 삭제되었습니다.')
      
    } catch (err) {
      const errorMessage = err?.response?.data?.error?.message || 
                          err?.message || 
                          '분석 결과 삭제 중 오류가 발생했습니다.'
      
      logError('분석 결과 삭제 실패', err)
      toast.error(`삭제 실패: ${errorMessage}`)
    }
  }, [logInfo, logError])

  // === 자동 데이터 조회 (마운트 시) ===
  useEffect(() => {
    if (autoFetch) {
      logInfo('컴포넌트 마운트 - 자동 데이터 조회 시작')
      fetchResults({ skip: 0, append: false, showToast: false })
    }
  }, [autoFetch]) // fetchResults는 의존성에서 제외 (무한 루프 방지)

  // === 필터 변경 시 자동 재조회 ===
  useEffect(() => {
    if (autoFetch) {
      logInfo('필터 변경 감지 - 데이터 재조회')
      fetchResults({ skip: 0, append: false, showToast: false })
    }
  }, [filters]) // fetchResults는 의존성에서 제외

  // === 계산된 값들 ===
  const isEmpty = useMemo(() => !loading && results.length === 0, [loading, results.length])
  
  const isFiltered = useMemo(() => {
    return Object.values(filters).some(value => 
      value !== null && value !== undefined && value !== ''
    )
  }, [filters])

  const resultCount = useMemo(() => results.length, [results.length])

  // === 디버깅 정보 ===
  const debugInfo = useMemo(() => ({
    resultCount,
    loading,
    hasMore,
    isEmpty,
    isFiltered,
    pagination,
    filters,
    error
  }), [resultCount, loading, hasMore, isEmpty, isFiltered, pagination, filters, error])

  // 개발 환경에서 디버깅 정보 출력
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[useAnalysisResults] Debug Info:', debugInfo)
    }
  }, [debugInfo])

  // === 반환 값 ===
  return {
    // 데이터
    results,
    loading,
    error,
    
    // 상태
    isEmpty,
    hasMore,
    isFiltered,
    resultCount,
    
    // 페이지네이션
    pagination,
    
    // 필터
    filters,
    updateFilters,
    clearFilters,
    
    // 액션
    fetchResults,
    refresh,
    loadMore,
    deleteResult,
    
    // 디버깅
    debugInfo
  }
}

export default useAnalysisResults

