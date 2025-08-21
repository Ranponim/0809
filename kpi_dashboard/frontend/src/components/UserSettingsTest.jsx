/**
 * UserSettingsTest 컴포넌트
 * 
 * 새로운 userSettings Context 기능을 테스트하는 컴포넌트입니다.
 * LocalStorage 지속성과 순서 독립적 설정을 검증합니다.
 */

import React, { useState } from 'react'
import { usePreference } from '@/contexts/PreferenceContext.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { toast } from 'sonner'
import { SettingsSaveStatus, SettingsStatusPanel, UnsavedChangesWarning } from '@/components/SettingsSaveStatus.jsx'

const UserSettingsTest = () => {
  const {
    settings,
    loading,
    saving,
    syncStatus,
    localStorageAvailable,
    updatePegConfiguration,
    updateStatisticsConfiguration,
    removePegConfiguration,
    removeStatisticsConfiguration,
    validateOrderIndependentSettings,
    resetSettings,
    clearLocalStorage,
    logInfo
  } = usePreference()

  const [newPegName, setNewPegName] = useState('')
  const [newStatsName, setNewStatsName] = useState('')

  // PEG 설정 추가
  const addPegConfiguration = () => {
    if (!newPegName.trim()) {
      toast.error('PEG 이름을 입력해주세요')
      return
    }

    const pegId = `peg_${Date.now()}`
    const config = {
      name: newPegName,
      enabled: true,
      parameters: { threshold: 95, unit: '%' },
      dependencies: [],
      createdAt: new Date().toISOString()
    }

    updatePegConfiguration(pegId, config)
    setNewPegName('')
    toast.success(`PEG '${newPegName}' 추가됨`)
  }

  // Statistics 설정 추가
  const addStatisticsConfiguration = () => {
    if (!newStatsName.trim()) {
      toast.error('Statistics 이름을 입력해주세요')
      return
    }

    const statsId = `stats_${Date.now()}`
    const config = {
      name: newStatsName,
      enabled: true,
      parameters: { aggregation: 'avg', period: 'daily' },
      dependencies: [],
      createdAt: new Date().toISOString()
    }

    updateStatisticsConfiguration(statsId, config)
    setNewStatsName('')
    toast.success(`Statistics '${newStatsName}' 추가됨`)
  }

  // 검증 실행
  const runValidation = () => {
    const results = validateOrderIndependentSettings()
    
    if (results.isValid) {
      toast.success('모든 설정이 유효합니다!')
    } else {
      toast.error(`검증 실패: ${results.errors.length}개 오류`)
      console.log('검증 결과:', results)
    }
  }

  // LocalStorage 테스트
  const testLocalStorage = () => {
    logInfo('LocalStorage 테스트 실행')
    
    // 페이지 새로고침 시뮬레이션을 위한 안내
    toast.info('브라우저를 새로고침하여 설정 지속성을 확인해보세요')
  }

  const pegConfigurations = settings.pegConfigurations || []
  const statisticsConfigurations = settings.statisticsConfigurations || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">UserSettings 테스트</h1>
        <div className="flex gap-2">
          <Badge variant={localStorageAvailable ? "default" : "destructive"}>
            LocalStorage: {localStorageAvailable ? "사용 가능" : "사용 불가"}
          </Badge>
          <Badge variant={syncStatus === 'idle' ? "default" : "secondary"}>
            동기화: {syncStatus}
          </Badge>
          {(loading || saving) && (
            <Badge variant="secondary">
              {loading ? "로딩 중..." : "저장 중..."}
            </Badge>
          )}
          <SettingsSaveStatus position="inline" variant="icon-only" showToast={false} />
        </div>
      </div>

      {/* LocalStorage 지속성 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle>LocalStorage 지속성 테스트</CardTitle>
          <CardDescription>
            설정을 추가한 후 브라우저를 새로고침하여 설정이 유지되는지 확인해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={testLocalStorage} variant="outline">
              지속성 테스트
            </Button>
            <Button onClick={clearLocalStorage} variant="destructive">
              LocalStorage 초기화
            </Button>
            <Button onClick={resetSettings} variant="secondary">
              전체 설정 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PEG 설정 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>PEG 설정 관리</CardTitle>
          <CardDescription>
            PEG 설정을 추가/제거하여 순서 독립적 설정을 테스트해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="PEG 이름 입력"
              value={newPegName}
              onChange={(e) => setNewPegName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addPegConfiguration()}
            />
            <Button onClick={addPegConfiguration}>PEG 추가</Button>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">현재 PEG 설정 ({pegConfigurations.length}개)</h4>
            {pegConfigurations.length === 0 ? (
              <p className="text-muted-foreground">등록된 PEG 설정이 없습니다.</p>
            ) : (
              pegConfigurations.map(peg => (
                <div key={peg.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{peg.name}</span>
                    <Badge className="ml-2" variant={peg.enabled ? "default" : "secondary"}>
                      {peg.enabled ? "활성" : "비활성"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removePegConfiguration(peg.id)}
                  >
                    제거
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics 설정 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics 설정 관리</CardTitle>
          <CardDescription>
            Statistics 설정을 추가/제거하여 순서 독립적 설정을 테스트해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Statistics 이름 입력"
              value={newStatsName}
              onChange={(e) => setNewStatsName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addStatisticsConfiguration()}
            />
            <Button onClick={addStatisticsConfiguration}>Statistics 추가</Button>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">현재 Statistics 설정 ({statisticsConfigurations.length}개)</h4>
            {statisticsConfigurations.length === 0 ? (
              <p className="text-muted-foreground">등록된 Statistics 설정이 없습니다.</p>
            ) : (
              statisticsConfigurations.map(stats => (
                <div key={stats.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{stats.name}</span>
                    <Badge className="ml-2" variant={stats.enabled ? "default" : "secondary"}>
                      {stats.enabled ? "활성" : "비활성"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeStatisticsConfiguration(stats.id)}
                  >
                    제거
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 순서 독립적 검증 */}
      <Card>
        <CardHeader>
          <CardTitle>순서 독립적 설정 검증</CardTitle>
          <CardDescription>
            PEG와 Statistics 설정이 어떤 순서로 추가되든 정상 작동하는지 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runValidation} className="w-full">
            설정 검증 실행
          </Button>
        </CardContent>
      </Card>

      {/* 설정 상태 표시 */}
      <Card>
        <CardHeader>
          <CardTitle>현재 설정 상태</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
            {JSON.stringify({
              pegConfigurations: settings.pegConfigurations || [],
              statisticsConfigurations: settings.statisticsConfigurations || [],
              preferences: settings.preferences
            }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

export default UserSettingsTest
