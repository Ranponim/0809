/**
 * AnalysisSetup.jsx
 * 
 * Task 4: Frontend: Build Analysis Setup and Period Selection UI
 * 
 * 분석 설정 및 기간 선택을 위한 UI 컴포넌트
 * - 날짜/시간 범위 선택기
 * - '분석' 버튼
 * - 두 개의 드롭다운 메뉴 (기준 기간 n-1, 비교 기간 n)
 * - 백엔드 API와의 통합
 * - 자동 기간 식별 기능
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Play, 
  Loader2, 
  XCircle,
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  RefreshCw
} from 'lucide-react'
import DateRangeSelector from './DateRangeSelector.jsx'
import { Input } from '@/components/ui/input.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const AnalysisSetup = () => {
  // 상태 관리
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  })
  
  const [periods, setPeriods] = useState({
    baselinePeriod: '', // 기준 기간 (n-1)
    comparisonPeriod: '' // 비교 기간 (n)
  })
  
  const [analysisConfig, setAnalysisConfig] = useState({
    useRecommendedTests: true,
    includeComprehensiveAnalysis: true,
    confidenceLevel: 0.95
  })
  
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isIdentifyingPeriods, setIsIdentifyingPeriods] = useState(false)
  const [currentTask, setCurrentTask] = useState(null)
  const [taskStatus, setTaskStatus] = useState(null)
  const [error, setError] = useState(null)
  const [pollingInterval, setPollingInterval] = useState(null)
  const [analysisResults, setAnalysisResults] = useState(null)
  const [identifiedPeriods, setIdentifiedPeriods] = useState([])
  const [useManualOverride, setUseManualOverride] = useState(false)
  const [manualPeriods, setManualPeriods] = useState({
    baseline: { startDate: '', endDate: '' },
    comparison: { startDate: '', endDate: '' }
  })

  // 날짜 범위 변경 핸들러
  const handleDateRangeChange = (newDateRange) => {
    console.log('📅 날짜 범위 변경:', newDateRange)
    setDateRange(newDateRange)
    setError(null)
    // 날짜 범위가 변경되면 기간 목록 초기화
    setPeriods({ baselinePeriod: '', comparisonPeriod: '' })
    setIdentifiedPeriods([])
  }

  // 기간 선택 핸들러
  const handlePeriodChange = (type, value) => {
    console.log(`📊 ${type} 기간 변경:`, value)
    setPeriods(prev => ({
      ...prev,
      [type]: value
    }))
    setError(null)
  }

  // 분석 설정 변경 핸들러
  const handleConfigChange = (key, value) => {
    console.log(`⚙️ 분석 설정 변경 - ${key}:`, value)
    setAnalysisConfig(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // 수동 기간 오버라이드 핸들러
  const handleManualPeriodChange = (periodType, dateType, value) => {
    console.log(`📅 수동 기간 변경 - ${periodType}.${dateType}:`, value)
    setManualPeriods(prev => ({
      ...prev,
      [periodType]: {
        ...prev[periodType],
        [dateType]: value
      }
    }))
    setError(null)
  }

  // 수동 오버라이드 토글 핸들러
  const handleManualOverrideToggle = (enabled) => {
    console.log(`🔄 수동 오버라이드 ${enabled ? '활성화' : '비활성화'}`)
    setUseManualOverride(enabled)
    if (!enabled) {
      // 수동 오버라이드 비활성화 시 자동 식별된 기간으로 복원
      if (identifiedPeriods.length >= 2) {
        setPeriods({
          baselinePeriod: identifiedPeriods[0].value,
          comparisonPeriod: identifiedPeriods[1].value
        })
      }
    }
  }

  // 자동 기간 식별
  const identifyPeriods = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('날짜 범위를 먼저 선택해주세요.')
      return
    }

    try {
      console.log('🔍 기간 식별 시작...')
      setIsIdentifyingPeriods(true)
      setError(null)

      // 기간 식별 API 호출
      const response = await fetch(`${API_BASE_URL}/api/analysis/identify-periods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          min_segment_length: 24, // 최소 24시간
          max_segments: 10 // 최대 10개 세그먼트
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`기간 식별 실패: ${response.status} - ${errorData.detail || response.statusText}`)
      }

      const result = await response.json()
      console.log('✅ 기간 식별 성공:', result)
      
      // 식별된 기간들을 드롭다운 옵션으로 변환
      const periodOptions = result.periods.map((period, index) => ({
        value: `period_${index + 1}`,
        label: `기간 ${index + 1} (${period.start_date} ~ ${period.end_date})`,
        startDate: period.start_date,
        endDate: period.end_date,
        stability_score: period.stability_score,
        data_points: period.data_points
      }))

      setIdentifiedPeriods(periodOptions)
      
      // 첫 번째와 두 번째 기간을 자동으로 선택
      if (periodOptions.length >= 2) {
        setPeriods({
          baselinePeriod: periodOptions[0].value,
          comparisonPeriod: periodOptions[1].value
        })
      }

    } catch (err) {
      console.error('❌ 기간 식별 오류:', err)
      setError(err.message)
    } finally {
      setIsIdentifyingPeriods(false)
    }
  }

  // 분석 시작
  const startAnalysis = async () => {
    try {
      console.log('🚀 분석 시작...')
      setIsAnalyzing(true)
      setError(null)
      setAnalysisResults(null)

      // 입력 검증
      if (!dateRange.startDate || !dateRange.endDate) {
        throw new Error('날짜 범위를 선택해주세요.')
      }

      let baselinePeriodData, comparisonPeriodData

      if (useManualOverride) {
        // 수동 오버라이드 모드
        if (!manualPeriods.baseline.startDate || !manualPeriods.baseline.endDate) {
          throw new Error('기준 기간의 시작 날짜와 종료 날짜를 모두 입력해주세요.')
        }
        if (!manualPeriods.comparison.startDate || !manualPeriods.comparison.endDate) {
          throw new Error('비교 기간의 시작 날짜와 종료 날짜를 모두 입력해주세요.')
        }

        baselinePeriodData = {
          startDate: manualPeriods.baseline.startDate,
          endDate: manualPeriods.baseline.endDate
        }
        comparisonPeriodData = {
          startDate: manualPeriods.comparison.startDate,
          endDate: manualPeriods.comparison.endDate
        }
      } else {
        // 자동 식별 모드
        if (!periods.baselinePeriod || !periods.comparisonPeriod) {
          throw new Error('기준 기간과 비교 기간을 모두 선택해주세요.')
        }

        if (periods.baselinePeriod === periods.comparisonPeriod) {
          throw new Error('기준 기간과 비교 기간은 서로 달라야 합니다.')
        }

        // 선택된 기간의 데이터 가져오기
        baselinePeriodData = identifiedPeriods.find(p => p.value === periods.baselinePeriod)
        comparisonPeriodData = identifiedPeriods.find(p => p.value === periods.comparisonPeriod)

        if (!baselinePeriodData || !comparisonPeriodData) {
          throw new Error('선택된 기간 데이터를 찾을 수 없습니다.')
        }
      }

      // 샘플 데이터 생성 (실제로는 백엔드에서 가져올 수 있음)
      const sampleData = generateSampleData()

      // 분석 요청 데이터 준비
      const analysisRequest = {
        period_n_data: {
          start_date: comparisonPeriodData.startDate,
          end_date: comparisonPeriodData.endDate,
          metrics: sampleData.comparison
        },
        period_n1_data: {
          start_date: baselinePeriodData.startDate,
          end_date: baselinePeriodData.endDate,
          metrics: sampleData.baseline
        },
        metrics: ['response_time', 'error_rate', 'throughput'],
        config: {
          use_recommended_tests: analysisConfig.useRecommendedTests,
          include_comprehensive_analysis: analysisConfig.includeComprehensiveAnalysis,
          confidence_level: analysisConfig.confidenceLevel
        },
        test_types: analysisConfig.useRecommendedTests ? null : ['t_test', 'mann_whitney', 'wilcoxon'],
        use_recommended_tests: analysisConfig.useRecommendedTests,
        include_comprehensive_analysis: analysisConfig.includeComprehensiveAnalysis,
        confidence_level: analysisConfig.confidenceLevel
      }

      console.log('📤 분석 요청 데이터:', analysisRequest)

      // 통합 분석 API 호출
      const response = await fetch(`${API_BASE_URL}/api/analysis/integrated-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisRequest)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`분석 요청 실패: ${response.status} - ${errorData.detail || response.statusText}`)
      }

      const result = await response.json()
      console.log('✅ 분석 요청 성공:', result)
      
      setCurrentTask(result.task_id)
      setTaskStatus({
        status: 'PENDING',
        progress: 0,
        current_step: '분석 요청됨'
      })

      // 폴링 시작
      startPolling(result.task_id)
      
    } catch (err) {
      console.error('❌ 분석 시작 오류:', err)
      setError(err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 작업 상태 폴링
  const startPolling = (taskId) => {
    console.log('🔄 폴링 시작:', taskId)
    
    // 기존 폴링 중지
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    // 즉시 첫 번째 상태 조회
    checkTaskStatus(taskId)

    // 2초마다 상태 조회
    const interval = setInterval(() => {
      checkTaskStatus(taskId)
    }, 2000)

    setPollingInterval(interval)
  }

  // 작업 상태 조회
  const checkTaskStatus = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analysis/task-status/${taskId}`)
      
      if (!response.ok) {
        throw new Error(`상태 조회 실패: ${response.status}`)
      }

      const status = await response.json()
      console.log('📊 작업 상태 업데이트:', status)
      
      setTaskStatus(status)

      // 작업이 완료되면 폴링 중지
      if (status.status === 'SUCCESS' || status.status === 'FAILURE') {
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
        
        if (status.status === 'SUCCESS' && status.result) {
          setAnalysisResults(status.result)
        }
      }

    } catch (err) {
      console.error('❌ 상태 조회 오류:', err)
    }
  }

  // 작업 취소
  const cancelAnalysis = async () => {
    if (!currentTask) return

    try {
      console.log('🛑 분석 취소:', currentTask)
      
      const response = await fetch(`${API_BASE_URL}/api/analysis/task-status/${currentTask}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCurrentTask(null)
        setTaskStatus(null)
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
      }
    } catch (err) {
      console.error('❌ 분석 취소 오류:', err)
      setError(err.message)
    }
  }

  // 샘플 데이터 생성 (실제로는 백엔드에서 가져올 수 있음)
  const generateSampleData = () => {
    const generateMetrics = (baseValue, variance) => {
      const data = []
      for (let i = 0; i < 30; i++) {
        data.push({
          timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
          response_time: baseValue + (Math.random() - 0.5) * variance,
          error_rate: Math.max(0, baseValue * 0.01 + (Math.random() - 0.5) * variance * 0.01),
          throughput: Math.max(0, baseValue * 10 + (Math.random() - 0.5) * variance * 10)
        })
      }
      return data
    }

    return {
      baseline: generateMetrics(100, 20), // 기준 기간 데이터
      comparison: generateMetrics(120, 25) // 비교 기간 데이터 (약간 다른 값)
    }
  }

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // 상태에 따른 아이콘과 색상
  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILURE':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800'
      case 'SUCCESS':
        return 'bg-green-100 text-green-800'
      case 'FAILURE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 분석 가능 여부 확인
  const canAnalyze = dateRange.startDate && 
                    dateRange.endDate && 
                    ((useManualOverride && 
                      manualPeriods.baseline.startDate && 
                      manualPeriods.baseline.endDate && 
                      manualPeriods.comparison.startDate && 
                      manualPeriods.comparison.endDate) ||
                     (!useManualOverride && 
                      periods.baselinePeriod && 
                      periods.comparisonPeriod && 
                      periods.baselinePeriod !== periods.comparisonPeriod)) &&
                    !isAnalyzing

  // 기간 식별 가능 여부 확인
  const canIdentifyPeriods = dateRange.startDate && 
                            dateRange.endDate && 
                            !isIdentifyingPeriods

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 통계 분석 설정
          </h1>
          <p className="text-gray-600">
            기간을 선택하고 통계 분석을 수행하세요
          </p>
        </div>

        {/* 분석 설정 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              분석 설정
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* 날짜 범위 선택 */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                분석 기간 선택
              </h3>
              <DateRangeSelector
                title="분석 기간"
                description="전체 분석을 수행할 날짜 범위를 선택하세요"
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onDateChange={handleDateRangeChange}
                disabled={isAnalyzing || currentTask}
                className="mb-4"
              />
            </div>

            {/* 자동 기간 식별 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  자동 기간 식별
                </h3>
                <Button
                  onClick={identifyPeriods}
                  disabled={!canIdentifyPeriods}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isIdentifyingPeriods ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      식별 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      기간 식별
                    </>
                  )}
                </Button>
              </div>
              
              {identifiedPeriods.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {identifiedPeriods.length}개의 안정적인 기간이 식별되었습니다.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* 기간 선택 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 기준 기간 (n-1) */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  기준 기간 (n-1)
                </Label>
                
                {useManualOverride ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-600">시작 날짜</Label>
                        <Input
                          type="date"
                          value={manualPeriods.baseline.startDate}
                          onChange={(e) => handleManualPeriodChange('baseline', 'startDate', e.target.value)}
                          disabled={isAnalyzing || currentTask}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">종료 날짜</Label>
                        <Input
                          type="date"
                          value={manualPeriods.baseline.endDate}
                          onChange={(e) => handleManualPeriodChange('baseline', 'endDate', e.target.value)}
                          disabled={isAnalyzing || currentTask}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Select 
                    value={periods.baselinePeriod} 
                    onValueChange={(value) => handlePeriodChange('baselinePeriod', value)}
                    disabled={isAnalyzing || currentTask || identifiedPeriods.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="기준 기간을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {identifiedPeriods.map((period) => (
                        <SelectItem key={period.value} value={period.value}>
                          <div className="flex flex-col">
                            <span>{period.label}</span>
                            <span className="text-xs text-gray-500">
                              안정성: {period.stability_score?.toFixed(2) || 'N/A'} | 
                              데이터: {period.data_points || 'N/A'}개
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {periods.baselinePeriod && !useManualOverride && (
                  <Badge variant="outline" className="text-xs">
                    기준 비교 대상
                  </Badge>
                )}
              </div>

              {/* 비교 기간 (n) */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  비교 기간 (n)
                </Label>
                
                {useManualOverride ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-600">시작 날짜</Label>
                        <Input
                          type="date"
                          value={manualPeriods.comparison.startDate}
                          onChange={(e) => handleManualPeriodChange('comparison', 'startDate', e.target.value)}
                          disabled={isAnalyzing || currentTask}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">종료 날짜</Label>
                        <Input
                          type="date"
                          value={manualPeriods.comparison.endDate}
                          onChange={(e) => handleManualPeriodChange('comparison', 'endDate', e.target.value)}
                          disabled={isAnalyzing || currentTask}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Select 
                    value={periods.comparisonPeriod} 
                    onValueChange={(value) => handlePeriodChange('comparisonPeriod', value)}
                    disabled={isAnalyzing || currentTask || identifiedPeriods.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="비교 기간을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {identifiedPeriods.map((period) => (
                        <SelectItem key={period.value} value={period.value}>
                          <div className="flex flex-col">
                            <span>{period.label}</span>
                            <span className="text-xs text-gray-500">
                              안정성: {period.stability_score?.toFixed(2) || 'N/A'} | 
                              데이터: {period.data_points || 'N/A'}개
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {periods.comparisonPeriod && !useManualOverride && (
                  <Badge variant="outline" className="text-xs">
                    분석 대상
                  </Badge>
                )}
              </div>
            </div>

            {/* 수동 오버라이드 토글 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">수동 기간 설정</Label>
                <p className="text-xs text-gray-600">자동 식별된 기간 대신 직접 기간을 설정합니다</p>
              </div>
              <Select 
                value={useManualOverride ? 'manual' : 'auto'} 
                onValueChange={(value) => handleManualOverrideToggle(value === 'manual')}
                disabled={isAnalyzing || currentTask}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">자동</SelectItem>
                  <SelectItem value="manual">수동</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 분석 옵션 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">분석 옵션</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">검정 방법</Label>
                  <Select 
                    value={analysisConfig.useRecommendedTests ? 'recommended' : 'custom'} 
                    onValueChange={(value) => handleConfigChange('useRecommendedTests', value === 'recommended')}
                    disabled={isAnalyzing || currentTask}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recommended">추천 검정 사용</SelectItem>
                      <SelectItem value="custom">사용자 정의 검정</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">포괄적 분석</Label>
                  <Select 
                    value={analysisConfig.includeComprehensiveAnalysis ? 'yes' : 'no'} 
                    onValueChange={(value) => handleConfigChange('includeComprehensiveAnalysis', value === 'yes')}
                    disabled={isAnalyzing || currentTask}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">포함</SelectItem>
                      <SelectItem value="no">제외</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">신뢰 수준</Label>
                  <Select 
                    value={analysisConfig.confidenceLevel.toString()} 
                    onValueChange={(value) => handleConfigChange('confidenceLevel', parseFloat(value))}
                    disabled={isAnalyzing || currentTask}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.90">90%</SelectItem>
                      <SelectItem value="0.95">95%</SelectItem>
                      <SelectItem value="0.99">99%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 분석 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={startAnalysis}
                disabled={!canAnalyze}
                className="flex items-center gap-2 px-6"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    분석 시작
                  </>
                )}
              </Button>
              
              {currentTask && (
                <Button
                  variant="outline"
                  onClick={cancelAnalysis}
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <XCircle className="h-4 w-4" />
                  취소
                </Button>
              )}
            </div>

            {/* 오류 메시지 */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 작업 상태 표시 */}
        {taskStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                분석 진행 상황
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* 작업 ID */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">작업 ID:</span>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {currentTask}
                </code>
              </div>

              {/* 상태 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">상태:</span>
                <Badge className={getStatusColor(taskStatus.status)}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(taskStatus.status)}
                    {taskStatus.status}
                  </div>
                </Badge>
              </div>

              {/* 진행률 */}
              {taskStatus.progress !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">진행률:</span>
                    <span className="text-sm font-medium">{taskStatus.progress}%</span>
                  </div>
                  <Progress value={taskStatus.progress} className="w-full" />
                </div>
              )}

              {/* 현재 단계 */}
              {taskStatus.current_step && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">현재 단계:</span>
                  <span className="text-sm font-medium">{taskStatus.current_step}</span>
                </div>
              )}

              {/* 오류 메시지 */}
              {taskStatus.error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{taskStatus.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* 분석 결과 표시 */}
        {analysisResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                분석 결과
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="text-sm overflow-auto max-h-96">
                  {JSON.stringify(analysisResults, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default AnalysisSetup
