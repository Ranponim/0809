import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import { Label } from '@/components/ui/label.jsx'
import { RefreshCw, Settings, Clock, Calendar, Check, X } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'
import { useDashboardSettings, usePreference } from '@/hooks/usePreference.js'

const Dashboard = () => {
  const [kpiData, setKpiData] = useState({})
  const [time2Data, setTime2Data] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshCountdown, setRefreshCountdown] = useState(0)
  const [zoomed, setZoomed] = useState({ open: false, title: '', data: [] })
  const refreshIntervalRef = useRef(null)
  const countdownIntervalRef = useRef(null)

  // 임시 시간 입력 상태
  const [tempTimeSettings, setTempTimeSettings] = useState({
    time1Start: '',
    time1End: '',
    time2Start: '',
    time2End: ''
  })

  // 입력 완료 상태
  const [inputCompleted, setInputCompleted] = useState({
    time1: false,
    time2: false
  })

  // usePreference 훅 사용 - 항상 호출
  const {
    settings: dashboardSettings = {},
    saving = false,
    error: settingsError = null,
    updateSettings = () => {}
  } = useDashboardSettings()

  // usePreference 훅 사용 - 항상 호출
  const { settings: pref = {} } = usePreference()

  // 안전한 설정 값 추출
  const selectedPegs = useMemo(() => {
    return Array.isArray(dashboardSettings?.selectedPegs) ? dashboardSettings.selectedPegs : []
  }, [dashboardSettings?.selectedPegs])

  const statisticsSel = useMemo(() => {
    return pref?.statisticsSettings || {}
  }, [pref?.statisticsSettings])

  const selectedNEs = useMemo(() => {
    return Array.isArray(statisticsSel.selectedNEs) ? statisticsSel.selectedNEs : []
  }, [statisticsSel.selectedNEs])

  const selectedCellIds = useMemo(() => {
    return Array.isArray(statisticsSel.selectedCellIds) ? statisticsSel.selectedCellIds : []
  }, [statisticsSel.selectedCellIds])

  const autoRefreshInterval = useMemo(() => {
    return dashboardSettings?.autoRefreshInterval || 30
  }, [dashboardSettings?.autoRefreshInterval])

  const chartStyle = useMemo(() => {
    return dashboardSettings?.chartStyle || 'line'
  }, [dashboardSettings?.chartStyle])

  const chartLayout = useMemo(() => {
    return dashboardSettings?.chartLayout || 'byPeg'
  }, [dashboardSettings?.chartLayout])

  const showLegend = useMemo(() => {
    return dashboardSettings?.showLegend !== false
  }, [dashboardSettings?.showLegend])

  const showGrid = useMemo(() => {
    return dashboardSettings?.showGrid !== false
  }, [dashboardSettings?.showGrid])

  const defaultNe = useMemo(() => {
    return dashboardSettings?.defaultNe || ''
  }, [dashboardSettings?.defaultNe])

  const defaultCellId = useMemo(() => {
    return dashboardSettings?.defaultCellId || ''
  }, [dashboardSettings?.defaultCellId])
  
  // Time1/Time2 비교 설정
  const defaultTimeRange = useMemo(() => {
    return dashboardSettings?.defaultTimeRange || 30
  }, [dashboardSettings?.defaultTimeRange])

  const time1Start = useMemo(() => {
    return dashboardSettings?.time1Start || ''
  }, [dashboardSettings?.time1Start])

  const time1End = useMemo(() => {
    return dashboardSettings?.time1End || ''
  }, [dashboardSettings?.time1End])

  const time2Start = useMemo(() => {
    return dashboardSettings?.time2Start || ''
  }, [dashboardSettings?.time2Start])

  const time2End = useMemo(() => {
    return dashboardSettings?.time2End || ''
  }, [dashboardSettings?.time2End])

  const enableTimeComparison = useMemo(() => {
    return dashboardSettings?.enableTimeComparison || false
  }, [dashboardSettings?.enableTimeComparison])

  // 설정 업데이트 함수들
  const updateDefaultTimeRange = useCallback((value) => {
    console.log('[Dashboard] 기본시간범위 업데이트:', value)
    updateSettings({ defaultTimeRange: parseInt(value) })
  }, [updateSettings])

  const updateEnableTimeComparison = useCallback((checked) => {
    console.log('[Dashboard] 토글 상태 변경:', checked)
    updateSettings({ enableTimeComparison: checked })
  }, [updateSettings])

  // 임시 시간 설정 업데이트
  const updateTempTimeSetting = useCallback((type, field, value) => {
    console.log('[Dashboard] 임시 시간 설정 업데이트:', type, field, value)
    setTempTimeSettings(prev => ({
      ...prev,
      [`${type}${field}`]: value
    }))
  }, [])

  // Time1 설정 적용
  const applyTime1Settings = useCallback(() => {
    if (tempTimeSettings.time1Start && tempTimeSettings.time1End) {
      console.log('[Dashboard] Time1 설정 적용:', tempTimeSettings.time1Start, tempTimeSettings.time1End)
      updateSettings({
        time1Start: tempTimeSettings.time1Start,
        time1End: tempTimeSettings.time1End
      })
      setInputCompleted(prev => ({ ...prev, time1: true }))
    }
  }, [tempTimeSettings.time1Start, tempTimeSettings.time1End, updateSettings])

  // Time2 설정 적용
  const applyTime2Settings = useCallback(() => {
    if (tempTimeSettings.time2Start && tempTimeSettings.time2End) {
      console.log('[Dashboard] Time2 설정 적용:', tempTimeSettings.time2Start, tempTimeSettings.time2End)
      updateSettings({
        time2Start: tempTimeSettings.time2Start,
        time2End: tempTimeSettings.time2End
      })
      setInputCompleted(prev => ({ ...prev, time2: true }))
    }
  }, [tempTimeSettings.time2Start, tempTimeSettings.time2End, updateSettings])

  // 토글 상태 변경 감지
  useEffect(() => {
    console.log('[Dashboard] enableTimeComparison 상태 변경:', enableTimeComparison)
  }, [enableTimeComparison])

  // 실제 시간 설정이 변경되면 임시 상태도 업데이트
  useEffect(() => {
    setTempTimeSettings(prev => ({
      ...prev,
      time1Start: time1Start || '',
      time1End: time1End || '',
      time2Start: time2Start || '',
      time2End: time2End || ''
    }))
  }, [time1Start, time1End, time2Start, time2End])

  const titleFor = useCallback((key) => key, [])

  const colorFor = useCallback((index) => {
    const preset = ['#8884d8','#82ca9d','#ffc658','#ff7300','#8dd1e1','#d084d0']
    if (index < preset.length) return preset[index]
    const hue = (index * 47) % 360
    return `hsl(${hue}, 70%, 50%)`
  }, [])

  // 데이터 fetching 함수
  const fetchKPIData = useCallback(async () => {
    // 안전한 기본값 설정
    const safeSelectedPegs = selectedPegs.length > 0 ? selectedPegs : ['randomaccessproblem']
    const safeSelectedNEs = selectedNEs.length > 0 ? selectedNEs : ['NVGNB#101086']
    const safeSelectedCellIds = selectedCellIds.length > 0 ? selectedCellIds.map(id => parseInt(id)) : [8418]

    console.log('[Dashboard] 데이터 fetching 시작 - 상태 확인', {
      selectedPegs,
      safeSelectedPegs,
      selectedNEs,
      safeSelectedNEs,
      selectedCellIds,
      safeSelectedCellIds,
      defaultNe,
      defaultCellId,
      enableTimeComparison,
      time1Start,
      time1End,
      time2Start,
      time2End
    })

    if (safeSelectedPegs.length === 0) {
      console.log('[Dashboard] 선택된 PEG가 없음 - 데이터 fetching 중단')
      setKpiData({})
      setTime2Data(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Time1/Time2 비교 모드인 경우
      if (enableTimeComparison && time1Start && time1End && time2Start && time2End) {
        console.log('[Dashboard] Time1/Time2 비교 모드로 데이터 fetching')
        
        // Time1 API 파라미터
        const time1Params = {
          start_date: time1Start,
          end_date: time1End,
          kpi_types: safeSelectedPegs,
          ne: safeSelectedNEs,
          cellid: safeSelectedCellIds,
        }
        
        console.log('[Dashboard] Time1 API 파라미터:', time1Params)
        
        // Time1 데이터 가져오기
        const time1Response = await apiClient.post('/api/kpi/query', time1Params)

        // Time2 API 파라미터
        const time2Params = {
          start_date: time2Start,
          end_date: time2End,
          kpi_types: safeSelectedPegs,
          ne: safeSelectedNEs,
          cellid: safeSelectedCellIds,
        }
        
        console.log('[Dashboard] Time2 API 파라미터:', time2Params)
        
        // Time2 데이터 가져오기
        const time2Response = await apiClient.post('/api/kpi/query', time2Params)

        const time1Data = time1Response?.data?.data || {}
        const time2Data = time2Response?.data?.data || {}

        setKpiData(time1Data)
        setTime2Data(time2Data)
        
        console.log('[Dashboard] Time1/Time2 데이터 fetching 완료', {
          time1KpiCount: Object.keys(time1Data).length,
          time1TotalRows: Object.values(time1Data).reduce((sum, arr) => sum + (arr?.length || 0), 0),
          time2KpiCount: Object.keys(time2Data).length,
          time2TotalRows: Object.values(time2Data).reduce((sum, arr) => sum + (arr?.length || 0), 0),
          time1DataKeys: Object.keys(time1Data),
          time2DataKeys: Object.keys(time2Data)
        })
      } else {
        // 일반 모드
        console.log('[Dashboard] 일반 모드로 데이터 fetching')
        
        const end = new Date()
        const start = new Date(end.getTime() - (dashboardSettings?.defaultHours || 1) * 60 * 60 * 1000)

        const generalParams = {
          kpi_types: safeSelectedPegs,
          ne: safeSelectedNEs,
          cellid: safeSelectedCellIds,
          start: start.toISOString(),
          end: end.toISOString()
        }
        
        console.log('[Dashboard] 일반 모드 API 파라미터:', generalParams)

        const response = await apiClient.post('/api/kpi/timeseries', generalParams)

      const dataByKpi = response?.data?.data || {}

      setKpiData(dataByKpi)
        setTime2Data(null)
      
        console.log('[Dashboard] 일반 모드 데이터 fetching 완료', {
        kpiCount: Object.keys(dataByKpi).length,
          totalRows: Object.values(dataByKpi).reduce((sum, arr) => sum + (arr?.length || 0), 0),
          dataKeys: Object.keys(dataByKpi)
      })
      }
      
      setLastRefresh(new Date())
    } catch (error) {
      console.error('[Dashboard] 데이터 fetching 오류:', error)
      setKpiData({}) // 오류 발생 시 데이터 초기화
      setTime2Data(null)
    } finally {
      setLoading(false)
    }
  }, [selectedPegs, selectedNEs, selectedCellIds, dashboardSettings?.defaultHours, defaultNe, defaultCellId, enableTimeComparison, time1Start, time1End, time2Start, time2End])

  // 자동 새로고침 설정
  useEffect(() => {
    // 기존 타이머 정리
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    // 자동 새로고침 간격이 설정된 경우만 타이머 설정
    if (autoRefreshInterval > 0) {
      console.log('[Dashboard] 자동 새로고침 설정:', autoRefreshInterval, '초')
      
      // 데이터 새로고침 타이머
      refreshIntervalRef.current = setInterval(() => {
        fetchKPIData()
      }, autoRefreshInterval * 1000)

      // 카운트다운 타이머
      setRefreshCountdown(autoRefreshInterval)
      countdownIntervalRef.current = setInterval(() => {
        setRefreshCountdown(prev => {
          if (prev <= 1) {
            return autoRefreshInterval
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [autoRefreshInterval, fetchKPIData])

  // 설정 변경 시 데이터 다시 로드
  useEffect(() => {
    fetchKPIData()
  }, [fetchKPIData])

  // 수동 새로고침
  const handleManualRefresh = useCallback(() => {
    console.log('[Dashboard] 수동 새로고침 실행')
    fetchKPIData()
  }, [fetchKPIData])

  // 차트 스타일에 따른 컴포넌트 선택
  const renderChart = useCallback((chartData, key, idx) => {
    const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []
    
    const chartProps = {
      data: chartData,
      className: "h-64"
    }

    const commonElements = [
      showGrid && <CartesianGrid key="grid" strokeDasharray="3 3" />,
      <XAxis key="xaxis" dataKey="time" />,
      <YAxis key="yaxis" />,
      <Tooltip key="tooltip" />,
      showLegend && <Legend key="legend" />
    ].filter(Boolean)

    switch (chartStyle) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...chartProps}>
              {commonElements}
              {entities.map((entity, index) => {
                if (enableTimeComparison && entity.includes('_Time')) {
                  const baseEntity = entity.replace('_Time1', '').replace('_Time2', '')
                  const isTime1 = entity.includes('_Time1')
                  return (
                    <Area
                      key={entity}
                      type="monotone"
                      dataKey={entity}
                      stroke={colorFor((idx + index) % 12)}
                      fill={colorFor((idx + index) % 12)}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      strokeDasharray={isTime1 ? undefined : "5 5"}
                      name={`${baseEntity} (${isTime1 ? 'Time1' : 'Time2'})`}
                    />
                  )
                } else {
                  return (
                    <Area
                      key={entity}
                      type="monotone"
                      dataKey={entity}
                      stroke={colorFor((idx + index) % 12)}
                      fill={colorFor((idx + index) % 12)}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  )
                }
              })}
            </AreaChart>
          </ResponsiveContainer>
        )
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...chartProps}>
              {commonElements}
              {entities.map((entity, index) => {
                if (enableTimeComparison && entity.includes('_Time')) {
                  const baseEntity = entity.replace('_Time1', '').replace('_Time2', '')
                  const isTime1 = entity.includes('_Time1')
                  return (
                    <Bar
                      key={entity}
                      dataKey={entity}
                      fill={colorFor((idx + index) % 12)}
                      name={`${baseEntity} (${isTime1 ? 'Time1' : 'Time2'})`}
                    />
                  )
                } else {
                  return (
                    <Bar
                      key={entity}
                      dataKey={entity}
                      fill={colorFor((idx + index) % 12)}
                    />
                  )
                }
              })}
            </BarChart>
          </ResponsiveContainer>
        )
      
      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...chartProps}>
              {commonElements}
              {entities.map((entity, index) => {
                if (enableTimeComparison && entity.includes('_Time')) {
                  const baseEntity = entity.replace('_Time1', '').replace('_Time2', '')
                  const isTime1 = entity.includes('_Time1')
                  return (
                    <Line
                      key={entity}
                      type="monotone"
                      dataKey={entity}
                      stroke={colorFor((idx + index) % 12)}
                      strokeWidth={2}
                      strokeDasharray={isTime1 ? undefined : "5 5"}
                      name={`${baseEntity} (${isTime1 ? 'Time1' : 'Time2'})`}
                    />
                  )
                } else {
                  return (
                    <Line
                      key={entity}
                      type="monotone"
                      dataKey={entity}
                      stroke={colorFor((idx + index) % 12)}
                      strokeWidth={2}
                    />
                  )
                }
              })}
            </LineChart>
          </ResponsiveContainer>
        )
    }
  }, [chartStyle, showGrid, showLegend, enableTimeComparison, colorFor])

  const buildChartDataByLayout = useCallback((kpiKey) => {
    const flatRows = Array.isArray(kpiData[kpiKey]) ? kpiData[kpiKey] : []
    const time2Rows = enableTimeComparison && time2Data ? (Array.isArray(time2Data[kpiKey]) ? time2Data[kpiKey] : []) : []
    
    if (flatRows.length === 0 && time2Rows.length === 0) return []

    if (chartLayout === 'byPeg') {
      // 시간축 + entity_id 별 series
      const groupedByTime = {}
      
      // Time1 데이터 처리
      flatRows.forEach(row => {
        const t = new Date(row.timestamp).toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
        if (!groupedByTime[t]) groupedByTime[t] = { time: t }
        const entityKey = enableTimeComparison ? `${row.entity_id}_Time1` : row.entity_id
        groupedByTime[t][entityKey] = row.value
      })
      
      // Time2 데이터 처리 (비교 모드인 경우)
      if (enableTimeComparison) {
        time2Rows.forEach(row => {
          const t = new Date(row.timestamp).toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
          if (!groupedByTime[t]) groupedByTime[t] = { time: t }
          const entityKey = `${row.entity_id}_Time2`
          groupedByTime[t][entityKey] = row.value
        })
      }
      
      return Object.values(groupedByTime)
    } else {
      // byEntity: entity 기준으로 PEG 시리즈 구성 -> UI에서 카드 단위 핸들링 필요
      const byEntity = {}
      flatRows.forEach(row => {
        const t = new Date(row.timestamp).toLocaleString()
        const entity = row.entity_id
        byEntity[entity] = byEntity[entity] || {}
        byEntity[entity][t] = byEntity[entity][t] || { time: t }
        byEntity[entity][t][row.peg_name] = row.value
      })
    const result = {}
      Object.keys(byEntity).forEach(entity => {
        result[entity] = Object.values(byEntity[entity]).sort((a,b)=> new Date(a.time)-new Date(b.time))
    })
    return result
    }
  }, [kpiData, time2Data, enableTimeComparison, chartLayout])

  if (loading) {
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <div className="flex items-center gap-2">
            {saving && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                설정 저장 중
              </Badge>
            )}
            {settingsError && (
              <Badge variant="destructive" className="text-xs">
                설정 오류
              </Badge>
            )}
          </div>
        </div>

        {/* 로딩 카드들 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedPegs.map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {titleFor(key)}
                  <Badge variant="outline" className="text-xs">
                    {chartStyle}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <div className="text-muted-foreground">Loading...</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 기본시간 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            기본시간 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 기본 시간 범위 */}
          <div>
            <Label htmlFor="defaultTimeRange" className="text-sm font-medium">
              기본 시간 범위
            </Label>
            <Select value={defaultTimeRange.toString()} onValueChange={updateDefaultTimeRange}>
              <SelectTrigger>
                <SelectValue placeholder="시간 범위 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5분</SelectItem>
                <SelectItem value="15">15분</SelectItem>
                <SelectItem value="30">30분</SelectItem>
                <SelectItem value="60">1시간</SelectItem>
                <SelectItem value="120">2시간</SelectItem>
                <SelectItem value="360">6시간</SelectItem>
                <SelectItem value="720">12시간</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time1/Time2 비교 설정 */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="enableTimeComparison"
                checked={enableTimeComparison}
                onCheckedChange={updateEnableTimeComparison}
              />
              <Label htmlFor="enableTimeComparison" className="text-sm font-medium">
                Time1/Time2 비교 활성화
              </Label>
            </div>

            {enableTimeComparison && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* Time1 설정 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-blue-600">Time1 설정</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="time1Start" className="text-xs text-muted-foreground">
                          시작 시간
                        </Label>
                        <input
                          type="datetime-local"
                          id="time1Start"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          value={tempTimeSettings.time1Start}
                          onChange={(e) => updateTempTimeSetting('time1', 'Start', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="time1End" className="text-xs text-muted-foreground">
                          끝 시간
                        </Label>
                        <input
                          type="datetime-local"
                          id="time1End"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          value={tempTimeSettings.time1End}
                          onChange={(e) => updateTempTimeSetting('time1', 'End', e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={applyTime1Settings}
                        disabled={!tempTimeSettings.time1Start || !tempTimeSettings.time1End || inputCompleted.time1}
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {inputCompleted.time1 ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Time1 설정 완료
                          </>
                        ) : (
                          'Time1 설정 입력'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Time2 설정 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-green-600">Time2 설정</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="time2Start" className="text-xs text-muted-foreground">
                          시작 시간
                        </Label>
                        <input
                          type="datetime-local"
                          id="time2Start"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          value={tempTimeSettings.time2Start}
                          onChange={(e) => updateTempTimeSetting('time2', 'Start', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="time2End" className="text-xs text-muted-foreground">
                          끝 시간
                        </Label>
                        <input
                          type="datetime-local"
                          id="time2End"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          value={tempTimeSettings.time2End}
                          onChange={(e) => updateTempTimeSetting('time2', 'End', e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={applyTime2Settings}
                        disabled={!tempTimeSettings.time2Start || !tempTimeSettings.time2End || inputCompleted.time2}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {inputCompleted.time2 ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Time2 설정 완료
                          </>
                        ) : (
                          'Time2 설정 입력'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Time1/Time2 비교 데이터 로드 버튼 */}
                <div className="flex justify-center">
                  <Button 
                    onClick={handleManualRefresh}
                    disabled={loading || !inputCompleted.time1 || !inputCompleted.time2}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {loading ? '데이터 로딩 중...' : 'Time1/Time2 비교 데이터 로드'}
                  </Button>
                </div>

                {/* 입력 상태 표시 */}
                <div className="flex justify-center gap-4 text-xs">
                  <div className={`flex items-center gap-1 ${inputCompleted.time1 ? 'text-green-600' : 'text-gray-500'}`}>
                    {inputCompleted.time1 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Time1 설정 {inputCompleted.time1 ? '완료' : '대기'}
                  </div>
                  <div className={`flex items-center gap-1 ${inputCompleted.time2 ? 'text-green-600' : 'text-gray-500'}`}>
                    {inputCompleted.time2 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Time2 설정 {inputCompleted.time2 ? '완료' : '대기'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 일반 데이터 새로고침 버튼 */}
          {!enableTimeComparison && (
            <Button 
              onClick={handleManualRefresh} 
              disabled={loading}
              className="w-full"
            >
              {loading ? '데이터 로딩 중...' : '데이터 새로고침'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 헤더 및 컨트롤 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">
            {selectedPegs.length}개 PEG 항목 • 차트 스타일: {chartStyle}
            {enableTimeComparison && ' • Time1/Time2 비교 모드'}
            {defaultNe && ` • NE: ${defaultNe}`}
            {defaultCellId && ` • Cell: ${defaultCellId}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 상태 뱃지들 */}
          {saving && (
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              설정 저장 중
            </Badge>
          )}
          
          {settingsError && (
            <Badge variant="destructive" className="text-xs">
              설정 오류
            </Badge>
          )}

          {/* Time1/Time2 비교 뱃지 */}
          {enableTimeComparison && (
            <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
              Time1/Time2 비교
            </Badge>
          )}

          {/* 자동 새로고침 카운트다운 */}
          {autoRefreshInterval > 0 && refreshCountdown > 0 && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {refreshCountdown}초 후 새로고침
            </Badge>
          )}

          {/* 마지막 새로고침 시간 */}
          {lastRefresh && (
            <Badge variant="secondary" className="text-xs">
              마지막 업데이트: {lastRefresh.toLocaleTimeString()}
            </Badge>
          )}

          {/* 수동 새로고침 버튼 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 설정 요약 */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">
          선택된 PEG: {selectedPegs.join(', ')}
        </Badge>
        {enableTimeComparison && (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            Time1/Time2 비교 활성화
          </Badge>
        )}
        {autoRefreshInterval > 0 && (
          <Badge variant="outline">
            자동 새로고침: {autoRefreshInterval}초
          </Badge>
        )}
        <Badge variant="outline">
          차트 스타일: {chartStyle}
        </Badge>
        {!showLegend && <Badge variant="secondary">범례 숨김</Badge>}
        {!showGrid && <Badge variant="secondary">격자 숨김</Badge>}
      </div>

      {/* KPI 차트들 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedPegs.map((key, idx) => {
          const built = buildChartDataByLayout(key)
          if (chartLayout === 'byPeg') {
            const chartData = Array.isArray(built) ? built : []
            const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(k => k !== 'time') : []
            return (
              <Card key={`${key}-${idx}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {titleFor(key)}
                    <div className="flex items-center gap-2">
                      {enableTimeComparison && (
                        <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                          Time1/Time2 비교
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {entities.length}개 시리즈
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {chartData.length}개 데이터포인트
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 cursor-zoom-in" onClick={() => setZoomed({ open: true, title: titleFor(key), data: chartData })}>
                    {chartData.length > 0 ? (
                      renderChart(chartData, key, idx)
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        데이터가 없습니다
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          } else {
            // byEntity: entity 카드 반복, 각 카드에서 PEG 시리즈 표시
            const byEntity = built || {}
            return Object.keys(byEntity).map((entityId, eIdx) => {
              const chartData = byEntity[entityId]
              const series = chartData.length > 0 ? Object.keys(chartData[0]).filter(k => k !== 'time') : []
              return (
                <Card key={`${key}-${entityId}-${eIdx}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {entityId}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {series.length}개 시리즈
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {chartData.length}개 데이터포인트
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 cursor-zoom-in" onClick={() => setZoomed({ open: true, title: entityId, data: chartData })}>
                      {chartData.length > 0 ? (
                        renderChart(chartData, `${key}-${entityId}`, idx + eIdx)
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          데이터가 없습니다
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          }
        })}
      </div>

      {/* 확대 다이얼로그 */}
      <Dialog open={zoomed.open} onOpenChange={(open) => setZoomed(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{zoomed.title}</DialogTitle>
          </DialogHeader>
          <div className="h-[480px]">
            {Array.isArray(zoomed.data) && zoomed.data.length > 0 && renderChart(zoomed.data, 'zoom', 0)}
          </div>
        </DialogContent>
      </Dialog>

      {/* 빈 상태 */}
      {selectedPegs.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">표시할 PEG가 선택되지 않았습니다</h3>
              <p className="text-muted-foreground">
                Preference 메뉴에서 표시할 PEG 항목을 선택하세요.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Dashboard

