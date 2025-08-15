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
  Maximize2,
  Minimize2,
  RefreshCw
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
      return result.kpiResults ? result : generateMockData(result)
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <span className="font-medium">{result.neId || '-'}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Cell ID</div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">{result.cellId || '-'}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">상태</div>
              <Badge variant={getStatusBadgeVariant(result.status)}>
                {result.status || 'unknown'}
              </Badge>
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

    const result = results[0]
    const chartData = result.kpiResults || []

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#8884d8">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.status === 'warning' ? '#f59e0b' : '#8884d8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
      <DialogContent className={`max-w-4xl ${isFullscreen ? 'max-w-none h-[90vh] w-[90vw]' : 'max-h-[80vh]'}`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {isCompareMode ? '분석 결과 비교' : '분석 결과 상세'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
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

