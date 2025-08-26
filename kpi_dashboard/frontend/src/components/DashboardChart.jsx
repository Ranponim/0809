/**
 * DashboardChart 컴포넌트
 * 
 * Dashboard의 차트 렌더링을 담당하는 컴포넌트입니다.
 * 다양한 차트 스타일(Line, Area, Bar)을 지원합니다.
 * 
 * Props:
 * - chartData: 차트 데이터
 * - key: 차트 키
 * - idx: 차트 인덱스
 * - chartStyle: 차트 스타일 (line, area, bar)
 * - showGrid: 격자 표시 여부
 * - showLegend: 범례 표시 여부
 * - enableTimeComparison: Time1/Time2 비교 모드 활성화 여부
 */

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'

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
  key,
  idx,
  chartStyle,
  showGrid,
  showLegend,
  enableTimeComparison
}) => {
  logDashboardChart('debug', 'DashboardChart 렌더링', {
    key,
    chartStyle,
    dataLength: chartData?.length,
    showGrid,
    showLegend,
    enableTimeComparison
  })

  if (!chartData || chartData.length === 0) {
    logDashboardChart('warn', '차트 데이터가 없음', { key })
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        데이터가 없습니다
      </div>
    )
  }

  const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []
  
  logDashboardChart('debug', '차트 엔티티 정보', {
    key,
    entities,
    entitiesCount: entities.length
  })

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

  try {
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
