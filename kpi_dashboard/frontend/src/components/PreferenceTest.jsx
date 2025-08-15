/**
 * PreferenceTest 컴포넌트
 * 
 * usePreference 훅의 동작을 테스트하고 검증하는 임시 컴포넌트입니다.
 * 개발 중에만 사용하며, 실제 PreferenceManager 개발 완료 후 제거됩니다.
 */

import React from 'react'
import { usePreference, useDashboardSettings, useStatisticsSettings } from '@/hooks/usePreference.js'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { AlertCircle, Check, Clock, Download, Upload, RotateCcw } from 'lucide-react'
import SettingBox from './SettingBox.jsx'
import ImportExportBox from './ImportExportBox.jsx'

const PreferenceTest = () => {
  // ================================
  // 훅 사용
  // ================================

  const {
    settings,
    loading,
    saving,
    error,
    hasUnsavedChanges,
    lastSaved,
    validationErrors,
    hasValidationErrors,
    updateSettings,
    saveImmediately,
    resetSettings,
    exportSettings,
    logInfo
  } = usePreference()

  const {
    settings: dashboardSettings,
    updateSettings: updateDashboardSettings,
    hasErrors: dashboardHasErrors
  } = useDashboardSettings()

  const {
    settings: statisticsSettings,
    updateSettings: updateStatisticsSettings,
    hasErrors: statisticsHasErrors
  } = useStatisticsSettings()

  // ================================
  // 테스트 함수들
  // ================================

  const testDashboardUpdate = () => {
    logInfo('Dashboard 설정 테스트 시작')
    
    const newPegs = ['availability', 'rrc', 'erab', 'sar', 'mobility_intra']
    updateDashboardSettings({
      selectedPegs: newPegs,
      defaultNe: 'TEST_NE_001',
      defaultCellId: 'TEST_CELL_001',
      autoRefreshInterval: 60
    })
  }

  const testStatisticsUpdate = () => {
    logInfo('Statistics 설정 테스트 시작')
    
    updateStatisticsSettings({
      defaultDateRange: 14,
      showDelta: true,
      showRsd: true,
      decimalPlaces: 3,
      defaultPegs: ['availability', 'rrc', 'erab']
    })
  }

  const testInvalidUpdate = () => {
    logInfo('유효성 검증 테스트 시작')
    
    // 잘못된 값으로 업데이트 시도 (자동 새로고침 간격이 범위 초과)
    updateDashboardSettings({
      autoRefreshInterval: 500, // 최대 300초 초과
      selectedPegs: [] // 최소 1개 필요
    })
  }



  // ================================
  // SettingBox 테스트용 필드 정의
  // ================================

  const dashboardFields = [
    {
      key: 'selectedPegs',
      type: 'multiselect',
      label: '선택된 PEG 항목',
      description: '대시보드에 표시할 PEG 항목들을 선택하세요',
      required: true,
      options: [
        { value: 'availability', label: 'Availability' },
        { value: 'rrc', label: 'RRC Connection' },
        { value: 'erab', label: 'E-RAB' },
        { value: 'sar', label: 'SAR' },
        { value: 'mobility_intra', label: 'Mobility Intra' },
        { value: 'cqi', label: 'CQI' }
      ]
    },
    {
      key: 'defaultNe',
      type: 'text',
      label: '기본 NE ID',
      description: '통계 분석 시 기본으로 사용할 NE ID',
      placeholder: 'NE_001'
    },
    {
      key: 'defaultCellId', 
      type: 'text',
      label: '기본 Cell ID',
      description: '통계 분석 시 기본으로 사용할 Cell ID',
      placeholder: 'Cell_001'
    },
    {
      key: 'autoRefreshInterval',
      type: 'number',
      label: '자동 새로고침 간격 (초)',
      description: '대시보드 데이터 자동 새로고침 간격',
      required: true,
      min: 5,
      max: 300
    },
    {
      key: 'chartStyle',
      type: 'select',
      label: '차트 스타일',
      description: '대시보드 차트의 기본 스타일',
      options: [
        { value: 'line', label: '선형 차트' },
        { value: 'bar', label: '막대 차트' },
        { value: 'area', label: '영역 차트' }
      ]
    },
    {
      key: 'showLegend',
      type: 'switch',
      label: '범례 표시',
      description: '차트에 범례를 표시할지 여부'
    },
    {
      key: 'showGrid',
      type: 'switch', 
      label: '격자 표시',
      description: '차트에 격자를 표시할지 여부'
    }
  ]

  const statisticsFields = [
    {
      key: 'defaultDateRange',
      type: 'number',
      label: '기본 날짜 범위 (일)',
      description: '통계 분석 시 기본 날짜 범위',
      required: true,
      min: 1,
      max: 365
    },
    {
      key: 'showDelta',
      type: 'switch',
      label: 'Delta 값 표시',
      description: '비교 분석 시 Delta 값을 표시할지 여부'
    },
    {
      key: 'showRsd',
      type: 'switch',
      label: 'RSD 값 표시', 
      description: '비교 분석 시 RSD 값을 표시할지 여부'
    },
    {
      key: 'decimalPlaces',
      type: 'number',
      label: '소수점 자릿수',
      description: '숫자 표시 시 소수점 자릿수',
      required: true,
      min: 0,
      max: 6
    },
    {
      key: 'defaultPegs',
      type: 'multiselect',
      label: '기본 PEG 선택',
      description: '통계 분석 시 기본으로 선택할 PEG 항목들',
      required: true,
      options: [
        { value: 'availability', label: 'Availability' },
        { value: 'rrc', label: 'RRC Connection' },
        { value: 'erab', label: 'E-RAB' },
        { value: 'sar', label: 'SAR' },
        { value: 'mobility_intra', label: 'Mobility Intra' },
        { value: 'cqi', label: 'CQI' }
      ]
    },
    {
      key: 'chartType',
      type: 'select',
      label: '차트 타입',
      description: '통계 차트의 기본 타입',
      options: [
        { value: 'bar', label: '막대 차트' },
        { value: 'line', label: '선형 차트' },
        { value: 'scatter', label: '산점도' }
      ]
    }
  ]

  // ================================
  // 렌더링
  // ================================

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Preference 훅 테스트</h2>
          <p className="text-muted-foreground">usePreference 훅의 동작을 테스트합니다</p>
        </div>
        
        {/* 상태 표시 */}
        <div className="flex items-center space-x-2">
          {loading && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              로딩 중
            </Badge>
          )}
          {saving && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              저장 중
            </Badge>
          )}
          {hasUnsavedChanges && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              저장되지 않은 변경사항
            </Badge>
          )}
          {!hasUnsavedChanges && lastSaved && (
            <Badge variant="default" className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              저장됨
            </Badge>
          )}
        </div>
      </div>

      {/* 오류 표시 */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">오류: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 유효성 검증 오류 표시 */}
      {hasValidationErrors && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="text-yellow-600">유효성 검증 오류</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {Object.entries(validationErrors).map(([field, message]) => (
                <li key={field} className="text-sm text-yellow-600">
                  • <strong>{field}:</strong> {message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* SettingBox 컴포넌트 테스트 */}
      <div className="space-y-6">
        <div className="border-t pt-6">
          <h3 className="text-xl font-semibold mb-4">SettingBox 컴포넌트 테스트</h3>
          <p className="text-muted-foreground mb-6">
            실제 SettingBox 컴포넌트를 사용하여 설정을 관리해보세요. 
            변경사항은 자동으로 저장되며 유효성 검증이 실시간으로 적용됩니다.
          </p>
          
          <div className="space-y-4">
            {/* Dashboard 설정 박스 */}
            <SettingBox
              title="Dashboard 설정"
              description="대시보드의 표시 방식과 동작을 설정합니다"
              settingKey="dashboardSettings"
              fields={dashboardFields}
              defaultOpen={true}
              showResetButton={true}
              onFieldChange={(fieldKey, newValue, updatedSettings) => {
                console.log('Dashboard 필드 변경:', { fieldKey, newValue, updatedSettings })
              }}
            />

            {/* Statistics 설정 박스 */}
            <SettingBox
              title="Statistics 설정"
              description="통계 분석의 기본값과 표시 옵션을 설정합니다"
              settingKey="statisticsSettings"
              fields={statisticsFields}
              defaultOpen={false}
              showResetButton={true}
              showSaveButton={true}
              onFieldChange={(fieldKey, newValue, updatedSettings) => {
                console.log('Statistics 필드 변경:', { fieldKey, newValue, updatedSettings })
              }}
            />

            {/* Import/Export 박스 */}
            <ImportExportBox
              title="설정 백업 & 복원"
              description="설정을 JSON 파일로 내보내거나 백업 파일에서 가져올 수 있습니다"
              defaultOpen={false}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 테스트 액션들 */}
        <Card>
          <CardHeader>
            <CardTitle>테스트 액션</CardTitle>
            <CardDescription>다양한 설정 업데이트 시나리오를 테스트합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={testDashboardUpdate} className="w-full">
              Dashboard 설정 업데이트 테스트
            </Button>
            
            <Button onClick={testStatisticsUpdate} className="w-full">
              Statistics 설정 업데이트 테스트
            </Button>
            
            <Button onClick={testInvalidUpdate} variant="destructive" className="w-full">
              유효성 검증 실패 테스트
            </Button>
            
            <Separator />
            
            <Button onClick={saveImmediately} variant="outline" className="w-full">
              즉시 저장
            </Button>
            
            <Button onClick={resetSettings} variant="outline" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              설정 초기화
            </Button>
            
            <Separator />
            
            <p className="text-xs text-muted-foreground">
              📄 Import/Export 기능은 위의 "설정 백업 & 복원" 박스에서 테스트할 수 있습니다.
            </p>
          </CardContent>
        </Card>

        {/* 현재 상태 표시 */}
        <Card>
          <CardHeader>
            <CardTitle>현재 상태</CardTitle>
            <CardDescription>실시간 설정 상태를 표시합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Dashboard 설정 {dashboardHasErrors && <Badge variant="destructive">오류</Badge>}</h4>
              <div className="text-sm space-y-1">
                <div><strong>선택된 PEGs:</strong> {dashboardSettings.selectedPegs?.join(', ')}</div>
                <div><strong>기본 NE:</strong> {dashboardSettings.defaultNe || '없음'}</div>
                <div><strong>기본 Cell ID:</strong> {dashboardSettings.defaultCellId || '없음'}</div>
                <div><strong>자동 새로고침:</strong> {dashboardSettings.autoRefreshInterval}초</div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-medium mb-2">Statistics 설정 {statisticsHasErrors && <Badge variant="destructive">오류</Badge>}</h4>
              <div className="text-sm space-y-1">
                <div><strong>기본 날짜 범위:</strong> {statisticsSettings.defaultDateRange}일</div>
                <div><strong>Delta 표시:</strong> {statisticsSettings.showDelta ? '예' : '아니오'}</div>
                <div><strong>RSD 표시:</strong> {statisticsSettings.showRsd ? '예' : '아니오'}</div>
                <div><strong>소수점 자릿수:</strong> {statisticsSettings.decimalPlaces}</div>
                <div><strong>기본 PEGs:</strong> {statisticsSettings.defaultPegs?.join(', ')}</div>
              </div>
            </div>
            
            <Separator />
            
            <div className="text-xs text-muted-foreground">
              <div><strong>마지막 저장:</strong> {lastSaved ? lastSaved.toLocaleTimeString() : '없음'}</div>
              <div><strong>저장되지 않은 변경사항:</strong> {hasUnsavedChanges ? '있음' : '없음'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 전체 설정 데이터 (개발용) */}
      <Card>
        <CardHeader>
          <CardTitle>전체 설정 데이터 (개발용)</CardTitle>
          <CardDescription>JSON 형태의 전체 설정 구조를 표시합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

export default PreferenceTest
