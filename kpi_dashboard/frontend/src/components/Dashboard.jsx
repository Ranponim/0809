import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { RefreshCw, Settings, Clock } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'
import { useDashboardSettings, usePreference } from '@/hooks/usePreference.js'

const Dashboard = () => {
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshCountdown, setRefreshCountdown] = useState(0)
  const [zoomed, setZoomed] = useState({ open: false, title: '', data: [] })
  const refreshIntervalRef = useRef(null)
  const countdownIntervalRef = useRef(null)

  // usePreference 훅 사용
  const {
    settings: dashboardSettings,
    saving,
    error: settingsError
  } = useDashboardSettings()

  // Derived PEG 설정 가져오기
  const { settings: allSettings } = usePreference()
  const derivedPegSettings = allSettings?.derivedPegSettings || {}

  // 하드코딩된 KPI 제거: 실제 설정(선택된 PEG)만 사용 - 안전한 접근
  const selectedPegs = Array.isArray(dashboardSettings?.selectedPegs) ? dashboardSettings.selectedPegs : []
  // Preference > Statistics의 데이터 선택 반영
  const { settings: pref } = usePreference()
  const statisticsSel = pref?.statisticsSettings || {}
  const selectedNEs = Array.isArray(statisticsSel.selectedNEs) ? statisticsSel.selectedNEs : []
  const selectedCellIds = Array.isArray(statisticsSel.selectedCellIds) ? statisticsSel.selectedCellIds : []
  const autoRefreshInterval = dashboardSettings?.autoRefreshInterval || 30
  const chartStyle = dashboardSettings?.chartStyle || 'line'
  const chartLayout = dashboardSettings?.chartLayout || 'byPeg'
  const showLegend = dashboardSettings?.showLegend !== false
  const showGrid = dashboardSettings?.showGrid !== false
  const defaultNe = dashboardSettings?.defaultNe || ''
  const defaultCellId = dashboardSettings?.defaultCellId || ''

  const titleFor = (key) => key

  const colorFor = (index) => {
    const preset = ['#8884d8','#82ca9d','#ffc658','#ff7300','#8dd1e1','#d084d0']
    if (index < preset.length) return preset[index]
    const hue = (index * 47) % 360
    return `hsl(${hue}, 70%, 50%)`
  }

  

  // 데이터 fetching 함수
  const fetchKPIData = React.useCallback(async () => {
    if (selectedPegs.length === 0) {
      setKpiData({})
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('[Dashboard] 데이터 fetching 시작 (최적화)', {
        selectedPegs,
        defaultNe,
        defaultCellId,
      })

      // 기간: 기본 1시간 (설정 저장 가능하도록 dashboardSettings에 저장/사용)
      const end = new Date()
      const start = new Date(end.getTime() - (dashboardSettings?.defaultHours || 1) * 60 * 60 * 1000)

      // 기본 PEG만 API로 요청 (Derived PEG 제외)
      const basicPegs = selectedPegs.filter(peg =>
        !derivedPegSettings.formulas?.some(formula =>
          formula.active && formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() === peg
        )
      )

      const response = await apiClient.post('/api/kpi/timeseries', {
        kpi_types: basicPegs,
        ne: selectedNEs,
        cellid: selectedCellIds,
        start: start.toISOString(),
        end: end.toISOString()
      })

      let dataByKpi = response?.data?.data || {}

      // Derived PEG 계산 및 추가
      if (derivedPegSettings.formulas && derivedPegSettings.formulas.length > 0) {
        const activeDerivedPegs = selectedPegs.filter(peg =>
          derivedPegSettings.formulas.some(formula =>
            formula.active && formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() === peg
          )
        )

        if (activeDerivedPegs.length > 0) {
          console.log('[Dashboard] Derived PEG 계산 시작', {
            activeDerivedPegs,
            availableBaseData: Object.keys(dataByKpi)
          })

          // 각 타임스탬프별로 Derived PEG 계산
          const derivedPegData = {}

          // 기본 데이터의 타임스탬프 구조 파악 (첫 번째 기본 PEG 사용)
          const firstBasicPeg = Object.keys(dataByKpi)[0]
          if (firstBasicPeg && dataByKpi[firstBasicPeg]) {
            dataByKpi[firstBasicPeg].forEach((row, index) => {
              const timestamp = row.timestamp
              const entityId = row.entity_id

              // 해당 타임스탬프의 모든 기본 PEG 값 수집
              const pegValues = {}
              Object.keys(dataByKpi).forEach(pegKey => {
                const pegData = dataByKpi[pegKey]
                if (pegData && pegData[index] && pegData[index].entity_id === entityId) {
                  pegValues[pegKey] = pegData[index].value
                }
              })

              // Derived PEG 계산
              const calculatedDerivedPegs = calculateAllDerivedPegs(
                derivedPegSettings.formulas,
                pegValues,
                derivedPegSettings.settings?.evaluationPrecision || 4
              )

              // 계산된 Derived PEG을 데이터에 추가
              Object.entries(calculatedDerivedPegs).forEach(([derivedPegKey, value]) => {
                if (!derivedPegData[derivedPegKey]) {
                  derivedPegData[derivedPegKey] = []
                }
                derivedPegData[derivedPegKey].push({
                  timestamp: timestamp,
                  entity_id: entityId,
                  value: value
                })
              })
            })
          }

          // Derived PEG 데이터를 기본 데이터에 병합
          dataByKpi = { ...dataByKpi, ...derivedPegData }

          console.log('[Dashboard] Derived PEG 계산 완료', {
            addedDerivedPegs: Object.keys(derivedPegData),
            totalKpiCount: Object.keys(dataByKpi).length
          })
        }
      }

      setKpiData(dataByKpi)
      setLastRefresh(new Date())
      
      console.log('[Dashboard] 데이터 fetching 완료 (최적화)', {
        kpiCount: Object.keys(dataByKpi).length,
        totalRows: Object.values(dataByKpi).reduce((sum, arr) => sum + (arr?.length || 0), 0)
      })
      
    } catch (error) {
      console.error('[Dashboard] 데이터 fetching 오류:', error)
      setKpiData({}) // 오류 발생 시 데이터 초기화
    } finally {
      setLoading(false)
    }
  }, [selectedPegs, selectedNEs, selectedCellIds, dashboardSettings?.defaultHours, defaultNe, defaultCellId])

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
  const handleManualRefresh = () => {
    console.log('[Dashboard] 수동 새로고침 실행')
    fetchKPIData()
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

  const buildChartDataByLayout = (kpiKey) => {
    const flatRows = Array.isArray(kpiData[kpiKey]) ? kpiData[kpiKey] : []
    if (flatRows.length === 0) return []

    if (chartLayout === 'byPeg') {
      // 시간축 + entity_id 별 series
      const groupedByTime = {}
      flatRows.forEach(row => {
        const t = new Date(row.timestamp).toLocaleString()
        if (!groupedByTime[t]) groupedByTime[t] = { time: t }
        groupedByTime[t][row.entity_id] = row.value
      })
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

