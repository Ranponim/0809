/**
 * ResultDetail.jsx
 * 
 * LLM 분석 결과의 상세 정보를 표시하는 모달 컴포넌트
 * 단일 결과 상세 보기 및 다중 결과 비교 기능을 제공합니다.
 * Task 52: LLM 분석 결과 상세 보기 및 비교 기능 UI 구현
 */

import React, { useState, useEffect, useMemo, memo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  
  // === 키보드 단축키 지원 ===
  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === 'F11') {
        event.preventDefault()
        setIsFullscreen(prev => !prev)
      } else if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
      return () => window.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen, isFullscreen])
  
  // === PEG 차트 제어 상태 ===
  const [pegPage, setPegPage] = useState(0)
  const [pegPageSize, setPegPageSize] = useState(10)
  const [pegFilter, setPegFilter] = useState('')
  const [weightFilter, setWeightFilter] = useState('all') // all, high(>=8), medium(6-7.9), low(<6)
  const [trendFilter, setTrendFilter] = useState('all') // all, up, down, stable

  // === 메모리 최적화: 큰 데이터 청크 단위 처리 ===
  const [dataChunkSize] = useState(50) // 한 번에 처리할 데이터 청크 크기

  const isCompareMode = mode === 'compare' && resultIds.length > 1
  const isSingleMode = mode === 'single' && resultIds.length === 1

  // === API 호출 (청크 단위 처리로 메모리 최적화) ===
  const fetchResultDetails = async (ids) => {
    setLoading(true)
    setError(null)

    try {
      console.log('📊 분석 결과 상세 정보 요청:', ids)

      // 메모리 효율을 위해 청크 단위로 처리
      const chunks = []
      for (let i = 0; i < ids.length; i += dataChunkSize) {
        chunks.push(ids.slice(i, i + dataChunkSize))
      }

      let allResults = []

      for (const chunk of chunks) {
        const promises = chunk.map(async (id) => {
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

        const chunkResults = await Promise.all(promises)
        allResults = [...allResults, ...chunkResults]

        // 메모리 효율을 위해 중간 결과 정리 (브라우저 환경에서 안전하게 처리)
        if (typeof window !== 'undefined' && window.gc) {
          window.gc()
        }
      }

      setResults(allResults)
      console.log('✅ 분석 결과 상세 정보 로딩 완료:', allResults.length, '개 항목')

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

  // (모킹 제거)

  // === 처리된 결과 데이터 ===
  const processedResults = useMemo(() => {
    // 모킹 제거: 에러가 있는 항목은 제외하고 그대로 사용
    return results.filter(r => !r.error)
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

  // === 단일 결과 차트 데이터 처리 ===
  const kpiChartData = useMemo(() => {
    if (isCompareMode || !processedResults.length || !processedResults[0].stats) {
      return {
        kpiResults: [],
        sortedKpiResults: [],
        filteredResults: [],
        dataWithTrends: [],
        trendFilteredResults: [],
        totalPages: 0,
        paginatedResults: [],
        data: [],
        summaryStats: { improved: 0, declined: 0, stable: 0, avgChange: 0, weightedAvgChange: 0 }
      };
    }

    const result = processedResults[0];
    const statsData = result.stats || [];

    const pegComparison = {};
    statsData.forEach(stat => {
      const pegName = stat.kpi_name;
      if (!pegComparison[pegName]) {
        pegComparison[pegName] = { peg_name: pegName, weight: 5 };
      }
      if (stat.period === 'N-1') {
        pegComparison[pegName]['N-1'] = stat.avg;
      } else if (stat.period === 'N') {
        pegComparison[pegName]['N'] = stat.avg;
      }
    });

    const weightData = result.request_params?.peg_definitions || {};
    Object.keys(pegComparison).forEach(pegName => {
      if (weightData[pegName]?.weight) {
        pegComparison[pegName].weight = weightData[pegName].weight;
      }
    });

    const kpiResults = Object.values(pegComparison).filter(peg => peg['N-1'] !== undefined && peg['N'] !== undefined);
    const sortedKpiResults = [...kpiResults].sort((a, b) => (b.weight || 0) - (a.weight || 0));

    const filteredResults = sortedKpiResults.filter(item => {
      const matchesNameFilter = !pegFilter || item.peg_name.toLowerCase().includes(pegFilter.toLowerCase());
      const weight = item.weight || 0;
      let matchesWeightFilter = true;
      if (weightFilter === 'high') matchesWeightFilter = weight >= 8;
      else if (weightFilter === 'medium') matchesWeightFilter = weight >= 6 && weight < 8;
      else if (weightFilter === 'low') matchesWeightFilter = weight < 6;
      return matchesNameFilter && matchesWeightFilter;
    });

    const dataWithTrends = filteredResults.map(item => {
      const n1Value = item['N-1'] || 0;
      const nValue = item['N'] || 0;
      const change = nValue - n1Value;
      const changePercent = n1Value !== 0 ? (change / n1Value) * 100 : 0;
      const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
      return { ...item, change, changePercent, trend };
    });

    const trendFilteredResults = dataWithTrends.filter(item => {
      if (trendFilter === 'all') return true;
      return item.trend === trendFilter;
    });

    const totalPages = Math.ceil(trendFilteredResults.length / pegPageSize);
    const paginatedResults = trendFilteredResults.slice(pegPage * pegPageSize, (pegPage + 1) * pegPageSize);

    const data = paginatedResults.map(item => ({
      name: item.peg_name,
      'N-1': item['N-1'] || 0,
      'N': item['N'] || 0,
      change: item.change,
      changePercent: item.changePercent,
      trend: item.trend,
      weight: item.weight,
      unit: '%',
      peg: item.weight || 0
    }));

    const improved = data.filter(item => item.trend === 'up').length;
    const declined = data.filter(item => item.trend === 'down').length;
    const stable = data.filter(item => item.trend === 'stable').length;
    const avgChange = data.length > 0 ? data.reduce((sum, item) => sum + item.change, 0) / data.length : 0;
    const weightedAvgChange = data.length > 0 ? data.reduce((sum, item) => sum + (item.change * item.weight), 0) / data.reduce((sum, item) => sum + item.weight, 0) : 0;
    const summaryStats = { improved, declined, stable, avgChange, weightedAvgChange };

    return { kpiResults, sortedKpiResults, filteredResults, dataWithTrends, trendFilteredResults, totalPages, paginatedResults, data, summaryStats };
  }, [isCompareMode, processedResults, pegFilter, weightFilter, trendFilter, pegPage, pegPageSize]);

  const renderKpiChart = () => {
    const { kpiResults, trendFilteredResults, totalPages, data, summaryStats } = kpiChartData;

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

    if (!kpiResults.length) {
      return <div className="text-center text-muted-foreground">PEG 비교 데이터가 없습니다.</div>
    }

    return (
      <div className="space-y-4">
        {/* 성능 요약 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{summaryStats.improved}</div>
            <div className="text-xs text-muted-foreground">개선 📈</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{summaryStats.declined}</div>
            <div className="text-xs text-muted-foreground">하락 📉</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-600">{summaryStats.stable}</div>
            <div className="text-xs text-muted-foreground">안정 ➡️</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${summaryStats.avgChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summaryStats.avgChange > 0 ? '+' : ''}{summaryStats.avgChange.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">평균 변화</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${summaryStats.weightedAvgChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summaryStats.weightedAvgChange > 0 ? '+' : ''}{summaryStats.weightedAvgChange.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">가중 평균 변화</div>
          </div>
        </div>

        {/* 필터 및 제어 영역 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>📊 PEG별 N-1/N 성능 비교 (가중치 높은 순)</span>
            <Badge variant="outline">
              전체 {kpiResults.length}개 중 {trendFilteredResults.length}개 표시
            </Badge>
          </div>
          
          <div className={`grid gap-3 transition-all duration-300 ${
            isFullscreen ? 'grid-cols-1 md:grid-cols-6 lg:grid-cols-8' : 'grid-cols-1 md:grid-cols-5'
          }`}>
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
            
            {/* 트렌드 필터 */}
            <Select value={trendFilter} onValueChange={(value) => {
              setTrendFilter(value)
              setPegPage(0) // 필터 변경 시 첫 페이지로
            }}>
              <SelectTrigger>
                <SelectValue placeholder="트렌드 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 트렌드</SelectItem>
                <SelectItem value="up">개선 📈</SelectItem>
                <SelectItem value="down">하락 📉</SelectItem>
                <SelectItem value="stable">안정 ➡️</SelectItem>
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
        <ResponsiveContainer 
          width="100%" 
          height={isFullscreen ? Math.min(window.innerHeight * 0.55, 900) : Math.min(window.innerHeight * 0.4, 500)}
          className="transition-all duration-300"
        >
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
                `${value?.toFixed(2)} ${props.payload.unit}`,
                name
              ]}
              labelFormatter={(label) => {
                const item = data.find(d => d.name === label)
                return `${label} (가중치: ${item?.weight || 0})`
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                
                const data = payload[0]?.payload
                if (!data) return null
                
                const getTrendIcon = (trend) => {
                  switch(trend) {
                    case 'up': return '📈'
                    case 'down': return '📉'
                    default: return '➡️'
                  }
                }
                
                const getTrendColor = (trend) => {
                  switch(trend) {
                    case 'up': return 'text-green-600'
                    case 'down': return 'text-red-600'
                    default: return 'text-gray-600'
                  }
                }
                
                return (
                  <div className="bg-white border rounded-lg shadow-lg p-3 min-w-[200px]">
                    <div className="font-semibold mb-2">{label}</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-orange-600">N-1 기간:</span>
                        <span className="font-medium">{data['N-1']?.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">N 기간:</span>
                        <span className="font-medium">{data['N']?.toFixed(2)}%</span>
                      </div>
                      <div className="border-t pt-1 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">성능 변화:</span>
                          <div className={`flex items-center gap-1 font-medium ${getTrendColor(data.trend)}`}>
                            <span>{getTrendIcon(data.trend)}</span>
                            <span>{data.change > 0 ? '+' : ''}{data.change?.toFixed(2)}%</span>
                            <span className="text-xs">({data.changePercent > 0 ? '+' : ''}{data.changePercent?.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-gray-600">가중치:</span>
                          <span className="font-medium">{data.weight}/10</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
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

  // === LLM 분석 리포트 렌더링 (analysis_llm.py HTML 구성과 동일 섹션) ===
  const renderLLMReport = (results) => {
    const first = results?.[0] || {}
    // 백엔드 응답 구조 정규화: { success, message, data: { ...문서... } }
    const doc = first?.data?.data || first?.data || first
    const analysis = doc?.analysis || {}

    // 요약: executive_summary 우선, 그 외 호환 키 폴백
    const summaryText = analysis.executive_summary || analysis.overall_summary || analysis.comprehensive_summary || '요약 정보가 없습니다.'

    // 진단 결과: diagnostic_findings(list[dict]) 우선, 없으면 key_findings(list[str]) 폴백
    const diagnosticFindings = Array.isArray(analysis.diagnostic_findings) && analysis.diagnostic_findings.length
      ? analysis.diagnostic_findings
      : (Array.isArray(analysis.key_findings) ? analysis.key_findings.map(t => ({ primary_hypothesis: String(t) })) : [])

    // 권장 조치: recommended_actions(list[dict] 또는 list[str]) 처리
    const recommendedActionsRaw = Array.isArray(analysis.recommended_actions) ? analysis.recommended_actions : []
    const recommendedActions = recommendedActionsRaw.map((a) => {
      if (a && typeof a === 'object') return a
      return { priority: '', action: String(a || ''), details: '' }
    })

    return (
      <div className="space-y-4">
        {/* 종합 분석 요약 */}
        <Card>
          <CardHeader>
            <CardTitle>종합 분석 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground whitespace-pre-line">
              {summaryText}
            </div>
          </CardContent>
        </Card>

        {/* 핵심 관찰 사항 (diagnostic_findings) */}
        {diagnosticFindings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>핵심 관찰 사항</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diagnosticFindings.map((d, idx) => (
                  <div key={idx} className="space-y-1">
                    {d.primary_hypothesis && (
                      <div className="text-sm"><span className="font-semibold">가설 {idx + 1}:</span> {d.primary_hypothesis}</div>
                    )}
                    {d.supporting_evidence && (
                      <div className="text-xs text-muted-foreground">증거: {d.supporting_evidence}</div>
                    )}
                    {d.confounding_factors_assessment && (
                      <div className="text-xs text-muted-foreground">교란 변수 평가: {d.confounding_factors_assessment}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 권장 조치 (recommended_actions) */}
        {recommendedActions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>권장 조치</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendedActions.map((a, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {a.priority && <Badge variant="outline">{a.priority}</Badge>}
                        <div className="text-sm font-medium">{a.action || '-'}</div>
                      </div>
                      {a.details && (
                        <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{a.details}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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

  // === 단일 결과 개요 ===
  const renderSingleOverview = (result) => (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              분석 결과 상세 정보
            </CardTitle>
            <Badge variant={getStatusBadgeVariant(result.status)}>
              {result.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">분석 날짜</div>
              <div className="text-sm">{formatDate(result.analysisDate)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">NE ID</div>
              <div className="text-sm">{result.neId}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Cell ID</div>
              <div className="text-sm">{result.cellId}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">LLM 모델</div>
              <div className="text-sm">{result.llmModel || 'N/A'}</div>
            </div>
          </div>

          {result.analysisResult && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">분석 결과</div>
              <div className="text-sm bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                {result.analysisResult}
              </div>
            </div>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">권장 사항</div>
              <div className="space-y-1">
                {result.recommendations.map((rec, index) => (
                  <div key={index} className="text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded border-l-2 border-l-green-500">
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
          <TabsTrigger value="kpi">PEG 비교 결과</TabsTrigger>
          <TabsTrigger value="recommendations">LLM 분석 리포트</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          {isCompareMode ? renderCompareHeader() : renderSingleOverview(processedResults[0])}
        </TabsContent>

        <TabsContent value="kpi" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {isCompareMode ? 'PEG 성능 비교 차트' : 'PEG 비교 결과 (N-1 vs N)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderKpiChart()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4 mt-6">
          {renderLLMReport(processedResults)}
        </TabsContent>
      </Tabs>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`transition-all duration-500 ease-in-out transform ${
        isFullscreen 
          ? 'max-w-[99vw] h-[98vh] w-[99vw] scale-100' 
          : 'max-w-6xl max-h-[85vh] w-[90vw] scale-100'
      }`}>
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
                className="transition-all duration-200 hover:scale-110 hover:bg-accent"
                title={isFullscreen ? "원래 크기로 (ESC)" : "최대화 (F11)"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {/* ❌ 커스텀 닫기 버튼 제거: DialogContent 기본 X만 사용 */}
            </div>
          </div>
          <DialogDescription className="sr-only">
            {isCompareMode
              ? `${processedResults.length}개의 분석 결과를 비교하고 상세 정보를 확인할 수 있습니다.`
              : '단일 분석 결과의 상세 정보를 확인하고 다양한 탭으로 전환할 수 있습니다.'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className={`transition-all duration-300 ${
          isFullscreen ? 'h-[85vh]' : 'max-h-[70vh]'
        }`}>
          <div className="px-1">
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default memo(ResultDetail)

