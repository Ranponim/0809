import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { 
  Calculator, 
  Plus, 
  Search, 
  Check, 
  X, 
  Edit, 
  Trash2, 
  Play,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Copy,
  Database
} from 'lucide-react'
import { toast } from 'sonner'
import { SettingsSaveStatus } from './SettingsSaveStatus.jsx'
import { usePreference as usePreferenceContext } from '@/contexts/PreferenceContext.jsx'

const DerivedPegManager = ({
  derivedPegSettings,
  updateDerivedPegSettings,
  availablePegs = [],
  saving: savingProp = false,
  dashboardSettings,
  updateDashboardSettings
}) => {
  // 저장 상태 관리
  const { saveSettings, hasUnsavedChanges, error: saveError, saving, lastSaved, settings: currentSettings } = usePreferenceContext()

  // 로컬 저장 상태 (자동 저장용)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(lastSaved ? new Date(lastSaved) : null)

  // 초기 로딩 시 마지막 저장 시간 설정
  useEffect(() => {
    if (lastSaved && !lastSavedAt) {
      setLastSavedAt(new Date(lastSaved))
    }
  }, [lastSaved, lastSavedAt])
  // 상태 관리
  const [selectedFormula, setSelectedFormula] = useState(null)
  const [editingFormula, setEditingFormula] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [validationResult, setValidationResult] = useState(null)
  const [testResult, setTestResult] = useState(null)

  // 기본 데이터
  const formulas = derivedPegSettings?.formulas || []
  const settings = derivedPegSettings?.settings || {
    autoValidate: false,
    showInDashboard: false,
    showInStatistics: false,
    evaluationPrecision: 4
  }

  // 디버깅용 로그
  useEffect(() => {
    console.log('[DerivedPegManager] 현재 설정 상태:', {
      formulasCount: formulas.length,
      settings,
      hasUnsavedChanges,
      saving,
      isAutoSaving,
      lastSavedAt: lastSavedAt?.toISOString()
    })
  }, [formulas.length, settings, hasUnsavedChanges, saving, isAutoSaving, lastSavedAt])

  // 자동 저장을 위한 useEffect (디바운싱 적용)
  useEffect(() => {
    const autoSave = async () => {
      if (derivedPegSettings && Object.keys(derivedPegSettings).length > 0 && hasUnsavedChanges) {
        setIsAutoSaving(true)
        try {
          // 직접 localStorage에 저장하여 비동기 상태 업데이트 문제 해결
          const updatedSettings = {
            ...currentSettings,
            derivedPegSettings: derivedPegSettings
          }

          const STORAGE_KEY = 'kpi-dashboard-preferences'
          const dataToSave = {
            settings: updatedSettings,
            lastSaved: new Date().toISOString(),
            version: 1
          }

          localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
          setLastSavedAt(new Date())
          // 자동 저장 성공 시 토스트는 표시하지 않음 (사용자 경험 개선)
        } catch (error) {
          console.error('Auto-save failed:', error)
          toast.error('자동 저장 실패: ' + error.message)
        } finally {
          setIsAutoSaving(false)
        }
      }
    }

    // 디바운싱 적용 (1초 지연)
    const timeoutId = setTimeout(autoSave, 1000)
    return () => clearTimeout(timeoutId)
  }, [derivedPegSettings, currentSettings, hasUnsavedChanges])

  // 템플릿 정의
  const formulaTemplates = [
    {
      id: 'success_rate',
      name: 'Success Rate (%)',
      formula: '(success_count / total_count) * 100',
      description: '성공률 계산 템플릿',
      category: 'percentage'
    },
    {
      id: 'efficiency',
      name: 'Efficiency (%)',
      formula: '(good_values / all_values) * 100',
      description: '효율성 계산 템플릿',
      category: 'percentage'
    },
    {
      id: 'delta',
      name: 'Delta Calculation',
      formula: 'current_value - previous_value',
      description: '변화량 계산 템플릿',
      category: 'difference'
    },
    {
      id: 'ratio',
      name: 'Simple Ratio',
      formula: 'numerator / denominator',
      description: '단순 비율 계산 템플릿',
      category: 'ratio'
    }
  ]

  // 지원 연산자 정보
  const supportedOperators = [
    { symbol: '+', name: '더하기', example: 'a + b' },
    { symbol: '-', name: '빼기', example: 'a - b' },
    { symbol: '*', name: '곱하기', example: 'a * b' },
    { symbol: '/', name: '나누기', example: 'a / b' },
    { symbol: '%', name: '나머지', example: 'a % b' },
    { symbol: '^', name: '거듭제곱', example: 'a ^ 2' },
    { symbol: '()', name: '괄호', example: '(a + b) * c' },
    { symbol: 'sqrt()', name: '제곱근', example: 'sqrt(a)' },
    { symbol: 'log()', name: '로그', example: 'log(a)' },
    { symbol: 'abs()', name: '절댓값', example: 'abs(a)' },
    { symbol: 'min()', name: '최솟값', example: 'min(a, b)' },
    { symbol: 'max()', name: '최댓값', example: 'max(a, b)' }
  ]

  // 필터링된 수식 목록
  const filteredFormulas = useMemo(() => {
    if (!searchTerm) return formulas
    return formulas.filter(formula => 
      formula.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formula.formula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formula.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [formulas, searchTerm])

  // 수식 검증 함수
  const validateFormula = useCallback((formula) => {
    try {
      // 기본 문법 검증
      const errors = []
      const warnings = []

      // 괄호 매칭 검사
      const openParens = (formula.match(/\(/g) || []).length
      const closeParens = (formula.match(/\)/g) || []).length
      if (openParens !== closeParens) {
        errors.push('괄호가 일치하지 않습니다')
      }

      // PEG 참조 검증 (기본 PEG + Derived PEG 포함)
      // 1) ${RawPEGName} 형태는 특수문자 허용 → 경고/에러 대상 제외
      // 2) 그 외 토큰은 안전 토큰(영문/숫자/_)으로 간주하여 검증
      // const rawRefs = formula.match(/\$\{[^}]+\}/g) || []
      // 원본 참조(${...})는 먼저 제거하여 안전 토큰만 검증
      const pegReferences = (formula.replace(/\$\{[^}]+\}/g, ' ').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [])
      
      // 사용 가능한 모든 PEG 목록 생성 (기본 PEG + 활성화된 Derived PEG)
      const allAvailablePegs = [
        ...availablePegs.map(p => p.value),
        ...formulas
          .filter(f => f.active)
          .map(f => f.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase())
      ]

      const unknownPegs = pegReferences.filter(peg => 
        !allAvailablePegs.includes(peg) &&
        !['sqrt', 'log', 'abs', 'min', 'max', 'if'].includes(peg)
      )
      
      if (unknownPegs.length > 0) {
        warnings.push(`알 수 없는 PEG: ${unknownPegs.join(', ')}`)
      }

      // 순환 참조 검증 (Derived PEG가 자기 자신을 참조하지 않는지)
      if (editingFormula) {
        const currentDerivedPegRef = editingFormula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
        if (pegReferences.includes(currentDerivedPegRef)) {
          errors.push('수식이 자기 자신을 참조할 수 없습니다 (순환 참조)')
        }
      }

      // 연산자 검증
      // 허용 문자 확장: ${...} 참조, 공백 및 기본 연산자/함수만 제한
      const invalidOps = formula
        .replace(/\$\{[^}]+\}/g, '') // ${...} 제거 후 검사
        .match(/[^a-zA-Z0-9_+\-*/()^%.,\s]/g)
      if (invalidOps) {
        errors.push(`지원하지 않는 문자: ${invalidOps.join(', ')}`)
      }

      // 의존성 분석 (기본 PEG와 Derived PEG 구분)
      const basicPegDependencies = pegReferences.filter(peg => 
        availablePegs.some(p => p.value === peg)
      )
      const derivedPegDependencies = pegReferences.filter(peg => 
        formulas.some(f => f.active && f.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() === peg)
      )

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        dependencies: basicPegDependencies,
        derivedDependencies: derivedPegDependencies
      }
    } catch (_error) {
      return {
        isValid: false,
        errors: ['수식 분석 중 오류가 발생했습니다'],
        warnings: [],
        dependencies: [],
        derivedDependencies: []
      }
    }
  }, [availablePegs, formulas, editingFormula])

  // 수식 테스트 함수 (모의 데이터로)
  const testFormula = useCallback((formula) => {
    try {
      const mockData = {}
      availablePegs.forEach(peg => {
        mockData[peg.value] = Math.random() * 100 + 50 // 50-150 사이 랜덤 값
      })

      // 간단한 수식 평가 (실제로는 더 안전한 파서 사용해야 함)
      let testFormula = formula
      Object.keys(mockData).forEach(peg => {
        const regex = new RegExp(`\\b${peg}\\b`, 'g')
        testFormula = testFormula.replace(regex, mockData[peg].toString())
      })

      // 기본 함수들 처리
      testFormula = testFormula.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
      testFormula = testFormula.replace(/log\(([^)]+)\)/g, 'Math.log($1)')
      testFormula = testFormula.replace(/abs\(([^)]+)\)/g, 'Math.abs($1)')
      testFormula = testFormula.replace(/\^/g, '**')

      const result = Function(`"use strict"; return (${testFormula})`)()
      
      return {
        success: true,
        result: Number(result).toFixed(settings.evaluationPrecision || 4),
        mockData
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }, [availablePegs, settings.evaluationPrecision])

  // 새 수식 추가
  const handleAddFormula = () => {
    const newFormula = {
      id: `formula_${Date.now()}`,
      name: '새 수식',
      formula: '',
      description: '',
      active: true,
      category: 'custom',
      unit: '',
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setEditingFormula(newFormula)
    setSelectedFormula(newFormula.id)
  }

  // 수식 저장
  const handleSaveFormula = async () => {
    if (!editingFormula) return

    console.log('[handleSaveFormula] 저장 시작', { editingFormula })

    const validation = validateFormula(editingFormula.formula)
    if (!validation.isValid) {
      toast.error(`수식 저장 실패: ${validation.errors.join(', ')}`)
      return
    }

    const updatedFormula = {
      ...editingFormula,
      dependencies: validation.dependencies,
      derivedDependencies: validation.derivedDependencies || [],
      updatedAt: new Date().toISOString()
    }

    console.log('[handleSaveFormula] 업데이트된 수식', { updatedFormula })

    const existingIndex = formulas.findIndex(f => f.id === editingFormula.id)
    let updatedFormulas

    if (existingIndex >= 0) {
      updatedFormulas = [...formulas]
      updatedFormulas[existingIndex] = updatedFormula
      console.log('[handleSaveFormula] 기존 수식 업데이트', { existingIndex, updatedFormula })
    } else {
      updatedFormulas = [...formulas, updatedFormula]
      console.log('[handleSaveFormula] 새 수식 추가', { updatedFormula })
    }

    // 새로운 설정 객체 생성
    const newDerivedSettings = {
      ...derivedPegSettings,
      formulas: updatedFormulas
    }

    console.log('[handleSaveFormula] 새로운 설정', { newDerivedSettings })

    // 설정 업데이트 (동기적으로 처리)
    updateDerivedPegSettings(newDerivedSettings)

    // Dashboard에 표시 설정이 활성화되어 있고 수식이 활성화된 경우 selectedPegs 업데이트
    if (settings.showInDashboard && updatedFormula.active) {
      const derivedPegName = updatedFormula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
      const currentSelectedPegs = dashboardSettings?.selectedPegs || []
      if (!currentSelectedPegs.includes(derivedPegName)) {
        console.log('[handleSaveFormula] Dashboard selectedPegs 업데이트', { derivedPegName })
        updateDashboardSettings({
          selectedPegs: [...currentSelectedPegs, derivedPegName]
        })
      }
    }

    // 즉시 localStorage에 저장 (비동기 상태 업데이트 문제 해결)
    try {
      console.log('[handleSaveFormula] 즉시 localStorage 저장 시작')

      // 현재 설정 상태를 가져와서 새로운 값으로 업데이트
      const updatedSettings = {
        ...currentSettings,
        derivedPegSettings: newDerivedSettings
      }

      // 직접 localStorage에 저장
      const STORAGE_KEY = 'kpi-dashboard-preferences'
      const dataToSave = {
        settings: updatedSettings,
        lastSaved: new Date().toISOString(),
        version: 1
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
      console.log('[handleSaveFormula] localStorage에 직접 저장 완료', dataToSave)

      // 저장 성공 후 편집 모드 종료
      setEditingFormula(null)
      setLastSavedAt(new Date())
      toast.success('수식이 저장되었습니다')
      console.log('[handleSaveFormula] 저장 성공 및 편집 모드 종료')

    } catch (error) {
      console.error('[handleSaveFormula] 저장 실패', error)
      toast.error('저장 실패: ' + error.message)
    }
  }

  // 수식 삭제
  const handleDeleteFormula = async (formulaId) => {
    const deletedFormula = formulas.find(f => f.id === formulaId)
    const updatedFormulas = formulas.filter(f => f.id !== formulaId)

    updateDerivedPegSettings({
      ...derivedPegSettings,
      formulas: updatedFormulas
    })

    // 삭제된 수식이 Dashboard에 표시되고 있었으면 selectedPegs에서 제거
    if (deletedFormula && deletedFormula.active) {
      const derivedPegName = deletedFormula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
      const currentSelectedPegs = dashboardSettings?.selectedPegs || []
      const newSelectedPegs = currentSelectedPegs.filter(peg => peg !== derivedPegName)

      if (newSelectedPegs.length !== currentSelectedPegs.length) {
        updateDashboardSettings({
          selectedPegs: newSelectedPegs
        })
      }
    }

        if (selectedFormula === formulaId) {
      setSelectedFormula(null)
    }
    if (editingFormula?.id === formulaId) {
      setEditingFormula(null)
    }

    // 즉시 localStorage에 저장
    try {
      const updatedSettings = {
        ...currentSettings,
        derivedPegSettings: {
          ...derivedPegSettings,
          formulas: updatedFormulas
        }
      }

      const STORAGE_KEY = 'kpi-dashboard-preferences'
      const dataToSave = {
        settings: updatedSettings,
        lastSaved: new Date().toISOString(),
        version: 1
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
      setLastSavedAt(new Date())
    } catch (error) {
      console.error('Auto-save failed:', error)
    }

    toast.success('수식이 삭제되었습니다')
  }

  // 템플릿 적용
  const handleApplyTemplate = (template) => {
    if (editingFormula) {
      setEditingFormula({
        ...editingFormula,
        formula: template.formula,
        description: template.description,
        category: template.category
      })
      toast.success(`템플릿 "${template.name}"이 적용되었습니다`)
    }
  }

  // 테스트용 함수 (개발 중에만 사용)
  const handleTestSaveState = () => {
    console.log('[TEST] 현재 저장 상태:', {
      derivedPegSettings,
      hasUnsavedChanges,
      saving,
      isAutoSaving,
      lastSavedAt,
      settings
    })
    toast.info('콘솔에서 현재 상태를 확인하세요')
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Derived PEG 관리
              {isAutoSaving && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  자동 저장 중...
                </Badge>
              )}
            </CardTitle>
            {lastSavedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                마지막 저장: {lastSavedAt.toLocaleString('ko-KR')}
              </p>
            )}
            <div className="flex items-center gap-2">
              {/* 저장 상태 표시 */}
              <SettingsSaveStatus
                position="inline"
                variant="compact"
                showToast={false}
                className="mr-2"
              />
              {/* 수동 저장 버튼 */}
              {(hasUnsavedChanges || saving || isAutoSaving) && (
                <Button
                  onClick={async () => {
                    try {
                      // 직접 localStorage에 저장
                      const updatedSettings = {
                        ...currentSettings,
                        derivedPegSettings: derivedPegSettings
                      }

                      const STORAGE_KEY = 'kpi-dashboard-preferences'
                      const dataToSave = {
                        settings: updatedSettings,
                        lastSaved: new Date().toISOString(),
                        version: 1
                      }

                      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
                      setLastSavedAt(new Date())
                      toast.success('Derived PEG 설정이 저장되었습니다')
                    } catch (error) {
                      toast.error('저장 실패: ' + error.message)
                    }
                  }}
                  disabled={saving || isAutoSaving}
                  size="sm"
                  className="h-8"
                >
                  {(saving || isAutoSaving) ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      저장
                    </>
                  )}
                </Button>
              )}

              {/* 테스트 버튼 (개발 중에만 표시) */}
              {process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={handleTestSaveState}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                >
                  🔧 테스트
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-validate"
                checked={settings.autoValidate}
                onCheckedChange={async (checked) => {
                  const newSettings = {
                    ...derivedPegSettings,
                    settings: { ...settings, autoValidate: checked }
                  }
                  updateDerivedPegSettings(newSettings)

                  // 즉시 localStorage에 저장
                  try {
                    const updatedSettings = {
                      ...currentSettings,
                      derivedPegSettings: newDerivedSettings
                    }

                    const STORAGE_KEY = 'kpi-dashboard-preferences'
                    const dataToSave = {
                      settings: updatedSettings,
                      lastSaved: new Date().toISOString(),
                      version: 1
                    }

                    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
                    setLastSavedAt(new Date())
                  } catch (error) {
                    console.error('Auto-save failed:', error)
                  }
                }}
              />
              <Label htmlFor="auto-validate">실시간 검증</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-dashboard"
                checked={settings.showInDashboard}
                onCheckedChange={async (checked) => {
                  // Derived PEG 설정 업데이트
                  const newDerivedSettings = {
                    ...derivedPegSettings,
                    settings: { ...settings, showInDashboard: checked }
                  }
                  updateDerivedPegSettings(newDerivedSettings)

                  // Dashboard의 selectedPegs 업데이트
                  if (checked) {
                    // Dashboard에 표시할 때: 활성화된 Derived PEG들을 selectedPegs에 추가
                    const activeDerivedPegs = formulas
                      .filter(formula => formula.active)
                      .map(formula => formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase())

                    const currentSelectedPegs = dashboardSettings?.selectedPegs || []
                    const newSelectedPegs = [...new Set([...currentSelectedPegs, ...activeDerivedPegs])]

                    updateDashboardSettings({
                      selectedPegs: newSelectedPegs
                    })
                  } else {
                    // Dashboard에서 제거할 때: 모든 Derived PEG들을 selectedPegs에서 제거
                    const activeDerivedPegs = formulas
                      .filter(formula => formula.active)
                      .map(formula => formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase())

                    const currentSelectedPegs = dashboardSettings?.selectedPegs || []
                    const newSelectedPegs = currentSelectedPegs.filter(peg =>
                      !activeDerivedPegs.includes(peg)
                    )

                    updateDashboardSettings({
                      selectedPegs: newSelectedPegs
                    })
                  }

                  // 즉시 localStorage에 저장
                  try {
                    const updatedSettings = {
                      ...currentSettings,
                      derivedPegSettings: newDerivedSettings
                    }

                    const STORAGE_KEY = 'kpi-dashboard-preferences'
                    const dataToSave = {
                      settings: updatedSettings,
                      lastSaved: new Date().toISOString(),
                      version: 1
                    }

                    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
                    setLastSavedAt(new Date())
                  } catch (error) {
                    console.error('Auto-save failed:', error)
                  }
                }}
              />
              <Label htmlFor="show-dashboard">Dashboard에 표시</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-statistics"
                checked={settings.showInStatistics}
                onCheckedChange={async (checked) => {
                  const newSettings = {
                    ...derivedPegSettings,
                    settings: { ...settings, showInStatistics: checked }
                  }
                  updateDerivedPegSettings(newSettings)

                  // 즉시 localStorage에 저장
                  try {
                    const updatedSettings = {
                      ...currentSettings,
                      derivedPegSettings: newDerivedSettings
                    }

                    const STORAGE_KEY = 'kpi-dashboard-preferences'
                    const dataToSave = {
                      settings: updatedSettings,
                      lastSaved: new Date().toISOString(),
                      version: 1
                    }

                    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
                    setLastSavedAt(new Date())
                  } catch (error) {
                    console.error('Auto-save failed:', error)
                  }
                }}
              />
              <Label htmlFor="show-statistics">Statistics에 표시</Label>
            </div>
            <div className="space-y-2">
              <Label>계산 정밀도</Label>
              <Select
                value={settings.evaluationPrecision?.toString()}
                onValueChange={async (value) => {
                  const newSettings = {
                    ...derivedPegSettings,
                    settings: { ...settings, evaluationPrecision: parseInt(value) }
                  }
                  updateDerivedPegSettings(newSettings)

                  // 즉시 localStorage에 저장
                  try {
                    const updatedSettings = {
                      ...currentSettings,
                      derivedPegSettings: newDerivedSettings
                    }

                    const STORAGE_KEY = 'kpi-dashboard-preferences'
                    const dataToSave = {
                      settings: updatedSettings,
                      lastSaved: new Date().toISOString(),
                      version: 1
                    }

                    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
                    setLastSavedAt(new Date())
                  } catch (error) {
                    console.error('Auto-save failed:', error)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">소수점 2자리</SelectItem>
                  <SelectItem value="4">소수점 4자리</SelectItem>
                  <SelectItem value="6">소수점 6자리</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 수식 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>수식 목록</CardTitle>
              <Button onClick={handleAddFormula} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                새 수식
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="수식 검색..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredFormulas.map((formula) => (
                  <div
                    key={formula.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedFormula === formula.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedFormula(formula.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate">
                            {formula.name}
                          </h4>
                          <Badge
                            variant={formula.active ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {formula.active ? '활성' : '비활성'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {formula.formula}
                        </p>
                        {formula.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formula.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {formula.category}
                          </Badge>
                          {formula.unit && (
                            <Badge variant="outline" className="text-xs">
                              {formula.unit}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingFormula({ ...formula })
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteFormula(formula.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 오른쪽: 수식 편집기 */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingFormula ? '수식 편집' : '수식 상세'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingFormula ? (
              <div className="space-y-4">
                {/* 수식 이름 */}
                <div className="space-y-2">
                  <Label htmlFor="formula-name">수식 이름</Label>
                  <Input
                    id="formula-name"
                    value={editingFormula.name}
                    onChange={(e) => setEditingFormula({
                      ...editingFormula,
                      name: e.target.value
                    })}
                    placeholder="예: RACH Success Rate (%)"
                  />
                </div>

                {/* 수식 입력 */}
                <div className="space-y-2">
                  <Label htmlFor="formula-input">수식</Label>
                  <Textarea
                    id="formula-input"
                    value={editingFormula.formula}
                    onChange={(e) => {
                      setEditingFormula({
                        ...editingFormula,
                        formula: e.target.value
                      })
                      if (settings.autoValidate) {
                        setValidationResult(validateFormula(e.target.value))
                      }
                    }}
                    placeholder="예: (randomaccesspremable / randomaccessresponse) * 100"
                    className="font-mono text-sm"
                    rows={4}
                  />
                  
                  {/* 실시간 검증 결과 */}
                  {validationResult && (
                    <div className="space-y-2">
                      {validationResult.isValid ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">수식이 유효합니다</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">
                            {validationResult.errors.join(', ')}
                          </span>
                        </div>
                      )}
                      
                      {validationResult.warnings.length > 0 && (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">
                            {validationResult.warnings.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 설명 */}
                <div className="space-y-2">
                  <Label htmlFor="formula-description">설명</Label>
                  <Input
                    id="formula-description"
                    value={editingFormula.description}
                    onChange={(e) => setEditingFormula({
                      ...editingFormula,
                      description: e.target.value
                    })}
                    placeholder="수식에 대한 설명을 입력하세요"
                  />
                </div>

                {/* 카테고리 및 단위 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="formula-category">카테고리</Label>
                    <Select
                      value={editingFormula.category}
                      onValueChange={(value) => setEditingFormula({
                        ...editingFormula,
                        category: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">비율 (%)</SelectItem>
                        <SelectItem value="success_rate">성공률</SelectItem>
                        <SelectItem value="efficiency">효율성</SelectItem>
                        <SelectItem value="quality">품질</SelectItem>
                        <SelectItem value="performance">성능</SelectItem>
                        <SelectItem value="custom">사용자 정의</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="formula-unit">단위</Label>
                    <Input
                      id="formula-unit"
                      value={editingFormula.unit}
                      onChange={(e) => setEditingFormula({
                        ...editingFormula,
                        unit: e.target.value
                      })}
                      placeholder="예: %, ms, Mbps"
                    />
                  </div>
                </div>

                {/* 활성화 상태 */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="formula-active"
                    checked={editingFormula.active}
                    onCheckedChange={(checked) => {
                      setEditingFormula({
                        ...editingFormula,
                        active: checked
                      })

                      // Dashboard에 표시 설정이 활성화되어 있는 경우 selectedPegs 업데이트
                      if (settings.showInDashboard) {
                        const derivedPegName = editingFormula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
                        const currentSelectedPegs = dashboardSettings?.selectedPegs || []

                        if (checked) {
                          // 활성화: selectedPegs에 추가
                          if (!currentSelectedPegs.includes(derivedPegName)) {
                            updateDashboardSettings({
                              selectedPegs: [...currentSelectedPegs, derivedPegName]
                            })
                          }
                        } else {
                          // 비활성화: selectedPegs에서 제거
                          const newSelectedPegs = currentSelectedPegs.filter(peg => peg !== derivedPegName)
                          if (newSelectedPegs.length !== currentSelectedPegs.length) {
                            updateDashboardSettings({
                              selectedPegs: newSelectedPegs
                            })
                          }
                        }
                      }

                      // 자동 저장은 useEffect에서 처리
                    }}
                  />
                  <Label htmlFor="formula-active">수식 활성화</Label>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <Button onClick={() => {
                    const validation = validateFormula(editingFormula.formula)
                    setValidationResult(validation)
                    const test = testFormula(editingFormula.formula)
                    setTestResult(test)
                  }}>
                    <Play className="h-4 w-4 mr-2" />
                    테스트
                  </Button>
                  <Button onClick={handleSaveFormula} disabled={saving}>
                    <Check className="h-4 w-4 mr-2" />
                    저장
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingFormula(null)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    취소
                  </Button>
                </div>

                {/* 테스트 결과 */}
                {testResult && (
                  <div className="space-y-2">
                    <Separator />
                    <h4 className="font-medium">테스트 결과</h4>
                    {testResult.success ? (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700">
                          <strong>결과: {testResult.result}</strong>
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          모의 데이터를 사용한 계산 결과입니다
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">
                          오류: {testResult.error}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedFormula ? (
              <div className="space-y-4">
                {(() => {
                  const formula = formulas.find(f => f.id === selectedFormula)
                  if (!formula) return <p>수식을 찾을 수 없습니다.</p>
                  
                  return (
                    <>
                      <div>
                        <h3 className="font-medium">{formula.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formula.description}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>수식</Label>
                        <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm">
                          {formula.formula}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">카테고리</Label>
                          <p className="text-sm">{formula.category}</p>
                        </div>
                        <div>
                          <Label className="text-xs">단위</Label>
                          <p className="text-sm">{formula.unit || '없음'}</p>
                        </div>
                      </div>
                      
                      {/* 의존성 표시 */}
                      {((formula.dependencies && formula.dependencies.length > 0) || 
                        (formula.derivedDependencies && formula.derivedDependencies.length > 0)) && (
                        <div className="space-y-2">
                          {/* 기본 PEG 의존성 */}
                          {formula.dependencies && formula.dependencies.length > 0 && (
                            <div>
                              <Label className="text-xs flex items-center gap-1">
                                <Database className="h-3 w-3" />
                                기본 PEG 의존성
                              </Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {formula.dependencies.map(dep => (
                                  <Badge key={dep} variant="outline" className="text-xs">
                                    {dep}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Derived PEG 의존성 */}
                          {formula.derivedDependencies && formula.derivedDependencies.length > 0 && (
                            <div>
                              <Label className="text-xs flex items-center gap-1">
                                <Calculator className="h-3 w-3" />
                                Derived PEG 의존성
                              </Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {formula.derivedDependencies.map(dep => (
                                  <Badge key={dep} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                    {dep}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <Button
                        onClick={() => setEditingFormula({ ...formula })}
                        className="w-full"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        편집
                      </Button>
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>수식을 선택하거나 새로 만들어보세요</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 하단: 도움말 및 템플릿 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 템플릿 라이브러리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              템플릿 라이브러리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {formulaTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleApplyTemplate(template)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      <p className="text-xs font-mono text-muted-foreground">
                        {template.formula}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 지원 연산자 */}
        <Card>
          <CardHeader>
            <CardTitle>지원 연산자</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {supportedOperators.map((op, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <code className="font-mono font-medium">{op.symbol}</code>
                      <span className="text-sm text-muted-foreground ml-2">
                        {op.name}
                      </span>
                    </div>
                    <code className="text-xs text-muted-foreground">
                      {op.example}
                    </code>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 사용 가능한 PEG 목록 (기본 PEG + 생성된 Derived PEG) */}
      <Card>
        <CardHeader>
          <CardTitle>사용 가능한 PEG</CardTitle>
          <CardDescription>
            수식에 사용할 수 있는 기본 PEG와 생성된 Derived PEG 목록입니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 기본 PEG */}
            {availablePegs.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  기본 PEG ({availablePegs.length}개)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {availablePegs.map((peg) => (
                    <Button
                      key={peg.value}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (editingFormula) {
                          setEditingFormula({
                            ...editingFormula,
                            formula: editingFormula.formula + peg.value
                          })
                        }
                      }}
                      className="text-xs"
                    >
                      {peg.label || peg.value}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 생성된 Derived PEG */}
            {formulas.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Derived PEG ({formulas.filter(f => f.active).length}개)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {formulas
                    .filter(formula => formula.active) // 활성화된 수식만 표시
                    .map((formula) => (
                      <Button
                        key={formula.id}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (editingFormula) {
                            // Derived PEG는 함수 형태로 삽입 (예: derived_peg_name())
                            const derivedPegRef = `${formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`
                            setEditingFormula({
                              ...editingFormula,
                              formula: editingFormula.formula + derivedPegRef
                            })
                          }
                        }}
                        className="text-xs bg-blue-50 border-blue-200 hover:bg-blue-100"
                        title={formula.description}
                      >
                        <Calculator className="h-3 w-3 mr-1" />
                        {formula.name}
                        {formula.unit && (
                          <span className="ml-1 text-muted-foreground">
                            ({formula.unit})
                          </span>
                        )}
                      </Button>
                    ))}
                </div>
                
                {/* Derived PEG가 없는 경우 */}
                {formulas.filter(f => f.active).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">아직 생성된 Derived PEG가 없습니다</p>
                    <p className="text-xs">새 수식을 추가하고 활성화하면 여기에 표시됩니다</p>
                  </div>
                )}
              </div>
            )}

            {/* 사용법 안내 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="font-medium text-sm text-blue-700 mb-1">💡 사용법</h5>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• 기본 PEG: 클릭하면 수식에 바로 삽입됩니다</li>
                <li>• Derived PEG: 다른 수식에서 참조할 수 있는 계산된 값입니다</li>
                <li>• 비활성화된 Derived PEG는 목록에 표시되지 않습니다</li>
                <li>• Derived PEG끼리 순환 참조하지 않도록 주의하세요</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DerivedPegManager
