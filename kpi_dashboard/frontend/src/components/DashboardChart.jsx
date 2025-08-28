/**
 * DashboardChart 컴포넌트
 *
 * Dashboard의 차트 렌더링을 담당하는 컴포넌트입니다.
 * 다양한 차트 스타일(Line, Area, Bar)을 지원합니다.
 * 로딩 상태와 빈 데이터 상태를 구분하여 사용자 경험을 개선합니다.
 *
 * Props:
 * - chartData: 차트 데이터
 * - key: 차트 키
 * - idx: 차트 인덱스
 * - chartStyle: 차트 스타일 (line, area, bar)
 * - showGrid: 격자 표시 여부
 * - showLegend: 범례 표시 여부
 * - enableTimeComparison: Time1/Time2 비교 모드 활성화 여부
 * - loading: 로딩 상태 (추가)
 * - onRefresh: 새로고침 콜백 (추가)
 * - error: 에러 상태 (추가)
 */

import React, { useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { Button } from '@/components/ui/button.jsx'
import { RefreshCw, BarChart3, AlertCircle } from 'lucide-react'

// 로깅 유틸리티
const logDashboardChart = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[DashboardChart:${timestamp}]`
  
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

/**
 * 차트 색상 생성 함수
 * @param {number} index - 색상 인덱스
 * @returns {string} 색상 코드
 */
const colorFor = (index) => {
  const preset = ['#8884d8','#82ca9d','#ffc658','#ff7300','#8dd1e1','#d084d0']
  if (index < preset.length) return preset[index]
  const hue = (index * 47) % 360
  return `hsl(${hue}, 70%, 50%)`
}

const DashboardChart = ({
  chartData,
  chartKey,
  idx,
  chartStyle,
  showGrid,
  showLegend,
  enableTimeComparison,
  loading = false,
  onRefresh,
  error = null
}) => {
  // 로컬 로딩 상태 (차트별 새로고침용)
  const [chartLoading, setChartLoading] = useState(false)

  // 차트별 새로고침 핸들러
  const handleChartRefresh = useCallback(async () => {
    if (onRefresh) {
      setChartLoading(true)
      logDashboardChart('info', '차트별 새로고침 시작', { chartKey })

      try {
        await onRefresh()
        logDashboardChart('info', '차트별 새로고침 완료', { chartKey })
      } catch (error) {
        logDashboardChart('error', '차트별 새로고침 실패', { chartKey, error: error.message })
      } finally {
        setChartLoading(false)
      }
    }
  }, [onRefresh, chartKey])

  logDashboardChart('debug', 'DashboardChart 렌더링', {
    chartKey,
    chartStyle,
    dataLength: chartData?.length,
    loading,
    chartLoading,
    hasError: !!error,
    showGrid,
    showLegend,
    enableTimeComparison
  })

  // 로딩 상태 처리
  if (loading || chartLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="animate-pulse">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-2" />
        </div>
        <p className="text-sm text-muted-foreground">
          {chartLoading ? '차트 새로고침 중...' : '데이터 로딩 중...'}
        </p>
        <div className="flex space-x-1 mt-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    )
  }

  // 에러 상태 처리
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-destructive">
        <AlertCircle className="h-12 w-12 mb-2" />
        <p className="text-sm font-medium mb-1">차트 로드 오류</p>
        <p className="text-xs text-muted-foreground mb-3 text-center max-w-32">
          {error.message || '데이터를 불러올 수 없습니다'}
        </p>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleChartRefresh}
            disabled={chartLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${chartLoading ? 'animate-spin' : ''}`} />
            다시 시도
          </Button>
        )}
      </div>
    )
  }

  // 빈 데이터 상태 처리
  if (!chartData || chartData.length === 0) {
    logDashboardChart('warn', '차트 데이터가 없음', { chartKey })
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm font-medium mb-1">데이터가 없습니다</p>
        <p className="text-xs text-center max-w-32 mb-3">
          선택한 조건에 맞는 데이터가 존재하지 않습니다
        </p>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleChartRefresh}
            disabled={chartLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${chartLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        )}
      </div>
    )
  }

  // 모든 데이터 포인트에서 엔티티 키를 수집 (Time1/Time2 모두 포함)
  const entities = chartData.length > 0 ? Array.from(
    new Set(
      chartData.flatMap(dataPoint =>
        Object.keys(dataPoint).filter(key =>
          key !== 'time' && key !== '_originalTime' && key !== '_isTime2'
        )
      )
    )
  ) : []

  logDashboardChart('debug', '차트 엔티티 정보', {
    chartKey,
    entities,
    entitiesCount: entities.length,
    hasTimeComparison: enableTimeComparison,
    time1Entities: entities.filter(e => e.includes('_Time1')),
    time2Entities: entities.filter(e => e.includes('_Time2')),
    chartDataLength: chartData.length,
    // Time2 렌더링 문제 디버깅용
    time1DataPoints: chartData.filter(d => !d._isTime2).length,
    time2DataPoints: chartData.filter(d => d._isTime2).length,
    sampleChartData: chartData.slice(0, 3).map(data => ({
      time: data.time,
      _isTime2: data._isTime2,
      entityKeys: Object.keys(data).filter(k => !k.startsWith('_')),
      allKeys: Object.keys(data),
      sampleValues: Object.keys(data)
        .filter(k => !k.startsWith('_'))
        .slice(0, 3)
        .map(k => ({ key: k, value: data[k] }))
    })),
    // Time2 데이터 상세 분석
    time2DetailedInfo: enableTimeComparison ? {
      time2EntitiesFound: entities.filter(e => e.includes('_Time2')).length,
      time2DataPoints: chartData.filter(d => d._isTime2),
      time2SampleValues: chartData
        .filter(d => d._isTime2)
        .slice(0, 2)
        .map(data => ({
          time: data.time,
          entities: Object.keys(data).filter(k => !k.startsWith('_')),
          values: Object.keys(data)
            .filter(k => !k.startsWith('_'))
            .reduce((acc, key) => {
              acc[key] = data[key]
              return acc
            }, {})
        }))
    } : null
  })

  const chartProps = {
    data: chartData,
    className: "h-64"
  }

  // X축 틱 포맷터 - 순수 시간 값만 표시
  const xAxisTickFormatter = (value, index) => {
    // Time1/Time2 비교 시에도 순수 시간 값만 표시
    return value
  }

  const commonElements = [
    showGrid && <CartesianGrid key="grid" strokeDasharray="3 3" />,
    <XAxis
      key="xaxis"
      dataKey="time"
      tickFormatter={enableTimeComparison ? xAxisTickFormatter : undefined}
      angle={enableTimeComparison ? -45 : 0}
      textAnchor={enableTimeComparison ? 'end' : 'middle'}
      height={enableTimeComparison ? 80 : 60}
    />,
    <YAxis key="yaxis" />,
    <Tooltip
      key="tooltip"
      formatter={(value, name) => {
        if (enableTimeComparison) {
          // Time1/Time2 비교 시 PEG 이름만 표시 (시간 구분 제거)
          const baseName = name.replace('_Time1', '').replace('_Time2', '')
          return [value, baseName]
        }
        return [value, name]
      }}
    />,
    showLegend && <Legend
      key="legend"
      formatter={(value, entry, index) => {
        if (enableTimeComparison) {
          // Legend에서도 Time1/Time2 접미사 제거하여 순수 PEG 이름만 표시
          return value.replace('_Time1', '').replace('_Time2', '')
        }
        return value
      }}
    />
  ].filter(Boolean)

  try {
    // 차트 렌더링 전 데이터 검증
    logDashboardChart('info', '차트 렌더링 시작', {
      chartKey,
      chartStyle,
      enableTimeComparison,
      entitiesCount: entities.length,
      chartDataLength: chartData.length,
      time1DataPoints: chartData.filter(d => !d._isTime2).length,
      time2DataPoints: chartData.filter(d => d._isTime2).length,
      entities,
      time1Entities: entities.filter(e => e.includes('_Time1')),
      time2Entities: entities.filter(e => e.includes('_Time2')),
      firstDataPoint: chartData.length > 0 ? {
        time: chartData[0].time,
        _isTime2: chartData[0]._isTime2,
        allKeys: Object.keys(chartData[0]),
        entityKeys: Object.keys(chartData[0]).filter(k => !k.startsWith('_')),
        entityValues: Object.keys(chartData[0])
          .filter(k => !k.startsWith('_'))
          .reduce((acc, key) => {
            acc[key] = chartData[0][key]
            return acc
          }, {})
      } : null
    })

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
  } catch (error) {
    logDashboardChart('error', '차트 렌더링 오류', { key, error })
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        차트 렌더링 오류
      </div>
    )
  }
}

export default DashboardChart

