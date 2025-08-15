import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Settings, BarChart3, Database, Bell, Clock, RefreshCw, Calculator } from 'lucide-react'
import SettingBox from './SettingBox.jsx'
import ImportExportBox from './ImportExportBox.jsx'
import DerivedPegManager from './DerivedPegManager.jsx'
import { usePreference, useDashboardSettings, useStatisticsSettings, useNotificationSettings } from '@/hooks/usePreference.js'
import apiClient from '@/lib/apiClient.js'
import { getCombinedPegOptions, formatPegOptionsForUI } from '@/lib/derivedPegUtils.js'

const PreferenceManager = () => {
  const { preferences, isLoading, isSaving, error, lastSaved, updateSettings } = usePreference()
  
  // DB PEG 관련 상태
  const [dbPegOptions, setDbPegOptions] = useState([])
  const [pegOptionsLoading, setPegOptionsLoading] = useState(false)
  const [useDbPegs, setUseDbPegs] = useState(false)
  const [lastDbFetch, setLastDbFetch] = useState(null)

  // DB에서 실제 PEG 목록 가져오기
  const fetchDbPegs = useCallback(async () => {
    try {
      setPegOptionsLoading(true)
      console.info('[PreferenceManager] Fetching DB PEGs')
      
      // DB 설정 로드
      let dbConfig = {}
      try {
        const rawDb = localStorage.getItem('dbConfig')
        if (rawDb) dbConfig = JSON.parse(rawDb)
      } catch {}

      if (!dbConfig.host) {
        console.warn('[PreferenceManager] No DB config found')
        return
      }

      // DB에서 PEG 목록 조회
      const response = await apiClient.post('/api/master/pegs', {
        db: dbConfig,
        table: dbConfig.table || 'summary',
        limit: 100
      })

      const pegs = response?.data?.pegs || []
      console.info('[PreferenceManager] DB PEGs loaded:', pegs.length)

      // PEG 목록을 옵션 형식으로 변환
      const pegOptions = pegs.map(peg => ({
        value: peg.id || peg.name,
        label: `${peg.name || peg.id} (DB PEG)`
      }))

      setDbPegOptions(pegOptions)
      setLastDbFetch(new Date())
      
    } catch (error) {
      console.error('[PreferenceManager] Error fetching DB PEGs:', error)
    } finally {
      setPegOptionsLoading(false)
    }
  }, [])

  // 현재 사용할 PEG 옵션 결정 (Database Setting PEG + Derived PEG 통합)
  const getCurrentPegOptions = useCallback(() => {
    console.log('🔍 getCurrentPegOptions 호출됨:', {
      useDbPegs,
      dbPegOptionsCount: dbPegOptions.length,
      derivedFormulasCount: preferences?.derivedPegSettings?.formulas?.length || 0
    })
    
    // 기본 PEG 목록 - 항상 Database Setting 우선 사용
    let basePegs = []
    
    if (useDbPegs && dbPegOptions.length > 0) {
      // Database Setting에서 가져온 PEG 사용
      console.log('📊 Database PEG 사용:', dbPegOptions)
      basePegs = dbPegOptions
    } else {
      // Database를 사용하지 않거나 데이터가 없는 경우에만 기본값 사용
      console.log('📝 기본 PEG 목록 사용 (fallback)')
      basePegs = [
        { value: 'availability', label: 'Availability (%)' },
        { value: 'rrc', label: 'RRC Success Rate (%)' },
        { value: 'erab', label: 'ERAB Success Rate (%)' },
        { value: 'sar', label: 'SAR' },
        { value: 'mobility_intra', label: 'Mobility Intra (%)' },
        { value: 'cqi', label: 'CQI' },
        { value: 'se', label: 'Spectral Efficiency' },
        { value: 'dl_thp', label: 'DL Throughput' },
        { value: 'ul_int', label: 'UL Interference' }
      ]
    }

    // Derived PEG와 통합
    const derivedFormulas = preferences?.derivedPegSettings?.formulas || []
    const combinedOptions = getCombinedPegOptions(basePegs, derivedFormulas)
    const result = formatPegOptionsForUI(combinedOptions)
    
    console.log('✅ 최종 PEG 옵션:', result)
    return result
  }, [useDbPegs, dbPegOptions, preferences?.derivedPegSettings?.formulas])

  // Dashboard Settings 필드 정의 (동적 PEG 옵션 포함)
  const dashboardFields = [
    {
      key: 'selectedPegs',
      label: 'Dashboard에 표시할 PEG 목록',
      type: 'multiselect',
      required: true,
      options: getCurrentPegOptions(),
      placeholder: useDbPegs 
        ? 'Database의 실제 PEG를 선택하세요' 
        : 'Dashboard에서 보여줄 PEG를 선택하세요'
    },
    {
      key: 'defaultNe',
      label: '기본 NE',
      type: 'text',
      placeholder: '예: nvgnb#10000,nvgnb#20000'
    },
    {
      key: 'defaultCellId',
      label: '기본 Cell ID',
      type: 'text',
      placeholder: '예: 2010,2011'
    },
    {
      key: 'autoRefreshInterval',
      label: '자동 새로고침 간격 (초)',
      type: 'number',
      min: 0,
      max: 300,
      placeholder: '0 = 비활성화, 30 = 30초마다'
    },
    {
      key: 'chartStyle',
      label: '차트 스타일',
      type: 'select',
      options: [
        { value: 'line', label: 'Line Chart' },
        { value: 'area', label: 'Area Chart' },
        { value: 'bar', label: 'Bar Chart' }
      ]
    },
    {
      key: 'showLegend',
      label: '차트 범례 표시',
      type: 'switch'
    },
    {
      key: 'showGrid',
      label: '차트 격자 표시',
      type: 'switch'
    }
  ]

  // Statistics Settings 필드 정의
  const statisticsFields = [
    {
      key: 'defaultNe',
      label: '기본 NE',
      type: 'text',
      placeholder: '예: nvgnb#10000,nvgnb#20000'
    },
    {
      key: 'defaultCellId',
      label: '기본 Cell ID',
      type: 'text',
      placeholder: '예: 2010,2011'
    },
    {
      key: 'defaultDateRange',
      label: '기본 날짜 범위 (일)',
      type: 'number',
      min: 1,
      max: 365,
      placeholder: '기본 조회 기간'
    },
    {
      key: 'decimalPlaces',
      label: '소수점 자릿수',
      type: 'number',
      min: 0,
      max: 6,
      placeholder: '통계 수치 표시 정밀도'
    },
    {
      key: 'showComparisonOptions',
      label: '비교 분석 옵션 표시',
      type: 'switch'
    },
    {
      key: 'autoCalculateStats',
      label: '자동 통계 계산',
      type: 'switch'
    }
  ]

  // Notification Settings 필드 정의
  const notificationFields = [
    {
      key: 'enableNotifications',
      label: '알림 활성화',
      type: 'switch'
    },
    {
      key: 'emailNotifications',
      label: '이메일 알림',
      type: 'switch'
    },
    {
      key: 'soundEnabled',
      label: '소리 알림',
      type: 'switch'
    },
    {
      key: 'notificationFrequency',
      label: '알림 빈도',
      type: 'select',
      options: [
        { value: 'immediate', label: '즉시' },
        { value: 'hourly', label: '매시간' },
        { value: 'daily', label: '매일' },
        { value: 'weekly', label: '매주' }
      ]
    }
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">환경설정</h2>
          <Badge variant="secondary" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            로딩 중...
          </Badge>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              설정을 불러오는 중입니다...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">환경설정</h2>
          <p className="text-muted-foreground">
            Dashboard와 Statistics의 동작을 설정할 수 있습니다
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isSaving && (
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              저장 중...
            </Badge>
          )}
          
          {error && (
            <Badge variant="destructive" className="text-xs">
              오류 발생
            </Badge>
          )}

          {lastSaved && (
            <Badge variant="outline" className="text-xs">
              마지막 저장: {new Date(lastSaved).toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </div>

      {/* 설정 탭 */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="derived-peg" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Derived PEG
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            알림
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            백업/복원
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* PEG 데이터 소스 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                PEG 데이터 소스
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {useDbPegs ? 'Database PEG 사용 중' : '기본 KPI 목록 사용 중'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {useDbPegs 
                        ? 'Database Settings에서 연결된 실제 PEG 목록을 사용합니다' 
                        : '미리 정의된 기본 KPI 목록을 사용합니다'
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={useDbPegs ? "secondary" : "default"}
                      size="sm"
                      onClick={() => {
                        setUseDbPegs(false)
                        localStorage.setItem('useDbPegs', 'false')
                      }}
                    >
                      기본 KPI
                    </Button>
                    <Button
                      variant={useDbPegs ? "default" : "secondary"}
                      size="sm"
                      onClick={() => {
                        setUseDbPegs(true)
                        localStorage.setItem('useDbPegs', 'true')
                        fetchDbPegs()
                      }}
                      disabled={pegOptionsLoading}
                    >
                      {pegOptionsLoading ? '로딩 중...' : 'DB PEG'}
                    </Button>
                    {dbPegOptions.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchDbPegs}
                        disabled={pegOptionsLoading}
                      >
                        <RefreshCw className={`h-3 w-3 ${pegOptionsLoading ? 'animate-spin' : ''}`} />
                        새로고침
                      </Button>
                    )}
                  </div>
                </div>

                {/* 상태 표시 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-sm font-medium">현재 모드</p>
                    <p className="text-xs text-muted-foreground">
                      {useDbPegs ? 'Database PEG' : '기본 KPI'}
                    </p>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-sm font-medium">사용 가능한 PEG</p>
                    <p className="text-xs text-muted-foreground">
                      {useDbPegs ? `${dbPegOptions.length}개` : '9개 (기본)'}
                    </p>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-sm font-medium">마지막 업데이트</p>
                    <p className="text-xs text-muted-foreground">
                      {lastDbFetch ? lastDbFetch.toLocaleTimeString() : '없음'}
                    </p>
                  </div>
                </div>

                {/* 경고 메시지 */}
                {useDbPegs && dbPegOptions.length === 0 && !pegOptionsLoading && (
                  <div className="p-3 border rounded-lg bg-amber-50 border-amber-200">
                    <p className="text-sm text-amber-700">
                      ⚠️ DB PEG를 불러올 수 없습니다. Database Settings에서 DB 연결을 확인하세요.
                    </p>
                  </div>
                )}

                {useDbPegs && dbPegOptions.length > 0 && (
                  <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                    <p className="text-sm text-green-700">
                      ✅ {dbPegOptions.length}개의 실제 DB PEG를 사용할 수 있습니다
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dashboard 설정 */}
          <SettingBox
            title="Dashboard 설정"
            description="Dashboard에서 표시할 PEG, 차트 스타일, 자동 새로고침 등을 설정합니다"
            settingKey="dashboardSettings"
            fields={dashboardFields}
            defaultOpen={true}
            showResetButton={true}
            showSaveButton={false}
          />
        </TabsContent>

        <TabsContent value="statistics" className="space-y-6">
          <SettingBox
            title="Statistics 설정"
            description="Statistics 페이지의 기본값, 소수점 자릿수, 비교 옵션 등을 설정합니다"
            settingKey="statisticsSettings"
            fields={statisticsFields}
            defaultOpen={true}
            showResetButton={true}
            showSaveButton={false}
          />
        </TabsContent>

        <TabsContent value="derived-peg" className="space-y-6">
          <DerivedPegManager
            derivedPegSettings={preferences?.derivedPegSettings || { formulas: [], settings: {} }}
            updateDerivedPegSettings={(newSettings) => {
              updateSettings({
                derivedPegSettings: newSettings
              })
            }}
            availablePegs={getCurrentPegOptions()}
            saving={isSaving}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <SettingBox
            title="알림 설정"
            description="이메일, 소리 알림 등 알림 관련 설정을 관리합니다"
            settingKey="notificationSettings"
            fields={notificationFields}
            defaultOpen={true}
            showResetButton={true}
            showSaveButton={false}
          />
        </TabsContent>

        <TabsContent value="backup" className="space-y-6">
          <ImportExportBox
            title="설정 백업 및 복원"
            description="모든 환경설정을 JSON 파일로 내보내거나 백업 파일에서 복원할 수 있습니다"
            defaultOpen={true}
          />
        </TabsContent>
      </Tabs>

      {/* 현재 설정 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            현재 설정 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Dashboard</h4>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  선택된 PEG: {preferences?.dashboardSettings?.selectedPegs?.length || 0}개
                </p>
                <p className="text-xs text-muted-foreground">
                  PEG 소스: {useDbPegs ? `DB (${dbPegOptions.length}개)` : '기본 KPI'}
                </p>
                <p className="text-xs text-muted-foreground">
                  차트 스타일: {preferences?.dashboardSettings?.chartStyle || 'line'}
                </p>
                <p className="text-xs text-muted-foreground">
                  자동 새로고침: {preferences?.dashboardSettings?.autoRefreshInterval || 0}초
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Statistics</h4>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  기본 기간: {preferences?.statisticsSettings?.defaultDateRange || 7}일
                </p>
                <p className="text-xs text-muted-foreground">
                  소수점: {preferences?.statisticsSettings?.decimalPlaces || 2}자리
                </p>
                <p className="text-xs text-muted-foreground">
                  비교 옵션: {preferences?.statisticsSettings?.showComparisonOptions ? '활성' : '비활성'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">알림</h4>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  알림: {preferences?.notificationSettings?.enableNotifications ? '활성' : '비활성'}
                </p>
                <p className="text-xs text-muted-foreground">
                  이메일: {preferences?.notificationSettings?.emailNotifications ? '활성' : '비활성'}
                </p>
                <p className="text-xs text-muted-foreground">
                  소리: {preferences?.notificationSettings?.soundEnabled ? '활성' : '비활성'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PreferenceManager
