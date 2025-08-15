/**
 * DateRangeSelector.jsx
 * 
 * 날짜 범위 선택을 위한 재사용 가능한 컴포넌트
 * Statistics Basic 탭에서 두 기간 비교를 위해 사용됩니다.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Calendar, Clock, AlertCircle, CheckCircle } from 'lucide-react'

const DateRangeSelector = ({
  title = "날짜 범위",
  description = "분석할 기간을 선택하세요",
  startDate,
  endDate,
  onDateChange,
  preset = "",
  onPresetChange,
  disabled = false,
  error = null,
  className = "",
  showPresets = true,
  minDate = null,
  maxDate = null
}) => {
  
  // 로컬 상태 (입력 검증용)
  const [localStartDate, setLocalStartDate] = useState(startDate || '')
  const [localEndDate, setLocalEndDate] = useState(endDate || '')
  const [validationError, setValidationError] = useState(null)
  
  // 미리 정의된 날짜 범위 프리셋
  const datePresets = [
    { value: 'last7days', label: '최근 7일', days: 7 },
    { value: 'last14days', label: '최근 14일', days: 14 },
    { value: 'last30days', label: '최근 30일', days: 30 },
    { value: 'thisweek', label: '이번 주', custom: true },
    { value: 'lastweek', label: '지난 주', custom: true },
    { value: 'thismonth', label: '이번 달', custom: true },
    { value: 'lastmonth', label: '지난 달', custom: true },
    { value: 'custom', label: '직접 선택', custom: true }
  ]
  
  // props 변경 시 로컬 상태 업데이트
  useEffect(() => {
    setLocalStartDate(startDate || '')
    setLocalEndDate(endDate || '')
  }, [startDate, endDate])
  
  // 날짜 검증 함수
  const validateDateRange = (start, end) => {
    if (!start || !end) {
      return "시작 날짜와 종료 날짜를 모두 입력해주세요"
    }
    
    const startDateTime = new Date(start)
    const endDateTime = new Date(end)
    
    if (isNaN(startDateTime) || isNaN(endDateTime)) {
      return "올바른 날짜 형식을 입력해주세요"
    }
    
    if (startDateTime >= endDateTime) {
      return "종료 날짜는 시작 날짜보다 이후여야 합니다"
    }
    
    // 최대 날짜 범위 제한 (예: 365일)
    const diffDays = (endDateTime - startDateTime) / (1000 * 60 * 60 * 24)
    if (diffDays > 365) {
      return "날짜 범위는 최대 365일까지 선택할 수 있습니다"
    }
    
    // minDate, maxDate 검증
    if (minDate && startDateTime < new Date(minDate)) {
      return `시작 날짜는 ${minDate} 이후여야 합니다`
    }
    
    if (maxDate && endDateTime > new Date(maxDate)) {
      return `종료 날짜는 ${maxDate} 이전이어야 합니다`
    }
    
    return null
  }
  
  // 날짜 변경 핸들러
  const handleDateChange = (type, value) => {
    let newStartDate = localStartDate
    let newEndDate = localEndDate
    
    if (type === 'start') {
      newStartDate = value
      setLocalStartDate(value)
    } else if (type === 'end') {
      newEndDate = value
      setLocalEndDate(value)
    }
    
    // 검증 수행
    const error = validateDateRange(newStartDate, newEndDate)
    setValidationError(error)
    
    // 유효한 경우에만 부모 컴포넌트에 전달
    if (!error && onDateChange) {
      onDateChange({
        startDate: newStartDate,
        endDate: newEndDate
      })
    }
  }
  
  // 프리셋 선택 핸들러
  const handlePresetChange = (presetValue) => {
    const today = new Date()
    let start, end
    
    switch (presetValue) {
      case 'last7days':
        end = new Date(today)
        start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
        
      case 'last14days':
        end = new Date(today)
        start = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
        break
        
      case 'last30days':
        end = new Date(today)
        start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
        
      case 'thisweek':
        const thisWeekStart = new Date(today)
        thisWeekStart.setDate(today.getDate() - today.getDay())
        start = thisWeekStart
        end = new Date(today)
        break
        
      case 'lastweek':
        const lastWeekEnd = new Date(today)
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1)
        const lastWeekStart = new Date(lastWeekEnd)
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
        start = lastWeekStart
        end = lastWeekEnd
        break
        
      case 'thismonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date(today)
        break
        
      case 'lastmonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        start = lastMonthStart
        end = lastMonthEnd
        break
        
      case 'custom':
        // 직접 선택 모드로 변경
        if (onPresetChange) {
          onPresetChange(presetValue)
        }
        return
        
      default:
        return
    }
    
    // 날짜를 ISO 형식으로 변환
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    
    setLocalStartDate(startStr)
    setLocalEndDate(endStr)
    
    // 검증 및 부모 컴포넌트에 전달
    const error = validateDateRange(startStr, endStr)
    setValidationError(error)
    
    if (!error && onDateChange) {
      onDateChange({
        startDate: startStr,
        endDate: endStr
      })
    }
    
    if (onPresetChange) {
      onPresetChange(presetValue)
    }
  }
  
  // 현재 날짜 범위 정보 계산
  const getDateRangeInfo = () => {
    if (!localStartDate || !localEndDate) return null
    
    try {
      const start = new Date(localStartDate)
      const end = new Date(localEndDate)
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      
      return {
        days: diffDays,
        startFormatted: start.toLocaleDateString('ko-KR'),
        endFormatted: end.toLocaleDateString('ko-KR')
      }
    } catch {
      return null
    }
  }
  
  const dateRangeInfo = getDateRangeInfo()
  const currentError = error || validationError
  const isValid = !currentError && localStartDate && localEndDate

  return (
    <Card className={`${className} ${disabled ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 프리셋 선택 */}
        {showPresets && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">빠른 선택</Label>
            <Select 
              value={preset} 
              onValueChange={handlePresetChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="기간을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {datePresets.map((presetOption) => (
                  <SelectItem key={presetOption.value} value={presetOption.value}>
                    {presetOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* 날짜 입력 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`start-${title}`} className="text-sm">시작 날짜</Label>
            <Input
              id={`start-${title}`}
              type="date"
              value={localStartDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              disabled={disabled}
              min={minDate}
              max={maxDate}
              className={currentError ? 'border-red-500' : ''}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`end-${title}`} className="text-sm">종료 날짜</Label>
            <Input
              id={`end-${title}`}
              type="date"
              value={localEndDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              disabled={disabled}
              min={minDate}
              max={maxDate}
              className={currentError ? 'border-red-500' : ''}
            />
          </div>
        </div>
        
        {/* 오류 메시지 */}
        {currentError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">{currentError}</span>
          </div>
        )}
        
        {/* 날짜 범위 정보 */}
        {dateRangeInfo && isValid && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
            <div className="text-sm text-green-700">
              <span className="font-medium">{dateRangeInfo.days}일 기간</span>
              <span className="text-green-600 ml-2">
                ({dateRangeInfo.startFormatted} ~ {dateRangeInfo.endFormatted})
              </span>
            </div>
          </div>
        )}
        
        {/* 상태 뱃지 */}
        <div className="flex items-center gap-2">
          <Badge variant={isValid ? "default" : "secondary"} className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {isValid ? "유효한 범위" : "범위 설정 필요"}
          </Badge>
          
          {dateRangeInfo && isValid && (
            <Badge variant="outline" className="text-xs">
              {dateRangeInfo.days}일 데이터
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default DateRangeSelector

