import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import apiClient from '@/lib/apiClient.js'

const Dashboard = () => {
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)
  const [kpiKeys, setKpiKeys] = useState([])
  const [entityList, setEntityList] = useState([])

  const defaultKpiKeys = ['availability','rrc','erab','sar','mobility_intra','cqi']

  const titleFor = (key) => ({
    availability: 'Availability (%)',
    rrc: 'RRC Success Rate (%)',
    erab: 'ERAB Success Rate (%)',
    sar: 'SAR',
    mobility_intra: 'Mobility Intra (%)',
    cqi: 'CQI',
  }[key] || key)

  const colorFor = (index) => {
    const preset = ['#8884d8','#82ca9d','#ffc658','#ff7300','#8dd1e1','#d084d0']
    if (index < preset.length) return preset[index]
    const hue = (index * 47) % 360
    return `hsl(${hue}, 70%, 50%)`
  }

  const kpiTypes = [
    { key: 'availability', title: 'Availability (%)', color: '#8884d8' },
    { key: 'rrc', title: 'RRC Success Rate (%)', color: '#82ca9d' },
    { key: 'erab', title: 'ERAB Success Rate (%)', color: '#ffc658' },
    { key: 'sar', title: 'SAR', color: '#ff7300' },
    { key: 'mobility_intra', title: 'Mobility Intra (%)', color: '#8dd1e1' },
    { key: 'cqi', title: 'CQI', color: '#d084d0' }
  ]

  useEffect(() => {
    const fetchKPIData = async () => {
      try {
        setLoading(true)
        const endDate = new Date().toISOString().split('T')[0]
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        // Preference 적용 (localStorage)
        let keys = defaultKpiKeys
        let ents = entityList
        let neStr = ''
        let cellidStr = ''
        try {
          const raw = localStorage.getItem('activePreference')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed?.config?.defaultKPIs) && parsed.config.defaultKPIs.length > 0) {
              keys = parsed.config.defaultKPIs.map(String)
            }
            // 새 구조: NE/CellID
            if (Array.isArray(parsed?.config?.defaultNEs)) neStr = parsed.config.defaultNEs.map(String).join(',')
            if (Array.isArray(parsed?.config?.defaultCellIDs)) cellidStr = parsed.config.defaultCellIDs.map(String).join(',')
          }
        } catch {}
        setKpiKeys(keys)
        setEntityList(ents)

        // 배치 엔드포인트 호출
        // 대시보드는 평균 시계열 표시 목적이므로 per-KPI 쿼리 후 평균 집계 포맷에 재활용 가능
        const requests = keys.map(kt => apiClient.post('/api/kpi/query', {
          start_date: startDate,
          end_date: endDate,
          kpi_type: kt,
          ne: neStr,
          cellid: cellidStr,
        }))
        const responses = await Promise.all(requests)
        const dataByKpi = {}
        responses.forEach((res, idx) => { dataByKpi[keys[idx]] = res?.data?.data || [] })
        const resp = { data: { data: dataByKpi } }
        setKpiData(resp?.data?.data || {})
      } catch (error) {
        console.error('Error fetching KPI data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchKPIData()
  }, [])

  const formatChartData = (data) => {
    if (!data || data.length === 0) return []
    
    const groupedByTime = data.reduce((acc, item) => {
      const time = new Date(item.timestamp).toLocaleDateString()
      if (!acc[time]) acc[time] = { time }
      acc[time][item.entity_id] = item.value
      return acc
    }, {})

    return Object.values(groupedByTime)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(kpiKeys && kpiKeys.length ? kpiKeys : defaultKpiKeys).map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{titleFor(key)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <div className="text-gray-500">Loading...</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(kpiKeys && kpiKeys.length ? kpiKeys : defaultKpiKeys).map((key, idx) => {
          const chartData = formatChartData(kpiData[key] || [])
          const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []
          
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{titleFor(key)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
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
                          stroke={colorFor((idx + index) % 12)}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default Dashboard

