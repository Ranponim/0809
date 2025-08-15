/**
 * LLM 분석 결과 필터링 컴포넌트
 * 
 * 이 컴포넌트는 분석 결과 목록의 필터링 기능을 담당합니다.
 * Task 41: Frontend LLM 분석 결과 필터링 기능 구현
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { 
  X, 
  Search, 
  Calendar,
  Building,
  Radio,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

/**
 * 분석 결과 필터링 컴포넌트
 * 
 * @param {Object} props
 * @param {Object} props.filters - 현재 필터 값들
 * @param {Function} props.onFilterChange - 필터 변경 핸들러
 * @param {Function} props.onClearFilters - 필터 초기화 핸들러
 * @param {boolean} props.isCollapsed - 필터 패널 접힌 상태
 * @param {Function} props.onToggleCollapse - 접기/펼치기 토글 핸들러
 * @param {boolean} props.showActiveCount - 활성 필터 개수 표시 여부
 */
const ResultFilter = ({
  filters = {},
  onFilterChange,
  onClearFilters,
  isCollapsed = false,
  onToggleCollapse,
  showActiveCount = true
}) => {

  // === 로깅 함수 ===
  const logInfo = useCallback((message, data = {}) => {
    console.log(`[ResultFilter] ${message}`, data)
  }, [])

  // === 필터 값 추출 ===
  const {
    neId = '',
    cellId = '',
    startDate = null,
    endDate = null,
    status = ''
  } = filters

  // === 활성 필터 계산 ===
  const activeFilters = {
    ...(neId && { 'NE ID': neId }),
    ...(cellId && { 'Cell ID': cellId }),
    ...(startDate && { '시작일': new Date(startDate).toLocaleDateString('ko-KR') }),
    ...(endDate && { '종료일': new Date(endDate).toLocaleDateString('ko-KR') }),
    ...(status && { '상태': status })
  }

  const activeFilterCount = Object.keys(activeFilters).length
  const hasActiveFilters = activeFilterCount > 0

  // === 필터 변경 핸들러 ===
  const handleFilterChange = useCallback((key, value) => {
    logInfo('필터 변경', { key, value })
    
    if (onFilterChange) {
      onFilterChange(key, value)
    }
  }, [onFilterChange, logInfo])

  // === 개별 필터 초기화 ===
  const handleClearFilter = useCallback((key) => {
    logInfo('개별 필터 초기화', { key })
    
    const clearValue = key === 'startDate' || key === 'endDate' ? null : ''
    handleFilterChange(key, clearValue)
  }, [handleFilterChange, logInfo])

  // === 전체 필터 초기화 ===
  const handleClearAllFilters = useCallback(() => {
    logInfo('전체 필터 초기화')
    
    if (onClearFilters) {
      onClearFilters()
    }
  }, [onClearFilters, logInfo])

  // === 날짜 포맷 변환 ===
  const formatDateForInput = useCallback((dateString) => {
    if (!dateString) return ''
    
    try {
      return new Date(dateString).toISOString().split('T')[0]
    } catch {
      return ''
    }
  }, [])

  const formatDateForAPI = useCallback((inputDate) => {
    if (!inputDate) return null
    
    try {
      return new Date(inputDate).toISOString()
    } catch {
      return null
    }
  }, [])

  // === 필터 패널 토글 ===
  const handleToggleCollapse = useCallback(() => {
    logInfo('필터 패널 토글', { isCollapsed: !isCollapsed })
    
    if (onToggleCollapse) {
      onToggleCollapse()
    }
  }, [isCollapsed, onToggleCollapse, logInfo])

  // === 렌더링 ===
  return (
    <Card className="w-full">
      {/* 헤더 */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              필터
            </CardTitle>
            
            {showActiveCount && hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}개 활성
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAllFilters}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                전체 초기화
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleToggleCollapse}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* 활성 필터 표시 */}
        {hasActiveFilters && !isCollapsed && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(activeFilters).map(([key, value]) => (
              <Badge 
                key={key} 
                variant="outline" 
                className="flex items-center gap-1 pr-1"
              >
                <span className="text-xs">{key}: {value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => {
                    // 키-값 매핑을 통해 실제 필터 키를 찾기
                    const filterKeyMap = {
                      'NE ID': 'neId',
                      'Cell ID': 'cellId',
                      '시작일': 'startDate',
                      '종료일': 'endDate',
                      '상태': 'status'
                    }
                    const actualKey = filterKeyMap[key]
                    if (actualKey) {
                      handleClearFilter(actualKey)
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      {/* 필터 컨텐츠 */}
      {!isCollapsed && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* NE ID 필터 */}
            <div className="space-y-2">
              <Label htmlFor="filter-ne" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                NE ID
              </Label>
              <div className="relative">
                <Input
                  id="filter-ne"
                  placeholder="NE ID 검색..."
                  value={neId}
                  onChange={(e) => handleFilterChange('neId', e.target.value)}
                  className="pr-8"
                />
                {neId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => handleClearFilter('neId')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Cell ID 필터 */}
            <div className="space-y-2">
              <Label htmlFor="filter-cell" className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Cell ID
              </Label>
              <div className="relative">
                <Input
                  id="filter-cell"
                  placeholder="Cell ID 검색..."
                  value={cellId}
                  onChange={(e) => handleFilterChange('cellId', e.target.value)}
                  className="pr-8"
                />
                {cellId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => handleClearFilter('cellId')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* 시작 날짜 필터 */}
            <div className="space-y-2">
              <Label htmlFor="filter-start" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                시작 날짜
              </Label>
              <div className="relative">
                <Input
                  id="filter-start"
                  type="date"
                  value={formatDateForInput(startDate)}
                  onChange={(e) => handleFilterChange('startDate', formatDateForAPI(e.target.value))}
                  className="pr-8"
                />
                {startDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => handleClearFilter('startDate')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* 종료 날짜 필터 */}
            <div className="space-y-2">
              <Label htmlFor="filter-end" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                종료 날짜
              </Label>
              <div className="relative">
                <Input
                  id="filter-end"
                  type="date"
                  value={formatDateForInput(endDate)}
                  onChange={(e) => handleFilterChange('endDate', formatDateForAPI(e.target.value))}
                  className="pr-8"
                />
                {endDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => handleClearFilter('endDate')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 빠른 날짜 필터 */}
          <div className="mt-4 pt-4 border-t">
            <Label className="text-sm font-medium mb-3 block">빠른 날짜 선택</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '오늘', days: 0 },
                { label: '어제', days: 1 },
                { label: '최근 7일', days: 7 },
                { label: '최근 30일', days: 30 },
                { label: '최근 90일', days: 90 }
              ].map(({ label, days }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const endDate = new Date()
                    const startDate = new Date()
                    
                    if (days === 0) {
                      // 오늘
                      startDate.setHours(0, 0, 0, 0)
                      endDate.setHours(23, 59, 59, 999)
                    } else if (days === 1) {
                      // 어제
                      startDate.setDate(startDate.getDate() - 1)
                      startDate.setHours(0, 0, 0, 0)
                      endDate.setDate(endDate.getDate() - 1)
                      endDate.setHours(23, 59, 59, 999)
                    } else {
                      // 최근 N일
                      startDate.setDate(startDate.getDate() - days)
                      startDate.setHours(0, 0, 0, 0)
                      endDate.setHours(23, 59, 59, 999)
                    }
                    
                    handleFilterChange('startDate', startDate.toISOString())
                    handleFilterChange('endDate', endDate.toISOString())
                    
                    logInfo('빠른 날짜 선택', { label, startDate, endDate })
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default ResultFilter

