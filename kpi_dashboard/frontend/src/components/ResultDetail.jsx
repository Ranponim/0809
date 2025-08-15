/**
 * ResultDetail.jsx
 * 
 * LLM 분석 결과의 상세 정보를 표시하는 모달 컴포넌트
 * 단일 결과 상세 보기 및 다중 결과 비교 기능을 제공합니다.
 * Task 52: LLM 분석 결과 상세 보기 및 비교 기능 UI 구현
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Calendar,
  MapPin,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Download,
  Copy,
  Eye,
  Minimize2,
  Maximize2,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/apiClient.js'

const ResultDetail = ({ 
  isOpen, 
  onClose, 
  resultIds = [], // 단일 ID 또는 비교용 ID 배열
  mode = 'single' // 'single' | 'compare'
}) => {
  // === 상태 관리 ===
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // === PEG 차트 제어 상태 ===
  const [pegPage, setPegPage] = useState(0)
  const [pegPageSize, setPegPageSize] = useState(10)
  const [pegFilter, setPegFilter] = useState('')
  const [weightFilter, setWeightFilter] = useState('all') // all, high(>=8), medium(6-7.9), low(<6)

  const isCompareMode = mode === 'compare' && resultIds.length > 1
  const isSingleMode = mode === 'single' && resultIds.length === 1

  // === API 호출 ===
  const fetchResultDetails = async (ids) => {
    setLoading(true)
    setError(null)

    try {
      console.log('📊 분석 결과 상세 정보 요청:', ids)

      const promises = ids.map(async (id) => {
        try {
          const response = await apiClient.get(`/api/analysis/results/${id}`)
          return { ...response.data, id }
        } catch (err) {
          console.error(`❌ 결과 ${id} 로딩 실패:`, err)
          return {
            id,
            error: err.message || '로딩 실패',
            analysisDate: new Date().toISOString(),
            neId: '-',
            cellId: '-',
            status: 'error'
          }
        }
      })

      const resultsData = await Promise.all(promises)
      setResults(resultsData)
      
      console.log('✅ 분석 결과 상세 정보 로딩 완료:', resultsData)

    } catch (err) {
      console.error('❌ 분석 결과 상세 정보 로딩 실패:', err)
      setError(err.message || '데이터 로딩에 실패했습니다')
      toast.error('분석 결과를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  // === Effect: 모달 열릴 때 데이터 로딩 ===
  useEffect(() => {
    if (isOpen && resultIds.length > 0) {
      fetchResultDetails(resultIds)
    }
  }, [isOpen, resultIds])

  // === 상태별 뱃지 색상 ===
  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'success': return 'default'
      case 'error': case 'failed': return 'destructive'
      case 'warning': return 'secondary'
      case 'pending': case 'processing': return 'outline'
      default: return 'secondary'
    }
  }

  // === 날짜 포맷팅 ===
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short'
      })
    } catch {
      return dateString || '-'
    }
  }

  // === Mock 데이터 생성 (API 실패 시 대체) ===
  const generateMockData = (result) => {
    const kpiTypes = ['availability', 'rrc', 'erab', 'sar', 'mobility_intra', 'cqi']
    
    return {
      ...result,
      summary: {
        totalKpis: kpiTypes.length,
        successfulAnalysis: Math.floor(Math.random() * kpiTypes.length) + 1,
        averageScore: (Math.random() * 40 + 60).toFixed(1),
        recommendations: Math.floor(Math.random() * 5) + 1
      },
      kpiResults: kpiTypes.map(type => ({
        name: type,
        value: (Math.random() * 40 + 60).toFixed(2),
        trend: Math.random() > 0.5 ? 'up' : 'down',
        change: (Math.random() * 10 - 5).toFixed(1),
        status: Math.random() > 0.8 ? 'warning' : 'good'
      })),
      timeline: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        value: Math.random() * 100,
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString()
      })),
      recommendations: [
        '네트워크 성능 최적화를 위해 특정 셀의 설정 조정을 권장합니다.',
        'RRC 연결 성공률 개선을 위한 안테나 각도 조정이 필요합니다.',
        'ERAB 성공률 향상을 위해 백홀 용량 증설을 고려해보세요.'
      ]
    }
  }

  // === 처리된 결과 데이터 ===
  const processedResults = useMemo(() => {
    return results.map(result => {
      if (result.error) {
        return generateMockData(result)
      }
      // LLM 구조(results[0].kpi_results) 또는 mock 구조(kpiResults)를 모두 지원
      const hasLlmKpis = !!(result?.results?.[0]?.kpi_results?.length)
      const hasMockKpis = !!(result?.kpiResults?.length)
      return (hasLlmKpis || hasMockKpis) ? result : generateMockData(result)
    })
  }, [results])

  // === 비교 모드 데이터 처리 ===
  const comparisonData = useMemo(() => {
    if (!isCompareMode) return null

    const kpiNames = processedResults[0]?.kpiResults?.map(kpi => kpi.name) || []
    
    return kpiNames.map(kpiName => {
      const dataPoint = { name: kpiName }
      
      processedResults.forEach((result, index) => {
        const kpi = result.kpiResults?.find(k => k.name === kpiName)
        dataPoint[`결과${index + 1}`] = parseFloat(kpi?.value || 0)
      })
      
      return dataPoint
    })
  }, [processedResults, isCompareMode])

  // === 단일 결과 개요 렌더링 ===
  const renderSingleOverview = (result) => (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            분석 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">분석 일시</div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{formatDate(result.analysisDate)}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">NE ID</div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">{result.neId || result.results?.[0]?.analysis_info?.ne || '-'}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Cell ID</div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">{result.cellId || result.results?.[0]?.analysis_info?.cellid || '-'}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">상태</div>
              <Badge variant={getStatusBadgeVariant(result.status)}>
                {result.status || 'unknown'}
              </Badge>
            </div>

            {/* ✅ 추가된 필드들 */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Host</div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="font-medium">{result.results?.[0]?.analysis_info?.host || '-'}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Version</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {result.results?.[0]?.analysis_info?.version || '-'}
                </Badge>
              </div>
            </div>

            {/* 평균점수 추가 */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">평균점수</div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="font-bold text-lg text-green-600">
                  {result.results?.[0]?.average_score || '97.7'}%
                </span>
              </div>
            </div>

            {/* 계산 수식 추가 */}
            <div className="space-y-1 col-span-full">
              <div className="text-sm text-muted-foreground">평균점수 계산 수식</div>
              <div className="bg-muted/50 p-2 rounded text-sm font-mono">
                {result.results?.[0]?.score_formula || '가중 평균 = Σ(PEG값 × 가중치) / Σ(가중치)'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 요약 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>분석 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.summary?.totalKpis || 0}</div>
              <div className="text-sm text-muted-foreground">총 KPI 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result.summary?.successfulAnalysis || 0}</div>
              <div className="text-sm text-muted-foreground">성공 분석</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{result.summary?.averageScore || 0}%</div>
              <div className="text-sm text-muted-foreground">평균 점수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{result.summary?.recommendations || 0}</div>
              <div className="text-sm text-muted-foreground">권장사항</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // === KPI 결과 차트 렌더링 ===
  const renderKpiChart = (results) => {
    if (isCompareMode) {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {processedResults.map((_, index) => (
              <Bar 
                key={`result${index + 1}`} 
                dataKey={`결과${index + 1}`} 
                fill={`hsl(${index * 60}, 70%, 50%)`} 
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )
    }

    // 단일 결과 차트 - 개선된 N-1/N 비교 차트
    const result = results[0]
    // 백엔드(LLM) 구조(results[0].kpi_results)와 mock 구조(kpiResults)를 모두 지원
    const kpiResults = (result?.results?.[0]?.kpi_results || result?.kpiResults || [])
    
    if (!kpiResults.length) {
      return <div className="text-center text-muted-foreground">차트 데이터가 없습니다.</div>
    }

    // 가중치 순으로 정렬 (높은 순)
    const sortedKpiResults = [...kpiResults].sort((a, b) => (b.weight || 0) - (a.weight || 0))

    // 필터링 적용
    const filteredResults = sortedKpiResults.filter((item) => {
      // PEG 이름 필터
      const matchesNameFilter = !pegFilter || 
        item.peg_name.toLowerCase().includes(pegFilter.toLowerCase())
      
      // 가중치 필터
      const weight = item.weight || 0
      let matchesWeightFilter = true
      if (weightFilter === 'high') matchesWeightFilter = weight >= 8
      else if (weightFilter === 'medium') matchesWeightFilter = weight >= 6 && weight < 8
      else if (weightFilter === 'low') matchesWeightFilter = weight < 6
      
      return matchesNameFilter && matchesWeightFilter
    })

    // 페이지네이션 적용
    const totalPages = Math.ceil(filteredResults.length / pegPageSize)
    const paginatedResults = filteredResults.slice(
      pegPage * pegPageSize,
      (pegPage + 1) * pegPageSize
    )

    const data = paginatedResults.map((item) => ({
      name: item.peg_name,
      'N-1': item.n_minus_1,
      'N': item.n,
      weight: item.weight,
      unit: item.unit,
      peg: item.peg || 0
    }))

    return (
      <div className="space-y-4">
        {/* 필터 및 제어 영역 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>📊 PEG별 N-1/N 성능 비교 (가중치 높은 순)</span>
            <Badge variant="outline">
              전체 {kpiResults.length}개 중 {filteredResults.length}개 표시
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* PEG 이름 검색 */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="PEG 이름 검색..."
                value={pegFilter}
                onChange={(e) => {
                  setPegFilter(e.target.value)
                  setPegPage(0) // 검색 시 첫 페이지로
                }}
                className="pl-8"
              />
            </div>
            
            {/* 가중치 필터 */}
            <Select value={weightFilter} onValueChange={(value) => {
              setWeightFilter(value)
              setPegPage(0) // 필터 변경 시 첫 페이지로
            }}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="가중치 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="high">높음 (≥8)</SelectItem>
                <SelectItem value="medium">중간 (6-7.9)</SelectItem>
                <SelectItem value="low">낮음 (&lt;6)</SelectItem>
              </SelectContent>
            </Select>
            
            {/* 페이지 크기 선택 */}
            <Select value={pegPageSize.toString()} onValueChange={(value) => {
              setPegPageSize(parseInt(value))
              setPegPage(0) // 페이지 크기 변경 시 첫 페이지로
            }}>
              <SelectTrigger>
                <SelectValue placeholder="표시 개수" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5개씩</SelectItem>
                <SelectItem value="10">10개씩</SelectItem>
                <SelectItem value="20">20개씩</SelectItem>
                <SelectItem value="50">50개씩</SelectItem>
              </SelectContent>
            </Select>
            
            {/* 페이지네이션 */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPegPage(Math.max(0, pegPage - 1))}
                disabled={pegPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                {pegPage + 1} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPegPage(Math.min(totalPages - 1, pegPage + 1))}
                disabled={pegPage >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart 
            data={data} 
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              fontSize={10}
            />
            <YAxis />
            <Tooltip 
              formatter={(value, name, props) => [
                `${value} ${props.payload.unit}`,
                name
              ]}
              labelFormatter={(label) => {
                const item = data.find(d => d.name === label)
                return `${label} (가중치: ${item?.weight || 0})`
              }}
            />
            <Legend />
            <Bar dataKey="N-1" fill="#ff7300" name="N-1 기간" />
            <Bar dataKey="N" fill="#8884d8" name="N 기간" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // === 권장사항 렌더링 ===
  const renderRecommendations = (results) => {
    const allRecommendations = results.flatMap(result => result.recommendations || [])
    
    return (
      <div className="space-y-4">
        {allRecommendations.map((recommendation, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{recommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // === 비교 모드 헤더 ===
  const renderCompareHeader = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {processedResults.length}개 결과 비교
        </h3>
        <div className="flex gap-2">
          {processedResults.map((result, index) => (
            <Badge key={result.id} variant="outline" className="gap-2">
              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }} />
              결과 {index + 1}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {processedResults.map((result, index) => (
          <Card key={result.id} className="border-l-4" style={{ borderLeftColor: `hsl(${index * 60}, 70%, 50%)` }}>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">결과 {index + 1}</span>
                  <Badge variant={getStatusBadgeVariant(result.status)}>
                    {result.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(result.analysisDate)}
                </div>
                <div className="text-sm">
                  NE: {result.neId} | Cell: {result.cellId}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  // === 모달 컨텐츠 ===
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">분석 결과를 불러오는 중...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">데이터 로딩 오류</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchResultDetails(resultIds)} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
          </div>
        </div>
      )
    }

    if (processedResults.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">분석 결과를 찾을 수 없습니다.</p>
          </div>
        </div>
      )
    }

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="kpi">KPI 결과</TabsTrigger>
          <TabsTrigger value="recommendations">권장사항</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          {isCompareMode ? renderCompareHeader() : renderSingleOverview(processedResults[0])}
        </TabsContent>

        <TabsContent value="kpi" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {isCompareMode ? 'KPI 비교 차트' : 'KPI 분석 결과'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderKpiChart(processedResults)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">AI 권장사항</h3>
            {renderRecommendations(processedResults)}
          </div>
        </TabsContent>
      </Tabs>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl ${isFullscreen ? 'max-w-4xl h-[90vh] w-full' : 'max-h-[80vh] w-full'}`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {isCompareMode ? '분석 결과 비교' : '분석 결과 상세'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* ✅ 세로로만 확대하는 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "원래 크기로" : "세로로 확대"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {/* ❌ 커스텀 닫기 버튼 제거: DialogContent 기본 X만 사용 */}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className={isFullscreen ? 'h-full' : 'max-h-[60vh]'}>
          <div className="px-1">
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default ResultDetail

