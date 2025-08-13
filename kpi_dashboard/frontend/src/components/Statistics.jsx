import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Search, Filter, BarChart3 } from 'lucide-react'
import AdvancedChart from './AdvancedChart.jsx'
import apiClient from '@/lib/apiClient.js'
import { toast } from 'sonner'

const Statistics = () => {
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    ne: '',
    cellid: ''
  })
  
  const [chartData, setChartData] = useState([])
  const [dbConfig, setDbConfig] = useState({
    host: '', port: 5432, user: '', password: '', dbname: '', table: 'summary'
  })
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

  useEffect(() => {
    // Preference에서 availableKPIs 로드 (없으면 기본값 유지)
    try {
      const raw = localStorage.getItem('activePreference')
      if (raw) {
        const parsed = JSON.parse(raw)
        const opts = Array.isArray(parsed?.config?.availableKPIs) && parsed.config.availableKPIs.length > 0
          ? parsed.config.availableKPIs.map(o => ({ value: String(o.value), label: String(o.label || o.value) }))
          : defaultKpiOptions
        setKpiOptions(opts)
        console.info('[Statistics] availableKPIs loaded from Preference:', opts)
      } else {
        console.info('[Statistics] No activePreference, using defaults')
      }
    } catch {
      setKpiOptions(defaultKpiOptions)
    }
    // DB 설정 로컬 저장소에서 로드
    try {
      const rawDb = localStorage.getItem('dbConfig')
      if (rawDb) {
        const parsed = JSON.parse(rawDb)
        setDbConfig(prev => ({ ...prev, ...parsed }))
        console.info('[Statistics] Loaded dbConfig from localStorage')
      }
    } catch {}
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
      console.info('[Statistics] Search click:', filters, dbConfig)
      const kpiTypes = (kpiOptions || []).map(o => o.value)
      let kpiMap = {}
      try {
        const raw = localStorage.getItem('activePreference')
        if (raw) {
          const parsed = JSON.parse(raw)
          kpiMap = parsed?.config?.kpiMappings || {}
        }
      } catch {}
      // 각 KPI에 대해 DB 프록시 쿼리를 병렬 호출 (필터: ne/cellid 적용)
      const requests = kpiTypes.map(kt =>
        apiClient.post('/api/kpi/query', {
          db: dbConfig,
          table: dbConfig.table || 'summary',
          start_date: filters.startDate,
          end_date: filters.endDate,
          kpi_type: kt,
          kpi_peg_names: Array.isArray(kpiMap?.[kt]?.peg_names) ? kpiMap[kt].peg_names : undefined,
          kpi_peg_like: Array.isArray(kpiMap?.[kt]?.peg_like) ? kpiMap[kt].peg_like : undefined,
          ne: filters.ne,
          cellid: filters.cellid,
        })
      )
      const responses = await Promise.all(requests)
      // 가능한 source 표시는 첫 응답 기준으로 설정
      setDataSource(responses[0]?.data?.source || '')
      const perKpiData = {}
      responses.forEach((res, idx) => {
        perKpiData[kpiTypes[idx]] = res?.data?.data || []
      })
      console.info('[Statistics] Query per KPI done:', kpiTypes.length)
      const formattedData = formatBatchChartData(perKpiData, kpiTypes)
      setChartData(formattedData)
    } catch (error) {
      console.error('Error fetching statistics:', error)
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
      const res = await apiClient.post('/api/db/ping', { db: dbConfig })
      if (res?.data?.ok) {
        setDbTestResult({ status: 'ok', message: 'Connection successful' })
        toast.success('DB connection OK')
      } else {
        setDbTestResult({ status: 'fail', message: 'Unexpected response' })
        toast.error('DB connection failed')
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Connection failed'
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
        const avg = tmp[t].cnt > 0 ? +(tmp[t].sum / tmp[t].cnt).toFixed(2) : 0
        timeMap[t][kt] = avg
      })
    })
    return Object.values(timeMap).sort((a, b) => new Date(a.time) - new Date(b.time)).slice(0, 200)
  }

  const seriesKeys = chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Statistics</h2>
      {/* DB 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>Database Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" value={dbConfig.host} onChange={(e)=>setDbConfig(prev=>({...prev, host: e.target.value}))} placeholder="127.0.0.1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" value={dbConfig.port} onChange={(e)=>setDbConfig(prev=>({...prev, port: Number(e.target.value||5432)}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Input id="user" value={dbConfig.user} onChange={(e)=>setDbConfig(prev=>({...prev, user: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={dbConfig.password} onChange={(e)=>setDbConfig(prev=>({...prev, password: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dbname">DB Name</Label>
              <Input id="dbname" value={dbConfig.dbname} onChange={(e)=>setDbConfig(prev=>({...prev, dbname: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="table">Table</Label>
              <Input id="table" value={dbConfig.table} onChange={(e)=>setDbConfig(prev=>({...prev, table: e.target.value}))} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={handleSaveDbConfig}>Save Settings</Button>
            <Button onClick={handleTestConnection} disabled={dbTestResult.status === 'testing'}>
              {dbTestResult.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            <div className="text-sm text-gray-500">
              {lastSavedAt ? `Saved: ${lastSavedAt}` : 'Not saved yet'}
              {dbTestResult.status === 'ok' && ' · DB: OK'}
              {dbTestResult.status === 'fail' && ` · DB: FAIL (${dbTestResult.message})`}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Basic Analysis</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ne">NE</Label>
                    <Input
                      id="ne"
                      list="ne-list"
                      placeholder="e.g., nvgnb#10000 or nvgnb#10000,nvgnb#20000"
                      value={filters.ne || ''}
                      onFocus={() => fetchNeSuggest('')}
                      onChange={(e) => { setFilters(prev => ({ ...prev, ne: e.target.value })); fetchNeSuggest(e.target.value.split(',').pop().trim()) }}
                    />
                    <datalist id="ne-list">
                      {neSuggest.map(item => (<option value={item} key={item} />))}
                    </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cellid">Cell ID</Label>
                    <Input
                      id="cellid"
                      list="cellid-list"
                      placeholder="e.g., 2010 or 2010,2011"
                      value={filters.cellid || ''}
                      onFocus={() => fetchCellSuggest('')}
                      onChange={(e) => { setFilters(prev => ({ ...prev, cellid: e.target.value })); fetchCellSuggest(e.target.value.split(',').pop().trim()) }}
                    />
                    <datalist id="cellid-list">
                      {cellSuggest.map(item => (<option value={item} key={item} />))}
                    </datalist>
                </div>
              </div>
              
              <div className="mt-4">
                <Button onClick={handleSearch} disabled={loading} className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics (Preference KPIs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {seriesKeys.map((key, index) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={`hsl(${(index * 47) % 360}, 70%, 50%)`}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {loading ? 'Loading...' : 'No data available. Please search with different filters.'}
                  </div>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {dataSource ? `Data source: ${dataSource}` : ''}
              </div>
            </CardContent>
          </Card>

          {/* Master Data Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Available PEGs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pegs.map((peg) => (
                    <div key={peg.id} className="flex justify-between">
                      <span className="font-medium">{peg.id}</span>
                      <span className="text-gray-500">{peg.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Cells</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cells.map((cell) => (
                    <div key={cell.id} className="flex justify-between">
                      <span className="font-medium">{cell.id}</span>
                      <span className="text-gray-500">{cell.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-6">
          <AdvancedChart />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Statistics

