/**
 * Dashboard 컴포넌트 - 리팩토링된 버전
 * 
 * KPI 대시보드를 표시하는 메인 컴포넌트입니다.
 * 차트 렌더링, 데이터 fetching, 설정 관리 기능을 제공합니다.
 * 
 * 주요 기능:
 * - KPI 데이터 표시 및 차트 렌더링
 * - 자동/수동 데이터 새로고침
 * - Time1/Time2 비교 모드
 * - 설정 기반 차트 스타일링
 * 
 * 사용법:
 * ```jsx
 * <Dashboard />
 * ```
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Settings } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'
import { useDashboardSettings, usePreference } from '@/hooks/usePreference.js'

// 분리된 컴포넌트들 import
import DashboardHeader from './DashboardHeader.jsx'
import DashboardSettings from './DashboardSettings.jsx'
import DashboardCard from './DashboardCard.jsx'
import DashboardChart from './DashboardChart.jsx'

// ================================
// 로깅 유틸리티
// ================================

/**
 * 로그 레벨별 출력 함수
 * @param {string} level - 로그 레벨 (info, error, warn, debug)
 * @param {string} message - 로그 메시지
 * @param {any} data - 추가 데이터
 */
const logDashboard = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[Dashboard:${timestamp}]`
  
  switch (level) {
    case 'info':
      console.log(`${prefix} ${message}`, data)
      break
    case 'error':
      console.error(`${prefix} ${message}`, data)
      break
    case 'warn':
      console.warn(`${prefix} ${message}`, data)
      break
    case 'debug':
      console.debug(`${prefix} ${message}`, data)
      break
    default:
      console.log(`${prefix} ${message}`, data)
  }
}

// ================================
// 메인 Dashboard 컴포넌트
// ================================

const Dashboard = () => {
  // 초기화 로깅을 debug 레벨로 변경하고 한 번만 출력
  const initRef = useRef(false)
  if (!initRef.current) {
    logDashboard('debug', 'Dashboard 컴포넌트 초기화')
    initRef.current = true
  }
  
  // 상태 관리
  const [kpiData, setKpiData] = useState({})
  const [time2Data, setTime2Data] = useState(null)
  const [loading, setLoading] = useState(false) // 초기값을 false로 변경
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

  // 설정 훅 사용
  const {
    settings: dashboardSettings = {},
    saving = false,
    error: settingsError = null,
    updateSettings = () => {}
  } = useDashboardSettings()

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
    logDashboard('info', '기본시간범위 업데이트', { value })
    updateSettings({ defaultTimeRange: parseInt(value) })
  }, [updateSettings])

  const updateEnableTimeComparison = useCallback((checked) => {
    logDashboard('info', '토글 상태 변경', { checked })
    updateSettings({ enableTimeComparison: checked })
  }, [updateSettings])

  // 임시 시간 설정 업데이트
  const updateTempTimeSetting = useCallback((type, field, value) => {
    logDashboard('debug', '임시 시간 설정 업데이트', { type, field, value })
    setTempTimeSettings(prev => ({
      ...prev,
      [`${type}${field}`]: value
    }))
  }, [])

  // Time1 설정 적용
  const applyTime1Settings = useCallback(() => {
    if (tempTimeSettings.time1Start && tempTimeSettings.time1End) {
      logDashboard('info', 'Time1 설정 적용', { 
        start: tempTimeSettings.time1Start, 
        end: tempTimeSettings.time1End 
      })
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
      logDashboard('info', 'Time2 설정 적용', { 
        start: tempTimeSettings.time2Start, 
        end: tempTimeSettings.time2End 
      })
      updateSettings({
        time2Start: tempTimeSettings.time2Start,
        time2End: tempTimeSettings.time2End
      })
      setInputCompleted(prev => ({ ...prev, time2: true }))
    }
  }, [tempTimeSettings.time2Start, tempTimeSettings.time2End, updateSettings])

  // 데이터 fetching 함수
  const fetchKPIData = useCallback(async () => {
    logDashboard('info', '데이터 fetching 시작')
    
    // 안전한 기본값 설정
    const safeSelectedPegs = selectedPegs.length > 0 ? selectedPegs : ['randomaccessproblem']
    const safeSelectedNEs = selectedNEs.length > 0 ? selectedNEs : ['NVGNB#101086']
    const safeSelectedCellIds = selectedCellIds.length > 0 ? selectedCellIds.map(id => parseInt(id)) : [8418]

    logDashboard('debug', '데이터 fetching 파라미터', {
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
      logDashboard('warn', '선택된 PEG가 없음 - 데이터 fetching 중단')
      setKpiData({})
      setTime2Data(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Time1/Time2 비교 모드인 경우
      if (enableTimeComparison && time1Start && time1End && time2Start && time2End) {
        logDashboard('info', 'Time1/Time2 비교 모드로 데이터 fetching')
        
        // Time1 API 파라미터
        const time1Params = {
          start_date: time1Start,
          end_date: time1End,
          kpi_types: safeSelectedPegs,
          ne: safeSelectedNEs,
          cellid: safeSelectedCellIds,
        }
        
        logDashboard('debug', 'Time1 API 파라미터', time1Params)
        
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
        
        logDashboard('debug', 'Time2 API 파라미터', time2Params)
        
        // Time2 데이터 가져오기
        const time2Response = await apiClient.post('/api/kpi/query', time2Params)

        const time1Data = time1Response?.data?.data || {}
        const time2Data = time2Response?.data?.data || {}

        setKpiData(time1Data)
        setTime2Data(time2Data)
        
        logDashboard('info', 'Time1/Time2 데이터 fetching 완료', {
          time1KpiCount: Object.keys(time1Data).length,
          time1TotalRows: Object.values(time1Data).reduce((sum, arr) => sum + (arr?.length || 0), 0),
          time2KpiCount: Object.keys(time2Data).length,
          time2TotalRows: Object.values(time2Data).reduce((sum, arr) => sum + (arr?.length || 0), 0),
          time1DataKeys: Object.keys(time1Data),
          time2DataKeys: Object.keys(time2Data)
        })
      } else {
        // 일반 모드
        logDashboard('info', '일반 모드로 데이터 fetching')
        
        const end = new Date()
        const start = new Date(end.getTime() - (dashboardSettings?.defaultHours || 1) * 60 * 60 * 1000)

        const generalParams = {
          kpi_types: safeSelectedPegs,
          ne: safeSelectedNEs,
          cellid: safeSelectedCellIds,
          start: start.toISOString(),
          end: end.toISOString()
        }
        
        logDashboard('debug', '일반 모드 API 파라미터', generalParams)

        const response = await apiClient.post('/api/kpi/timeseries', generalParams)

        const dataByKpi = response?.data?.data || {}

        setKpiData(dataByKpi)
        setTime2Data(null)
      
        logDashboard('info', '일반 모드 데이터 fetching 완료', {
          kpiCount: Object.keys(dataByKpi).length,
          totalRows: Object.values(dataByKpi).reduce((sum, arr) => sum + (arr?.length || 0), 0),
          dataKeys: Object.keys(dataByKpi)
        })
      }
      
      setLastRefresh(new Date())
    } catch (error) {
      logDashboard('error', '데이터 fetching 오류', error)
      setKpiData({}) // 오류 발생 시 데이터 초기화
      setTime2Data(null)
    } finally {
      setLoading(false)
    }
  }, [selectedPegs, selectedNEs, selectedCellIds, dashboardSettings?.defaultHours, defaultNe, defaultCellId, enableTimeComparison, time1Start, time1End, time2Start, time2End])

  // 자동 새로고침 설정
  useEffect(() => {
    logDashboard('debug', '자동 새로고침 설정 변경', { autoRefreshInterval })
    
    // 기존 타이머 정리
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    // 자동 새로고침 간격이 설정된 경우만 타이머 설정
    if (autoRefreshInterval > 0) {
      logDashboard('info', '자동 새로고침 설정', { interval: autoRefreshInterval })
      
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

  // 설정 변경 시 데이터 다시 로드 (초기화 완료 후)
  useEffect(() => {
    // 초기화가 완료될 때까지 기다림
    const timer = setTimeout(() => {
      logDashboard('info', '설정 변경으로 인한 데이터 로드 시작')
      fetchKPIData()
    }, 500) // 500ms 지연

    return () => clearTimeout(timer)
  }, [selectedPegs, selectedNEs, selectedCellIds, dashboardSettings?.defaultHours, defaultNe, defaultCellId, enableTimeComparison, time1Start, time1End, time2Start, time2End])

  // 수동 새로고침
  const handleManualRefresh = useCallback(() => {
    logDashboard('info', '수동 새로고침 실행')
    fetchKPIData()
  }, [fetchKPIData])

  // 차트 데이터 구성 함수
  const buildChartDataByLayout = useCallback((kpiKey) => {
    logDashboard('debug', '차트 데이터 구성', { kpiKey, chartLayout })
    
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
    logDashboard('debug', '로딩 상태 렌더링')
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <DashboardHeader
          loading={loading}
          saving={saving}
          settingsError={settingsError}
          selectedPegs={selectedPegs}
          chartStyle={chartStyle}
          enableTimeComparison={enableTimeComparison}
          defaultNe={defaultNe}
          defaultCellId={defaultCellId}
          autoRefreshInterval={autoRefreshInterval}
          refreshCountdown={refreshCountdown}
          lastRefresh={lastRefresh}
          onManualRefresh={handleManualRefresh}
        />

        {/* 로딩 카드들 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedPegs.map((key) => (
            <Card key={key}>
              <CardContent className="pt-6">
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

  logDashboard('debug', 'Dashboard 메인 렌더링')
  
  return (
    <div className="space-y-6">
      {/* 설정 컴포넌트 */}
      <DashboardSettings
        defaultTimeRange={defaultTimeRange}
        enableTimeComparison={enableTimeComparison}
        tempTimeSettings={tempTimeSettings}
        inputCompleted={inputCompleted}
        loading={loading}
        onUpdateDefaultTimeRange={updateDefaultTimeRange}
        onUpdateEnableTimeComparison={updateEnableTimeComparison}
        onUpdateTempTimeSetting={updateTempTimeSetting}
        onApplyTime1Settings={applyTime1Settings}
        onApplyTime2Settings={applyTime2Settings}
        onManualRefresh={handleManualRefresh}
      />

      {/* 헤더 컴포넌트 */}
      <DashboardHeader
        loading={loading}
        saving={saving}
        settingsError={settingsError}
        selectedPegs={selectedPegs}
        chartStyle={chartStyle}
        enableTimeComparison={enableTimeComparison}
        defaultNe={defaultNe}
        defaultCellId={defaultCellId}
        autoRefreshInterval={autoRefreshInterval}
        refreshCountdown={refreshCountdown}
        lastRefresh={lastRefresh}
        onManualRefresh={handleManualRefresh}
      />

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
            return (
              <DashboardCard
                key={`${key}-${idx}`}
                idx={idx}
                title={key}
                chartData={chartData}
                chartStyle={chartStyle}
                chartLayout={chartLayout}
                enableTimeComparison={enableTimeComparison}
                showGrid={showGrid}
                showLegend={showLegend}
                onZoom={setZoomed}
              />
            )
          } else {
            // byEntity: entity 카드 반복, 각 카드에서 PEG 시리즈 표시
            const byEntity = built || {}
            return Object.keys(byEntity).map((entityId, eIdx) => {
              const chartData = byEntity[entityId]
              return (
                <DashboardCard
                  key={`${key}-${entityId}-${eIdx}`}
                  idx={idx + eIdx}
                  title={entityId}
                  chartData={chartData}
                  chartStyle={chartStyle}
                  chartLayout={chartLayout}
                  enableTimeComparison={enableTimeComparison}
                  showGrid={showGrid}
                  showLegend={showLegend}
                  onZoom={setZoomed}
                />
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
            {Array.isArray(zoomed.data) && zoomed.data.length > 0 && (
              <DashboardChart
                chartData={zoomed.data}
                key="zoom"
                idx={0}
                chartStyle={chartStyle}
                showGrid={showGrid}
                showLegend={showLegend}
                enableTimeComparison={enableTimeComparison}
              />
            )}
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

