import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { RefreshCw, Settings, Clock } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'
import { useDashboardSettings } from '@/hooks/usePreference.js'

const Dashboard = () => {
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshCountdown, setRefreshCountdown] = useState(0)
  const refreshIntervalRef = useRef(null)
  const countdownIntervalRef = useRef(null)

  // usePreference 훅 사용
  const {
    settings: dashboardSettings,
    updateSettings: updateDashboardSettings,
    saving,
    error: settingsError
  } = useDashboardSettings()

  const defaultKpiKeys = ['availability','rrc','erab','sar','mobility_intra','cqi']
  
  // 현재 설정에서 값 추출 (기본값 포함)
  const selectedPegs = dashboardSettings.selectedPegs?.length > 0 ? dashboardSettings.selectedPegs : defaultKpiKeys
  const defaultNe = dashboardSettings.defaultNe || ''
  const defaultCellId = dashboardSettings.defaultCellId || ''
  const autoRefreshInterval = dashboardSettings.autoRefreshInterval || 30
  const chartStyle = dashboardSettings.chartStyle || 'line'
  const showLegend = dashboardSettings.showLegend !== false
  const showGrid = dashboardSettings.showGrid !== false

  const titleFor = (key) => ({
    availability: 'Availability (%)',
    rrc: 'RRC Success Rate (%)',
    erab: 'ERAB Success Rate (%)',
    sar: 'SAR',
    mobility_intra: 'Mobility Intra (%)',
    cqi: 'CQI',
  }[key] || key)

  const colorFor = (index) => {
    const preset = ['#8884d8','#82ca9d','#ffc658','#ff7300','#8dd1e1','#d084d0']
    if (index < preset.length) return preset[index]
    const hue = (index * 47) % 360
    return `hsl(${hue}, 70%, 50%)`
  }

  const kpiTypes = [
    { key: 'availability', title: 'Availability (%)', color: '#8884d8' },
    { key: 'rrc', title: 'RRC Success Rate (%)', color: '#82ca9d' },
    { key: 'erab', title: 'ERAB Success Rate (%)', color: '#ffc658' },
    { key: 'sar', title: 'SAR', color: '#ff7300' },
    { key: 'mobility_intra', title: 'Mobility Intra (%)', color: '#8dd1e1' },
    { key: 'cqi', title: 'CQI', color: '#d084d0' }
  ]

  // 데이터 fetching 함수
  const fetchKPIData = async () => {
    try {
      setLoading(true)
      console.log('[Dashboard] 데이터 fetching 시작', {
        selectedPegs,
        defaultNe,
        defaultCellId,
        chartStyle
      })

      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // 새로운 API 형식으로 요청
      const requests = selectedPegs.map(kt => apiClient.post('/api/kpi/query', {
        start_date: startDate,
        end_date: endDate,
        kpi_type: kt,
        ne: defaultNe,
        cellid: defaultCellId,
        ids: 2 // Mock 데이터용
      }))

      const responses = await Promise.all(requests)
      const dataByKpi = {}
      
      responses.forEach((res, idx) => { 
        dataByKpi[selectedPegs[idx]] = res?.data?.data || [] 
      })
      
      setKpiData(dataByKpi)
      setLastRefresh(new Date())
      
      console.log('[Dashboard] 데이터 fetching 완료', {
        kpiCount: Object.keys(dataByKpi).length,
        totalRows: Object.values(dataByKpi).reduce((sum, arr) => sum + arr.length, 0)
      })
      
    } catch (error) {
      console.error('[Dashboard] 데이터 fetching 오류:', error)
    } finally {
      setLoading(false)
    }
  }

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
  }, [autoRefreshInterval])

  // 설정 변경 시 데이터 다시 로드
  useEffect(() => {
    fetchKPIData()
  }, [selectedPegs, defaultNe, defaultCellId])

  // 수동 새로고침
  const handleManualRefresh = () => {
    console.log('[Dashboard] 수동 새로고침 실행')
    fetchKPIData()
  }

  const formatChartData = (data) => {
    if (!data || data.length === 0) return []
    
    const groupedByTime = data.reduce((acc, item) => {
      const time = new Date(item.timestamp).toLocaleDateString()
      if (!acc[time]) acc[time] = { time }
      acc[time][item.entity_id] = item.value
      return acc
    }, {})

    return Object.values(groupedByTime)
  }

  // 차트 스타일에 따른 컴포넌트 선택
  const renderChart = (chartData, key, idx) => {
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
              {entities.map((entity, index) => (
                <Area
                  key={entity}
                  type="monotone"
                  dataKey={entity}
                  stroke={colorFor((idx + index) % 12)}
                  fill={colorFor((idx + index) % 12)}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...chartProps}>
              {commonElements}
              {entities.map((entity, index) => (
                <Bar
                  key={entity}
                  dataKey={entity}
                  fill={colorFor((idx + index) % 12)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
      
      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...chartProps}>
              {commonElements}
              {entities.map((entity, index) => (
                <Line
                  key={entity}
                  type="monotone"
                  dataKey={entity}
                  stroke={colorFor((idx + index) % 12)}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
    }
  }

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
      {/* 헤더 및 컨트롤 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">
            {selectedPegs.length}개 PEG 항목 • 차트 스타일: {chartStyle}
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
          const chartData = formatChartData(kpiData[key] || [])
          const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(k => k !== 'time') : []
          
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {titleFor(key)}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {entities.length}개 엔터티
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {chartData.length}개 데이터포인트
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
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
        })}
      </div>

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

