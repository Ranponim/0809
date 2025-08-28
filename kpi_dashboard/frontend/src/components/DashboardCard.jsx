/**
 * DashboardCard 컴포넌트
 * 
 * Dashboard의 개별 차트 카드를 담당하는 컴포넌트입니다.
 * 차트 제목, 뱃지, 차트 렌더링을 포함합니다.
 * 
 * Props:
 * - key: 차트 키
 * - idx: 차트 인덱스
 * - title: 차트 제목
 * - chartData: 차트 데이터
 * - chartStyle: 차트 스타일
 * - chartLayout: 차트 레이아웃
 * - enableTimeComparison: Time1/Time2 비교 모드 활성화 여부
 * - showGrid: 격자 표시 여부
 * - showLegend: 범례 표시 여부
 * - onZoom: 확대 핸들러
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import DashboardChart from './DashboardChart.jsx'

// 로깅 유틸리티
const logDashboardCard = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[DashboardCard:${timestamp}]`
  
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
 * PEG 제목 생성 함수
 * @param {string} key - PEG 키
 * @returns {string} 표시할 제목
 */
const titleFor = (key) => key

const DashboardCard = ({
  key,
  idx,
  title,
  chartData,
  chartStyle,
  chartLayout,
  enableTimeComparison,
  showGrid,
  showLegend,
  onZoom
}) => {
  logDashboardCard('debug', 'DashboardCard 렌더링', {
    key,
    idx,
    title,
    chartStyle,
    chartLayout,
    dataLength: chartData?.length,
    enableTimeComparison
  })

  const entities = chartData?.length > 0 ? Object.keys(chartData[0]).filter(k => k !== 'time') : []

  return (
    <Card key={`${key}-${idx}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {titleFor(title)}
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
              {chartData?.length || 0}개 데이터포인트
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="h-64 cursor-zoom-in" 
          onClick={() => onZoom({ open: true, title: titleFor(title), data: chartData })}
        >
          <DashboardChart
            chartData={chartData}
            key={key}
            idx={idx}
            chartStyle={chartStyle}
            showGrid={showGrid}
            showLegend={showLegend}
            enableTimeComparison={enableTimeComparison}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default DashboardCard

