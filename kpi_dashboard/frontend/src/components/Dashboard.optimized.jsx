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
import { Button } from '@/components/ui/button.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Settings, BarChart3 } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'
import { useDashboardSettings, usePreference } from '@/hooks/usePreference.js'
import { calculateAllDerivedPegs } from '@/lib/derivedPegUtils.js'

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
  const [zoomed, setZoomed] = useState({ open: false, title: '', data: [] })

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
  const derivedPegSettings = pref?.derivedPegSettings || {}

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

  // Time1 설정 토글 (다시 입력 가능하게 만들기)
  const toggleTime1Settings = useCallback(() => {
    logDashboard('info', 'Time1 설정 토글', {
      currentState: inputCompleted.time1,
      newState: !inputCompleted.time1
    })

    // 수정 모드로 전환할 때 tempTimeSettings를 현재 설정값으로 리셋
    if (inputCompleted.time1) { // 완료 상태에서 수정 모드로 전환
      setTempTimeSettings(prev => ({
        ...prev,
        time1Start: time1Start, // 현재 설정된 값으로 리셋
        time1End: time1End
      }))
    }

    setInputCompleted(prev => ({ ...prev, time1: !prev.time1 }))
  }, [inputCompleted.time1, time1Start, time1End])

  // Time2 설정 토글 (다시 입력 가능하게 만들기)
  const toggleTime2Settings = useCallback(() => {
    logDashboard('info', 'Time2 설정 토글', {
      currentState: inputCompleted.time2,
      newState: !inputCompleted.time2
    })

    // 수정 모드로 전환할 때 tempTimeSettings를 현재 설정값으로 리셋
    if (inputCompleted.time2) { // 완료 상태에서 수정 모드로 전환
      setTempTimeSettings(prev => ({
        ...prev,
        time2Start: time2Start, // 현재 설정된 값으로 리셋
        time2End: time2End
      }))
    }

    setInputCompleted(prev => ({ ...prev, time2: !prev.time2 }))
  }, [inputCompleted.time2, time2Start, time2End])

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

        logDashboard('info', 'Time1 API 파라미터 상세', {
          ...time1Params,
          time1StartParsed: new Date(time1Start).toISOString(),
          time1EndParsed: new Date(time1End).toISOString(),
          time1DurationMinutes: `${Math.abs(new Date(time1End) - new Date(time1Start)) / (1000 * 60)}분`,
          safeSelectedPegs,
          safeSelectedNEs,
          safeSelectedCellIds
        })

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

        logDashboard('info', 'Time2 API 파라미터 상세', {
          ...time2Params,
          time2StartParsed: new Date(time2Start).toISOString(),
          time2EndParsed: new Date(time2End).toISOString(),
          time2DurationMinutes: `${Math.abs(new Date(time2End) - new Date(time2Start)) / (1000 * 60)}분`,
          timeComparison: {
            time1Start,
            time1End,
            time2Start,
            time2End,
            time1Duration: `${Math.abs(new Date(time1End) - new Date(time1Start)) / (1000 * 60)}분`,
            time2Duration: `${Math.abs(new Date(time2End) - new Date(time2Start)) / (1000 * 60)}분`,
            timeOverlap: new Date(time1End) > new Date(time2Start) ? '시간대 겹침' : '시간대 분리'
          }
        })
        


        // 현재 설정된 시간 범위 로깅
        logDashboard('debug', '설정된 시간 범위', {
          time1Start,
          time1End,
          time2Start,
          time2End,
          time1Duration: `${Math.abs(new Date(time1End) - new Date(time1Start)) / (1000 * 60)}분`,
          time2Duration: `${Math.abs(new Date(time2End) - new Date(time2Start)) / (1000 * 60)}분`
        })
        
        // Time2 데이터 가져오기
        logDashboard('info', 'Time2 API 호출 전 파라미터', time2Params)
        const time2Response = await apiClient.post('/api/kpi/query', time2Params)
        logDashboard('info', 'Time2 API 호출 후 응답 상태', {
          status: time2Response?.status,
          statusText: time2Response?.statusText,
          hasData: !!time2Response?.data,
          dataKeys: time2Response?.data ? Object.keys(time2Response.data) : []
        })

        let time1Data = time1Response?.data?.data || {}
        let time2Data = time2Response?.data?.data || {}

        // Derived PEG 계산을 위한 헬퍼 함수
        const calculateDerivedPegsForDataset = (baseData, timeLabel) => {
          if (!derivedPegSettings.formulas || derivedPegSettings.formulas.length === 0) {
            return baseData
          }

          const activeDerivedPegs = safeSelectedPegs.filter(peg =>
            derivedPegSettings.formulas.some(formula =>
              formula.active && formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() === peg
            )
          )

          if (activeDerivedPegs.length === 0) {
            return baseData
          }

          console.log(`[Dashboard] ${timeLabel} Derived PEG 계산 시작`, {
            activeDerivedPegs,
            availableBaseData: Object.keys(baseData)
          })

          const derivedPegData = {}
          const firstBasicPeg = Object.keys(baseData)[0]

          if (firstBasicPeg && baseData[firstBasicPeg]) {
            baseData[firstBasicPeg].forEach((row, index) => {
              const timestamp = row.timestamp
              const entityId = row.entity_id

              // 해당 타임스탬프의 모든 기본 PEG 값 수집
              const pegValues = {}
              Object.keys(baseData).forEach(pegKey => {
                const pegData = baseData[pegKey]
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

          const resultData = { ...baseData, ...derivedPegData }
          console.log(`[Dashboard] ${timeLabel} Derived PEG 계산 완료`, {
            addedDerivedPegs: Object.keys(derivedPegData),
            totalKpiCount: Object.keys(resultData).length
          })

          return resultData
        }

        // Time1과 Time2에 대해 Derived PEG 계산 적용
        time1Data = calculateDerivedPegsForDataset(time1Data, 'Time1')
        time2Data = calculateDerivedPegsForDataset(time2Data, 'Time2')

        // Time2 데이터 상세 로깅
        const targetKpiKey = safeSelectedPegs[0] || 'randomaccessproblem'
        const time2KpiData = time2Data[targetKpiKey]

        logDashboard('info', 'Time2 데이터 상세 분석', {
          time2ResponseStatus: time2Response?.status,
          time2ResponseHasData: !!time2Response?.data,
          time2ResponseDataKeys: time2Response?.data ? Object.keys(time2Response.data) : [],
          time2RawDataKeys: Object.keys(time2Data),
          time2DataStructure: Object.keys(time2Data).reduce((acc, key) => {
            const data = time2Data[key]
            acc[key] = {
              type: Array.isArray(data) ? 'array' : typeof data,
              length: Array.isArray(data) ? data.length : 'N/A',
              sample: Array.isArray(data) && data.length > 0 ? data.slice(0, 1) : null
            }
            return acc
          }, {}),
          targetKpiKey,
          targetKpiInTime2Data: time2Data.hasOwnProperty(targetKpiKey),
          targetKpiDataLength: Array.isArray(time2KpiData) ? time2KpiData.length : 'N/A',
          targetKpiDataSample: Array.isArray(time2KpiData) && time2KpiData.length > 0 ? time2KpiData.slice(0, 3) : [],
          comparison: {
            time1DataLength: Array.isArray(time1Data[targetKpiKey]) ? time1Data[targetKpiKey].length : 'N/A',
            time2DataLength: Array.isArray(time2KpiData) ? time2KpiData.length : 'N/A',
            difference: (Array.isArray(time1Data[targetKpiKey]) ? time1Data[targetKpiKey].length : 0) - (Array.isArray(time2KpiData) ? time2KpiData.length : 0)
          }
        })

        // Time2 데이터가 의심스러울 때 추가 분석
        if (Array.isArray(time2KpiData) && time2KpiData.length <= 1) {
          logDashboard('warn', 'Time2 데이터가 1개 이하입니다 - 상세 분석', {
            time2Params,
            time2KpiData,
            time2FullResponse: time2Response?.data,
            possibleIssues: [
              'Time2 기간에 실제 데이터가 부족함',
              'API 파라미터가 잘못됨',
              '데이터베이스에 해당 시간대의 데이터가 없음',
              'API 응답 구조가 예상과 다름'
            ]
          })
        }

        setKpiData(time1Data)
        setTime2Data(time2Data)

        // 데이터 저장 후 확인 로그
        logDashboard('debug', '데이터 저장 후 상태', {
          kpiDataKeys: Object.keys(time1Data),
          time2DataKeys: Object.keys(time2Data),
          time2DataSample: Object.keys(time2Data).length > 0 ? {
            firstKey: Object.keys(time2Data)[0],
            firstKeyDataLength: time2Data[Object.keys(time2Data)[0]]?.length || 0
          } : null
        })

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

        let dataByKpi = response?.data?.data || {}

        // 일반 모드에서도 Derived PEG 계산 적용
        dataByKpi = calculateDerivedPegsForDataset(dataByKpi, '일반 모드')

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

    // Time2 데이터 상세 분석 로깅
    if (enableTimeComparison) {
      logDashboard('debug', 'buildChartDataByLayout - Time2 데이터 분석', {
        kpiKey,
        enableTimeComparison,
        time2DataExists: !!time2Data,
        time2DataType: typeof time2Data,
        time2DataKeys: time2Data ? Object.keys(time2Data) : [],
        kpiKeyInTime2Data: time2Data ? time2Data.hasOwnProperty(kpiKey) : false,
        time2DataForKpiKey: time2Data?.[kpiKey],
        time2DataForKpiKeyType: typeof time2Data?.[kpiKey],
        time2DataForKpiKeyIsArray: Array.isArray(time2Data?.[kpiKey]),
        time2RowsLength: time2Rows.length,
        time2RowsSample: time2Rows.length > 0 ? time2Rows.slice(0, 2).map(row => ({
          entity_id: row.entity_id,
          timestamp: row.timestamp,
          value: row.value,
          hasTimestamp: !!row.timestamp,
          hasEntityId: !!row.entity_id,
          hasValue: row.hasOwnProperty('value')
        })) : []
      })
    }

    // 현재 데이터 상태 상세 로그
    logDashboard('debug', '차트 데이터 구성 - 데이터 상태 확인', {
      kpiKey,
      kpiDataExists: !!kpiData,
      time2DataExists: !!time2Data,
      kpiDataKeys: Object.keys(kpiData || {}),
      time2DataKeys: Object.keys(time2Data || {}),
      kpiDataHasKey: kpiData && kpiData[kpiKey] ? true : false,
      time2DataHasKey: time2Data && time2Data[kpiKey] ? true : false,
      flatRowsLength: flatRows.length,
      time2RowsLength: time2Rows.length
    })

    if (flatRows.length === 0 && time2Rows.length === 0) {
      logDashboard('warn', '차트 데이터 없음 - 데이터 구성 실패', {
        kpiKey,
        flatRowsLength: flatRows.length,
        time2RowsLength: time2Rows.length
      })
      return []
    }

    if (chartLayout === 'byPeg') {
      // 시간축 + entity_id 별 series
      const groupedByTime = {}

      // Time1과 Time2 데이터를 시간순으로 정렬하여 연속적으로 표시
      let timeIndex = 0

      // Time1과 Time2 데이터 확인 로그
      logDashboard('debug', '차트 데이터 구성 시작', {
        kpiKey,
        time1RowsCount: flatRows.length,
        time2RowsCount: time2Rows.length,
        enableTimeComparison,
        time2DataKeys: Object.keys(time2Data || {}),
        time2DataHasKpiKey: time2Data && time2Data[kpiKey] ? true : false
      })

      // Time1 데이터 처리
      flatRows.forEach(row => {
        // Time1의 시간은 그대로 사용하되, 인덱스로 구분
        const originalTime = new Date(row.timestamp)
        const timeKey = `T1_${timeIndex++}_${originalTime.getTime()}`
        // 날짜-시간 형식으로 표시 (MM/DD HH:MM)
        const displayTime = originalTime.toLocaleString('ko-KR', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(/\./g, '/').replace(' ', ' ')

        if (!groupedByTime[timeKey]) {
          groupedByTime[timeKey] = { time: displayTime, _originalTime: originalTime }
        }

        const entityKey = enableTimeComparison ? `${row.entity_id}_Time1` : row.entity_id
        groupedByTime[timeKey][entityKey] = row.value
      })
      
      // Time2 데이터 처리 (비교 모드인 경우)
      if (enableTimeComparison && time2Rows.length > 0) {
        logDashboard('debug', 'Time2 데이터 처리 시작', {
          time2RowsCount: time2Rows.length,
          time2RowsSample: time2Rows.slice(0, 2).map(row => ({
            entity_id: row.entity_id,
            timestamp: row.timestamp,
            value: row.value
          }))
        })
        // Time2는 Time1의 마지막 시간 이후에 이어서 표시
        time2Rows.forEach(row => {
          const originalTime = new Date(row.timestamp)
          const timeKey = `T2_${timeIndex++}_${originalTime.getTime()}`

          // Time2 표시 시간은 날짜-시간 형식으로 표시 (MM/DD HH:MM)
          const displayTime = originalTime.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(/\./g, '/').replace(' ', ' ')

          if (!groupedByTime[timeKey]) {
            groupedByTime[timeKey] = { time: displayTime, _originalTime: originalTime, _isTime2: true }
          }

          const entityKey = `${row.entity_id}_Time2`
          groupedByTime[timeKey][entityKey] = row.value
        })

        logDashboard('debug', 'Time2 데이터 처리 완료', {
          processedTime2Rows: time2Rows.length,
          groupedByTimeKeys: Object.keys(groupedByTime).length,
          time2KeysInGrouped: Object.keys(groupedByTime).filter(key => key.startsWith('T2_')).length
        })
      } else {
        logDashboard('debug', 'Time2 데이터 처리 건너뜀', {
          enableTimeComparison,
          time2RowsLength: time2Rows.length,
          reason: !enableTimeComparison ? '비교 모드 비활성화' : 'Time2 데이터 없음'
        })
      }

      // 시간순으로 정렬하여 연속적인 차트 생성
      const sortedData = Object.values(groupedByTime).sort((a, b) => {
        return a._originalTime.getTime() - b._originalTime.getTime()
      })

      // 디버그 로깅 - 상세 데이터 구조 확인
      const time1DataPoints = sortedData.filter(d => !d._isTime2)
      const time2DataPoints = sortedData.filter(d => d._isTime2)

      logDashboard('info', 'Time1/Time2 데이터 구성 완료', {
        kpiKey,
        time1Count: flatRows.length,
        time2Count: time2Rows.length,
        totalDataPoints: sortedData.length,
        time1DataPointsCount: time1DataPoints.length,
        time2DataPointsCount: time2DataPoints.length,
        timeRange: sortedData.length > 0 ? {
          first: sortedData[0].time,
          last: sortedData[sortedData.length - 1].time
        } : null,
        sampleDataPoints: sortedData.slice(0, 3).map(point => ({
          time: point.time,
          _isTime2: point._isTime2,
          entityCount: Object.keys(point).filter(k => !k.startsWith('_')).length,
          entities: Object.keys(point).filter(k => !k.startsWith('_')),
          allKeys: Object.keys(point)
        })),
        time1Entities: flatRows.length > 0 ? Object.keys(flatRows[0]).filter(k => k !== 'timestamp') : [],
        time2Entities: time2Rows.length > 0 ? Object.keys(time2Rows[0]).filter(k => k !== 'timestamp') : [],
        // Time2 렌더링 문제 디버깅용
        time2EntityKeys: time2DataPoints.length > 0 ?
          Object.keys(time2DataPoints[0]).filter(k => !k.startsWith('_')) : [],
        time2SampleData: time2DataPoints.slice(0, 2).map(point => ({
          time: point.time,
          _isTime2: point._isTime2,
          entities: Object.keys(point).filter(k => !k.startsWith('_')),
          sampleValues: Object.keys(point)
            .filter(k => !k.startsWith('_'))
            .slice(0, 3)
            .map(k => ({ key: k, value: point[k] }))
        }))
      })

      // 최종 반환 전 데이터 검증
      logDashboard('debug', 'buildChartDataByLayout 최종 반환 데이터', {
        kpiKey,
        returnedDataLength: sortedData.length,
        totalTime1Data: sortedData.filter(d => !d._isTime2).length,
        totalTime2Data: sortedData.filter(d => d._isTime2).length,
        returnedData: sortedData.slice(0, 3).map(data => ({
          time: data.time,
          _isTime2: data._isTime2,
          entityCount: Object.keys(data).filter(k => !k.startsWith('_')).length,
          entities: Object.keys(data).filter(k => !k.startsWith('_')),
          sampleValues: Object.keys(data)
            .filter(k => !k.startsWith('_'))
            .slice(0, 2)
            .map(k => ({ key: k, value: data[k] }))
        }))
      })

      return sortedData
    } else {
      // byEntity: entity 기준으로 PEG 시리즈 구성 -> UI에서 카드 단위 핸들링 필요
      const byEntity = {}

      // Time1 데이터 처리
      flatRows.forEach(row => {
        const t = new Date(row.timestamp).toLocaleString()
        const entity = row.entity_id
        byEntity[entity] = byEntity[entity] || {}
        byEntity[entity][t] = byEntity[entity][t] || { time: t }
        byEntity[entity][t][row.peg_name] = row.value
      })

      // Time2 데이터 처리 (비교 모드인 경우)
      if (enableTimeComparison) {
        time2Rows.forEach(row => {
          const t = new Date(row.timestamp).toLocaleString() + ' (T2)'
          const entity = row.entity_id
          byEntity[entity] = byEntity[entity] || {}
          byEntity[entity][t] = byEntity[entity][t] || { time: t }
          byEntity[entity][t][row.peg_name + '_Time2'] = row.value
        })
      }

    const result = {}
      Object.keys(byEntity).forEach(entity => {
        result[entity] = Object.values(byEntity[entity]).sort((a,b)=> new Date(a.time.replace(' (T2)', ''))-new Date(b.time.replace(' (T2)', '')))
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
        onToggleTime1Settings={toggleTime1Settings}
        onToggleTime2Settings={toggleTime2Settings}
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

        <Badge variant="outline">
          차트 스타일: {chartStyle}
        </Badge>
        {!showLegend && <Badge variant="secondary">범례 숨김</Badge>}
        {!showGrid && <Badge variant="secondary">격자 숨김</Badge>}
      </div>

      {/* KPI 차트들 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedPegs.map((key, idx) => {
          logDashboard('debug', '차트 렌더링 시작', {
            key,
            idx,
            selectedPegs,
            totalSelectedPegs: selectedPegs.length
          })

          const built = buildChartDataByLayout(key)
          if (chartLayout === 'byPeg') {
            const chartData = Array.isArray(built) ? built : []

            logDashboard('debug', '차트 데이터 생성 결과', {
              key,
              chartDataLength: chartData.length,
              builtType: Array.isArray(built) ? 'array' : typeof built
            })

            return (
              <DashboardCard
                key={`${key}-${idx}`}
                chartKey={key}
                idx={idx}
                title={key}
                chartData={chartData}
                chartStyle={chartStyle}
                chartLayout={chartLayout}
                enableTimeComparison={enableTimeComparison}
                showGrid={showGrid}
                showLegend={showLegend}
                onZoom={setZoomed}
                loading={loading}
                onRefresh={handleManualRefresh}
                error={null}
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
                  loading={loading}
                  onRefresh={handleManualRefresh}
                  error={null}
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
                loading={false}
                onRefresh={null}
                error={null}
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
              <p className="text-muted-foreground mb-4">
                Preference 메뉴에서 표시할 PEG 항목을 선택하세요.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  // Preference 메뉴로 이동하는 로직 (필요시 구현)
                  console.log('Navigate to Preference menu')
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Preference 설정
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 로딩 중일 때의 전체 상태 표시 */}
      {loading && selectedPegs.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-pulse">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              </div>
              <h3 className="text-lg font-medium mb-2">데이터 로딩 중...</h3>
              <p className="text-muted-foreground">
                선택한 PEG의 데이터를 불러오고 있습니다.
              </p>
              <div className="flex justify-center space-x-1 mt-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Dashboard

