/**
 * SettingBox 컴포넌트
 * 
 * 재사용 가능한 설정 박스 컴포넌트입니다.
 * 다양한 입력 타입을 지원하며, usePreference 훅과 통합되어 자동 저장 및 상태 표시를 제공합니다.
 * 
 * 주요 기능:
 * - 접이식 카드 UI
 * - 다양한 입력 타입 지원 (텍스트, 숫자, 선택, 체크박스, 다중선택)
 * - 실시간 유효성 검증
 * - 저장 상태 시각적 피드백
 * - 에러 처리 및 표시
 * 
 * 사용법:
 * ```jsx
 * <SettingBox
 *   title="Dashboard 설정"
 *   description="대시보드의 기본 동작을 설정합니다"
 *   settingKey="dashboardSettings"
 *   fields={[
 *     { key: 'selectedPegs', type: 'multiselect', label: 'PEG 선택', options: pegOptions },
 *     { key: 'autoRefreshInterval', type: 'number', label: '새로고침 간격', min: 5, max: 300 }
 *   ]}
 * />
 * ```
 */

import React, { useState, useCallback, useMemo } from 'react'
import { usePreference } from '@/hooks/usePreference.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Clock, 
  AlertCircle, 
  Save, 
  RotateCcw
} from 'lucide-react'

// ================================
// 필드 타입별 기본 속성
// ================================

const FIELD_TYPE_DEFAULTS = {
  text: {
    placeholder: '텍스트를 입력하세요',
    maxLength: 100
  },
  number: {
    placeholder: '숫자를 입력하세요',
    min: 0,
    max: 999999
  },
  select: {
    placeholder: '선택하세요',
    options: []
  },
  multiselect: {
    placeholder: '하나 이상 선택하세요',
    options: []
  },
  checkbox: {
    label: '활성화'
  },
  switch: {
    label: '켜기/끄기'
  }
}

// ================================
// 개별 필드 컴포넌트들
// ================================

const TextField = ({ field, value, onChange, error, disabled }) => (
  <div className="space-y-2">
    <Label htmlFor={field.key} className="text-sm font-medium">
      {field.label}
      {field.required && <span className="text-destructive ml-1">*</span>}
    </Label>
    <Input
      id={field.key}
      type={field.type === 'number' ? 'number' : 'text'}
      value={value || ''}
      onChange={(e) => {
        const newValue = field.type === 'number' ? 
          (e.target.value === '' ? '' : Number(e.target.value)) : 
          e.target.value
        onChange(newValue)
      }}
      placeholder={field.placeholder || FIELD_TYPE_DEFAULTS[field.type]?.placeholder}
      maxLength={field.maxLength || FIELD_TYPE_DEFAULTS[field.type]?.maxLength}
      min={field.min || FIELD_TYPE_DEFAULTS[field.type]?.min}
      max={field.max || FIELD_TYPE_DEFAULTS[field.type]?.max}
      disabled={disabled}
      className={error ? 'border-destructive' : ''}
    />
    {field.description && (
      <p className="text-xs text-muted-foreground">{field.description}</p>
    )}
    {error && (
      <p className="text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
)

const SelectField = ({ field, value, onChange, error, disabled }) => (
  <div className="space-y-2">
    <Label htmlFor={field.key} className="text-sm font-medium">
      {field.label}
      {field.required && <span className="text-destructive ml-1">*</span>}
    </Label>
    <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={error ? 'border-destructive' : ''}>
        <SelectValue placeholder={field.placeholder || FIELD_TYPE_DEFAULTS.select.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {field.options?.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {field.description && (
      <p className="text-xs text-muted-foreground">{field.description}</p>
    )}
    {error && (
      <p className="text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
)

const MultiselectField = ({ field, value, onChange, error, disabled }) => {
  const selectedValues = Array.isArray(value) ? value : []
  
  const handleToggle = (optionValue) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue]
    onChange(newValues)
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className={`border rounded-md p-3 space-y-2 ${error ? 'border-destructive' : 'border-input'}`}>
        {field.options?.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <Checkbox
              id={`${field.key}-${option.value}`}
              checked={selectedValues.includes(option.value)}
              onCheckedChange={() => handleToggle(option.value)}
              disabled={disabled}
            />
            <Label 
              htmlFor={`${field.key}-${option.value}`}
              className="text-sm cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
        {field.options?.length === 0 && (
          <p className="text-sm text-muted-foreground">선택 가능한 옵션이 없습니다</p>
        )}
      </div>
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map(val => {
            const option = field.options?.find(opt => opt.value === val)
            return option ? (
              <Badge key={val} variant="secondary" className="text-xs">
                {option.label}
              </Badge>
            ) : null
          })}
        </div>
      )}
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

const SwitchField = ({ field, value, onChange, error, disabled }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={field.key} className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
      </div>
      <Switch
        id={field.key}
        checked={Boolean(value)}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
    {error && (
      <p className="text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
)

// ================================
// 메인 SettingBox 컴포넌트
// ================================

const SettingBox = ({
  title,
  description,
  settingKey,
  fields = [],
  defaultOpen = false,
  disabled = false,
  className = '',
  onFieldChange,
  showSaveButton = false,
  showResetButton = false
}) => {
  // ================================
  // 상태 관리
  // ================================

  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [showValidation, setShowValidation] = useState(false)
  
  // usePreference 훅 사용
  const { 
    settings,
    updateSettings,
    updateSectionLocal,
    saving,
    error: globalError,
    validationErrors,
    
    logInfo,
    saveImmediately,
    defaultSettings
  } = usePreference()

  // 현재 설정 섹션의 값들
  const currentSettings = settings[settingKey] || {}

  // ================================
  // 유효성 검증 및 에러 처리
  // ================================

  const fieldErrors = useMemo(() => {
    const errors = {}
    Object.entries(validationErrors).forEach(([path, message]) => {
      if (path.startsWith(`${settingKey}.`)) {
        const fieldKey = path.replace(`${settingKey}.`, '')
        errors[fieldKey] = message
      }
    })
    return errors
  }, [validationErrors, settingKey])

  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  // ================================
  // 필드 값 변경 핸들러
  // ================================

  const handleFieldChange = useCallback((fieldKey, newValue) => {
    logInfo(`SettingBox 필드 변경: ${settingKey}.${fieldKey}`, { oldValue: currentSettings[fieldKey], newValue })

    // 개별 필드 변경사항을 상위 설정으로 반영
    const updatedSectionSettings = {
      ...currentSettings,
      [fieldKey]: newValue
    }

    // 전체 설정에서 해당 섹션만 업데이트
    // showSaveButton이 켜져 있으면 자동 저장을 하지 않고 로컬 상태만 갱신
    if (showSaveButton) {
      updateSectionLocal(settingKey, updatedSectionSettings)
    } else {
      updateSettings({
        [settingKey]: updatedSectionSettings
      })
    }

    // 외부 핸들러 호출 (선택사항)
    onFieldChange?.(fieldKey, newValue, updatedSectionSettings)

    // 유효성 검증 표시 활성화
    setShowValidation(true)
  }, [settingKey, currentSettings, updateSettings, onFieldChange, logInfo])

  // ================================
  // 액션 핸들러들
  // ================================

  const handleSave = useCallback(async () => {
    logInfo(`SettingBox 즉시 저장: ${settingKey}`)
    await saveImmediately()
  }, [saveImmediately, logInfo, settingKey])

  const handleReset = useCallback(() => {
    logInfo(`SettingBox 초기화: ${settingKey}`)
    const defaultSectionSettings = defaultSettings[settingKey] || {}
    
    updateSettings({
      [settingKey]: defaultSectionSettings
    })
    
    setShowValidation(false)
  }, [settingKey, updateSettings, defaultSettings, logInfo])

  // ================================
  // 필드 렌더링 함수
  // ================================

  const renderField = useCallback((field) => {
    const value = currentSettings[field.key]
    const error = showValidation ? fieldErrors[field.key] : null
    const fieldDisabled = disabled || saving

    const commonProps = {
      field,
      value,
      onChange: (newValue) => handleFieldChange(field.key, newValue),
      error,
      disabled: fieldDisabled
    }

    switch (field.type) {
      case 'text':
      case 'number':
        return <TextField key={field.key} {...commonProps} />
      
      case 'select':
        return <SelectField key={field.key} {...commonProps} />
      
      case 'multiselect':
        return <MultiselectField key={field.key} {...commonProps} />
      
      case 'switch':
      case 'checkbox':
        return <SwitchField key={field.key} {...commonProps} />
      
      default:
        return (
          <div key={field.key} className="text-sm text-muted-foreground">
            지원하지 않는 필드 타입: {field.type}
          </div>
        )
    }
  }, [currentSettings, fieldErrors, showValidation, disabled, saving, handleFieldChange])

  // ================================
  // 렌더링
  // ================================

  return (
    <Card className={`w-full ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {title}
                  
                  {/* 상태 뱃지들 */}
                  {saving && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      저장 중
                    </Badge>
                  )}
                  
                  {showValidation && hasFieldErrors && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      오류
                    </Badge>
                  )}
                  
                  {showValidation && !hasFieldErrors && !saving && (
                    <Badge variant="default" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      유효
                    </Badge>
                  )}
                </CardTitle>
                
                {description && (
                  <CardDescription>{description}</CardDescription>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* 필드 개수 표시 */}
                <Badge variant="outline" className="text-xs">
                  {fields.length}개 설정
                </Badge>
                
                {/* 접기/펼치기 아이콘 */}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* 전역 오류 표시 */}
            {globalError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            )}
            
            {/* 필드들 렌더링 */}
            {fields.length > 0 ? (
              <div className="space-y-4">
                {fields.map(renderField)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                설정할 수 있는 항목이 없습니다.
              </p>
            )}
            
            {/* 액션 버튼들 */}
            {(showSaveButton || showResetButton || hasFieldErrors) && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {showResetButton && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={disabled || saving}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        초기화
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {showSaveButton && (
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={disabled || saving || hasFieldErrors}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        저장
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

export default SettingBox

