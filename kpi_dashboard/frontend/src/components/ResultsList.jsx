/**
 * LLM 분석 결과 목록을 표시하는 컴포넌트
 * 
 * 이 컴포넌트는 분석 결과를 테이블 형태로 표시하고,
 * 필터링, 페이지네이션, 삭제 기능을 제공합니다.
 * Task 40: Frontend LLM 분석 결과 목록 UI 컴포넌트 개발
 */

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table.jsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.jsx'
import { 
  Search, 
  Filter, 
  RefreshCcw, 
  Trash2, 
  Download,
  Calendar,
  Loader2,
  AlertCircle,
  ChevronDown,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { useAnalysisResults } from '@/hooks/useAnalysisResults.js'
import ResultFilter from './ResultFilter.jsx'
import ResultDetail from './ResultDetail.jsx'

/**
 * 분석 결과 목록 컴포넌트
 */
const ResultsList = () => {
  
  // === 커스텀 훅 사용 ===
  const {
    results,
    loading,
    error,
    isEmpty,
    hasMore,
    isFiltered,
    resultCount,
    filters,
    updateFilters,
    clearFilters,
    refresh,
    loadMore,
    deleteResult
  } = useAnalysisResults({
    initialLimit: 20,
    autoFetch: true
  })

  // === 로컬 상태 ===
  const [showFilters, setShowFilters] = useState(false)
  const [selectedResults, setSelectedResults] = useState(new Set())
  const [sortConfig, setSortConfig] = useState({
    key: 'analysisDate',
    direction: 'desc'
  })
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    resultIds: [],
    mode: 'single' // 'single' | 'compare'
  })

  // === 로깅 함수 ===
  const logInfo = useCallback((message, data = {}) => {
    console.log(`[ResultsList] ${message}`, data)
  }, [])

  // === 정렬 함수 ===
  const sortedResults = useMemo(() => {
    if (!results?.length) return []
    
    const sorted = [...results].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      
      // 날짜 정렬
      if (sortConfig.key === 'analysisDate') {
        const aDate = new Date(aValue)
        const bDate = new Date(bValue)
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
      }
      
      // 문자열 정렬
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortConfig.direction === 'asc' ? comparison : -comparison
      }
      
      // 숫자 정렬
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })
    
    return sorted
  }, [results, sortConfig])

  // === 정렬 핸들러 ===
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
    
    logInfo('정렬 변경', { key, direction: sortConfig.direction })
  }, [sortConfig.direction, logInfo])

  // === 필터 핸들러 ===
  const handleFilterChange = useCallback((newFilters) => {
    updateFilters(newFilters)
    logInfo('필터 변경', newFilters)
  }, [updateFilters, logInfo])

  // === 선택 핸들러 ===
  const handleSelectResult = useCallback((resultId) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(resultId)) {
        newSet.delete(resultId)
      } else {
        newSet.add(resultId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedResults.size === sortedResults.length) {
      setSelectedResults(new Set())
    } else {
      setSelectedResults(new Set(sortedResults.map(r => r.id)))
    }
  }, [selectedResults.size, sortedResults])

  // === 삭제 핸들러 ===
  const handleDelete = useCallback(async (resultId) => {
    try {
      logInfo('분석 결과 삭제 시작', { resultId })
      await deleteResult(resultId)
      
      // 선택 상태에서 제거
      setSelectedResults(prev => {
        const newSet = new Set(prev)
        newSet.delete(resultId)
        return newSet
      })
      
    } catch (error) {
      logInfo('분석 결과 삭제 실패', { resultId, error })
    }
  }, [deleteResult, logInfo])

  // === 벌크 삭제 ===
  const handleBulkDelete = useCallback(async () => {
    if (selectedResults.size === 0) return
    
    try {
      logInfo('벌크 삭제 시작', { count: selectedResults.size })
      
      const deletePromises = Array.from(selectedResults).map(id => deleteResult(id))
      await Promise.all(deletePromises)
      
      setSelectedResults(new Set())
      toast.success(`${selectedResults.size}개의 결과가 삭제되었습니다.`)
      
    } catch (error) {
      logInfo('벌크 삭제 실패', { error })
      toast.error('일부 결과 삭제에 실패했습니다.')
    }
  }, [selectedResults, deleteResult, logInfo])

  // === 상세 보기 ===
  const handleShowDetail = useCallback((resultId) => {
    logInfo('상세 보기 요청', { resultId })
    setDetailModal({
      isOpen: true,
      resultIds: [resultId],
      mode: 'single'
    })
  }, [logInfo])

  // === 비교 보기 ===
  const handleCompareResults = useCallback(() => {
    if (selectedResults.size < 2) {
      toast.error('비교할 결과를 2개 이상 선택해주세요')
      return
    }
    
    if (selectedResults.size > 5) {
      toast.error('최대 5개까지만 비교할 수 있습니다')
      return
    }

    const resultIds = Array.from(selectedResults)
    logInfo('비교 보기 요청', { resultIds, count: resultIds.length })
    
    setDetailModal({
      isOpen: true,
      resultIds,
      mode: 'compare'
    })
  }, [selectedResults, logInfo])

  // === 모달 닫기 ===
  const handleCloseDetail = useCallback(() => {
    setDetailModal({
      isOpen: false,
      resultIds: [],
      mode: 'single'
    })
  }, [])

  // === 데이터 내보내기 ===
  const handleExport = useCallback(() => {
    if (!sortedResults?.length) {
      toast.error('내보낼 데이터가 없습니다.')
      return
    }
    
    try {
      logInfo('데이터 내보내기 시작', { count: sortedResults.length })
      
      const exportData = sortedResults.map(result => ({
        '분석 날짜': new Date(result.analysisDate).toLocaleString('ko-KR'),
        'NE ID': result.neId,
        'Cell ID': result.cellId,
        '상태': result.status,
        '결과 수': result.results?.length || 0,
        '통계 수': result.stats?.length || 0
      }))
      
      const csvContent = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `analysis_results_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      
      toast.success('데이터가 내보내기 되었습니다.')
      logInfo('데이터 내보내기 완료')
      
    } catch (error) {
      logInfo('데이터 내보내기 실패', { error })
      toast.error('데이터 내보내기에 실패했습니다.')
    }
  }, [sortedResults, logInfo])

  // === 상태별 뱃지 컬러 ===
  const getStatusBadgeVariant = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'default' // 기본 (보통 파란색)
      case 'error':
      case 'failed':
        return 'destructive' // 빨간색
      case 'warning':
        return 'secondary' // 회색
      case 'pending':
      case 'processing':
        return 'outline' // 테두리만
      default:
        return 'secondary'
    }
  }, [])

  // === 날짜 포맷팅 ===
  const formatDate = useCallback((dateString) => {
    try {
      return new Date(dateString).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString || '-'
    }
  }, [])

  // === 렌더링 ===
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">LLM 분석 결과</h2>
          <p className="text-muted-foreground">
            총 {resultCount}개의 분석 결과
            {isFiltered && ' (필터 적용됨)'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {selectedResults.size > 0 && (
            <>
              {selectedResults.size >= 2 && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={handleCompareResults}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  비교하기 ({selectedResults.size})
                </Button>
              )}
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    선택 삭제 ({selectedResults.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>선택된 결과 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      선택된 {selectedResults.size}개의 분석 결과를 삭제하시겠습니까? 
                      이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete}>
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={!sortedResults?.length}
          >
            <Download className="h-4 w-4 mr-2" />
            내보내기
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            필터
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <ResultFilter
          filters={filters}
          onFilterChange={(key, value) => updateFilters({ [key]: value })}
          onClearFilters={clearFilters}
          isCollapsed={false}
          onToggleCollapse={() => setShowFilters(false)}
          showActiveCount={true}
        />
      )}

      {/* 메인 컨텐츠 */}
      <Card>
        <CardContent className="p-0">
          {/* 에러 상태 */}
          {error && (
            <div className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">데이터 로딩 오류</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={refresh} variant="outline">
                <RefreshCcw className="h-4 w-4 mr-2" />
                다시 시도
              </Button>
            </div>
          )}

          {/* 로딩 상태 */}
          {loading && isEmpty && (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">분석 결과를 불러오는 중...</p>
            </div>
          )}

          {/* 빈 상태 */}
          {!loading && isEmpty && !error && (
            <div className="p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {isFiltered ? '검색 결과가 없습니다' : '분석 결과가 없습니다'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {isFiltered 
                  ? '다른 조건으로 검색해보세요.' 
                  : '아직 생성된 분석 결과가 없습니다.'}
              </p>
              {isFiltered && (
                <Button onClick={clearFilters} variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  필터 초기화
                </Button>
              )}
            </div>
          )}

          {/* 테이블 */}
          {!isEmpty && !error && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedResults.size === sortedResults.length && sortedResults.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('analysisDate')}
                    >
                      분석 날짜
                      {sortConfig.key === 'analysisDate' && (
                        <span className="ml-2">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('neId')}
                    >
                      NE ID
                      {sortConfig.key === 'neId' && (
                        <span className="ml-2">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('cellId')}
                    >
                      Cell ID
                      {sortConfig.key === 'cellId' && (
                        <span className="ml-2">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-center">결과 수</TableHead>
                    <TableHead className="text-center">통계 수</TableHead>
                    <TableHead className="w-20">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result) => (
                    <TableRow 
                      key={result.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleShowDetail(result.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedResults.has(result.id)}
                          onChange={() => handleSelectResult(result.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(result.analysisDate)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {result.neId || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {result.cellId || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(result.status)}>
                          {result.status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {result.results?.length || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {result.stats?.length || 0}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleShowDetail(result.id)}
                            title="상세 보기"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="삭제">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>분석 결과 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  이 분석 결과를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(result.id)}>
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 더 보기 버튼 */}
          {hasMore && !loading && !error && (
            <div className="p-6 text-center border-t">
              <Button 
                variant="outline" 
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                더 보기
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상세 보기 모달 */}
      <ResultDetail
        isOpen={detailModal.isOpen}
        onClose={handleCloseDetail}
        resultIds={detailModal.resultIds}
        mode={detailModal.mode}
      />
    </div>
  )
}

export default ResultsList
