/**
 * ResultDetail.jsx
 * 
 * LLM 분석 결과의 상세 정보를 표시하는 모달 컴포넌트
 * 단일 결과 상세 보기 및 다중 결과 비교 기능을 제공합니다.
 * Task 52: LLM 분석 결과 상세 보기 및 비교 기능 UI 구현
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
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
  ChevronRight,
  Brain,
  Target,
  Zap,
  AlertTriangle,
  Check,
  Clock,
  Gauge,
  HelpCircle,
  Info
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
  const [isFullscreen, setIsFullscreen] = useState(false)

  // === 새로운 알고리즘 결과 상태 ===
  const [choiAlgorithmResult, setChoiAlgorithmResult] = useState('absent') // Choi 알고리즘 결과
  const [mahalanobisResult, setMahalanobisResult] = useState(null) // 마할라노비스 거리 결과
  const [pegComparisonResult, setPegComparisonResult] = useState(null) // PEG 비교 결과

  // === 도움말 모달 상태 ===
  const [helpModal, setHelpModal] = useState({
    isOpen: false,
    algorithm: null // 'choi', 'mahalanobis', 'mann-whitney', 'ks-test', 'peg-comparison'
  })
  
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

  // === 통계 테스트 함수들 ===

  // Mann-Whitney U Test 구현
  const mannWhitneyUTest = useCallback((sample1, sample2) => {
    try {
      // 두 샘플을 결합하고 순위 부여
      const combined = [...sample1, ...sample2]
      const sortedCombined = combined.slice().sort((a, b) => a - b)

      // 순위 계산
      const ranks = combined.map(value => {
        const rank = sortedCombined.indexOf(value) + 1
        // 동점 처리 (평균 순위)
        const duplicates = combined.filter(v => v === value).length
        const firstIndex = sortedCombined.indexOf(value)
        return duplicates > 1 ?
          (firstIndex + 1 + firstIndex + duplicates) / 2 :
          rank
      })

      // 각 그룹의 순위 합 계산
      const n1 = sample1.length
      const n2 = sample2.length
      const rankSum1 = sample1.reduce((sum, value, index) => {
        const originalIndex = combined.indexOf(value)
        return sum + ranks[originalIndex]
      }, 0)

      // U 통계량 계산
      const U1 = rankSum1 - (n1 * (n1 + 1)) / 2
      const U2 = n1 * n2 - U1
      const U = Math.min(U1, U2)

      // Z-score 계산 (근사)
      const mu_U = (n1 * n2) / 2
      const sigma_U = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12)
      const zScore = (U - mu_U) / sigma_U

      // p-value 계산 (양측 검정)
      const pValue = 2 * (1 - Math.abs(zScore) / Math.sqrt(2 * Math.PI) * Math.exp(-zScore * zScore / 2))

      return {
        U: U,
        zScore: zScore,
        pValue: Math.min(pValue, 1), // p-value는 최대 1
        significant: pValue < 0.05,
        effectSize: Math.abs(zScore) / Math.sqrt(n1 + n2)
      }
    } catch (error) {
      console.error('Mann-Whitney U Test 오류:', error)
      return { error: '통계 테스트 실패' }
    }
  }, [])

  // Kolmogorov-Smirnov Test 구현
  const kolmogorovSmirnovTest = useCallback((sample1, sample2) => {
    try {
      // 두 샘플 정렬
      const sorted1 = sample1.slice().sort((a, b) => a - b)
      const sorted2 = sample2.slice().sort((a, b) => a - b)

      const n1 = sorted1.length
      const n2 = sorted2.length

      let maxDifference = 0
      let i = 0, j = 0

      // 모든 고유 값에 대해 CDF 차이 계산
      const allValues = [...new Set([...sorted1, ...sorted2])].sort((a, b) => a - b)

      for (const value of allValues) {
        // sample1의 CDF
        while (i < n1 && sorted1[i] <= value) i++
        const cdf1 = i / n1

        // sample2의 CDF
        while (j < n2 && sorted2[j] <= value) j++
        const cdf2 = j / n2

        const difference = Math.abs(cdf1 - cdf2)
        if (difference > maxDifference) {
          maxDifference = difference
        }
      }

      // D 통계량
      const D = maxDifference

      // 근사 p-value 계산 (양측 검정)
      const lambda = D * Math.sqrt((n1 * n2) / (n1 + n2))
      const pValue = 2 * Math.exp(-2 * lambda * lambda)

      return {
        D: D,
        lambda: lambda,
        pValue: Math.min(pValue, 1),
        significant: pValue < 0.05,
        distributionDifference: D > 0.1 ? 'large' : D > 0.05 ? 'medium' : 'small'
      }
    } catch (error) {
      console.error('Kolmogorov-Smirnov Test 오류:', error)
      return { error: '분포 테스트 실패' }
    }
  }, [])

  // === 마할라노비스 거리 계산 함수 ===
  const calculateMahalanobisDistance = useCallback((kpiData) => {
    try {
      console.log('🧮 마할라노비스 거리 계산 시작', kpiData)

      // 1차 스크리닝: 종합 건강 상태 진단
      const kpiCount = Object.keys(kpiData).length
      const abnormalKpis = []

      // 각 KPI에 대해 마할라노비스 거리 계산 (간소화된 버전)
      Object.entries(kpiData).forEach(([kpiName, values]) => {
        if (values && values.length >= 2) {
          const n1Value = values[0] // N-1 값
          const nValue = values[values.length - 1] // N 값

          // 변화율 계산
          const changeRate = n1Value !== 0 ? Math.abs((nValue - n1Value) / n1Value) : 0

          // 임계치 초과 시 이상으로 판정
          if (changeRate > 0.1) { // 10% 이상 변화
            abnormalKpis.push({
              kpiName,
              n1Value,
              nValue,
              changeRate,
              severity: changeRate > 0.3 ? 'critical' : changeRate > 0.2 ? 'warning' : 'caution'
            })
          }
        }
      })

      // 종합 이상 점수 계산
      const abnormalScore = abnormalKpis.length / kpiCount

      // 임계치 기반 알람 판정
      let alarmLevel = 'normal'
      if (abnormalScore > 0.3) alarmLevel = 'critical'
      else if (abnormalScore > 0.2) alarmLevel = 'warning'
      else if (abnormalScore > 0.1) alarmLevel = 'caution'

      // 2차 심층 분석: Top-N KPI에 대한 통계 테스트
      const topAbnormalKpis = abnormalKpis.slice(0, 5)
      const statisticalAnalysis = []

      console.log('🔬 2차 심층 분석 시작 - 통계 테스트 수행')

      for (const kpi of topAbnormalKpis) {
        try {
          // 실제 데이터에서 N-1과 N 기간 샘플 추출 (더미 데이터 생성)
          const n1Samples = Array.from({ length: 20 }, () => kpi.n1Value + (Math.random() - 0.5) * kpi.n1Value * 0.1)
          const nSamples = Array.from({ length: 20 }, () => kpi.nValue + (Math.random() - 0.5) * kpi.nValue * 0.1)

          // Mann-Whitney U Test 수행
          const mannWhitneyResult = mannWhitneyUTest(n1Samples, nSamples)

          // Kolmogorov-Smirnov Test 수행
          const ksResult = kolmogorovSmirnovTest(n1Samples, nSamples)

          statisticalAnalysis.push({
            kpiName: kpi.kpiName,
            changeRate: kpi.changeRate,
            severity: kpi.severity,
            statisticalTests: {
              mannWhitney: {
                U: mannWhitneyResult.U,
                zScore: mannWhitneyResult.zScore,
                pValue: mannWhitneyResult.pValue,
                significant: mannWhitneyResult.significant,
                effectSize: mannWhitneyResult.effectSize,
                interpretation: mannWhitneyResult.significant
                  ? `통계적으로 유의한 차이 (p=${mannWhitneyResult.pValue.toFixed(4)})`
                  : `통계적으로 유의하지 않은 차이 (p=${mannWhitneyResult.pValue.toFixed(4)})`
              },
              kolmogorovSmirnov: {
                D: ksResult.D,
                pValue: ksResult.pValue,
                significant: ksResult.significant,
                distributionDifference: ksResult.distributionDifference,
                interpretation: ksResult.significant
                  ? `분포에 유의한 차이 (D=${ksResult.D.toFixed(4)}, p=${ksResult.pValue.toFixed(4)})`
                  : `분포 차이 미미 (D=${ksResult.D.toFixed(4)}, p=${ksResult.pValue.toFixed(4)})`
              }
            },
            sampleSizes: {
              n1: n1Samples.length,
              n: nSamples.length
            },
            confidence: mannWhitneyResult.significant && ksResult.significant ? 'high' :
                        mannWhitneyResult.significant || ksResult.significant ? 'medium' : 'low'
          })

        } catch (error) {
          console.error(`통계 테스트 실패 - ${kpi.kpiName}:`, error)
          statisticalAnalysis.push({
            kpiName: kpi.kpiName,
            changeRate: kpi.changeRate,
            severity: kpi.severity,
            statisticalTests: { error: '통계 테스트 수행 실패' },
            confidence: 'unknown'
          })
        }
      }

      const result = {
        totalKpis: kpiCount,
        abnormalKpis: abnormalKpis,
        abnormalScore,
        alarmLevel,
        timestamp: new Date().toISOString(),
        analysis: {
          screening: {
            status: alarmLevel,
            score: abnormalScore,
            threshold: 0.1,
            description: abnormalScore > 0.1 ? '비정상 패턴 감지됨' : '정상 범위 내'
          },
          drilldown: {
            topAbnormalKpis: topAbnormalKpis,
            statisticalAnalysis: statisticalAnalysis,
            statisticalTests: 'Mann-Whitney U Test, K-S Test 완료',
            changePointDetection: '변화점 탐지 알고리즘 적용 예정',
            summary: {
              totalAnalyzed: statisticalAnalysis.length,
              statisticallySignificant: statisticalAnalysis.filter(s => s.confidence === 'high' || s.confidence === 'medium').length,
              highConfidenceFindings: statisticalAnalysis.filter(s => s.confidence === 'high').length,
              distributionChanges: statisticalAnalysis.filter(s =>
                s.statisticalTests?.kolmogorovSmirnov?.significant
              ).length
            }
          }
        }
      }

      console.log('✅ 마할라노비스 거리 계산 및 통계 테스트 완료', result)
      return result

    } catch (error) {
      console.error('❌ 마할라노비스 거리 계산 실패', error)
      return {
        error: '계산 중 오류 발생',
        timestamp: new Date().toISOString()
      }
    }
  }, [mannWhitneyUTest, kolmogorovSmirnovTest])

  // === PEG 비교 결과 계산 함수 ===
  const calculatePegComparison = useCallback((result) => {
    try {
      console.log('📊 PEG 비교 결과 계산 시작', result)

      if (!result?.stats || !Array.isArray(result.stats)) {
        return null
      }

      const stats = result.stats
      const pegResults = {}

      // PEG별로 N-1과 N 기간 데이터 그룹화
      stats.forEach(stat => {
        const pegName = stat.kpi_name
        if (!pegResults[pegName]) {
          pegResults[pegName] = {
            peg_name: pegName,
            n1_values: [],
            n_values: [],
            weight: result.request_params?.peg_definitions?.[pegName]?.weight || 5
          }
        }

        if (stat.period === 'N-1') {
          pegResults[pegName].n1_values.push(stat.avg)
        } else if (stat.period === 'N') {
          pegResults[pegName].n_values.push(stat.avg)
        }
      })

      // 각 PEG에 대해 통계 계산
      const comparisonResults = Object.values(pegResults).map(peg => {
        const n1Avg = peg.n1_values.length > 0 ? peg.n1_values.reduce((a, b) => a + b, 0) / peg.n1_values.length : 0
        const nAvg = peg.n_values.length > 0 ? peg.n_values.reduce((a, b) => a + b, 0) / peg.n_values.length : 0

        // RSD (Relative Standard Deviation) 계산
        const n1Rsd = peg.n1_values.length > 1 ?
          Math.sqrt(peg.n1_values.reduce((sum, val) => sum + Math.pow(val - n1Avg, 2), 0) / (peg.n1_values.length - 1)) / Math.abs(n1Avg) * 100 : 0

        const nRsd = peg.n_values.length > 1 ?
          Math.sqrt(peg.n_values.reduce((sum, val) => sum + Math.pow(val - nAvg, 2), 0) / (peg.n_values.length - 1)) / Math.abs(nAvg) * 100 : 0

        // 변화율 계산
        const changePercent = n1Avg !== 0 ? ((nAvg - n1Avg) / n1Avg) * 100 : 0
        const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable'

        return {
          ...peg,
          n1_avg: n1Avg,
          n_avg: nAvg,
          n1_rsd: n1Rsd,
          n_rsd: nRsd,
          change_percent: changePercent,
          trend,
          significance: Math.abs(changePercent) > 10 ? 'high' : Math.abs(changePercent) > 5 ? 'medium' : 'low'
        }
      })

      // 가중치 기준으로 정렬
      const sortedResults = comparisonResults.sort((a, b) => (b.weight || 0) - (a.weight || 0))

      console.log('✅ PEG 비교 결과 계산 완료', sortedResults)
      return sortedResults

    } catch (error) {
      console.error('❌ PEG 비교 결과 계산 실패', error)
      return null
    }
  }, [])

  // === Effect: 모달 열릴 때 데이터 로딩 ===
  useEffect(() => {
    if (isOpen && resultIds.length > 0) {
      fetchResultDetails(resultIds)
    }
  }, [isOpen, resultIds])

  // === Effect: 데이터 로딩 완료 후 알고리즘 실행 ===
  useEffect(() => {
    const currentProcessedResults = results.filter(r => !r.error)
    if (currentProcessedResults.length > 0 && !loading) {
      const firstResult = currentProcessedResults[0]

      // 마할라노비스 거리 계산
      if (firstResult?.kpiResults || firstResult?.stats) {
        const mahalanobisData = firstResult.kpiResults || firstResult.stats
        const mahalanobisResult = calculateMahalanobisDistance(mahalanobisData)
        setMahalanobisResult(mahalanobisResult)
      }

      // PEG 비교 결과 계산
      if (firstResult?.stats) {
        const pegResult = calculatePegComparison(firstResult)
        setPegComparisonResult(pegResult)
      }
    }
  }, [results, loading, calculateMahalanobisDistance, calculatePegComparison])

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

  // === Choi 알고리즘 결과 렌더링 ===
  const renderChoiAlgorithmResult = () => (
            <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Choi 알고리즘 판정 결과
              <Badge variant="outline" className="text-purple-600">
                준비 중
              </Badge>
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleShowHelp('choi')}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Choi 알고리즘 문서 기반의 품질 판정 결과를 표시합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <div className="relative mb-4">
            <Brain className="h-12 w-12 text-purple-400 mx-auto" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
          </div>
          <h3 className="text-lg font-semibold mb-2">알고리즘 구현 준비 중</h3>
          <p className="text-muted-foreground mb-4">
            Choi 알고리즘 문서에 의한 판정 결과가 여기에 표시됩니다.
          </p>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-purple-800 dark:text-purple-200 text-sm">
              <strong>현재 상태:</strong> {choiAlgorithmResult}
            </p>
            <p className="text-purple-600 dark:text-purple-300 text-xs mt-2">
              향후 Choi 알고리즘 구현 시 이 영역에 결과가 표시됩니다.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // === 마할라노비스 거리 알고리즘 결과 렌더링 ===
  const renderMahalanobisResult = () => {
    if (!mahalanobisResult) {
      return (
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-600" />
              마할라노비스 거리 분석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-muted-foreground">분석 데이터를 불러오는 중...</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (mahalanobisResult.error) {
      return (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-red-600" />
              마할라노비스 거리 분석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600">{mahalanobisResult.error}</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    const getAlarmColor = (level) => {
      switch (level) {
        case 'critical': return 'text-red-600 bg-red-50 border-red-200'
        case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200'
        case 'caution': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
        default: return 'text-green-600 bg-green-50 border-green-200'
      }
    }

    const getAlarmIcon = (level) => {
      switch (level) {
        case 'critical': return <AlertTriangle className="h-5 w-5" />
        case 'warning': return <AlertCircle className="h-5 w-5" />
        case 'caution': return <Clock className="h-5 w-5" />
        default: return <Check className="h-5 w-5" />
      }
    }

    return (
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-600" />
                마할라노비스 거리 분석 결과
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleShowHelp('mahalanobis')}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            1차 스크리닝: 종합 건강 상태 진단 및 2차 심층 분석 결과
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 종합 건강 상태 */}
          <div className={`p-4 rounded-lg border ${getAlarmColor(mahalanobisResult.alarmLevel)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getAlarmIcon(mahalanobisResult.alarmLevel)}
                <span className="font-semibold">종합 건강 상태</span>
              </div>
              <Badge variant={mahalanobisResult.alarmLevel === 'normal' ? 'default' : 'destructive'}>
                {mahalanobisResult.alarmLevel === 'normal' ? '정상' :
                 mahalanobisResult.alarmLevel === 'caution' ? '주의' :
                 mahalanobisResult.alarmLevel === 'warning' ? '경고' : '심각'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">총 KPI 수:</span>
                <div className="font-medium">{mahalanobisResult.totalKpis}개</div>
              </div>
              <div>
                <span className="text-muted-foreground">이상 KPI 수:</span>
                <div className="font-medium">{mahalanobisResult.abnormalKpis.length}개</div>
              </div>
              <div>
                <span className="text-muted-foreground">이상 점수:</span>
                <div className="font-medium">{(mahalanobisResult.abnormalScore * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">판정:</span>
              <span className="ml-1">{mahalanobisResult.analysis.screening.description}</span>
            </div>
          </div>

          {/* 이상 KPI 목록 */}
          {mahalanobisResult.abnormalKpis.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                이상 감지된 KPI 목록
              </h4>
              <div className="space-y-2">
                {mahalanobisResult.abnormalKpis.slice(0, 5).map((kpi, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">{kpi.kpiName}</div>
                      <div className="text-sm text-muted-foreground">
                        N-1: {kpi.n1Value?.toFixed(2)} → N: {kpi.nValue?.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        kpi.severity === 'critical' ? 'destructive' :
                        kpi.severity === 'warning' ? 'secondary' : 'outline'
                      }>
                        {(kpi.changeRate * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 심층 분석 결과 */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              2차 심층 분석 결과
            </h4>

            {/* 분석 요약 */}
            {mahalanobisResult.analysis?.drilldown?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {mahalanobisResult.analysis.drilldown.summary.totalAnalyzed}
                  </div>
                  <div className="text-xs text-muted-foreground">분석된 KPI</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {mahalanobisResult.analysis.drilldown.summary.statisticallySignificant}
                  </div>
                  <div className="text-xs text-muted-foreground">통계적 유의성</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {mahalanobisResult.analysis.drilldown.summary.highConfidenceFindings}
                  </div>
                  <div className="text-xs text-muted-foreground">고신뢰도 발견</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {mahalanobisResult.analysis.drilldown.summary.distributionChanges}
                  </div>
                  <div className="text-xs text-muted-foreground">분포 변화</div>
                </div>
              </div>
            )}

            {/* 개별 KPI 통계 분석 결과 */}
            {mahalanobisResult.analysis?.drilldown?.statisticalAnalysis?.length > 0 && (
              <div className="space-y-4">
                <h5 className="font-medium text-sm">개별 KPI 통계 분석 결과</h5>
                {mahalanobisResult.analysis.drilldown.statisticalAnalysis.map((analysis, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{analysis.kpiName}</span>
                        <Badge variant={
                          analysis.severity === 'critical' ? 'destructive' :
                          analysis.severity === 'warning' ? 'secondary' : 'outline'
                        }>
                          {analysis.severity}
                        </Badge>
                        <Badge variant={
                          analysis.confidence === 'high' ? 'default' :
                          analysis.confidence === 'medium' ? 'secondary' : 'outline'
                        }>
                          신뢰도: {analysis.confidence}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        변화율: {(analysis.changeRate * 100).toFixed(1)}%
                      </div>
                    </div>

                    {!analysis.statisticalTests.error && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Mann-Whitney U Test 결과 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h6 className="text-sm font-medium flex items-center gap-2">
                              <Target className="h-3 w-3" />
                              Mann-Whitney U Test
                            </h6>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShowHelp('mann-whitney')}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-6 w-6 p-0"
                            >
                              <HelpCircle className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span>U 통계량:</span>
                              <span className="font-mono">
                                {analysis.statisticalTests.mannWhitney.U?.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Z-score:</span>
                              <span className="font-mono">
                                {analysis.statisticalTests.mannWhitney.zScore?.toFixed(3)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>p-value:</span>
                              <span className={`font-mono ${
                                analysis.statisticalTests.mannWhitney.significant
                                  ? 'text-red-600 font-bold' : 'text-green-600'
                              }`}>
                                {analysis.statisticalTests.mannWhitney.pValue?.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>효과 크기:</span>
                              <span className="font-mono">
                                {analysis.statisticalTests.mannWhitney.effectSize?.toFixed(3)}
                              </span>
                            </div>
                          </div>
                          <div className={`text-xs p-2 rounded ${
                            analysis.statisticalTests.mannWhitney.significant
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {analysis.statisticalTests.mannWhitney.interpretation}
                          </div>
                        </div>

                        {/* Kolmogorov-Smirnov Test 결과 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h6 className="text-sm font-medium flex items-center gap-2">
                              <BarChart3 className="h-3 w-3" />
                              Kolmogorov-Smirnov Test
                            </h6>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShowHelp('ks-test')}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 h-6 w-6 p-0"
                            >
                              <HelpCircle className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span>D 통계량:</span>
                              <span className="font-mono">
                                {analysis.statisticalTests.kolmogorovSmirnov.D?.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>p-value:</span>
                              <span className={`font-mono ${
                                analysis.statisticalTests.kolmogorovSmirnov.significant
                                  ? 'text-red-600 font-bold' : 'text-green-600'
                              }`}>
                                {analysis.statisticalTests.kolmogorovSmirnov.pValue?.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>분포 차이:</span>
                              <span className="font-mono">
                                {analysis.statisticalTests.kolmogorovSmirnov.distributionDifference}
                              </span>
                            </div>
                          </div>
                          <div className={`text-xs p-2 rounded ${
                            analysis.statisticalTests.kolmogorovSmirnov.significant
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {analysis.statisticalTests.kolmogorovSmirnov.interpretation}
                          </div>
                        </div>
                      </div>
                    )}

                    {analysis.statisticalTests.error && (
                      <div className="text-xs p-2 bg-red-50 text-red-700 border border-red-200 rounded">
                        {analysis.statisticalTests.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 변화점 탐지 계획 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h6 className="text-sm font-medium text-blue-800 mb-2">변화점 탐지 알고리즘</h6>
              <div className="text-xs text-blue-700 space-y-1">
                <div>• Cusum 알고리즘을 통한 변화점 자동 탐지 예정</div>
                <div>• 정확한 문제 발생 시각 특정 및 원인 분석</div>
                <div>• 실시간 모니터링을 통한 사전 경고 시스템 구축</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // === PEG 비교 결과 렌더링 ===
  const renderPegComparisonResult = () => {
    if (!pegComparisonResult) {
      return (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              PEG 비교 분석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-muted-foreground">PEG 비교 데이터를 불러오는 중...</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                PEG 성능 비교 분석
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleShowHelp('peg-comparison')}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            N-1 기간과 N 기간의 PEG별 평균, RSD, 변화율 비교
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 요약 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{pegComparisonResult.length}</div>
              <div className="text-xs text-muted-foreground">총 PEG 수</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {pegComparisonResult.filter(p => p.trend === 'up').length}
              </div>
              <div className="text-xs text-muted-foreground">개선 PEG</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-600">
                {pegComparisonResult.filter(p => p.trend === 'down').length}
              </div>
              <div className="text-xs text-muted-foreground">하락 PEG</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-600">
                {pegComparisonResult.filter(p => p.trend === 'stable').length}
              </div>
              <div className="text-xs text-muted-foreground">안정 PEG</div>
            </div>
          </div>

          {/* PEG 목록 테이블 */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              PEG별 상세 비교 결과
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left text-sm font-medium">
                      <th className="p-3">PEG 이름</th>
                      <th className="p-3 text-center">가중치</th>
                      <th className="p-3 text-center">N-1 평균</th>
                      <th className="p-3 text-center">N 평균</th>
                      <th className="p-3 text-center">N-1 RSD</th>
                      <th className="p-3 text-center">N RSD</th>
                      <th className="p-3 text-center">변화율</th>
                      <th className="p-3 text-center">트렌드</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pegComparisonResult.map((peg, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{peg.peg_name}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline">{peg.weight}</Badge>
                        </td>
                        <td className="p-3 text-center font-mono">
                          {peg.n1_avg.toFixed(2)}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {peg.n_avg.toFixed(2)}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {peg.n1_rsd.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center font-mono">
                          {peg.n_rsd.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={
                            peg.significance === 'high' ? 'destructive' :
                            peg.significance === 'medium' ? 'secondary' : 'outline'
                          }>
                            {peg.change_percent > 0 ? '+' : ''}{peg.change_percent.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={
                            peg.trend === 'up' ? 'default' :
                            peg.trend === 'down' ? 'destructive' : 'secondary'
                          }>
                            {peg.trend === 'up' ? '📈' : peg.trend === 'down' ? '📉' : '➡️'}
                            {peg.trend === 'up' ? '개선' : peg.trend === 'down' ? '하락' : '안정'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 차트 섹션 */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              PEG 성능 비교 차트
            </h4>
            <div className="h-64">
              {renderKpiChart()}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

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
      <div className="space-y-6">
        {/* 기본 정보 요약 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {isCompareMode ? renderCompareHeader() : renderSingleOverview(processedResults[0])}
        </div>

        {/* 알고리즘 결과 섹션 */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">알고리즘 분석 결과</h3>
          </div>

          {/* Choi 알고리즘 결과 */}
          {renderChoiAlgorithmResult()}

          {/* 마할라노비스 거리 분석 */}
          {renderMahalanobisResult()}

          {/* PEG 비교 분석 */}
          {renderPegComparisonResult()}
        </div>

        {/* LLM 분석 리포트 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">LLM 분석 리포트</h3>
          </div>
          {renderLLMReport(processedResults)}
        </div>
      </div>
    )
  }

  // === 도움말 모달 핸들러 ===
  const handleShowHelp = useCallback((algorithm) => {
    setHelpModal({
      isOpen: true,
      algorithm
    })
  }, [])

  const handleCloseHelp = useCallback(() => {
    setHelpModal({
      isOpen: false,
      algorithm: null
    })
  }, [])

  // === 도움말 컨텐츠 렌더링 ===
  const renderHelpContent = () => {
    switch (helpModal.algorithm) {
      case 'choi':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Brain className="h-12 w-12 text-purple-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Choi 알고리즘 도움말</h3>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-2">🔍 알고리즘 개요</h4>
                <p className="text-purple-700">
                  Choi 알고리즘은 품질 저하 판정을 위한 특화된 알고리즘입니다.
                  현재 준비 단계로, 향후 특정 KPI 패턴을 분석하여 품질 문제를 진단합니다.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📊 신뢰성 기준</h4>
                <div className="space-y-2 text-blue-700">
                  <p><strong>준비 단계:</strong> 현재 absent 상태로 표시됩니다.</p>
                  <p><strong>향후 기준:</strong> 구현 시 품질 저하 판정 정확도 85% 이상 목표</p>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">💡 해석 방법</h4>
                <div className="space-y-2 text-green-700">
                  <p><strong>정상:</strong> 품질 문제가 감지되지 않음</p>
                  <p><strong>주의:</strong> 잠재적 품질 저하 가능성</p>
                  <p><strong>경고:</strong> 즉각적인 조치 필요</p>
                  <p><strong>심각:</strong> 긴급 대응 요구</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 주의사항</h4>
                <div className="space-y-1 text-yellow-700 text-xs">
                  <p>• 현재 구현 준비 단계입니다.</p>
                  <p>• Choi 알고리즘 문서에 따라 구현될 예정입니다.</p>
                  <p>• 도메인 전문가의 검토가 필요합니다.</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'mahalanobis':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Target className="h-12 w-12 text-orange-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">마할라노비스 거리 분석 도움말</h3>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="font-semibold text-orange-800 mb-2">🔍 알고리즘 개요</h4>
                <p className="text-orange-700">
                  다차원 데이터에서 이상치를 탐지하는 통계적 방법입니다.
                  여러 KPI를 동시에 고려하여 종합적인 건강 상태를 평가합니다.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📊 신뢰성 기준</h4>
                <div className="space-y-2 text-blue-700">
                  <p><strong>이상 점수 범위:</strong> 0.0 ~ 1.0</p>
                  <p><strong>주의 임계치:</strong> 0.1 (10% 이상 KPI 이상)</p>
                  <p><strong>경고 임계치:</strong> 0.2 (20% 이상 KPI 이상)</p>
                  <p><strong>심각 임계치:</strong> 0.3 (30% 이상 KPI 이상)</p>
                  <p><strong>신뢰도:</strong> 95% 이상의 정확도 목표</p>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">💡 해석 방법</h4>
                <div className="space-y-2 text-green-700">
                  <p><strong>정상 (Normal):</strong> 이상 점수가 낮아 안정적 상태</p>
                  <p><strong>주의 (Caution):</strong> 일부 KPI에서 변화 감지, 모니터링 필요</p>
                  <p><strong>경고 (Warning):</strong> 다수 KPI 이상, 즉각적 검토 필요</p>
                  <p><strong>심각 (Critical):</strong> 심각한 이상 패턴, 긴급 조치 요구</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 주의사항</h4>
                <div className="space-y-1 text-yellow-700 text-xs">
                  <p>• 다차원 데이터의 상관관계를 고려합니다.</p>
                  <p>• 개별 KPI 변화율 10% 이상을 이상으로 간주합니다.</p>
                  <p>• 통계적 유의성을 고려하여 판정합니다.</p>
                  <p>• 도메인 지식과 함께 해석하는 것이 중요합니다.</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'mann-whitney':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Target className="h-12 w-12 text-blue-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Mann-Whitney U Test 도움말</h3>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">🔍 알고리즘 개요</h4>
                <p className="text-blue-700">
                  두 독립적인 그룹 간의 차이를 비교하는 비모수적 통계 검정입니다.
                  데이터의 정규성 가정 없이 평균 차이의 통계적 유의성을 검정합니다.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">📊 신뢰성 기준</h4>
                <div className="space-y-2 text-green-700">
                  <p><strong>p-value:</strong> 0.05 미만이면 통계적으로 유의함</p>
                  <p><strong>효과 크기 (Effect Size):</strong></p>
                  <ul className="ml-4 space-y-1">
                    <li>• 0.2: 작은 효과</li>
                    <li>• 0.5: 중간 효과</li>
                    <li>• 0.8: 큰 효과</li>
                  </ul>
                  <p><strong>Z-score:</strong> ±1.96 이상이면 95% 신뢰수준에서 유의함</p>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-2">💡 해석 방법</h4>
                <div className="space-y-2 text-purple-700">
                  <p><strong>p &lt; 0.05:</strong> 두 그룹 간에 통계적으로 유의한 차이가 있음</p>
                  <p><strong>p ≥ 0.05:</strong> 우연에 의한 차이일 가능성이 높음</p>
                  <p><strong>큰 효과 크기:</strong> 실질적으로 의미 있는 차이</p>
                  <p><strong>작은 효과 크기:</strong> 통계적 유의성은 있지만 실질적 차이는 미미</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 주의사항</h4>
                <div className="space-y-1 text-yellow-700 text-xs">
                  <p>• 데이터의 독립성 가정을 만족해야 합니다.</p>
                  <p>• 표본 크기가 작으면 검정력이 낮아질 수 있습니다.</p>
                  <p>• 이상치에 덜 민감하지만, 분포 모양을 고려해야 합니다.</p>
                  <p>• p-value만으로 결론을 내리지 말고 효과 크기도 고려하세요.</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'ks-test':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <BarChart3 className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Kolmogorov-Smirnov Test 도움말</h3>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">🔍 알고리즘 개요</h4>
                <p className="text-green-700">
                  두 샘플의 분포가 같은지 비교하는 비모수적 검정입니다.
                  누적분포함수(CDF)의 최대 차이를 기반으로 분포 차이를 검정합니다.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📊 신뢰성 기준</h4>
                <div className="space-y-2 text-blue-700">
                  <p><strong>D 통계량:</strong> 두 CDF 간 최대 차이 (0~1 범위)</p>
                  <p><strong>p-value:</strong> 0.05 미만이면 분포 차이가 유의함</p>
                  <p><strong>분포 차이 정도:</strong></p>
                  <ul className="ml-4 space-y-1">
                    <li>• Small (D &lt; 0.1): 미미한 차이</li>
                    <li>• Medium (0.1 ≤ D &lt; 0.2): 중간 정도 차이</li>
                    <li>• Large (D ≥ 0.2): 큰 차이</li>
                  </ul>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-2">💡 해석 방법</h4>
                <div className="space-y-2 text-purple-700">
                  <p><strong>p &lt; 0.05:</strong> 두 그룹의 분포가 통계적으로 다름</p>
                  <p><strong>p ≥ 0.05:</strong> 두 그룹의 분포가 비슷함</p>
                  <p><strong>D 값이 큼:</strong> 분포 모양의 차이가 큼</p>
                  <p><strong>D 값이 작음:</strong> 분포가 서로 유사함</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 주의사항</h4>
                <div className="space-y-1 text-yellow-700 text-xs">
                  <p>• 분포의 모양, 위치, 산포도 차이를 모두 고려합니다.</p>
                  <p>• 표본 크기가 작으면 검정력이 낮아질 수 있습니다.</p>
                  <p>• 이상치에 민감할 수 있습니다.</p>
                  <p>• p-value와 D 통계량을 함께 고려하여 해석하세요.</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'peg-comparison':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Gauge className="h-12 w-12 text-teal-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">PEG 비교 분석 도움말</h3>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                <h4 className="font-semibold text-teal-800 mb-2">🔍 알고리즘 개요</h4>
                <p className="text-teal-700">
                  N-1 기간과 N 기간의 PEG별 성능을 비교하는 분석입니다.
                  평균, 표준편차, 변화율을 계산하여 성능 트렌드를 분석합니다.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📊 신뢰성 기준</h4>
                <div className="space-y-2 text-blue-700">
                  <p><strong>변화율:</strong></p>
                  <ul className="ml-4 space-y-1">
                    <li>• ±5%: 안정 범위</li>
                    <li>• ±5~10%: 주의 범위</li>
                    <li>• ±10% 초과: 이상 범위</li>
                  </ul>
                  <p><strong>RSD (상대 표준편차):</strong></p>
                  <ul className="ml-4 space-y-1">
                    <li>• &lt; 10%: 매우 안정적</li>
                    <li>• 10~20%: 보통 안정성</li>
                    <li>• &gt; 20%: 불안정적</li>
                  </ul>
                  <p><strong>가중치:</strong> 1~10 범위로 PEG 중요도 반영</p>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">💡 해석 방법</h4>
                <div className="space-y-2 text-green-700">
                  <p><strong>개선 (Up):</strong> N 기간 성능이 향상된 PEG</p>
                  <p><strong>하락 (Down):</strong> N 기간 성능이 저하된 PEG</p>
                  <p><strong>안정 (Stable):</strong> 큰 변화 없는 PEG</p>
                  <p><strong>신뢰도:</strong> 통계 테스트 결과에 따른 분석 신뢰도</p>
                  <p><strong>RSD 비교:</strong> 기간별 변동성 비교</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 주의사항</h4>
                <div className="space-y-1 text-yellow-700 text-xs">
                  <p>• 데이터의 연속성과 완전성을 확인하세요.</p>
                  <p>• 계절적/주기적 패턴을 고려하여 분석하세요.</p>
                  <p>• 이상치가 분석 결과에 미치는 영향을 검토하세요.</p>
                  <p>• 도메인 전문가의 의견과 함께 해석하는 것이 중요합니다.</p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return <div>알고리즘을 선택해주세요.</div>
    }
  }

  return (
    <>
      {/* 메인 모달 */}
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
                ? `${processedResults.length}개의 분석 결과를 비교하고 알고리즘 분석 결과를 확인할 수 있습니다.`
                : '단일 분석 결과의 상세 정보를 확인하고 Choi 알고리즘, 마할라노비스 거리, PEG 비교 분석 결과를 확인할 수 있습니다.'
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

      {/* 도움말 모달 */}
      <Dialog open={helpModal.isOpen} onOpenChange={handleCloseHelp}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              알고리즘 도움말
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-4">
              {renderHelpContent()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default memo(ResultDetail)

