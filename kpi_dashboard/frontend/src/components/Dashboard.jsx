import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import axios from 'axios'

const Dashboard = () => {
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)

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
        
        const promises = kpiTypes.map(async (kpi) => {
          const response = await axios.get(`http://localhost:8000/api/kpi/statistics`, {
            params: {
              start_date: startDate,
              end_date: endDate,
              kpi_type: kpi.key,
              entity_ids: 'LHK078ML1,LHK078MR1'
            }
          })
          return { [kpi.key]: response.data.data }
        })

        const results = await Promise.all(promises)
        const combinedData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
        setKpiData(combinedData)
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
          {kpiTypes.map((kpi) => (
            <Card key={kpi.key}>
              <CardHeader>
                <CardTitle>{kpi.title}</CardTitle>
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
        {kpiTypes.map((kpi) => {
          const chartData = formatChartData(kpiData[kpi.key] || [])
          const entities = chartData.length > 0 ? Object.keys(chartData[0]).filter(key => key !== 'time') : []
          
          return (
            <Card key={kpi.key}>
              <CardHeader>
                <CardTitle>{kpi.title}</CardTitle>
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
                          stroke={index === 0 ? kpi.color : `hsl(${index * 60}, 70%, 50%)`}
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

