import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { TrendingUp, BarChart3 } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'

const AdvancedChart = () => {
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

  const defaultKpiOptions = [
    { value: 'availability', label: 'Availability (%)', threshold: 99.0 },
    { value: 'rrc', label: 'RRC Success Rate (%)', threshold: 98.5 },
    { value: 'erab', label: 'ERAB Success Rate (%)', threshold: 99.0 },
    { value: 'sar', label: 'SAR', threshold: 2.5 },
    { value: 'mobility_intra', label: 'Mobility Intra (%)', threshold: 95.0 },
    { value: 'cqi', label: 'CQI', threshold: 8.0 }
  ]

  const [kpiOptions, setKpiOptions] = useState(defaultKpiOptions)
  const [dbPegOptions, setDbPegOptions] = useState([])
  const [useDbPegs, setUseDbPegs] = useState(false)

  useEffect(()=>{
    // Preference에서 availableKPIs 로드 (없으면 기본값)
    try {
      const raw = localStorage.getItem('activePreference')
      if (raw) {
        const parsed = JSON.parse(raw)
        const opts = Array.isArray(parsed?.config?.availableKPIs) && parsed.config.availableKPIs.length > 0
          ? parsed.config.availableKPIs.map(o => ({ value: String(o.value), label: String(o.label || o.value), threshold: Number(o.threshold ?? 0) }))
          : defaultKpiOptions
        setKpiOptions(opts)
        // 현재 선택된 KPI가 목록에 없으면 기본으로 보정
        const values = opts.map(o => o.value)
        setChartConfig(prev => ({
          ...prev,
          primaryKPI: values.includes(prev.primaryKPI) ? prev.primaryKPI : (opts[0]?.value || 'availability'),
          secondaryKPI: values.includes(prev.secondaryKPI) ? prev.secondaryKPI : (opts[1]?.value || opts[0]?.value || 'rrc'),
          thresholdValue: (opts.find(o=>o.value=== (values.includes(prev.primaryKPI)? prev.primaryKPI : (opts[0]?.value || 'availability')))?.threshold) ?? prev.thresholdValue
        }))
      }
    } catch {
      setKpiOptions(defaultKpiOptions)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // DB에서 실제 PEG 목록 가져오기
  const fetchDbPegs = async () => {
    try {
      setPegOptionsLoading(true)
      console.info('[AdvancedChart] Fetching DB PEGs')
      
      // DB 설정 로드
      let dbConfig = {}
      try {
        const rawDb = localStorage.getItem('dbConfig')
        if (rawDb) dbConfig = JSON.parse(rawDb)
      } catch {}

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
  }

  // 현재 사용할 KPI 옵션 결정
  const getCurrentKpiOptions = () => {
    if (useDbPegs && dbPegOptions.length > 0) {
      return dbPegOptions
    }
    return kpiOptions
  }

  const generateChart = async () => {
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
  }

  const formatAdvancedChartData = (results, config) => {
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
  }

  const getDataKeys = () => {
    if (chartData.length === 0) return { primary: [], secondary: [] }
    
    const allKeys = Object.keys(chartData[0]).filter(key => key !== 'time')
    const primary = allKeys.filter(key => key.endsWith('_period1') || key.endsWith('_period2'))
    const secondary = allKeys.filter(key => key.endsWith('_secondary'))
    
    return { primary, secondary }
  }

  const { primary: primaryKeys, secondary: secondaryKeys } = getDataKeys()

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
          {/* DB PEG 옵션 토글 */}
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">PEG 데이터 소스</Label>
                <p className="text-xs text-muted-foreground">
                  {useDbPegs ? 'Database에서 실제 PEG 목록을 사용합니다' : '기본 KPI 목록을 사용합니다'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={useDbPegs ? "secondary" : "default"}
                  size="sm"
                  onClick={() => setUseDbPegs(false)}
                >
                  기본 KPI
                </Button>
                <Button
                  variant={useDbPegs ? "default" : "secondary"}
                  size="sm"
                  onClick={() => {
                    setUseDbPegs(true)
                    if (dbPegOptions.length === 0) {
                      fetchDbPegs()
                    }
                  }}
                  disabled={pegOptionsLoading}
                >
                  {pegOptionsLoading ? '로딩 중...' : 'DB PEG'}
                </Button>
              </div>
            </div>
            {useDbPegs && dbPegOptions.length === 0 && !pegOptionsLoading && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ DB PEG를 불러올 수 없습니다. Database Settings를 확인하세요.
              </p>
            )}
            {useDbPegs && dbPegOptions.length > 0 && (
              <p className="text-xs text-green-600 mt-2">
                ✅ {dbPegOptions.length}개의 DB PEG를 사용할 수 있습니다
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Primary KPI */}
            <div className="space-y-2">
              <Label>Primary KPI</Label>
              <Select 
                value={chartConfig.primaryKPI} 
                onValueChange={(value) => setChartConfig(prev => ({ ...prev, primaryKPI: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getCurrentKpiOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secondary KPI */}
            <div className="space-y-2">
              <Label>Secondary KPI (Dual Axis)</Label>
              <Select 
                value={chartConfig.secondaryKPI} 
                onValueChange={(value) => setChartConfig(prev => ({ ...prev, secondaryKPI: value }))}
                disabled={!chartConfig.showSecondaryAxis}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getCurrentKpiOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period 1 Dates */}
            <div className="space-y-2">
              <Label>Period 1 Start</Label>
              <Input
                type="date"
                value={chartConfig.startDate1}
                onChange={(e) => setChartConfig(prev => ({ ...prev, startDate1: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Period 1 End</Label>
              <Input
                type="date"
                value={chartConfig.endDate1}
                onChange={(e) => setChartConfig(prev => ({ ...prev, endDate1: e.target.value }))}
              />
            </div>

            {/* Period 2 Dates */}
            <div className="space-y-2">
              <Label>Period 2 Start</Label>
              <Input
                type="date"
                value={chartConfig.startDate2}
                onChange={(e) => setChartConfig(prev => ({ ...prev, startDate2: e.target.value }))}
                disabled={!chartConfig.showComparison}
              />
            </div>

            <div className="space-y-2">
              <Label>Period 2 End</Label>
              <Input
                type="date"
                value={chartConfig.endDate2}
                onChange={(e) => setChartConfig(prev => ({ ...prev, endDate2: e.target.value }))}
                disabled={!chartConfig.showComparison}
              />
            </div>

            {/* Filters: NE / Cell ID */}
            <div className="space-y-2">
              <Label>NE</Label>
              <Input
                placeholder="e.g., nvgnb#10000 or nvgnb#10000,nvgnb#20000"
                value={chartConfig.ne}
                onChange={(e)=> setChartConfig(prev => ({ ...prev, ne: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cell ID</Label>
              <Input
                placeholder="e.g., 2010 or 2010,2011"
                value={chartConfig.cellid}
                onChange={(e)=> setChartConfig(prev => ({ ...prev, cellid: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Use Preference (NE/Cell)</Label>
              <Button
                type="button"
                variant="outline"
                onClick={()=>{
                  try {
                    const raw = localStorage.getItem('activePreference')
                    if (!raw) return
                    const pref = JSON.parse(raw)
                    const defNEs = Array.isArray(pref?.config?.defaultNEs) ? pref.config.defaultNEs.map(String) : []
                    const defCellIDs = Array.isArray(pref?.config?.defaultCellIDs) ? pref.config.defaultCellIDs.map(String) : []
                    setChartConfig(prev => ({
                      ...prev,
                      ne: defNEs.join(','),
                      cellid: defCellIDs.join(','),
                    }))
                  } catch {}
                }}
              >
                Load from Preference
              </Button>
            </div>
          </div>

          {/* Options */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showComparison"
                checked={chartConfig.showComparison}
                onCheckedChange={(checked) => setChartConfig(prev => ({ ...prev, showComparison: checked }))}
              />
              <Label htmlFor="showComparison">Show Period Comparison</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showSecondaryAxis"
                checked={chartConfig.showSecondaryAxis}
                onCheckedChange={(checked) => setChartConfig(prev => ({ ...prev, showSecondaryAxis: checked }))}
              />
              <Label htmlFor="showSecondaryAxis">Show Secondary Y-Axis</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showThreshold"
                checked={chartConfig.showThreshold}
                onCheckedChange={(checked) => setChartConfig(prev => ({ ...prev, showThreshold: checked }))}
              />
              <Label htmlFor="showThreshold">Show Threshold Line</Label>
            </div>

            {chartConfig.showThreshold && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="threshold">Threshold Value:</Label>
                <Input
                  id="threshold"
                  type="number"
                  step="0.1"
                  value={chartConfig.thresholdValue}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, thresholdValue: parseFloat(e.target.value) }))}
                  className="w-24"
                />
              </div>
            )}
          </div>

          <div className="mt-4">
            <Button onClick={generateChart} disabled={loading} className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {loading ? 'Generating...' : 'Generate Chart'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart Display */}
      <Card>
        <CardHeader>
          <CardTitle>
            {getCurrentKpiOptions().find(opt => opt.value === chartConfig.primaryKPI)?.label || 'KPI'} Analysis
            {chartConfig.showSecondaryAxis && ` vs ${getCurrentKpiOptions().find(opt => opt.value === chartConfig.secondaryKPI)?.label}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  {chartConfig.showSecondaryAxis && <YAxis yAxisId="right" orientation="right" />}
                  <Tooltip />
                  <Legend />
                  
                  {/* Threshold line */}
                  {chartConfig.showThreshold && (
                    <ReferenceLine 
                      y={chartConfig.thresholdValue} 
                      stroke="red" 
                      strokeDasharray="5 5" 
                      yAxisId="left"
                    />
                  )}
                  
                  {/* Primary KPI lines */}
                  {primaryKeys.map((key, index) => (
                    <Line
                      key={key}
                      yAxisId="left"
                      type="monotone"
                      dataKey={key}
                      stroke={key.includes('period1') ? `hsl(${index * 60}, 70%, 40%)` : `hsl(${index * 60}, 70%, 60%)`}
                      strokeWidth={2}
                      strokeDasharray={key.includes('period1') ? "0" : "5 5"}
                    />
                  ))}
                  
                  {/* Secondary KPI lines */}
                  {chartConfig.showSecondaryAxis && secondaryKeys.map((key, index) => (
                    <Line
                      key={key}
                      yAxisId="right"
                      type="monotone"
                      dataKey={key}
                      stroke={`hsl(${(index + primaryKeys.length) * 60}, 70%, 50%)`}
                      strokeWidth={2}
                      strokeDasharray="10 5"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {loading ? 'Generating chart...' : 'Click "Generate Chart" to create visualization'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdvancedChart

