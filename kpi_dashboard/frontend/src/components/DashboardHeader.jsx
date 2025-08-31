/**
 * DashboardHeader 컴포넌트
 * 
 * Dashboard의 헤더 부분을 담당하는 컴포넌트입니다.
 * 제목, 상태 표시, 새로고침 버튼 등을 포함합니다.
 * 
 * Props:
 * - loading: 로딩 상태
 * - saving: 설정 저장 상태
 * - settingsError: 설정 오류 상태
 * - selectedPegs: 선택된 PEG 목록
 * - chartStyle: 차트 스타일
 * - enableTimeComparison: Time1/Time2 비교 모드 활성화 여부
 * - defaultNe: 기본 NE
 * - defaultCellId: 기본 Cell ID
 * - lastRefresh: 마지막 새로고침 시간
 * - onManualRefresh: 수동 새로고침 핸들러
 */

import React from 'react'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { RefreshCw, Clock } from 'lucide-react'

// 로깅 유틸리티
const logDashboardHeader = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[DashboardHeader:${timestamp}]`
  
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

const DashboardHeader = ({
  loading,
  saving,
  settingsError,
  selectedPegs,
  chartStyle,
  enableTimeComparison,
  defaultNe,
  defaultCellId,
  lastRefresh,
  onManualRefresh
}) => {
  logDashboardHeader('debug', 'DashboardHeader 렌더링', {
    loading,
    saving,
    settingsError,
    selectedPegsCount: selectedPegs?.length,
    chartStyle,
    enableTimeComparison,
    defaultNe,
    defaultCellId,
    lastRefresh
  })

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">
          {selectedPegs?.length || 0}개 PEG 항목 • 차트 스타일: {chartStyle}
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
          onClick={onManualRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>
    </div>
  )
}

export default DashboardHeader

