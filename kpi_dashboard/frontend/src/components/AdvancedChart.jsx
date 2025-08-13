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
    entities: ['LHK078ML1', 'LHK078MR1'],
    showSecondaryAxis: true,
    showComparison: true,
    showThreshold: true,
    thresholdValue: 99.0
  })

  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(false)

  const kpiOptions = [
    { value: 'availability', label: 'Availability (%)', threshold: 99.0 },
    { value: 'rrc', label: 'RRC Success Rate (%)', threshold: 98.5 },
    { value: 'erab', label: 'ERAB Success Rate (%)', threshold: 99.0 },
    { value: 'sar', label: 'SAR', threshold: 2.5 },
    { value: 'mobility_intra', label: 'Mobility Intra (%)', threshold: 95.0 },
    { value: 'cqi', label: 'CQI', threshold: 8.0 }
  ]

  const generateChart = async () => {
    try {
      setLoading(true)
      
      // Fetch primary KPI data for both periods
      const promises = []
      
      // Period 1 data
      promises.push(
        apiClient.post('/api/kpi/query', {
          params: {
            // 유지: 호출 시그니처 호환성
          },
          start_date: chartConfig.startDate1,
          end_date: chartConfig.endDate1,
          kpi_type: chartConfig.primaryKPI,
          entity_ids: chartConfig.entities.join(',')
        })
      )

      // Period 2 data
      if (chartConfig.showComparison) {
        promises.push(
          apiClient.post('/api/kpi/query', {
            start_date: chartConfig.startDate2,
            end_date: chartConfig.endDate2,
            kpi_type: chartConfig.primaryKPI,
            entity_ids: chartConfig.entities.join(',')
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
            entity_ids: chartConfig.entities.join(',')
          })
        )
      }

      const results = await Promise.all(promises)
      
      // Process and combine data
      const formattedData = formatAdvancedChartData(results, chartConfig)
      setChartData(formattedData)
      
    } catch (error) {
      console.error('Error generating advanced chart:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAdvancedChartData = (results, config) => {
    if (!results || results.length === 0) return []

    const period1Data = results[0]?.data?.data || []
    const period2Data = config.showComparison && results[1] ? results[1].data.data : []
    const secondaryData = config.showSecondaryAxis && results[2] ? results[2].data.data : []

    // Group data by time for period 1
    const groupedData = {}

    // Add period 1 data
    period1Data.forEach(item => {
      const time = new Date(item.timestamp).toLocaleString()
      if (!groupedData[time]) groupedData[time] = { time }
      groupedData[time][`${item.entity_id}_period1`] = item.value
    })

    // Add period 2 data
    if (config.showComparison) {
      period2Data.forEach(item => {
        const time = new Date(item.timestamp).toLocaleString()
        if (!groupedData[time]) groupedData[time] = { time }
        groupedData[time][`${item.entity_id}_period2`] = item.value
      })
    }

    // Add secondary KPI data
    if (config.showSecondaryAxis) {
      secondaryData.forEach(item => {
        const time = new Date(item.timestamp).toLocaleString()
        if (!groupedData[time]) groupedData[time] = { time }
        groupedData[time][`${item.entity_id}_secondary`] = item.value
      })
    }

    return Object.values(groupedData).slice(0, 100) // Limit for performance
  }

  const getDataKeys = () => {
    if (chartData.length === 0) return { primary: [], secondary: [] }
    
    const allKeys = Object.keys(chartData[0]).filter(key => key !== 'time')
    const primary = allKeys.filter(key => !key.includes('_secondary'))
    const secondary = allKeys.filter(key => key.includes('_secondary'))
    
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
                  {kpiOptions.map(option => (
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
                  {kpiOptions.map(option => (
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
            {kpiOptions.find(opt => opt.value === chartConfig.primaryKPI)?.label || 'KPI'} Analysis
            {chartConfig.showSecondaryAxis && ` vs ${kpiOptions.find(opt => opt.value === chartConfig.secondaryKPI)?.label}`}
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

