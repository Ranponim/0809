import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Search, Filter, BarChart3 } from 'lucide-react'
import AdvancedChart from './AdvancedChart.jsx'
import apiClient from '@/lib/apiClient.js'

const Statistics = () => {
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    kpiType: 'availability',
    entityIds: 'LHK078ML1,LHK078MR1'
  })
  
  const [chartData, setChartData] = useState([])
  const [dbConfig, setDbConfig] = useState({
    host: '', port: 5432, user: '', password: '', dbname: '', table: 'summary'
  })
  const [loading, setLoading] = useState(false)
  const [pegs, setPegs] = useState([])
  const [cells, setCells] = useState([])

  const kpiOptions = [
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

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [pegsResponse, cellsResponse] = await Promise.all([
          apiClient.get('/api/master/pegs'),
          apiClient.get('/api/master/cells')
        ])
        setPegs(pegsResponse.data.pegs || [])
        setCells(cellsResponse.data.cells || [])
      } catch (error) {
        console.error('Error fetching master data:', error)
      }
    }

    fetchMasterData()
  }, [])

  const handleSearch = async () => {
    try {
      setLoading(true)
      const response = await apiClient.post('/api/kpi/query', {
        db: dbConfig,
        table: dbConfig.table || 'summary',
        start_date: filters.startDate,
        end_date: filters.endDate,
        kpi_type: filters.kpiType,
        entity_ids: filters.entityIds
      })

      const data = response.data.data || []
      const formattedData = formatChartData(data)
      setChartData(formattedData)
    } catch (error) {
      console.error('Error fetching statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatChartData = (data) => {
    if (!data || data.length === 0) return []
    
    const groupedByTime = data.reduce((acc, item) => {
      const time = new Date(item.timestamp).toLocaleString()
      if (!acc[time]) acc[time] = { time }
      acc[time][item.entity_id] = item.value
      return acc
    }, {})

    return Object.values(groupedByTime).slice(0, 50) // Limit to 50 points for better performance
  }

  const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []

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
                  <Label htmlFor="kpiType">KPI Type</Label>
                  <Select value={filters.kpiType} onValueChange={(value) => setFilters(prev => ({ ...prev, kpiType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select KPI Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {kpiOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="entityIds">Entity IDs</Label>
                  <Input
                    id="entityIds"
                    placeholder="e.g., LHK078ML1,LHK078MR1"
                    value={filters.entityIds}
                    onChange={(e) => setFilters(prev => ({ ...prev, entityIds: e.target.value }))}
                  />
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
              <CardTitle>
                {kpiOptions.find(opt => opt.value === filters.kpiType)?.label || 'KPI'} Statistics
              </CardTitle>
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
                      {entities.map((entity, index) => (
                        <Line
                          key={entity}
                          type="monotone"
                          dataKey={entity}
                          stroke={`hsl(${index * 60}, 70%, 50%)`}
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

