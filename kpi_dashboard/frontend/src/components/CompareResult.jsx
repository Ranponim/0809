/**
 * CompareResult.jsx
 * 
 * Task 7: Frontend: Build Main Dashboard with Summary and Results Table
 * 
 * 분석 결과를 표시하는 전용 컴포넌트
 * - 분석 요약 정보 표시
 * - 결과 테이블 표시
 * - 필터링 및 정렬 기능
 * - 상세 보기 기능
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table.jsx'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog.jsx'
import { 
  Alert, 
  AlertDescription 
} from '@/components/ui/alert.jsx'
import { 
  Progress 
} from '@/components/ui/progress.jsx'
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Eye, 
  Download,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  SortAsc,
  SortDesc
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const CompareResult = () => {
  // 상태 관리
  const [analysisResults, setAnalysisResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedResult, setSelectedResult] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  
  // 필터링 및 정렬 상태
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateRange: 'all',
    testType: 'all'
  })
  const [sortConfig, setSortConfig] = useState({
    key: 'analysisDate',
    direction: 'desc'
  })
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  // 분석 결과 데이터 가져오기
  const fetchAnalysisResults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📊 분석 결과 데이터 가져오기 시작...')
      
      // 실제 API 호출 (현재는 샘플 데이터 사용)
      const response = await fetch(`${API_BASE_URL}/api/analysis/results`)
      
      if (!response.ok) {
        throw new Error(`분석 결과 조회 실패: ${response.status}`)
      }
      
      const data = await response.json()
      setAnalysisResults(data.results || [])
      
      console.log('✅ 분석 결과 데이터 로드 완료:', data.results?.length || 0)
      
    } catch (err) {
      console.error('❌ 분석 결과 조회 오류:', err)
      setError(err.message)
      
      // 샘플 데이터로 대체 (개발용)
      const sampleData = generateSampleAnalysisResults()
      setAnalysisResults(sampleData)
    } finally {
      setLoading(false)
    }
  }, [])

  // 샘플 분석 결과 데이터 생성 (개발용)
  const generateSampleAnalysisResults = () => {
    const sampleResults = []
    const testTypes = ['t_test', 'mann_whitney', 'wilcoxon', 'anova']
    const statuses = ['pass', 'fail', 'warning']
    const metrics = ['response_time', 'error_rate', 'throughput']
    
    for (let i = 1; i <= 20; i++) {
      const result = {
        id: `analysis_${i}`,
        analysisDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        baselinePeriod: {
          startDate: '2024-01-01',
          endDate: '2024-01-07',
          dataPoints: Math.floor(Math.random() * 1000) + 500
        },
        comparisonPeriod: {
          startDate: '2024-01-08',
          endDate: '2024-01-14',
          dataPoints: Math.floor(Math.random() * 1000) + 500
        },
        metrics: metrics.slice(0, Math.floor(Math.random() * 3) + 1),
        testType: testTypes[Math.floor(Math.random() * testTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        pValue: Math.random(),
        effectSize: Math.random() * 2,
        confidenceLevel: 0.95,
        summary: `분석 ${i}의 요약 결과입니다. ${statuses[Math.floor(Math.random() * statuses.length)]} 상태입니다.`,
        details: {
          statisticalTests: {
            t_test: { pValue: Math.random(), significant: Math.random() > 0.05 },
            mann_whitney: { pValue: Math.random(), significant: Math.random() > 0.05 }
          },
          effectSizes: {
            cohens_d: Math.random() * 2,
            cliffs_delta: Math.random() * 2
          },
          anomalyScores: {
            z_score: Math.random() * 3,
            anomaly_detection: Math.random()
          }
        }
      }
      sampleResults.push(result)
    }
    
    return sampleResults
  }

  // 필터링된 결과 계산
  const filteredResults = React.useMemo(() => {
    let filtered = [...analysisResults]
    
    // 검색 필터
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(result => 
        result.id.toLowerCase().includes(searchLower) ||
        result.summary.toLowerCase().includes(searchLower) ||
        result.metrics.some(metric => metric.toLowerCase().includes(searchLower))
      )
    }
    
    // 상태 필터
    if (filters.status !== 'all') {
      filtered = filtered.filter(result => result.status === filters.status)
    }
    
    // 테스트 타입 필터
    if (filters.testType !== 'all') {
      filtered = filtered.filter(result => result.testType === filters.testType)
    }
    
    // 날짜 범위 필터
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const resultDate = new Date()
      
      switch (filters.dateRange) {
        case 'today':
          filtered = filtered.filter(result => {
            resultDate.setTime(new Date(result.analysisDate).getTime())
            return resultDate.toDateString() === now.toDateString()
          })
          break
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          filtered = filtered.filter(result => new Date(result.analysisDate) >= weekAgo)
          break
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          filtered = filtered.filter(result => new Date(result.analysisDate) >= monthAgo)
          break
      }
    }
    
    return filtered
  }, [analysisResults, filters])

  // 정렬된 결과 계산
  const sortedResults = React.useMemo(() => {
    const sorted = [...filteredResults].sort((a, b) => {
      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]
      
      // 날짜 정렬
      if (sortConfig.key === 'analysisDate') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
    
    return sorted
  }, [filteredResults, sortConfig])

  // 페이지네이션된 결과
  const paginatedResults = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sortedResults.slice(startIndex, endIndex)
  }, [sortedResults, currentPage, itemsPerPage])

  // 정렬 핸들러
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // 필터 변경 핸들러
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
    setCurrentPage(1) // 필터 변경 시 첫 페이지로 이동
  }

  // 상세 보기 핸들러
  const handleViewDetail = (result) => {
    setSelectedResult(result)
    setDetailModalOpen(true)
  }

  // 상태에 따른 아이콘과 색상
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800'
      case 'fail':
        return 'bg-red-100 text-red-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchAnalysisResults()
  }, [fetchAnalysisResults])

  // 통계 계산
  const stats = React.useMemo(() => {
    const total = analysisResults.length
    const pass = analysisResults.filter(r => r.status === 'pass').length
    const fail = analysisResults.filter(r => r.status === 'fail').length
    const warning = analysisResults.filter(r => r.status === 'warning').length
    
    return {
      total,
      pass,
      fail,
      warning,
      passRate: total > 0 ? ((pass / total) * 100).toFixed(1) : 0
    }
  }, [analysisResults])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 분석 결과 비교
          </h1>
          <p className="text-gray-600">
            통계 분석 결과를 확인하고 비교하세요
          </p>
        </div>

        {/* 통계 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">총 분석</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">통과</p>
                  <p className="text-2xl font-bold text-green-600">{stats.pass}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">실패</p>
                  <p className="text-2xl font-bold text-red-600">{stats.fail}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">통과율</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.passRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 필터 및 검색 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              필터 및 검색
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>검색</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="분석 ID, 요약, 메트릭 검색..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>상태</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 상태</SelectItem>
                    <SelectItem value="pass">통과</SelectItem>
                    <SelectItem value="fail">실패</SelectItem>
                    <SelectItem value="warning">경고</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>날짜 범위</Label>
                <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 기간</SelectItem>
                    <SelectItem value="today">오늘</SelectItem>
                    <SelectItem value="week">최근 7일</SelectItem>
                    <SelectItem value="month">최근 30일</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>테스트 타입</Label>
                <Select value={filters.testType} onValueChange={(value) => handleFilterChange('testType', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 타입</SelectItem>
                    <SelectItem value="t_test">T-Test</SelectItem>
                    <SelectItem value="mann_whitney">Mann-Whitney U</SelectItem>
                    <SelectItem value="wilcoxon">Wilcoxon</SelectItem>
                    <SelectItem value="anova">ANOVA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 결과 테이블 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                분석 결과 목록
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAnalysisResults}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  새로고침
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">데이터 로딩 중...</span>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('id')}
                          className="flex items-center gap-1"
                        >
                          분석 ID
                          {sortConfig.key === 'id' && (
                            sortConfig.direction === 'asc' ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('analysisDate')}
                          className="flex items-center gap-1"
                        >
                          분석 날짜
                          {sortConfig.key === 'analysisDate' && (
                            sortConfig.direction === 'asc' ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>기간</TableHead>
                      <TableHead>메트릭</TableHead>
                      <TableHead>테스트 타입</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('status')}
                          className="flex items-center gap-1"
                        >
                          상태
                          {sortConfig.key === 'status' && (
                            sortConfig.direction === 'asc' ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('pValue')}
                          className="flex items-center gap-1"
                        >
                          P-값
                          {sortConfig.key === 'pValue' && (
                            sortConfig.direction === 'asc' ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.id}</TableCell>
                        <TableCell>
                          {new Date(result.analysisDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>기준: {result.baselinePeriod.startDate} ~ {result.baselinePeriod.endDate}</div>
                            <div>비교: {result.comparisonPeriod.startDate} ~ {result.comparisonPeriod.endDate}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {result.metrics.map((metric) => (
                              <Badge key={metric} variant="outline" className="text-xs">
                                {metric}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.testType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(result.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(result.status)}
                              {result.status}
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {result.pValue.toFixed(4)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetail(result)}
                            >
                              <Eye className="h-4 w-4" />
                              상세보기
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* 페이지네이션 */}
                {sortedResults.length > itemsPerPage && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, sortedResults.length)} / {sortedResults.length}개 결과
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        이전
                      </Button>
                      <span className="text-sm">
                        {currentPage} / {Math.ceil(sortedResults.length / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(sortedResults.length / itemsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(sortedResults.length / itemsPerPage)}
                      >
                        다음
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 상세 보기 모달 */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              분석 결과 상세 보기
            </DialogTitle>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <Card>
                <CardHeader>
                  <CardTitle>기본 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">분석 ID</Label>
                      <p className="text-sm">{selectedResult.id}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">분석 날짜</Label>
                      <p className="text-sm">{new Date(selectedResult.analysisDate).toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">상태</Label>
                      <Badge className={getStatusColor(selectedResult.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(selectedResult.status)}
                          {selectedResult.status}
                        </div>
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">신뢰 수준</Label>
                      <p className="text-sm">{(selectedResult.confidenceLevel * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 기간 정보 */}
              <Card>
                <CardHeader>
                  <CardTitle>분석 기간</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">기준 기간 (n-1)</Label>
                      <p className="text-sm">{selectedResult.baselinePeriod.startDate} ~ {selectedResult.baselinePeriod.endDate}</p>
                      <p className="text-xs text-gray-500">{selectedResult.baselinePeriod.dataPoints}개 데이터 포인트</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">비교 기간 (n)</Label>
                      <p className="text-sm">{selectedResult.comparisonPeriod.startDate} ~ {selectedResult.comparisonPeriod.endDate}</p>
                      <p className="text-xs text-gray-500">{selectedResult.comparisonPeriod.dataPoints}개 데이터 포인트</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 통계 결과 */}
              <Card>
                <CardHeader>
                  <CardTitle>통계 분석 결과</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium">P-값</Label>
                        <p className="text-lg font-bold">{selectedResult.pValue.toFixed(4)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">효과 크기</Label>
                        <p className="text-lg font-bold">{selectedResult.effectSize.toFixed(3)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">테스트 타입</Label>
                        <Badge variant="outline">{selectedResult.testType}</Badge>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">요약</Label>
                      <p className="text-sm mt-1">{selectedResult.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 상세 통계 */}
              <Card>
                <CardHeader>
                  <CardTitle>상세 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">통계 검정 결과</Label>
                      <div className="mt-2 space-y-2">
                        {Object.entries(selectedResult.details.statisticalTests).map(([test, result]) => (
                          <div key={test} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{test}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">P-값: {result.pValue.toFixed(4)}</span>
                              <Badge variant={result.significant ? "default" : "secondary"}>
                                {result.significant ? "유의함" : "유의하지 않음"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">효과 크기</Label>
                      <div className="mt-2 space-y-2">
                        {Object.entries(selectedResult.details.effectSizes).map(([effect, value]) => (
                          <div key={effect} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{effect}</span>
                            <span className="text-sm">{value.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">이상치 점수</Label>
                      <div className="mt-2 space-y-2">
                        {Object.entries(selectedResult.details.anomalyScores).map(([score, value]) => (
                          <div key={score} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{score}</span>
                            <span className="text-sm">{value.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CompareResult
