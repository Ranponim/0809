import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { BarChart3 } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'

import ChartControls from './chart/ChartControls.jsx'
import ChartDisplay from './chart/ChartDisplay.jsx'

const defaultKpiOptions = [
  { value: 'availability', label: 'Availability (%)', threshold: 99.0 },
  { value: 'rrc', label: 'RRC Success Rate (%)', threshold: 98.5 },
  { value: 'erab', label: 'ERAB Success Rate (%)', threshold: 99.0 },
  { value: 'sar', label: 'SAR', threshold: 2.5 },
  { value: 'mobility_intra', label: 'Mobility Intra (%)', threshold: 95.0 },
  { value: 'cqi', label: 'CQI', threshold: 8.0 }
]

const AdvancedChart = memo(() => {
  const [chartConfig, setChartConfig] = useState({
    primaryKPI: 'availability',
    secondaryKPI: 'rrc',
    startDate1: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    startDate2: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate2: new Date().toISOString().split('T')[0],
    ne: '',
    cellid: '',
    showSecondaryAxis: true,
    showComparison: true,
    showThreshold: true,
    thresholdValue: 99.0
  })

  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pegOptionsLoading, setPegOptionsLoading] = useState(false)
  const [kpiOptions, setKpiOptions] = useState(defaultKpiOptions)
  const [dbPegOptions, setDbPegOptions] = useState([])
  const [useDbPegs, setUseDbPegs] = useState(false)

  // 현재 사용할 KPI 옵션 결정
  const getCurrentKpiOptions = useMemo(() => {
    if (useDbPegs && dbPegOptions.length > 0) {
      return dbPegOptions
    }
    return kpiOptions
  }, [useDbPegs, dbPegOptions, kpiOptions])

  

  // DB에서 실제 PEG 목록 가져오기
  const fetchDbPegs = useCallback(async () => {
    try {
      setPegOptionsLoading(true)
      console.info('[AdvancedChart] Fetching DB PEGs')
      
      // DB 설정 로드
      let dbConfig = {}
      try {
        const rawDb = localStorage.getItem('dbConfig')
        if (rawDb) dbConfig = JSON.parse(rawDb)
      } catch (e) {
        console.error('Error parsing dbConfig from localStorage', e)
      }

      if (!dbConfig.host) {
        console.warn('[AdvancedChart] No DB config found')
        return
      }

      // DB에서 PEG 목록 조회
      const response = await apiClient.post('/api/master/pegs', {
        db: dbConfig,
        table: dbConfig.table || 'summary',
        limit: 100
      })

      const pegs = response?.data?.pegs || []
      console.info('[AdvancedChart] DB PEGs loaded:', pegs.length)

      // PEG 목록을 KPI 옵션 형식으로 변환
      const pegOptions = pegs.map(peg => ({
        value: peg.id || peg.name,
        label: `${peg.name || peg.id} (DB)`,
        threshold: 0, // 기본 임계값
        isDbPeg: true
      }))

      setDbPegOptions(pegOptions)
      
    } catch (error) {
      console.error('[AdvancedChart] Error fetching DB PEGs:', error)
    } finally {
      setPegOptionsLoading(false)
    }
  }, [])

  // 차트 데이터 포맷팅
  const formatAdvancedChartData = useCallback((results, config) => {
    if (!results || results.length === 0) return []

    const period1Data = results[0]?.data?.data || []
    const period2Data = config.showComparison && results[1] ? results[1].data.data : []
    const secondaryData = config.showSecondaryAxis && results[2] ? results[2].data.data : []

    // Aggregate by time (avg across rows) because NE/CELL filter narrows scope
    const grouped = {}
    function acc(rows, key) {
      const tmp = {}
      rows.forEach(item => {
        const t = new Date(item.timestamp).toLocaleString()
        if (!tmp[t]) tmp[t] = { sum: 0, cnt: 0 }
        tmp[t].sum += Number(item.value) || 0
        tmp[t].cnt += 1
      })
      Object.keys(tmp).forEach(t => {
        if (!grouped[t]) grouped[t] = { time: t }
        const avg = tmp[t].cnt > 0 ? +(tmp[t].sum / tmp[t].cnt).toFixed(2) : 0
        grouped[t][key] = avg
      })
    }
    acc(period1Data, `${config.primaryKPI}_period1`)
    if (config.showComparison) acc(period2Data, `${config.primaryKPI}_period2`)
    if (config.showSecondaryAxis) acc(secondaryData, `${config.secondaryKPI}_secondary`)

    return Object.values(grouped).sort((a,b)=> new Date(a.time)-new Date(b.time)).slice(0, 200)
  }, [])

  // 차트 생성
  const generateChart = useCallback(async () => {
    try {
      setLoading(true)
      console.info('[AdvancedChart] Generate with config:', chartConfig, 'useDbPegs:', useDbPegs)
      
      // Fetch primary/secondary KPI for configured periods with NE/CELL filters
      const promises = []
      
      // Period 1 data
      promises.push(
        apiClient.post('/api/kpi/query', {
          start_date: chartConfig.startDate1,
          end_date: chartConfig.endDate1,
          kpi_type: chartConfig.primaryKPI,
          ne: chartConfig.ne,
          cellid: chartConfig.cellid,
          ids: 2 // Mock 데이터용
        })
      )

      // Period 2 data
      if (chartConfig.showComparison) {
        promises.push(
          apiClient.post('/api/kpi/query', {
            start_date: chartConfig.startDate2,
            end_date: chartConfig.endDate2,
            kpi_type: chartConfig.primaryKPI,
            ne: chartConfig.ne,
            cellid: chartConfig.cellid,
            ids: 2 // Mock 데이터용
          })
        )
      }

      // Secondary KPI data (for dual axis)
      if (chartConfig.showSecondaryAxis && chartConfig.secondaryKPI !== chartConfig.primaryKPI) {
        promises.push(
          apiClient.post('/api/kpi/query', {
            start_date: chartConfig.startDate2,
            end_date: chartConfig.endDate2,
            kpi_type: chartConfig.secondaryKPI,
            ne: chartConfig.ne,
            cellid: chartConfig.cellid,
            ids: 2 // Mock 데이터용
          })
        )
      }

      const results = await Promise.all(promises)
      console.info('[AdvancedChart] API responses:', results.map(r=>r?.data?.data?.length ?? 0))
      
      // Process and combine data
      const formattedData = formatAdvancedChartData(results, chartConfig)
      setChartData(formattedData)
      
    } catch (error) {
      console.error('[AdvancedChart] Error generating advanced chart:', error)
    } finally {
      setLoading(false)
    }
  }, [chartConfig, useDbPegs, formatAdvancedChartData])

  

  // 초기 KPI 옵션 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem('activePreference')
      if (raw) {
        const parsed = JSON.parse(raw)
        const opts = Array.isArray(parsed?.config?.availableKPIs) && parsed.config.availableKPIs.length > 0
          ? parsed.config.availableKPIs.map((item) => ({ 
              value: String(item?.value || ''), 
              label: String(item?.label || item?.value || ''), 
              threshold: Number(item?.threshold ?? 0) 
            }))
          : defaultKpiOptions
        setKpiOptions(opts)
        // 현재 선택된 KPI가 목록에 없으면 기본으로 보정
        const values = opts.map((item) => item.value)
        setChartConfig(prev => ({
          ...prev,
          primaryKPI: values.includes(prev.primaryKPI) ? prev.primaryKPI : (opts[0]?.value || 'availability'),
          secondaryKPI: values.includes(prev.secondaryKPI) ? prev.secondaryKPI : (opts[1]?.value || opts[0]?.value || 'rrc'),
          thresholdValue: (opts.find((item) => item.value === (values.includes(prev.primaryKPI) ? prev.primaryKPI : (opts[0]?.value || 'availability')))?.threshold) ?? prev.thresholdValue
        }))
      }
    } catch {
      setKpiOptions(defaultKpiOptions)
    }
  }, [])

  // DB PEG 자동 로드
  useEffect(() => {
    if (useDbPegs && dbPegOptions.length === 0) {
      fetchDbPegs()
    }
  }, [useDbPegs, dbPegOptions.length, fetchDbPegs])

  

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Advanced Chart Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartControls
            chartConfig={chartConfig}
            onConfigChange={setChartConfig}
            kpiOptions={kpiOptions}
            loading={loading}
            onGenerate={generateChart}
            useDbPegs={useDbPegs}
            pegOptionsLoading={pegOptionsLoading}
            dbPegOptions={dbPegOptions}
          />
        </CardContent>
      </Card>

      {/* Chart Display */}
      <Card>
        <CardHeader>
          <CardTitle>
            {getCurrentKpiOptions.find(opt => opt.value === chartConfig.primaryKPI)?.label || 'KPI'} Analysis
            {chartConfig.showSecondaryAxis && ` vs ${getCurrentKpiOptions.find(opt => opt.value === chartConfig.secondaryKPI)?.label}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartDisplay
            chartData={chartData}
            chartConfig={chartConfig}
            loading={loading}
            kpiOptions={kpiOptions}
            useDbPegs={useDbPegs}
            dbPegOptions={dbPegOptions}
          />
        </CardContent>
      </Card>
    </div>
  )
})

AdvancedChart.displayName = 'AdvancedChart'

export default AdvancedChart