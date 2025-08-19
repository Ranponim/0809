import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { usePreference } from '@/contexts/PreferenceContext.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Search, Filter, BarChart3, Clock, Settings, Info, TrendingUp } from 'lucide-react'
import AdvancedChart from './AdvancedChart.jsx'
import BasicComparison from './BasicComparison.jsx'
import apiClient from '@/lib/apiClient.js'
import { toast } from 'sonner'
import { useStatisticsSettings } from '@/hooks/usePreference.js'

const Statistics = () => {
  // usePreference 훅 사용
  const {
    settings: statisticsSettings,
    updateSettings: updateStatisticsSettings,
    saving,
    error: settingsError
  } = useStatisticsSettings()

  // 설정에서 기본값 추출
  const defaultDateRange = statisticsSettings.defaultDateRange || 7
  const defaultNe = statisticsSettings.defaultNe || ''
  const defaultCellId = statisticsSettings.defaultCellId || ''
  const decimalPlaces = statisticsSettings.decimalPlaces || 2
  const showComparisonOptions = statisticsSettings.showComparisonOptions !== false
  const autoCalculateStats = statisticsSettings.autoCalculateStats !== false

  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - defaultDateRange * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    ne: defaultNe,
    cellid: defaultCellId
  })
  
  const [chartData, setChartData] = useState([])
  // Preference의 공통 DB 설정 사용
  const { settings } = usePreference()
  const dbConfig = settings?.databaseSettings || { host: '', port: 5432, user: '', password: '', dbname: '', table: 'summary' }
  const [dbTestResult, setDbTestResult] = useState({ status: 'idle', message: '' })
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [dataSource, setDataSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [pegs, setPegs] = useState([])
  const [cells, setCells] = useState([])
  const [neSuggest, setNeSuggest] = useState([])
  const [cellSuggest, setCellSuggest] = useState([])

  const defaultKpiOptions = [
    { value: 'availability', label: 'Availability' },
    { value: 'rrc', label: 'RRC Success Rate' },
    { value: 'erab', label: 'ERAB Success Rate' },
    { value: 'sar', label: 'SAR' },
    { value: 'mobility_intra', label: 'Mobility Intra' },
    { value: 'cqi', label: 'CQI' },
    { value: 'se', label: 'Spectral Efficiency' },
    { value: 'dl_thp', label: 'DL Throughput' },
    { value: 'ul_int', label: 'UL Interference' }
  ]

  const [kpiOptions, setKpiOptions] = useState(defaultKpiOptions)

  // 설정 변경 시 필터 기본값 업데이트
  useEffect(() => {
    console.log('[Statistics] 설정 변경 감지:', {
      defaultDateRange,
      defaultNe,
      defaultCellId,
      decimalPlaces
    })

    setFilters(prev => ({
      ...prev,
      startDate: new Date(Date.now() - defaultDateRange * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ne: defaultNe,
      cellid: defaultCellId
    }))
  }, [defaultDateRange, defaultNe, defaultCellId])

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        console.info('[Statistics] Fetching master PEGs/Cells')
        const [pegsResponse, cellsResponse] = await Promise.all([
          apiClient.get('/api/master/pegs'),
          apiClient.get('/api/master/cells')
        ])
        setPegs(pegsResponse.data.pegs || [])
        setCells(cellsResponse.data.cells || [])
        console.info('[Statistics] Master loaded:', pegsResponse.data.pegs?.length || 0, cellsResponse.data.cells?.length || 0)
      } catch (error) {
        console.error('Error fetching master data:', error)
      }
    }

    fetchMasterData()
  }, [])

  const handleSearch = async () => {
    try {
      setLoading(true)
      console.info('[Statistics] 검색 시작:', {
        filters,
        decimalPlaces,
        autoCalculateStats
      })

      const kpiTypes = (kpiOptions || []).map(o => o.value)
      
      // 새로운 API 형식으로 요청
      const requests = kpiTypes.map(kt =>
        apiClient.post('/api/kpi/query', {
          start_date: filters.startDate,
          end_date: filters.endDate,
          kpi_type: kt,
          ne: filters.ne,
          cellid: filters.cellid,
          ids: 2 // Mock 데이터용
        })
      )
      
      const responses = await Promise.all(requests)
      
      // 데이터 소스 설정
      setDataSource(responses[0]?.data?.source || 'Mock API')
      
      const perKpiData = {}
      responses.forEach((res, idx) => {
        perKpiData[kpiTypes[idx]] = res?.data?.data || []
      })
      
      console.info('[Statistics] KPI 데이터 로드 완료:', {
        kpiCount: kpiTypes.length,
        totalRows: Object.values(perKpiData).reduce((sum, arr) => sum + arr.length, 0)
      })
      
      // decimalPlaces 설정을 반영한 데이터 포맷팅
      const formattedData = formatBatchChartData(perKpiData, kpiTypes)
      setChartData(formattedData)
      
      if (autoCalculateStats && formattedData.length > 0) {
        console.info('[Statistics] 자동 통계 계산 활성화됨')
        // 통계 자동 계산 로직은 추후 구현
      }
      
    } catch (error) {
      console.error('[Statistics] 검색 오류:', error)
      toast.error('데이터 조회 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const fetchNeSuggest = async (q='') => {
    try {
      const res = await apiClient.post('/api/master/ne-list', {
        db: dbConfig,
        table: dbConfig.table || 'summary',
        columns: { ne: 'ne', time: 'datetime' },
        q,
        start_date: filters.startDate,
        end_date: filters.endDate,
        limit: 50,
      })
      setNeSuggest(res?.data?.items || [])
    } catch {}
  }

  const fetchCellSuggest = async (q='') => {
    try {
      const res = await apiClient.post('/api/master/cellid-list', {
        db: dbConfig,
        table: dbConfig.table || 'summary',
        columns: { cellid: 'cellid', time: 'datetime' },
        q,
        start_date: filters.startDate,
        end_date: filters.endDate,
        limit: 50,
      })
      setCellSuggest(res?.data?.items || [])
    } catch {}
  }

  const handleSaveDbConfig = () => {
    try {
      localStorage.setItem('dbConfig', JSON.stringify(dbConfig))
      const ts = new Date().toLocaleString()
      setLastSavedAt(ts)
      toast.success('Database settings saved')
    } catch (e) {
      toast.error('Failed to save settings')
    }
  }

  const handleTestConnection = async () => {
    setDbTestResult({ status: 'testing', message: '' })
    try {
      // 백엔드 라우터: /api/master/test-connection 사용
      const res = await apiClient.post('/api/master/test-connection', {
        host: dbConfig.host,
        port: Number(dbConfig.port) || 5432,
        user: dbConfig.user,
        password: dbConfig.password,
        dbname: dbConfig.dbname,
        table: dbConfig.table || undefined,
      })
      if (res?.data?.ok) {
        setDbTestResult({ status: 'ok', message: 'Connection successful' })
        toast.success('DB connection OK')
      } else {
        setDbTestResult({ status: 'fail', message: 'Unexpected response' })
        toast.error('DB connection failed')
      }
    } catch (e) {
      const detail = e?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (detail?.error_message || e?.message || 'Connection failed')
      setDbTestResult({ status: 'fail', message: String(msg) })
      toast.error(`DB connection failed: ${msg}`)
    }
  }

  const formatBatchChartData = (batchData, kpiTypes) => {
    const timeMap = {}
    kpiTypes.forEach((kt) => {
      const rows = Array.isArray(batchData[kt]) ? batchData[kt] : []
      const tmp = {}
      rows.forEach(row => {
        const t = new Date(row.timestamp).toLocaleString()
        if (!tmp[t]) tmp[t] = { sum: 0, cnt: 0 }
        tmp[t].sum += Number(row.value) || 0
        tmp[t].cnt += 1
      })
      Object.keys(tmp).forEach(t => {
        if (!timeMap[t]) timeMap[t] = { time: t }
        // decimalPlaces 설정 반영
        const avg = tmp[t].cnt > 0 ? +(tmp[t].sum / tmp[t].cnt).toFixed(decimalPlaces) : 0
        timeMap[t][kt] = avg
      })
    })
    return Object.values(timeMap).sort((a, b) => new Date(a.time) - new Date(b.time)).slice(0, 200)
  }

  const seriesKeys = chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Statistics</h2>
          <p className="text-muted-foreground">
            기본 날짜 범위: {defaultDateRange}일 • 소수점: {decimalPlaces}자리
            {defaultNe && ` • 기본 NE: ${defaultNe}`}
            {defaultCellId && ` • 기본 Cell: ${defaultCellId}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 상태 뱃지들 */}
          {saving && (
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              설정 저장 중
            </Badge>
          )}
          
          {settingsError && (
            <Badge variant="destructive" className="text-xs">
              설정 오류
            </Badge>
          )}

          {autoCalculateStats && (
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              자동 통계 계산
            </Badge>
          )}

          {showComparisonOptions && (
            <Badge variant="outline" className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1" />
              비교 옵션 활성
            </Badge>
          )}
        </div>
      </div>

      {/* 설정 요약 */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">
          기본 기간: {defaultDateRange}일
        </Badge>
        <Badge variant="outline">
          소수점: {decimalPlaces}자리
        </Badge>
        {autoCalculateStats && (
          <Badge variant="secondary">자동 통계 계산</Badge>
        )}
        {showComparisonOptions && (
          <Badge variant="secondary">비교 옵션</Badge>
        )}
      </div>
      {/* Database 설정 UI 제거: Preference > Database에서 관리합니다. */}
      
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Basic Analysis</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-6">
          <BasicComparison />
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-6">
          <AdvancedChart />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Statistics

