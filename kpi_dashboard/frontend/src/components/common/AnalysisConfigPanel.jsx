/**
 * AnalysisConfigPanel.jsx
 *
 * 분석 설정을 위한 범용 컴포넌트
 * 기간 설정, PEG 선택, 필터링 옵션 등을 공통으로 제공
 *
 * 사용법:
 * ```jsx
 * <AnalysisConfigPanel
 *   config={analysisConfig}
 *   onConfigChange={handleConfigChange}
 *   analysisType="statistics" // "statistics" | "llm" | "trend"
 *   showPeriodSelector={true}
 *   showPegSelector={true}
 *   showFilterOptions={true}
 * />
 * ```
 */

import React, { useState, useEffect, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { AlertTriangle, Settings, Database, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import DateRangeSelector from '../DateRangeSelector.jsx'
import DataFilterPanel from './DataFilterPanel.jsx'

const AnalysisConfigPanel = memo(({
  // 필수 Props
  config,
  onConfigChange,

  // 옵션 Props
  analysisType = 'statistics', // "statistics" | "llm" | "trend"
  showPeriodSelector = true,
  showPegSelector = true,
  showFilterOptions = true,
  showDatabaseOptions = false,

  // 데이터 관련 Props
  availablePegs = [],
  pegOptionsLoading = false,
  onPegOptionsRefresh,

  // 이벤트 핸들러
  onValidate,
  onReset,

  // 스타일링
  className = '',
  compact = false
}) => {
  // 로컬 상태
  const [validationErrors, setValidationErrors] = useState([])
  const [isValidating, setIsValidating] = useState(false)

  // 기본 PEG 옵션들 (Database에서 가져오지 못한 경우 사용)
  const defaultPegOptions = useMemo(() => [
    { value: 'availability', label: 'Availability (%)', category: 'performance' },
    { value: 'rrc', label: 'RRC Success Rate (%)', category: 'access' },
    { value: 'erab', label: 'ERAB Success Rate (%)', category: 'access' },
    { value: 'sar', label: 'SAR', category: 'mobility' },
    { value: 'mobility_intra', label: 'Mobility Intra (%)', category: 'mobility' },
    { value: 'cqi', label: 'CQI', category: 'quality' },
    { value: 'se', label: 'Spectral Efficiency', category: 'efficiency' },
    { value: 'dl_thp', label: 'DL Throughput', category: 'throughput' },
    { value: 'ul_int', label: 'UL Interference', category: 'interference' }
  ], [])

  // 현재 사용할 PEG 옵션들 결정
  const currentPegOptions = useMemo(() => {
    return availablePegs.length > 0 ? availablePegs : defaultPegOptions
  }, [availablePegs, defaultPegOptions])

  // 선택된 PEG 개수 계산
  const selectedPegCount = useMemo(() => {
    return config.selectedPegs?.length || 0
  }, [config.selectedPegs])

  // 설정 변경 핸들러
  const handleConfigChange = (key, value) => {
    onConfigChange({
      ...config,
      [key]: value
    })
  }

  // 기간 변경 핸들러
  const handlePeriodChange = (periodKey, periodData) => {
    handleConfigChange(periodKey, periodData)
  }

  // PEG 선택 변경 핸들러
  const handlePegToggle = (pegValue) => {
    const currentPegs = config.selectedPegs || []
    const isSelected = currentPegs.includes(pegValue)

    const newPegs = isSelected
      ? currentPegs.filter(p => p !== pegValue)
      : [...currentPegs, pegValue]

    handleConfigChange('selectedPegs', newPegs)
  }

  // PEG 전체 선택/해제
  const handleSelectAllPegs = (selectAll) => {
    const newPegs = selectAll
      ? currentPegOptions.map(peg => peg.value)
      : []

    handleConfigChange('selectedPegs', newPegs)
  }

  // 설정 검증
  const validateConfig = async () => {
    setIsValidating(true)
    const errors = []

    try {
      // 기간 검증
      if (showPeriodSelector) {
        if (config.period1?.startDate && config.period1?.endDate) {
          const period1Start = new Date(config.period1.startDate)
          const period1End = new Date(config.period1.endDate)

          if (period1Start >= period1End) {
            errors.push('기간 1의 시작일이 종료일보다 늦을 수 없습니다.')
          }
        }

        if (config.showComparison && config.period2?.startDate && config.period2?.endDate) {
          const period2Start = new Date(config.period2.startDate)
          const period2End = new Date(config.period2.endDate)

          if (period2Start >= period2End) {
            errors.push('기간 2의 시작일이 종료일보다 늦을 수 없습니다.')
          }
        }
      }

      // PEG 검증
      if (showPegSelector && (!config.selectedPegs || config.selectedPegs.length === 0)) {
        errors.push('분석할 PEG를 최소 1개 이상 선택해주세요.')
      }

      // 분석 타입별 추가 검증
      if (analysisType === 'llm') {
        if (!config.n_minus_1 || !config.n) {
          errors.push('LLM 분석을 위해 N-1과 N 기간을 모두 입력해주세요.')
        }
      }

      setValidationErrors(errors)

      if (errors.length === 0) {
        toast.success('설정이 유효합니다!')
        if (onValidate) {
          await onValidate()
        }
      } else {
        toast.error(`설정 오류: ${errors.length}개의 문제가 발견되었습니다.`)
      }

    } catch (error) {
      console.error('설정 검증 오류:', error)
      toast.error('설정 검증 중 오류가 발생했습니다.')
    } finally {
      setIsValidating(false)
    }
  }

  // 설정 초기화
  const resetConfig = () => {
    const defaultConfig = {
      selectedPegs: ['availability', 'rrc', 'erab'],
      includeOutliers: true,
      decimalPlaces: 4,
      showComparison: true,
      showSecondaryAxis: false,
      showThreshold: false,
      thresholdValue: 99.0,
      ne: '',
      cellid: ''
    }

    onConfigChange(defaultConfig)
    setValidationErrors([])

    if (onReset) {
      onReset()
    }

    toast.success('설정이 초기화되었습니다.')
  }

  // 카테고리별 PEG 그룹화
  const pegsByCategory = useMemo(() => {
    const grouped = {}
    currentPegOptions.forEach(peg => {
      const category = peg.category || 'other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(peg)
    })
    return grouped
  }, [currentPegOptions])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            분석 설정
            {analysisType && (
              <Badge variant="outline" className="ml-2">
                {analysisType === 'statistics' ? '통계 분석' :
                 analysisType === 'llm' ? 'LLM 분석' : '트렌드 분석'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-6 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
            {/* 기간 설정 */}
            {showPeriodSelector && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">분석 기간 설정</Label>
                  <DateRangeSelector
                    title="기간 1 (기준)"
                    description="비교의 기준이 되는 기간"
                    startDate={config.period1?.startDate || ''}
                    endDate={config.period1?.endDate || ''}
                    preset={config.period1?.preset || 'last7days'}
                    onDateChange={(data) => handlePeriodChange('period1', data)}
                    onPresetChange={(preset) => handlePeriodChange('period1', { ...config.period1, preset })}
                  />
                </div>

                {config.showComparison && (
                  <div className="space-y-3">
                    <DateRangeSelector
                      title="기간 2 (비교)"
                      description="기준과 비교할 기간"
                      startDate={config.period2?.startDate || ''}
                      endDate={config.period2?.endDate || ''}
                      preset={config.period2?.preset || 'last14days'}
                      onDateChange={(data) => handlePeriodChange('period2', data)}
                      onPresetChange={(preset) => handlePeriodChange('period2', { ...config.period2, preset })}
                    />
                  </div>
                )}
              </>
            )}

            {/* PEG 선택 */}
            {showPegSelector && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    분석할 PEG
                    {pegOptionsLoading && <RefreshCw className="h-3 w-3 animate-spin ml-2" />}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAllPegs(true)}
                      className="text-xs h-7"
                    >
                      전체 선택
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAllPegs(false)}
                      className="text-xs h-7"
                    >
                      전체 해제
                    </Button>
                    {onPegOptionsRefresh && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onPegOptionsRefresh}
                        disabled={pegOptionsLoading}
                        className="text-xs h-7"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {Object.entries(pegsByCategory).map(([category, pegs]) => (
                    <div key={category} className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {category === 'performance' ? '성능' :
                         category === 'access' ? '접속' :
                         category === 'mobility' ? '이동성' :
                         category === 'quality' ? '품질' :
                         category === 'efficiency' ? '효율성' :
                         category === 'interference' ? '간섭' : category}
                      </Label>
                      {pegs.map((peg) => (
                        <div key={peg.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`peg-${peg.value}`}
                            checked={config.selectedPegs?.includes(peg.value) || false}
                            onCheckedChange={() => handlePegToggle(peg.value)}
                          />
                          <Label
                            htmlFor={`peg-${peg.value}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {peg.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <Badge variant="outline" className="text-xs w-full justify-center">
                  {selectedPegCount}개 PEG 선택됨
                </Badge>
              </div>
            )}

            {/* 분석 옵션 */}
            {showFilterOptions && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">분석 옵션</Label>

                <div className="space-y-3">
                  {/* 기간 비교 옵션 */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">기간 비교 활성화</Label>
                    <Checkbox
                      checked={config.showComparison || false}
                      onCheckedChange={(checked) => handleConfigChange('showComparison', checked)}
                    />
                  </div>

                  {/* 이상치 포함 옵션 */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">이상치 데이터 포함</Label>
                    <Checkbox
                      checked={config.includeOutliers !== false}
                      onCheckedChange={(checked) => handleConfigChange('includeOutliers', checked)}
                    />
                  </div>

                  {/* 소수점 자리수 설정 */}
                  <div className="space-y-2">
                    <Label className="text-sm">소수점 자리수</Label>
                    <Select
                      value={String(config.decimalPlaces || 4)}
                      onValueChange={(value) => handleConfigChange('decimalPlaces', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2자리</SelectItem>
                        <SelectItem value="3">3자리</SelectItem>
                        <SelectItem value="4">4자리</SelectItem>
                        <SelectItem value="5">5자리</SelectItem>
                        <SelectItem value="6">6자리</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* 데이터 필터 */}
            {showFilterOptions && (
              <DataFilterPanel
                ne={config.ne || ''}
                cellid={config.cellid || ''}
                onNeChange={(value) => handleConfigChange('ne', value)}
                onCellidChange={(value) => handleConfigChange('cellid', value)}
                compact={compact}
              />
            )}
          </div>

          {/* 액션 버튼들 */}
          <Separator className="my-6" />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={resetConfig}
              className="text-sm"
            >
              초기화
            </Button>

            <div className="flex items-center gap-2">
              {validationErrors.length > 0 && (
                <div className="flex items-center gap-1 text-red-600 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {validationErrors.length}개 오류
                </div>
              )}

              <Button
                onClick={validateConfig}
                disabled={isValidating}
                className="text-sm"
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                    검증 중...
                  </>
                ) : (
                  '설정 검증'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 검증 오류 표시 */}
      {validationErrors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-red-700 font-medium">설정 오류</span>
            </div>
            <ul className="space-y-1 text-sm text-red-600">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
})

AnalysisConfigPanel.displayName = 'AnalysisConfigPanel'

export default AnalysisConfigPanel
