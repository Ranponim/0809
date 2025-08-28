/**
 * DashboardCard 컴포넌트
 *
 * Dashboard의 개별 차트 카드를 담당하는 컴포넌트입니다.
 * 차트 제목, 뱃지, 차트 렌더링을 포함합니다.
 * 로딩 상태와 새로고침 기능을 지원합니다.
 *
 * Props:
 * - chartKey: 차트 키
 * - idx: 차트 인덱스
 * - title: 차트 제목
 * - chartData: 차트 데이터
 * - chartStyle: 차트 스타일
 * - chartLayout: 차트 레이아웃
 * - enableTimeComparison: Time1/Time2 비교 모드 활성화 여부
 * - showGrid: 격자 표시 여부
 * - showLegend: 범례 표시 여부
 * - onZoom: 확대 핸들러
 * - loading: 로딩 상태 (추가)
 * - onRefresh: 새로고침 콜백 (추가)
 * - error: 에러 상태 (추가)
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
 * @param {string} chartKey - PEG 키
 * @returns {string} 표시할 제목
 */
const titleFor = (title) => title

const DashboardCard = ({
  chartKey,
  idx,
  title,
  chartData,
  chartStyle,
  chartLayout,
  enableTimeComparison,
  showGrid,
  showLegend,
  onZoom,
  loading = false,
  onRefresh,
  error = null
}) => {
  logDashboardCard('debug', 'DashboardCard 렌더링', {
    chartKey,
    idx,
    title,
    chartStyle,
    chartLayout,
    dataLength: chartData?.length,
    loading,
    hasError: !!error,
    enableTimeComparison,
    chartDataType: Array.isArray(chartData) ? 'array' : typeof chartData,
    chartDataSample: chartData?.length > 0 ? {
      firstItem: {
        time: chartData[0].time,
        _isTime2: chartData[0]._isTime2,
        entityCount: Object.keys(chartData[0]).filter(k => !k.startsWith('_')).length,
        entities: Object.keys(chartData[0]).filter(k => !k.startsWith('_')),
        allKeys: Object.keys(chartData[0])
      },
      totalItems: chartData.length,
      // Time2 렌더링 문제 디버깅용
      time1DataPoints: chartData.filter(d => !d._isTime2).length,
      time2DataPoints: chartData.filter(d => d._isTime2).length,
      time2SampleData: chartData.filter(d => d._isTime2).slice(0, 2).map(point => ({
        time: point.time,
        _isTime2: point._isTime2,
        entities: Object.keys(point).filter(k => !k.startsWith('_')),
        sampleValues: Object.keys(point)
          .filter(k => !k.startsWith('_'))
          .slice(0, 3)
          .map(k => ({ key: k, value: point[k] }))
      }))
    } : null
  })

  // 모든 데이터 포인트에서 엔티티 키를 수집 (Time1/Time2 모두 포함)
  const entities = chartData?.length > 0 ? Array.from(
    new Set(
      chartData.flatMap(dataPoint =>
        Object.keys(dataPoint).filter(k =>
          k !== 'time' && k !== '_originalTime' && k !== '_isTime2'
        )
      )
    )
  ) : []

  // 로딩 중이거나 에러가 있을 때 카드 스타일 변경
  const cardClassName = `w-full ${error ? 'border-destructive' : ''} ${loading ? 'opacity-75' : ''}`

  return (
    <Card key={`${chartKey}-${idx}`} className={cardClassName}>
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
            chartKey={chartKey}
            idx={idx}
            chartStyle={chartStyle}
            showGrid={showGrid}
            showLegend={showLegend}
            enableTimeComparison={enableTimeComparison}
            loading={loading}
            onRefresh={onRefresh}
            error={error}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default DashboardCard

