/**
 * DataFilterPanel.jsx
 *
 * 데이터 필터링을 위한 범용 컴포넌트
 * NE, Cell ID 등의 필터링 옵션을 공통으로 제공
 *
 * 사용법:
 * ```jsx
 * <DataFilterPanel
 *   ne={config.ne}
 *   cellid={config.cellid}
 *   onNeChange={handleNeChange}
 *   onCellidChange={handleCellidChange}
 *   compact={false}
 * />
 * ```
 */

import React, { useState, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Filter, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const DataFilterPanel = memo(({
  // 필터 값들
  ne = '',
  cellid = '',

  // 이벤트 핸들러
  onNeChange,
  onCellidChange,

  // 옵션 Props
  compact = false,
  showValidation = true,
  onValidate,
  onReset,

  // 스타일링
  className = ''
}) => {
  // 로컬 상태
  const [isValidating, setIsValidating] = useState(false)
  const [validationErrors, setValidationErrors] = useState([])

  // NE 필터 검증
  const validateNeFilter = (neValue) => {
    if (!neValue || neValue.trim() === '') return []

    const errors = []
    const neList = neValue.split(',').map(item => item.trim()).filter(item => item !== '')

    // 각 NE 값 검증
    neList.forEach((neItem, index) => {
      // 숫자 형식 검증 (예: nvgnb#10000)
      const nePattern = /^nvgnb#\d+$/
      if (!nePattern.test(neItem)) {
        errors.push(`NE #${index + 1}: '${neItem}'은 올바른 NE 형식(nvgnb#숫자)이 아닙니다.`)
      }
    })

    // 중복 값 검증
    const uniqueNeList = [...new Set(neList)]
    if (uniqueNeList.length !== neList.length) {
      errors.push('중복된 NE 값이 있습니다.')
    }

    return errors
  }

  // Cell ID 필터 검증
  const validateCellIdFilter = (cellidValue) => {
    if (!cellidValue || cellidValue.trim() === '') return []

    const errors = []
    const cellIdList = cellidValue.split(',').map(item => item.trim()).filter(item => item !== '')

    // 각 Cell ID 값 검증
    cellIdList.forEach((cellIdItem, index) => {
      // 숫자 형식 검증
      if (!/^\d+$/.test(cellIdItem)) {
        errors.push(`Cell ID #${index + 1}: '${cellIdItem}'은 숫자 형식이어야 합니다.`)
      }

      // 범위 검증 (일반적으로 3-5자리 숫자)
      if (cellIdItem.length < 3 || cellIdItem.length > 6) {
        errors.push(`Cell ID #${index + 1}: '${cellIdItem}'의 길이가 올바르지 않습니다 (3-6자리).`)
      }
    })

    // 중복 값 검증
    const uniqueCellIdList = [...new Set(cellIdList)]
    if (uniqueCellIdList.length !== cellIdList.length) {
      errors.push('중복된 Cell ID 값이 있습니다.')
    }

    return errors
  }

  // 전체 필터 검증
  const validateFilters = () => {
    setIsValidating(true)
    const errors = []

    try {
      // NE 필터 검증
      const neErrors = validateNeFilter(ne)
      errors.push(...neErrors)

      // Cell ID 필터 검증
      const cellIdErrors = validateCellIdFilter(cellid)
      errors.push(...cellIdErrors)

      setValidationErrors(errors)

      if (errors.length === 0) {
        toast.success('필터 설정이 유효합니다!')
        if (onValidate) {
          onValidate()
        }
      } else {
        toast.error(`필터 오류: ${errors.length}개의 문제가 발견되었습니다.`)
      }

    } catch (error) {
      console.error('필터 검증 오류:', error)
      toast.error('필터 검증 중 오류가 발생했습니다.')
    } finally {
      setIsValidating(false)
    }
  }

  // 필터 초기화
  const resetFilters = () => {
    onNeChange('')
    onCellidChange('')
    setValidationErrors([])

    if (onReset) {
      onReset()
    }

    toast.success('필터가 초기화되었습니다.')
  }

  // NE 예시 값들
  const neExamples = [
    'nvgnb#10000',
    'nvgnb#20000',
    'nvgnb#30000'
  ]

  // Cell ID 예시 값들
  const cellIdExamples = [
    '2010',
    '2011',
    '3010',
    '3011'
  ]

  // NE 필터 파싱 (쉼표로 구분된 값들)
  const neList = ne ? ne.split(',').map(item => item.trim()).filter(item => item !== '') : []

  // Cell ID 필터 파싱 (쉼표로 구분된 값들)
  const cellIdList = cellid ? cellid.split(',').map(item => item.trim()).filter(item => item !== '') : []

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Filter className="h-4 w-4" />
          데이터 필터
        </Label>

        {/* 필터 상태 표시 */}
        <div className="flex items-center gap-2">
          {neList.length > 0 && (
            <Badge variant="outline" className="text-xs">
              NE: {neList.length}개
            </Badge>
          )}
          {cellIdList.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Cell ID: {cellIdList.length}개
            </Badge>
          )}
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {/* NE 필터 */}
        <div className="space-y-2">
          <Label className="text-sm">NE (Network Element)</Label>
          <Input
            placeholder="예: nvgnb#10000 또는 nvgnb#10000,nvgnb#20000"
            value={ne}
            onChange={(e) => onNeChange(e.target.value)}
            className="text-sm"
          />

          {/* NE 예시 */}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">예시:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {neExamples.map((example, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs px-2"
                  onClick={() => {
                    const currentNeList = ne ? ne.split(',').map(item => item.trim()).filter(item => item !== '') : []
                    if (!currentNeList.includes(example)) {
                      const newNeList = [...currentNeList, example]
                      onNeChange(newNeList.join(','))
                    }
                  }}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>

          {/* NE 값 목록 표시 */}
          {neList.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {neList.map((neItem, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    const newNeList = neList.filter((_, i) => i !== index)
                    onNeChange(newNeList.join(','))
                  }}
                >
                  {neItem} ✕
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Cell ID 필터 */}
        <div className="space-y-2">
          <Label className="text-sm">Cell ID</Label>
          <Input
            placeholder="예: 2010 또는 2010,2011,3010"
            value={cellid}
            onChange={(e) => onCellidChange(e.target.value)}
            className="text-sm"
          />

          {/* Cell ID 예시 */}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">예시:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {cellIdExamples.map((example, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs px-2"
                  onClick={() => {
                    const currentCellIdList = cellid ? cellid.split(',').map(item => item.trim()).filter(item => item !== '') : []
                    if (!currentCellIdList.includes(example)) {
                      const newCellIdList = [...currentCellIdList, example]
                      onCellidChange(newCellIdList.join(','))
                    }
                  }}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>

          {/* Cell ID 값 목록 표시 */}
          {cellIdList.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {cellIdList.map((cellIdItem, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    const newCellIdList = cellIdList.filter((_, i) => i !== index)
                    onCellidChange(newCellIdList.join(','))
                  }}
                >
                  {cellIdItem} ✕
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 필터 요약 */}
      {(neList.length > 0 || cellIdList.length > 0) && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-xs font-medium mb-2">적용된 필터</div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {neList.length > 0 && (
              <div>NE 필터: {neList.join(', ')} ({neList.length}개)</div>
            )}
            {cellIdList.length > 0 && (
              <div>Cell ID 필터: {cellIdList.join(', ')} ({cellIdList.length}개)</div>
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼들 */}
      {showValidation && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
            >
              필터 초기화
            </Button>

            <div className="flex items-center gap-2">
              {validationErrors.length > 0 && (
                <div className="flex items-center gap-1 text-red-600 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {validationErrors.length}개 오류
                </div>
              )}

              <Button
                size="sm"
                onClick={validateFilters}
                disabled={isValidating}
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                    검증 중...
                  </>
                ) : (
                  '필터 검증'
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* 검증 오류 표시 */}
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-red-700 font-medium text-sm">필터 오류</span>
          </div>
          <ul className="space-y-1 text-sm text-red-600">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
})

DataFilterPanel.displayName = 'DataFilterPanel'

export default DataFilterPanel
