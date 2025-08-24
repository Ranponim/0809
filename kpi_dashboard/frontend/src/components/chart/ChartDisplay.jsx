import React, { memo, useMemo } from 'react'
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

const ChartDisplay = memo(({
  chartData,
  chartConfig,
  loading,
  kpiOptions,
  useDbPegs,
  dbPegOptions
}) => {
  const getDataKeys = useMemo(() => {
    if (chartData.length === 0) return { primary: [], secondary: [] }
    
    const allKeys = Object.keys(chartData[0]).filter(key => key !== 'time')
    const primary = allKeys.filter(key => key.endsWith('_period1') || key.endsWith('_period2'))
    const secondary = allKeys.filter(key => key.endsWith('_secondary'))
    
    return { primary, secondary }
  }, [chartData])

  

  const { primary: primaryKeys, secondary: secondaryKeys } = getDataKeys

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        {loading ? 'Generating chart...' : 'Click "Generate Chart" to create visualization'}
      </div>
    )
  }

  return (
    <div className="h-96">
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
    </div>
  )
})

ChartDisplay.displayName = 'ChartDisplay'

export default ChartDisplay
