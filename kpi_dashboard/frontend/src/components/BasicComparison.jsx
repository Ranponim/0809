/**
 * BasicComparison.jsx
 * 
 * Statistics Basic 탭 - 두 기간 비교 분석 컴포넌트
 * 사용자가 두 날짜 구간을 선택하고 PEG 데이터를 비교 분석할 수 있습니다.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts'
import { 
  Play, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, 
  CheckCircle, BarChart3, Eye, Settings, Download
} from 'lucide-react'
import { toast } from 'sonner'

import DateRangeSelector from './DateRangeSelector.jsx'
import ComparisonChart from './ComparisonChart.jsx'
import apiClient from '@/lib/apiClient.js'
import { useStatisticsSettings, usePreference } from '@/hooks/usePreference.js'

const BasicComparison = () => {
  // Preference 설정 훅
  const {
    settings: statisticsSettings,
    updateSettings: updateStatisticsSettings
  } = useStatisticsSettings()
  
  // 전역 Preference 훅 (Dashboard 설정 업데이트용)
  const {
    preferences,
    updatePreference,
    isSaving: preferenceSaving
  } = usePreference()

  // 상태 관리
  const [period1, setPeriod1] = useState({
    startDate: '',
    endDate: '',
    preset: 'last7days'
  })
  
  const [period2, setPeriod2] = useState({
    startDate: '',
    endDate: '',
    preset: 'last14days'
  })
  
  const [selectedPegs, setSelectedPegs] = useState(['availability', 'rrc', 'erab'])
  const [includeOutliers, setIncludeOutliers] = useState(true)
  const [decimalPlaces, setDecimalPlaces] = useState(4)
  
  const [comparisonResults, setComparisonResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastAnalysisTime, setLastAnalysisTime] = useState(null)
  const [selectedResults, setSelectedResults] = useState(new Set())
  
  // 사용 가능한 PEG 옵션 (Database Setting에서 동적으로 로드)
  const [availablePegs, setAvailablePegs] = useState([])
  const [pegOptionsLoading, setPegOptionsLoading] = useState(false)
  const [pegOptionsError, setPegOptionsError] = useState(null)
  
  // PEG 목록 로드 함수
  const fetchAvailablePegs = useCallback(async () => {
    console.log('🔍 Available PEGs 로드 시작')
    setPegOptionsLoading(true)
    setPegOptionsError(null)
    
    try {
      // Database 설정 확인
      const dbConfig = localStorage.getItem('dbConfig')
      const useDbPegs = localStorage.getItem('useDbPegs') === 'true'
      
      console.log('📊 DB 설정 상태:', { 
        hasDbConfig: !!dbConfig, 
        useDbPegs,
        dbConfigData: dbConfig ? JSON.parse(dbConfig) : null 
      })
      
      let pegOptions = []
      
      if (useDbPegs && dbConfig) {
        // Database Setting에서 PEG 목록 가져오기
        console.log('🔗 Database에서 PEG 목록 조회 중...')
        const response = await apiClient.get('/api/master/pegs')
        
        console.log('📥 Database PEG 응답:', response.data)
        
        if (response.data && Array.isArray(response.data)) {
          pegOptions = response.data.map(peg => ({
            value: peg.peg_name || peg.value || peg.id,
            label: peg.display_name || peg.label || `${peg.peg_name} (${peg.unit || 'N/A'})`
          }))
        }
      }
      
      // 기본 PEG 목록 (DB에서 가져오지 못했거나 DB 사용하지 않는 경우)
      if (pegOptions.length === 0) {
        console.log('📝 기본 PEG 목록 사용')
        pegOptions = [
          { value: 'availability', label: 'Availability (%)' },
          { value: 'rrc', label: 'RRC Success Rate (%)' },
          { value: 'erab', label: 'ERAB Success Rate (%)' },
          { value: 'sar', label: 'SAR' },
          { value: 'mobility_intra', label: 'Mobility Intra (%)' },
          { value: 'cqi', label: 'CQI' },
          { value: 'se', label: 'Spectral Efficiency' },
          { value: 'dl_thp', label: 'DL Throughput' },
          { value: 'ul_int', label: 'UL Interference' }
        ]
      }
      
      console.log('✅ PEG 목록 로드 완료:', pegOptions)
      setAvailablePegs(pegOptions)
      
      // 기본 선택된 PEG 설정 (처음 3개)
      if (selectedPegs.length === 0 && pegOptions.length > 0) {
        const defaultPegs = pegOptions.slice(0, 3).map(peg => peg.value)
        setSelectedPegs(defaultPegs)
        console.log('🎯 기본 PEG 선택:', defaultPegs)
      }
      
    } catch (err) {
      console.error('❌ PEG 목록 로드 실패:', err)
      setPegOptionsError(err.message || 'PEG 목록을 불러오는데 실패했습니다')
      
      // 에러 시 기본 목록 사용
      const fallbackPegs = [
        { value: 'availability', label: 'Availability (%)' },
        { value: 'rrc', label: 'RRC Success Rate (%)' },
        { value: 'erab', label: 'ERAB Success Rate (%)' }
      ]
      setAvailablePegs(fallbackPegs)
      
    } finally {
      setPegOptionsLoading(false)
    }
  }, [selectedPegs.length])
  
  // 초기 날짜 설정 및 PEG 목록 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    const today = new Date()
    
    // 기간 1: 최근 7일
    const period1End = new Date(today)
    const period1Start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    // 기간 2: 그 이전 7일
    const period2End = new Date(period1Start)
    const period2Start = new Date(period1Start.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    setPeriod1({
      startDate: period1Start.toISOString().split('T')[0],
      endDate: period1End.toISOString().split('T')[0],
      preset: 'last7days'
    })
    
    setPeriod2({
      startDate: period2Start.toISOString().split('T')[0],
      endDate: period2End.toISOString().split('T')[0],
      preset: 'custom'
    })
    
    // PEG 목록 로드
    fetchAvailablePegs()
  }, [fetchAvailablePegs])
  
  // Settings에서 기본값 가져오기
  useEffect(() => {
    if (statisticsSettings.defaultPegs) {
      setSelectedPegs(statisticsSettings.defaultPegs)
    }
    
    if (statisticsSettings.decimalPlaces !== undefined) {
      setDecimalPlaces(statisticsSettings.decimalPlaces)
    }
    
    if (statisticsSettings.includeOutliers !== undefined) {
      setIncludeOutliers(statisticsSettings.includeOutliers)
    }
  }, [statisticsSettings])
  
  // 날짜 변경 핸들러
  const handlePeriod1Change = useCallback(({ startDate, endDate }) => {
    setPeriod1(prev => ({
      ...prev,
      startDate,
      endDate,
      preset: 'custom'
    }))
  }, [])
  
  const handlePeriod2Change = useCallback(({ startDate, endDate }) => {
    setPeriod2(prev => ({
      ...prev,
      startDate,
      endDate,
      preset: 'custom'
    }))
  }, [])
  
  // PEG 선택 변경 핸들러
  const handlePegToggle = (pegValue) => {
    setSelectedPegs(prev => {
      const isSelected = prev.includes(pegValue)
      const newPegs = isSelected 
        ? prev.filter(p => p !== pegValue)
        : [...prev, pegValue]
      
      // Settings에 저장
      if (updateStatisticsSettings) {
        updateStatisticsSettings({
          defaultPegs: newPegs
        })
      }
      
      return newPegs
    })
  }
  
  // 비교 분석 실행
  const executeComparison = async () => {
    // 유효성 검증
    if (!period1.startDate || !period1.endDate || !period2.startDate || !period2.endDate) {
      toast.error('두 기간의 날짜를 모두 설정해주세요')
      return
    }
    
    if (selectedPegs.length === 0) {
      toast.error('분석할 PEG를 최소 1개 이상 선택해주세요')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      console.log('🔍 Statistics 비교 분석 시작:', {
        period1,
        period2,
        selectedPegs,
        includeOutliers,
        decimalPlaces
      })
      
      // API 요청 페이로드 구성
      const requestPayload = {
        period1: {
          start_date: `${period1.startDate}T00:00:00`,
          end_date: `${period1.endDate}T23:59:59`
        },
        period2: {
          start_date: `${period2.startDate}T00:00:00`,
          end_date: `${period2.endDate}T23:59:59`
        },
        peg_names: selectedPegs,
        include_outliers: includeOutliers,
        decimal_places: decimalPlaces,
        // 필터 옵션 추가 (향후 확장 가능)
        ne_filter: statisticsSettings.defaultNe ? [statisticsSettings.defaultNe] : null,
        cell_id_filter: statisticsSettings.defaultCellId ? [statisticsSettings.defaultCellId] : null
      }
      
      console.log('📤 API 요청 페이로드:', requestPayload)
      
      // API 호출
      const response = await apiClient.post('/api/statistics/compare', requestPayload)
      
      console.log('📥 API 응답:', response.data)
      
      // 결과 저장
      setComparisonResults(response.data)
      setLastAnalysisTime(new Date())
      
      toast.success(`비교 분석 완료! ${response.data.analysis_results?.length || 0}개 PEG 분석됨`)
      
    } catch (err) {
      console.error('❌ 비교 분석 실패:', err)
      
      let errorMessage = '비교 분석 중 오류가 발생했습니다'
      
      if (err.response?.data?.error_message) {
        errorMessage = err.response.data.error_message
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      toast.error(errorMessage)
      
    } finally {
      setLoading(false)
    }
  }
  
  // 결과 선택 토글
  const toggleResultSelection = (pegName) => {
    const newSelected = new Set(selectedResults)
    if (newSelected.has(pegName)) {
      newSelected.delete(pegName)
    } else {
      newSelected.add(pegName)
    }
    setSelectedResults(newSelected)
  }
  
  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedResults.size === comparisonResults?.analysis_results?.length) {
      // 전체 해제
      setSelectedResults(new Set())
    } else {
      // 전체 선택
      const allPegs = comparisonResults?.analysis_results?.map(result => result.peg_name) || []
      setSelectedResults(new Set(allPegs))
    }
  }
  
  // 선택된 결과를 Dashboard에 저장
  const saveToDashboard = async () => {
    if (selectedResults.size === 0) {
      toast.error('저장할 PEG를 선택해주세요')
      return
    }
    
    try {
      console.log('💾 Dashboard에 저장할 PEG:', Array.from(selectedResults))
      
      // 현재 Dashboard 설정 가져오기 - 안전한 접근
      const currentDashboardSettings = preferences?.dashboard || {}
      const currentSelectedPegs = currentDashboardSettings?.selectedPegs || []
      
      // 새로 선택된 PEG 중 중복되지 않은 것들만 추가
      const newPegs = Array.from(selectedResults).filter(peg => !currentSelectedPegs.includes(peg))
      const updatedSelectedPegs = [...currentSelectedPegs, ...newPegs]
      
      console.log('📊 현재 Dashboard PEG:', currentSelectedPegs)
      console.log('🆕 추가할 새 PEG:', newPegs)
      console.log('📈 업데이트된 PEG 목록:', updatedSelectedPegs)
      
      // Preference API를 통해 Dashboard 설정 업데이트
      await updatePreference('dashboard', {
        ...currentDashboardSettings,
        selectedPegs: updatedSelectedPegs
      })
      
      toast.success(`${selectedResults.size}개 PEG가 Dashboard에 추가되었습니다`, {
        description: `총 ${updatedSelectedPegs.length}개 PEG가 Dashboard에 설정되어 있습니다. Dashboard로 이동해서 확인해보세요!`,
        duration: 5000
      })
      
      // 선택 상태 초기화
      setSelectedResults(new Set())
      
    } catch (err) {
      console.error('❌ Dashboard 저장 실패:', err)
      toast.error('Dashboard 저장 중 오류가 발생했습니다', {
        description: err.message || '네트워크 오류일 수 있습니다'
      })
    }
  }
  
  // 분석 가능 상태 확인
  const canAnalyze = period1.startDate && period1.endDate && 
                    period2.startDate && period2.endDate && 
                    selectedPegs.length > 0
  
  // 개선 상태 아이콘 렌더링
  const renderImprovementIcon = (status) => {
    switch (status) {
      case 'improved':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      case 'stable':
        return <Minus className="h-4 w-4 text-blue-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
  }
  
  // 개선 상태 뱃지 렌더링
  const renderImprovementBadge = (status, magnitude) => {
    const colors = {
      improved: 'bg-green-100 text-green-800 border-green-200',
      degraded: 'bg-red-100 text-red-800 border-red-200',
      stable: 'bg-blue-100 text-blue-800 border-blue-200'
    }
    
    const magnitudeText = {
      significant: '상당한',
      moderate: '보통',
      minor: '미미한',
      none: '변화없음'
    }
    
    return (
      <Badge className={`${colors[status] || 'bg-gray-100 text-gray-800'} text-xs`}>
        {renderImprovementIcon(status)}
        <span className="ml-1">
          {status === 'improved' ? '개선' : 
           status === 'degraded' ? '악화' : '안정'}
          {magnitude && ` (${magnitudeText[magnitude]})`}
        </span>
      </Badge>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* 헤더 및 제어 패널 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Basic 비교 분석</h2>
          <p className="text-muted-foreground">
            두 기간의 KPI 데이터를 비교하여 성능 변화를 분석합니다
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {lastAnalysisTime && (
            <Badge variant="outline" className="text-xs">
              마지막 분석: {lastAnalysisTime.toLocaleTimeString('ko-KR')}
            </Badge>
          )}
          
          <Button
            onClick={executeComparison}
            disabled={!canAnalyze || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                비교 분석 실행
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* 설정 패널 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 기간 1 */}
        <DateRangeSelector
          title="기간 1 (기준)"
          description="비교의 기준이 되는 첫 번째 기간"
          startDate={period1.startDate}
          endDate={period1.endDate}
          preset={period1.preset}
          onDateChange={handlePeriod1Change}
          onPresetChange={(preset) => setPeriod1(prev => ({ ...prev, preset }))}
        />
        
        {/* 기간 2 */}
        <DateRangeSelector
          title="기간 2 (비교 대상)"
          description="기준과 비교할 두 번째 기간"
          startDate={period2.startDate}
          endDate={period2.endDate}
          preset={period2.preset}
          onDateChange={handlePeriod2Change}
          onPresetChange={(preset) => setPeriod2(prev => ({ ...prev, preset }))}
        />
        
        {/* 분석 옵션 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              분석 옵션
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* PEG 선택 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center justify-between">
                <span>분석할 PEG</span>
                {pegOptionsLoading && (
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                )}
              </Label>
              
              {pegOptionsError && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {pegOptionsError}
                </div>
              )}
              
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pegOptionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-muted-foreground">PEG 목록 로드 중...</span>
                  </div>
                ) : availablePegs.length > 0 ? (
                  availablePegs.map((peg) => (
                    <div
                      key={peg.value}
                      className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                        selectedPegs.includes(peg.value)
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => handlePegToggle(peg.value)}
                    >
                      <span className="text-sm">{peg.label}</span>
                      {selectedPegs.includes(peg.value) && (
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
                    <p className="text-xs">사용 가능한 PEG가 없습니다</p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {selectedPegs.length}개 선택됨
                </Badge>
                
                {!pegOptionsLoading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchAvailablePegs}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    새로고침
                  </Button>
                )}
              </div>
            </div>
            
            {/* 분석 설정 */}
            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">이상치 포함</Label>
                <Button
                  variant={includeOutliers ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIncludeOutliers(!includeOutliers)}
                >
                  {includeOutliers ? "포함" : "제외"}
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">소수점 자릿수</Label>
                <Select
                  value={decimalPlaces.toString()}
                  onValueChange={(value) => setDecimalPlaces(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2자리</SelectItem>
                    <SelectItem value="3">3자리</SelectItem>
                    <SelectItem value="4">4자리</SelectItem>
                    <SelectItem value="5">5자리</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 오류 메시지 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-red-700 font-medium">분석 오류</span>
            </div>
            <p className="text-red-600 mt-2">{error}</p>
          </CardContent>
        </Card>
      )}
      
      {/* 분석 결과 */}
      {comparisonResults && (
        <div className="space-y-6">
          <Separator />
          
          <div>
            <h3 className="text-xl font-semibold mb-4">비교 분석 결과</h3>
            
            {/* 차트 시각화 */}
            <div className="mb-6">
              <ComparisonChart 
                comparisonResults={comparisonResults}
                title="PEG 비교 분석 차트"
                showControls={true}
                defaultChartType="bar"
                height={400}
              />
            </div>
            
            {/* 요약 정보 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {comparisonResults.summary?.total_pegs_analyzed || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">분석된 PEG</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {comparisonResults.summary?.improved_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">개선</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {comparisonResults.summary?.degraded_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">악화</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {comparisonResults.summary?.stable_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">안정</div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* 상세 결과 - 탭으로 구분 */}
            <Card>
              <CardHeader>
                <CardTitle>상세 비교 결과</CardTitle>
              </CardHeader>
              
              <CardContent>
                <Tabs defaultValue="table" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="table" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      테이블 뷰
                    </TabsTrigger>
                    <TabsTrigger value="chart" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      차트 뷰
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="table" className="space-y-4">
                    {/* 선택 컨트롤 */}
                    {comparisonResults?.analysis_results?.length > 0 && (
                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedResults.size === comparisonResults.analysis_results.length && selectedResults.size > 0}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-medium">
                              전체 선택 ({selectedResults.size}/{comparisonResults.analysis_results.length})
                            </span>
                          </div>
                          {selectedResults.size > 0 && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              {selectedResults.size}개 선택됨
                            </Badge>
                          )}
                        </div>
                        
                        {selectedResults.size > 0 && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedResults(new Set())}
                            >
                              선택 해제
                            </Button>
                            <Button
                              size="sm"
                              onClick={saveToDashboard}
                              disabled={preferenceSaving}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
                            >
                              {preferenceSaving ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  저장 중...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  Dashboard에 저장
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <ScrollArea className="h-96">
                      <div className="space-y-4">
                        {comparisonResults.analysis_results?.map((result, index) => (
                          <Card key={index} className={`border-l-4 border-l-blue-500 ${
                            selectedResults.has(result.peg_name) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                          }`}>
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedResults.has(result.peg_name)}
                                    onChange={() => toggleResultSelection(result.peg_name)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <h4 className="font-semibold">{result.peg_name}</h4>
                                </div>
                                {renderImprovementBadge(result.improvement_status, result.improvement_magnitude)}
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">기간 1 평균</span>
                                  <div className="font-medium">{result.period1_stats?.mean}</div>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground">기간 2 평균</span>
                                  <div className="font-medium">{result.period2_stats?.mean}</div>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground">Delta</span>
                                  <div className={`font-medium ${
                                    result.delta > 0 ? 'text-green-600' :
                                    result.delta < 0 ? 'text-red-600' : 'text-blue-600'
                                  }`}>
                                    {result.delta > 0 ? '+' : ''}{result.delta}
                                  </div>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground">Delta %</span>
                                  <div className={`font-medium ${
                                    result.delta_percentage > 0 ? 'text-green-600' :
                                    result.delta_percentage < 0 ? 'text-red-600' : 'text-blue-600'
                                  }`}>
                                    {result.delta_percentage > 0 ? '+' : ''}{result.delta_percentage}%
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t text-sm">
                                <div>
                                  <span className="text-muted-foreground">기간 1 RSD</span>
                                  <div className="font-medium">{result.rsd_period1}%</div>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground">기간 2 RSD</span>
                                  <div className="font-medium">{result.rsd_period2}%</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="chart">
                    <div className="space-y-4">
                      {/* 다양한 차트 타입 보기 */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ComparisonChart 
                          comparisonResults={comparisonResults}
                          title="막대 차트"
                          showControls={false}
                          defaultChartType="bar"
                          height={300}
                        />
                        
                        <ComparisonChart 
                          comparisonResults={comparisonResults}
                          title="라인 차트"
                          showControls={false}
                          defaultChartType="line"
                          height={300}
                        />
                        
                        <ComparisonChart 
                          comparisonResults={comparisonResults}
                          title="개선 상태 분포"
                          showControls={false}
                          defaultChartType="pie"
                          height={300}
                        />
                        
                        <ComparisonChart 
                          comparisonResults={comparisonResults}
                          title="레이더 차트"
                          showControls={false}
                          defaultChartType="radar"
                          height={300}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {/* 분석 대기 상태 */}
      {!comparisonResults && !error && (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">비교 분석 준비</h3>
            <p className="text-muted-foreground mb-4">
              두 기간과 분석할 PEG를 선택한 후 '비교 분석 실행' 버튼을 클릭하세요
            </p>
            <Badge variant="outline">
              {canAnalyze ? "분석 준비 완료" : "설정 필요"}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default BasicComparison
