import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { RefreshCw, Settings, Clock } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'
import { useDashboardSettings } from '@/hooks/usePreference.js'

/**
 * 최적화된 KPI 차트 컴포넌트
 * React.memo를 사용하여 불필요한 리렌더링 방지
 */
const KPIChart = memo(({ 
  chartData, 
  chartStyle, 
  showGrid, 
  showLegend, 
  colorFor, 
  idx 
}) => {
  console.log(`[KPIChart] 렌더링 - 스타일: ${chartStyle}, 데이터포인트: ${chartData.length}`)
  
  // 엔터티 목록을 메모이제이션
  const entities = useMemo(() => {
    return chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []
  }, [chartData])
  
  // 차트 속성을 메모이제이션
  const chartProps = useMemo(() => ({
    data: chartData,
    className: "h-64"
  }), [chartData])

  // 공통 차트 요소들을 메모이제이션
  const commonElements = useMemo(() => [
    showGrid && <CartesianGrid key="grid" strokeDasharray="3 3" />,
    <XAxis key="xaxis" dataKey="time" />,
    <YAxis key="yaxis" />,
    <Tooltip key="tooltip" />,
    showLegend && <Legend key="legend" />
  ].filter(Boolean), [showGrid, showLegend])

  // 차트 렌더링 함수를 메모이제이션
  const chartComponent = useMemo(() => {
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
  }, [chartStyle, chartProps, commonElements, entities, colorFor, idx])

  return chartComponent
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수로 렌더링 최적화
  return (
    prevProps.chartStyle === nextProps.chartStyle &&
    prevProps.showGrid === nextProps.showGrid &&
    prevProps.showLegend === nextProps.showLegend &&
    prevProps.idx === nextProps.idx &&
    JSON.stringify(prevProps.chartData) === JSON.stringify(nextProps.chartData)
  )
})

KPIChart.displayName = 'KPIChart'

/**
 * 최적화된 KPI 카드 컴포넌트
 */
const KPICard = memo(({ 
  title, 
  chartData, 
  chartStyle, 
  showGrid, 
  showLegend, 
  colorFor, 
  idx 
}) => {
  console.log(`[KPICard] 렌더링 - ${title}`)
  
  // 엔터티 수와 데이터포인트 수를 메모이제이션
  const { entityCount, dataPointCount } = useMemo(() => {
    const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(k => k !== 'time') : []
    return {
      entityCount: entities.length,
      dataPointCount: chartData.length
    }
  }, [chartData])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {entityCount}개 엔터티
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {dataPointCount}개 데이터포인트
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {chartData.length > 0 ? (
            <KPIChart
              chartData={chartData}
              chartStyle={chartStyle}
              showGrid={showGrid}
              showLegend={showLegend}
              colorFor={colorFor}
              idx={idx}
            />
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

KPICard.displayName = 'KPICard'

/**
 * 최적화된 대시보드 컴포넌트
 */
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
    saving,
    error: settingsError
  } = useDashboardSettings()

  // 상수들을 메모이제이션
  const defaultKpiKeys = useMemo(() => [
    'availability','rrc','erab','sar','mobility_intra','cqi'
  ], [])
  
  // 현재 설정에서 값 추출 (기본값 포함) - 메모이제이션
  const settings = useMemo(() => {
    const selectedPegs = dashboardSettings?.selectedPegs && dashboardSettings.selectedPegs.length > 0 
      ? dashboardSettings.selectedPegs 
      : defaultKpiKeys
    
    return {
      selectedPegs,
      defaultNe: dashboardSettings?.defaultNe || '',
      defaultCellId: dashboardSettings?.defaultCellId || '',
      autoRefreshInterval: dashboardSettings?.autoRefreshInterval || 30,
      chartStyle: dashboardSettings?.chartStyle || 'line',
      showLegend: dashboardSettings?.showLegend !== false,
      showGrid: dashboardSettings?.showGrid !== false
    }
  }, [dashboardSettings, defaultKpiKeys])

  // 제목 매핑을 메모이제이션
  const titleMap = useMemo(() => ({
    availability: 'Availability (%)',
    rrc: 'RRC Success Rate (%)',
    erab: 'ERAB Success Rate (%)',
    sar: 'SAR',
    mobility_intra: 'Mobility Intra (%)',
    cqi: 'CQI',
  }), [])

  // 제목 함수를 useCallback으로 최적화
  const titleFor = useCallback((key) => titleMap[key] || key, [titleMap])

  // 색상 함수를 useCallback으로 최적화
  const colorFor = useCallback((index) => {
    const preset = ['#8884d8','#82ca9d','#ffc658','#ff7300','#8dd1e1','#d084d0']
    if (index < preset.length) return preset[index]
    const hue = (index * 47) % 360
    return `hsl(${hue}, 70%, 50%)`
  }, [])

  // 차트 데이터 포맷팅 함수를 useCallback으로 최적화
  // 백엔드에서 객체(Map) 또는 배열로 올 수 있어 방어적으로 배열을 보장
  const formatChartData = useCallback((data) => {
    const rows = Array.isArray(data) ? data : Object.values(data || {}).flat()
    if (!rows || rows.length === 0) return []

    const groupedByTime = rows.reduce((acc, item) => {
      const time = new Date(item.timestamp).toLocaleDateString()
      if (!acc[time]) acc[time] = { time }
      acc[time][item.entity_id] = item.value
      return acc
    }, {})

    return Object.values(groupedByTime)
  }, [])

  /**
   * /api/kpi/query 응답 스펙
   * {
   *   success: boolean,
   *   data: { [kpiType: string]: Array<{
   *     timestamp: string,
   *     entity_id: string,
   *     value: number,
   *     kpi_type?: string,
   *     peg_name?: string,
   *     ne?: string,
   *     cell_id?: string,
   *     date?: string,
   *     hour?: number
   *   }> },
   *   metadata: object
   * }
   */
  // 데이터 fetching 함수를 useCallback으로 최적화
  const fetchKPIData = useCallback(async () => {
    try {
      setLoading(true)
      console.log('[Dashboard] 데이터 fetching 시작', {
        selectedPegs: settings.selectedPegs,
        defaultNe: settings.defaultNe,
        defaultCellId: settings.defaultCellId,
        chartStyle: settings.chartStyle
      })

      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // 백엔드 응답 형식에 맞춰 단일 요청으로 여러 KPI 동시 조회
      const response = await apiClient.post('/api/kpi/query', {
        start_date: startDate,
        end_date: endDate,
        kpi_types: settings.selectedPegs,
        ne: settings.defaultNe,
        cellid: settings.defaultCellId,
      })

      const dataByKpi = response?.data?.data || {}

      setKpiData(dataByKpi)
      setLastRefresh(new Date())
      
      console.log('[Dashboard] 데이터 fetching 완료', {
        kpiCount: Object.keys(dataByKpi).length,
        totalRows: Object.values(dataByKpi).reduce((sum, arr) => sum + (arr?.length || 0), 0)
      })
      
    } catch (error) {
      console.error('[Dashboard] 데이터 fetching 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [settings])

  // 수동 새로고침 함수를 useCallback으로 최적화
  const handleManualRefresh = useCallback(() => {
    console.log('[Dashboard] 수동 새로고침 실행')
    fetchKPIData()
  }, [fetchKPIData])

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
    if (settings.autoRefreshInterval > 0) {
      console.log('[Dashboard] 자동 새로고침 설정:', settings.autoRefreshInterval, '초')
      
      // 데이터 새로고침 타이머
      refreshIntervalRef.current = setInterval(() => {
        fetchKPIData()
      }, settings.autoRefreshInterval * 1000)

      // 카운트다운 타이머
      setRefreshCountdown(settings.autoRefreshInterval)
      countdownIntervalRef.current = setInterval(() => {
        setRefreshCountdown(prev => {
          if (prev <= 1) {
            return settings.autoRefreshInterval
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
  }, [settings.autoRefreshInterval, fetchKPIData])

  // 설정 변경 시 데이터 다시 로드
  useEffect(() => {
    fetchKPIData()
  }, [fetchKPIData])

  // 포맷된 KPI 데이터를 메모이제이션
  const formattedKpiData = useMemo(() => {
    const result = {}
    Object.keys(kpiData).forEach(key => {
      result[key] = formatChartData(kpiData[key])
    })
    return result
  }, [kpiData, formatChartData])

  // 로딩 상태 렌더링을 메모이제이션
  const loadingContent = useMemo(() => {
    if (!loading) return null
    
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
          {settings.selectedPegs.map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {titleFor(key)}
                  <Badge variant="outline" className="text-xs">
                    {settings.chartStyle}
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
  }, [loading, saving, settingsError, settings.selectedPegs, settings.chartStyle, titleFor])

  if (loading) {
    return loadingContent
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 컨트롤 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">
            {settings.selectedPegs.length}개 PEG 항목 • 차트 스타일: {settings.chartStyle}
            {settings.defaultNe && ` • NE: ${settings.defaultNe}`}
            {settings.defaultCellId && ` • Cell: ${settings.defaultCellId}`}
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
          {settings.autoRefreshInterval > 0 && refreshCountdown > 0 && (
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
          선택된 PEG: {settings.selectedPegs.join(', ')}
        </Badge>
        {settings.autoRefreshInterval > 0 && (
          <Badge variant="outline">
            자동 새로고침: {settings.autoRefreshInterval}초
          </Badge>
        )}
        <Badge variant="outline">
          차트 스타일: {settings.chartStyle}
        </Badge>
        {!settings.showLegend && <Badge variant="secondary">범례 숨김</Badge>}
        {!settings.showGrid && <Badge variant="secondary">격자 숨김</Badge>}
      </div>

      {/* KPI 차트들 - 최적화된 컴포넌트 사용 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {settings.selectedPegs.map((key, idx) => (
          <KPICard
            key={key}
            title={titleFor(key)}
            chartData={formattedKpiData[key] || []}
            chartStyle={settings.chartStyle}
            showGrid={settings.showGrid}
            showLegend={settings.showLegend}
            colorFor={colorFor}
            idx={idx}
          />
        ))}
      </div>

      {/* 빈 상태 */}
      {settings.selectedPegs.length === 0 && (
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
