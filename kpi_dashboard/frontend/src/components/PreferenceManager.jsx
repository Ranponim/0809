import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Settings, BarChart3, Database, Bell, Clock, RefreshCw, Calculator, RotateCcw, Loader2, AlertTriangle } from 'lucide-react'
import { Label } from '@/components/ui/label.jsx'
import SettingBox from './SettingBox.jsx'
import ImportExportBox from './ImportExportBox.jsx'
import DerivedPegManager from './DerivedPegManager.jsx'
import { usePreference } from '@/hooks/usePreference.js'
import apiClient from '@/lib/apiClient.js'
import { formatPegOptionsForUI } from '@/lib/derivedPegUtils.js'
import { CardDescription } from '@/components/ui/card.jsx'

const PreferenceManager = () => {
  const { settings, isLoading, isSaving, error, lastSaved, updateSettings, saveSettings, resetSettings } = usePreference()
  
  // DB PEG 관련 상태
  const [dbPegOptions, setDbPegOptions] = useState([])
  const [pegOptionsLoading, setPegOptionsLoading] = useState(false)
  const useDbPegs = true
  const [lastDbFetch, setLastDbFetch] = useState(null)

  // DB에서 실제 PEG 목록 가져오기
  const fetchDbPegs = useCallback(async () => {
    try {
      setPegOptionsLoading(true)
      console.info('[PreferenceManager] Fetching DB PEGs')
      
      // Preference의 DB 설정 직접 사용
      const dbConfig = settings?.databaseSettings || {}

      if (!dbConfig.host) {
        console.warn('[PreferenceManager] No DB config found')
        return
      }

      // DB에서 PEG 목록 조회 (백엔드 스키마에 맞춰 평탄화하여 전달)
      const response = await apiClient.post('/api/master/pegs', {
        host: String(dbConfig.host).trim(),
        port: Number(dbConfig.port) || 5432,
        user: String(dbConfig.user || '').trim(),
        password: String(dbConfig.password || '').trim(),
        dbname: String(dbConfig.dbname || '').trim(),
        table: String(dbConfig.table || 'summary').trim(),
        limit: 500
      })

      const pegs = response?.data?.pegs || (Array.isArray(response?.data?.items) ? response.data.items.map(v => ({ id: v, name: v })) : (Array.isArray(response?.data) ? response.data.map(v => ({ id: v, name: v })) : []))
      console.info('[PreferenceManager] DB PEGs loaded:', pegs.length)

      // PEG 목록을 옵션 형식으로 변환
      const pegOptions = pegs.map(peg => ({
        value: peg.id || peg.name || peg.peg_name,
        label: String(peg.name || peg.id || peg.peg_name)
      }))

      setDbPegOptions(pegOptions)
      setLastDbFetch(new Date())
      
    } catch (error) {
      console.error('[PreferenceManager] Error fetching DB PEGs:', error)
    } finally {
      setPegOptionsLoading(false)
    }
  }, [settings?.databaseSettings])

  // 현재 사용할 PEG 옵션 결정 (Database Setting PEG + Derived PEG 통합)
  const getCurrentPegOptions = useCallback(() => {
    // DB PEG만 사용
    const result = formatPegOptionsForUI(dbPegOptions)
    console.log('✅ 최종 PEG 옵션:', result)
    return result
  }, [dbPegOptions])

  // DB 설정 변경 시 자동으로 PEG 목록 갱신
  const dbKey = JSON.stringify({
    host: settings?.databaseSettings?.host,
    port: settings?.databaseSettings?.port,
    user: settings?.databaseSettings?.user,
    dbname: settings?.databaseSettings?.dbname,
    table: settings?.databaseSettings?.table
  })
  useEffect(() => {
    // PreferenceManager가 마운트될 때만 API 호출
    fetchDbPegs()
  }, [fetchDbPegs, dbKey])

  // Dashboard Settings 필드 정의 (동적 PEG 옵션 포함)
  const dashboardFields = [
    {
      key: 'selectedPegs',
      label: 'Dashboard에 표시할 PEG 목록',
      type: 'multiselect',
      required: false,
      options: getCurrentPegOptions(),
      placeholder: 'Database PEG에서 선택하세요'
    },

    {
      key: 'chartLayout',
      label: '그래프 정렬 방식',
      type: 'select',
      options: [
        { value: 'byPeg', label: 'PEG별 (PEG마다 Cell/NE 시리즈)' },
        { value: 'byEntity', label: 'Cell/NE별 (엔터티마다 PEG 시리즈)' }
      ]
    }
  ]

  // HOST → NE → CellID 계층 선택 상태 (Preference/Statistics 탭 전용)
  const [hosts, setHosts] = useState([])
  const [selectedHosts, setSelectedHosts] = useState([])
  const [nes, setNes] = useState([])
  const [selectedNEs, setSelectedNEs] = useState([])
  const [cellIds, setCellIds] = useState([])
  const [selectedCellIds, setSelectedCellIds] = useState([])

  // 초기 선택값을 Preference에서 로드
  useEffect(() => {
    const s = settings?.statisticsSettings || {}
    setSelectedHosts(Array.isArray(s.selectedHosts) ? s.selectedHosts : [])
    setSelectedNEs(Array.isArray(s.selectedNEs) ? s.selectedNEs : [])
    setSelectedCellIds(Array.isArray(s.selectedCellIds) ? s.selectedCellIds : [])
  }, [settings?.statisticsSettings])

  // HOST 목록 조회 (DB 설정 변경 시)
  useEffect(() => {
    const fetchHosts = async () => {
      try {
        const db = settings?.databaseSettings || {}
        if (!db.host) return
        const payload = {
          host: String(db.host || '').trim(),
          port: Number(db.port) || 5432,
          user: String(db.user || '').trim(),
          password: String(db.password || '').trim(),
          dbname: String(db.dbname || '').trim(),
          table: String(db.table || 'summary').trim()
        }
        const res = await apiClient.post('/api/master/hosts', payload)
        setHosts(Array.isArray(res?.data?.hosts) ? res.data.hosts : [])
      } catch (e) {
        console.error('[PreferenceManager] HOST 목록 조회 실패', e)
      }
    }
    
    fetchHosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.databaseSettings?.host, settings?.databaseSettings?.port, settings?.databaseSettings?.user, settings?.databaseSettings?.password, settings?.databaseSettings?.dbname, settings?.databaseSettings?.table])

  // 선택된 HOST 기준 NE 조회
  useEffect(() => {
    const fetchNes = async () => {
      try {
        const db = settings?.databaseSettings || {}
        if (!db.host || selectedHosts.length === 0) { setNes([]); return }
        const payload = {
          host: String(db.host || '').trim(),
          port: Number(db.port) || 5432,
          user: String(db.user || '').trim(),
          password: String(db.password || '').trim(),
          dbname: String(db.dbname || '').trim(),
          table: String(db.table || 'summary').trim(),
          hosts: selectedHosts
        }
        const res = await apiClient.post('/api/master/nes-by-host', payload)
        setNes(Array.isArray(res?.data?.nes) ? res.data.nes : [])
      } catch (e) {
        console.error('[PreferenceManager] NE 목록 조회 실패', e)
      }
    }
    
    fetchNes()
  }, [selectedHosts, settings?.databaseSettings])

  // 선택된 HOST/NE 기준 CellID 조회
  useEffect(() => {
    const fetchCells = async () => {
      try {
        const db = settings?.databaseSettings || {}
        if (!db.host || selectedHosts.length === 0 || selectedNEs.length === 0) { setCellIds([]); return }
        const payload = {
          host: String(db.host || '').trim(),
          port: Number(db.port) || 5432,
          user: String(db.user || '').trim(),
          password: String(db.password || '').trim(),
          dbname: String(db.dbname || '').trim(),
          table: String(db.table || 'summary').trim(),
          hosts: selectedHosts,
          nes: selectedNEs
        }
        const res = await apiClient.post('/api/master/cells-by-host-ne', payload)
        setCellIds(Array.isArray(res?.data?.cellids) ? res.data.cellids : [])
      } catch (e) {
        console.error('[PreferenceManager] CellID 목록 조회 실패', e)
      }
    }
    
    fetchCells()
  }, [selectedNEs, selectedHosts, settings?.databaseSettings])

  // Database Settings 필드 정의 (LLM/Statistics 공통)
  const databaseFields = [
    { key: 'host', label: 'Host', type: 'text', placeholder: '예: 127.0.0.1' },
    { key: 'port', label: 'Port', type: 'number', min: 1, max: 65535, placeholder: '5432' },
    { key: 'user', label: 'User', type: 'text', placeholder: 'postgres' },
    { key: 'password', label: 'Password', type: 'text', placeholder: '비밀번호' },
    { key: 'dbname', label: 'DB Name', type: 'text', placeholder: 'postgres' },
    { key: 'table', label: '기본 테이블명', type: 'text', placeholder: 'summary' }
  ]

  // Database 섹션용 저장/테스트 액션 바를 SettingBox 하단에 렌더링하기 위해 별도 요소 추가

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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database
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
                    <p className="text-sm font-medium">PEG 데이터 소스</p>
                    <p className="text-xs text-muted-foreground">Database Settings에서 연결된 실제 PEG 목록을 사용합니다</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchDbPegs}
                      disabled={pegOptionsLoading}
                    >
                      <RefreshCw className={`h-3 w-3 ${pegOptionsLoading ? 'animate-spin' : ''}`} />
                      새로고침
                    </Button>
                  </div>
                </div>

                {/* 상태 표시: 사용 가능한 PEG 수 / 마지막 업데이트 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-sm font-medium">사용 가능한 PEG</p>
                    <p className="text-xs text-muted-foreground">{dbPegOptions.length}개</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-sm font-medium">마지막 업데이트</p>
                    <p className="text-xs text-muted-foreground">{lastDbFetch ? lastDbFetch.toLocaleTimeString() : '없음'}</p>
                  </div>
                </div>

                {/* 경고/성공 메시지 */}
                {dbPegOptions.length === 0 && !pegOptionsLoading && (
                  <div className="p-3 border rounded-lg bg-amber-50 border-amber-200">
                    <p className="text-sm text-amber-700">⚠️ DB PEG를 불러올 수 없습니다. Database Settings에서 DB 연결을 확인하세요.</p>
                  </div>
                )}
                {dbPegOptions.length > 0 && (
                  <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                    <p className="text-sm text-green-700">✅ {dbPegOptions.length}개의 실제 DB PEG를 사용할 수 있습니다</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dashboard 설정 */}
          <SettingBox
            key={`dashboard-settings-${dbPegOptions.length}-${lastDbFetch ? lastDbFetch.getTime() : 0}`}
            title="Dashboard 설정"
            description="DB에서 연동된 PEG만 선택하여 표시합니다"
            settingKey="dashboardSettings"
            fields={dashboardFields}
            defaultOpen={true}
            showResetButton={true}
            showSaveButton={false} // 직접 구현한 저장 버튼 사용
          />
          
          {/* Dashboard 저장 버튼 */}
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await saveSettings()
                  alert('Dashboard 설정이 저장되었습니다')
                } catch (e) {
                  alert('저장 실패: ' + (e?.message || '알 수 없는 오류'))
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>데이터 선택 (HOST → NE → CellID)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="block mb-2">HOST (다중 선택)</Label>
                  <select
                    multiple
                    className="w-full border rounded p-2 h-48"
                    value={selectedHosts}
                    onChange={(e) => {
                      const opts = Array.from(e.target.selectedOptions).map(o => o.value)
                      setSelectedHosts(opts)
                    }}
                  >
                    {hosts.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="block mb-2">NE (다중 선택)</Label>
                  <select
                    multiple
                    className="w-full border rounded p-2 h-48"
                    value={selectedNEs}
                    onChange={(e) => {
                      const opts = Array.from(e.target.selectedOptions).map(o => o.value)
                      setSelectedNEs(opts)
                    }}
                  >
                    {nes.map(ne => (
                      <option key={ne} value={ne}>{ne}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="block mb-2">CellID (다중 선택)</Label>
                  <select
                    multiple
                    className="w-full border rounded p-2 h-48"
                    value={selectedCellIds}
                    onChange={(e) => {
                      const opts = Array.from(e.target.selectedOptions).map(o => o.value)
                      setSelectedCellIds(opts)
                    }}
                  >
                    {cellIds.map(cid => (
                      <option key={cid} value={cid}>{cid}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 저장/요약 */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  <div className="mb-1">HOST: {selectedHosts.length}개</div>
                  <div className="mb-1">NE: {selectedNEs.length}개</div>
                  <div>CellID: {selectedCellIds.length}개</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        // 설정에 저장
                        updateSettings({
                          statisticsSettings: {
                            ...(settings?.statisticsSettings || {}),
                            selectedHosts,
                            selectedNEs,
                            selectedCellIds
                          }
                        })
                        await saveSettings()
                        alert('Statistics 설정이 저장되었습니다')
                      } catch (e) {
                        alert('저장 실패: ' + (e?.message || '알 수 없는 오류'))
                      }
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <SettingBox
            title="Database 설정"
            description="LLM 분석과 Statistics에서 공통으로 사용할 PostgreSQL DB 설정입니다 (테이블명 포함)."
            settingKey="databaseSettings"
            fields={databaseFields}
            defaultOpen={true}
            showResetButton={true}
            showSaveButton={false} // 직접 구현한 저장 버튼 사용
          />
          
          {/* Database 저장 버튼 */}
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await saveSettings()
                  alert('Database 설정이 저장되었습니다')
                } catch (e) {
                  alert('저장 실패: ' + (e?.message || '알 수 없는 오류'))
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </Button>
            
            <Button
              size="sm"
              onClick={async () => {
                try {
                  // Preference의 현재 DB 설정으로 연결 테스트
                  const db = settings?.databaseSettings || {}
                  const res = await apiClient.post('/api/master/test-connection', {
                    host: (db.host || '').trim(),
                    port: Number(db.port) || 5432,
                    user: (db.user || '').trim(),
                    password: (db.password || '').trim(),
                    dbname: (db.dbname || '').trim(),
                    table: (db.table || 'summary').trim()
                  })
                  const ok = res?.data?.success
                  if (ok) {
                    alert('DB 연결 성공. table_exists=' + res?.data?.table_exists)
                  } else {
                    alert('DB 연결 실패: 응답 형식 확인 필요')
                  }
                } catch (err) {
                  alert('DB 연결 실패: ' + (err?.response?.data?.detail || err?.message))
                }
              }}
            >
              Test Connection
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="derived-peg" className="space-y-6">
          <DerivedPegManager
            derivedPegSettings={settings?.derivedPegSettings || { formulas: [], settings: {} }}
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
          
          {/* 설정 초기화 섹션 추가 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-orange-500" />
                설정 초기화
              </CardTitle>
              <CardDescription>
                Dashboard, Statistics, Database 설정을 기본값으로 초기화합니다. 이 작업은 되돌릴 수 없습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-orange-800">주의사항</h4>
                    <ul className="text-sm text-orange-700 space-y-1">
                      <li>• Dashboard의 선택된 PEG 목록이 초기화됩니다</li>
                      <li>• Statistics의 기본 설정이 초기화됩니다</li>
                      <li>• Database 연결 설정이 기본값으로 초기화됩니다</li>
                      <li>• 이 작업은 되돌릴 수 없습니다</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">초기화할 설정</p>
                  <p className="text-xs text-muted-foreground">
                    Dashboard, Statistics, Database 설정을 기본값으로 초기화
                  </p>
                </div>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const confirmed = window.confirm(
                      '정말로 Dashboard, Statistics, Database 설정을 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.'
                    )
                    
                    if (confirmed) {
                      try {
                        const result = await resetSettings(['dashboardSettings', 'statisticsSettings', 'databaseSettings'])
                        if (result.success) {
                          alert('✅ 설정이 성공적으로 초기화되었습니다!')
                        } else {
                          alert('❌ 설정 초기화 실패: ' + (result.error || '알 수 없는 오류'))
                        }
                      } catch (error) {
                        alert('❌ 설정 초기화 중 오류 발생: ' + error.message)
                      }
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      초기화 중...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      설정 초기화
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
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
                  선택된 PEG: {settings?.dashboardSettings?.selectedPegs?.length || 0}개
                </p>
                <p className="text-xs text-muted-foreground">
                  PEG 소스: {useDbPegs ? `DB (${dbPegOptions.length}개)` : '기본 KPI'}
                </p>
                <p className="text-xs text-muted-foreground">
                  차트 스타일: {settings?.dashboardSettings?.chartStyle || 'line'}
                </p>

              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Statistics</h4>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  기본 기간: {settings?.statisticsSettings?.defaultDateRange || 7}일
                </p>
                <p className="text-xs text-muted-foreground">
                  소수점: {settings?.statisticsSettings?.decimalPlaces || 2}자리
                </p>
                <p className="text-xs text-muted-foreground">
                  비교 옵션: {settings?.statisticsSettings?.showComparisonOptions ? '활성' : '비활성'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">알림</h4>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  알림: {settings?.notificationSettings?.enableNotifications ? '활성' : '비활성'}
                </p>
                <p className="text-xs text-muted-foreground">
                  이메일: {settings?.notificationSettings?.emailNotifications ? '활성' : '비활성'}
                </p>
                <p className="text-xs text-muted-foreground">
                  소리: {settings?.notificationSettings?.soundEnabled ? '활성' : '비활성'}
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
