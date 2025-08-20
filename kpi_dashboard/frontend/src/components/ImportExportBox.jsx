/**
 * ImportExportBox 컴포넌트
 * 
 * 사용자 설정의 Import/Export 기능을 제공하는 전용 컴포넌트입니다.
 * usePreference 훅에서 제공하는 기능을 UI로 노출하며, 
 * 파일 업로드/다운로드, 진행 상태, 에러 처리를 담당합니다.
 * 
 * 주요 기능:
 * - JSON 파일로 설정 내보내기 (전체/부분)
 * - JSON 파일에서 설정 가져오기
 * - 드래그 앤 드롭 파일 업로드
 * - 실시간 진행 상태 표시
 * - 파일 유효성 검증 및 에러 처리
 * 
 * 사용법:
 * ```jsx
 * <ImportExportBox 
 *   title="설정 백업 & 복원"
 *   defaultOpen={false}
 * />
 * ```
 */

import React, { useState, useRef, useCallback } from 'react'
import { usePreference } from '@/hooks/usePreference.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx'
import { 
  Download, 
  Upload, 
  FileJson, 
  Check, 
  X, 
  AlertCircle, 
  Clock,
  ChevronDown,
  ChevronUp,
  File,
  FolderOpen,
  Save
} from 'lucide-react'
import { toast } from 'sonner'

// ================================
// Import/Export 옵션 정의
// ================================

const EXPORT_SECTIONS = [
  {
    key: 'dashboardSettings',
    label: 'Dashboard 설정',
    description: '선택된 PEG, 차트 스타일, 새로고침 간격 등'
  },
  {
    key: 'statisticsSettings', 
    label: 'Statistics 설정',
    description: '기본 날짜 범위, 비교 옵션, 소수점 자릿수 등'
  },
  {
    key: 'derivedPegSettings',
    label: 'Derived PEG 설정',
    description: '사용자 정의 수식, 활성화 상태, 계산 정밀도 등'
  },
  {
    key: 'notificationSettings',
    label: '알림 설정',
    description: '토스트, 사운드, 알림 타입 설정'
  },
  {
    key: 'generalSettings',
    label: '일반 설정',
    description: '언어, 시간대, 날짜 형식 등'
  }
]

// ================================
// ImportExportBox 메인 컴포넌트
// ================================

const ImportExportBox = ({
  title = "설정 백업 & 복원",
  description = "설정을 JSON 파일로 내보내거나 가져올 수 있습니다",
  defaultOpen = false,
  className = ''
}) => {
  // ================================
  // 상태 관리
  // ================================

  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [importError, setImportError] = useState(null)
  const [lastImportedFile, setLastImportedFile] = useState(null)
  const [exportSections, setExportSections] = useState(
    EXPORT_SECTIONS.reduce((acc, section) => ({ ...acc, [section.key]: true }), {})
  )
  const [customFileName, setCustomFileName] = useState('')

  const fileInputRef = useRef(null)

  // ================================
  // usePreference 훅 사용
  // ================================

  const {
    settings,
    exportSettings,
    importSettings,
    hasUnsavedChanges,
    saving,
    logInfo,
    logError
  } = usePreference()

  // ================================
  // Export 기능
  // ================================

  const handleExport = useCallback(async (exportType = 'full') => {
    setIsExporting(true)
    setImportError(null)
    
    try {
      logInfo('설정 내보내기 시작', { exportType, customFileName })

      let settingsToExport = settings
      
      // 부분 내보내기인 경우 선택된 섹션만 포함
      if (exportType === 'partial') {
        const selectedSections = Object.entries(exportSections)
          .filter(([key, selected]) => selected)
          .map(([key]) => key)
        
        if (selectedSections.length === 0) {
          toast.error('내보낼 설정 섹션을 하나 이상 선택해주세요')
          return
        }
        
        settingsToExport = selectedSections.reduce((acc, sectionKey) => {
          if (settings[sectionKey]) {
            acc[sectionKey] = settings[sectionKey]
          }
          return acc
        }, {})
        
        logInfo('부분 내보내기 선택된 섹션', selectedSections)
      }

      // 파일명 생성
      const timestamp = new Date().toISOString().split('T')[0]
      const fileName = customFileName.trim() || 
        (exportType === 'partial' ? 
          `preference-settings-partial-${timestamp}.json` : 
          `preference-settings-${timestamp}.json`)

      // Export 실행
      const success = await exportSettings(fileName, settingsToExport)
      
      if (success) {
        toast.success(`설정이 "${fileName}" 파일로 내보내졌습니다`)
        setCustomFileName('') // 파일명 초기화
      }
      
    } catch (error) {
      logError('설정 내보내기 실패', error)
      toast.error('설정 내보내기 실패: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }, [settings, exportSections, customFileName, exportSettings, logInfo, logError])

  // ================================
  // Import 기능
  // ================================

  const handleImport = useCallback(async (file) => {
    if (!file) return

    setIsImporting(true)
    setImportProgress(0)
    setImportError(null)
    
    try {
      logInfo('설정 가져오기 시작', { fileName: file.name, fileSize: file.size })

      // 파일 타입 검증
      if (!file.name.toLowerCase().endsWith('.json')) {
        throw new Error('JSON 파일만 지원됩니다')
      }

      // 파일 크기 검증 (최대 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('파일 크기가 너무 큽니다 (최대 5MB)')
      }

      // 진행률 시뮬레이션
      setImportProgress(20)
      
      // Import 실행
      const importedSettings = await importSettings(file)
      
      setImportProgress(80)
      
      // 성공 처리
      setLastImportedFile({
        name: file.name,
        size: file.size,
        importedAt: new Date(),
        sectionsCount: Object.keys(importedSettings).length
      })
      
      setImportProgress(100)
      
      logInfo('설정 가져오기 완료', { 
        fileName: file.name, 
        sectionsImported: Object.keys(importedSettings).length 
      })
      
      toast.success(`"${file.name}"에서 설정을 성공적으로 가져왔습니다`)
      
    } catch (error) {
      logError('설정 가져오기 실패', error)
      setImportError(error.message)
      toast.error('설정 가져오기 실패: ' + error.message)
    } finally {
      setIsImporting(false)
      
      // 진행률 초기화 (3초 후)
      setTimeout(() => {
        setImportProgress(0)
      }, 3000)
    }
  }, [importSettings, logInfo, logError])

  // ================================
  // 파일 업로드 핸들러들
  // ================================

  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0]
    if (file) {
      handleImport(file)
      event.target.value = '' // 파일 입력 초기화
    }
  }, [handleImport])

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event) => {
    event.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((event) => {
    event.preventDefault()
    setDragOver(false)
    
    const files = event.dataTransfer.files
    if (files.length > 0) {
      handleImport(files[0])
    }
  }, [handleImport])

  // ================================
  // Export 섹션 선택 핸들러
  // ================================

  const handleSectionToggle = useCallback((sectionKey) => {
    setExportSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }, [])

  const handleSelectAll = useCallback(() => {
    const allSelected = Object.values(exportSections).every(Boolean)
    const newState = EXPORT_SECTIONS.reduce((acc, section) => ({
      ...acc,
      [section.key]: !allSelected
    }), {})
    setExportSections(newState)
  }, [exportSections])

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
                  <FileJson className="h-5 w-5" />
                  {title}
                  
                  {/* 상태 뱃지들 */}
                  {isImporting && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      가져오는 중
                    </Badge>
                  )}
                  
                  {isExporting && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      내보내는 중
                    </Badge>
                  )}
                  
                  {hasUnsavedChanges && (
                    <Badge variant="outline" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      저장되지 않은 변경사항
                    </Badge>
                  )}
                </CardTitle>
                
                {description && (
                  <CardDescription>{description}</CardDescription>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {lastImportedFile && (
                  <Badge variant="default" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    가져옴
                  </Badge>
                )}
                
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
            {/* Import 오류 표시 */}
            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}
            
            {/* Import 진행률 표시 */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>파일 가져오는 중...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}
            
            {/* Import 섹션 */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                설정 가져오기
              </h4>
              
              {/* 드래그 앤 드롭 영역 */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragOver 
                    ? 'border-primary bg-primary/5' 
                    : isImporting 
                    ? 'border-muted bg-muted/20' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-2">
                  <File className={`h-8 w-8 mx-auto ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="space-y-1">
                    <p className={`text-sm font-medium ${dragOver ? 'text-primary' : ''}`}>
                      {dragOver 
                        ? '파일을 여기에 놓으세요' 
                        : 'JSON 파일을 드래그하거나 클릭하여 선택하세요'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      최대 5MB, .json 파일만 지원
                    </p>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="mt-2"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    파일 선택
                  </Button>
                </div>
              </div>
              
              {/* 숨겨진 파일 입력 */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              
              {/* 마지막 가져온 파일 정보 */}
              {lastImportedFile && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium">마지막 가져온 파일:</span>
                    <span>{lastImportedFile.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {lastImportedFile.sectionsCount}개 섹션
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lastImportedFile.importedAt.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Export 섹션 */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Download className="h-4 w-4" />
                설정 내보내기
              </h4>
              
              {/* 파일명 설정 */}
              <div className="space-y-2">
                <Label htmlFor="fileName" className="text-sm">
                  파일명 (선택사항)
                </Label>
                <Input
                  id="fileName"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="preference-settings-custom.json"
                  disabled={isExporting}
                />
                <p className="text-xs text-muted-foreground">
                  비워두면 자동으로 날짜가 포함된 파일명이 생성됩니다
                </p>
              </div>
              
              {/* Export 섹션 선택 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">내보낼 설정 선택</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={isExporting}
                  >
                    {Object.values(exportSections).every(Boolean) ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {EXPORT_SECTIONS.map((section) => (
                    <div key={section.key} className="flex items-start space-x-2 p-2 rounded border">
                      <Checkbox
                        id={section.key}
                        checked={exportSections[section.key]}
                        onCheckedChange={() => handleSectionToggle(section.key)}
                        disabled={isExporting}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor={section.key}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {section.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Export 버튼들 */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => handleExport('full')}
                  disabled={isExporting || saving}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  전체 설정 내보내기
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => handleExport('partial')}
                  disabled={isExporting || saving || Object.values(exportSections).every(v => !v)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  선택된 설정만 내보내기
                </Button>
              </div>
              
              {Object.values(exportSections).every(v => !v) && (
                <p className="text-xs text-destructive">
                  내보낼 설정 섹션을 하나 이상 선택해주세요
                </p>
              )}
            </div>
            
            {/* 현재 설정 상태 요약 */}
            <div className="bg-muted/50 rounded-lg p-3">
              <h5 className="text-sm font-medium mb-2">현재 설정 상태</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {EXPORT_SECTIONS.map((section) => (
                  <div key={section.key} className="flex justify-between">
                    <span>{section.label}:</span>
                    <span className="text-muted-foreground">
                      {settings[section.key] ? '설정됨' : '기본값'}
                    </span>
                  </div>
                ))}
              </div>
              {hasUnsavedChanges && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  저장되지 않은 변경사항이 있습니다
                </p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

export default ImportExportBox

