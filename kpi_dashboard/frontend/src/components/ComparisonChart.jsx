/**
 * ComparisonChart.jsx
 * 
 * Statistics 비교 분석 결과를 시각화하는 차트 컴포넌트
 * 다양한 차트 타입(Bar, Line, Pie)으로 두 기간의 데이터를 비교 표시합니다.
 */

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Area, AreaChart
} from 'recharts'
import { 
  BarChart3, TrendingUp, TrendingDown, PieChart as PieIcon, Activity, 
  Maximize2, Minimize2
} from 'lucide-react'

const ComparisonChart = ({ 
  comparisonResults, 
  title = "비교 분석 차트",
  className = "",
  showControls = true,
  defaultChartType = "bar",
  height = 400
}) => {
  
  const [chartType, setChartType] = useState(defaultChartType)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState("mean") // mean, delta, delta_percentage
  
  // 차트 타입 옵션
  const chartTypes = [
    { value: 'bar', label: '막대 차트', icon: BarChart3 },
    { value: 'line', label: '라인 차트', icon: Activity },
    { value: 'area', label: '영역 차트', icon: TrendingUp },
    { value: 'pie', label: '파이 차트', icon: PieIcon },
    { value: 'radar', label: '레이더 차트', icon: Activity },
    { value: 'composed', label: '복합 차트', icon: BarChart3 }
  ]
  
  // 메트릭 옵션
  const metrics = [
    { value: 'mean', label: '평균값', description: '두 기간의 평균 비교' },
    { value: 'delta', label: 'Delta', description: '절대값 변화량' },
    { value: 'delta_percentage', label: 'Delta %', description: '상대적 변화율' }
  ]
  
  // 차트 데이터 준비
  const chartData = useMemo(() => {
    if (!comparisonResults?.analysis_results) return []
    
    console.log('📊 차트 데이터 생성 중:', comparisonResults.analysis_results)
    
    return comparisonResults.analysis_results.map((result) => {
      const period1Mean = parseFloat(result.period1_stats?.mean) || 0
      const period2Mean = parseFloat(result.period2_stats?.mean) || 0
      const delta = parseFloat(result.delta) || 0
      const deltaPercentage = parseFloat(result.delta_percentage) || 0
      
      return {
        name: result.peg_name,
        peg_name: result.peg_name,
        period1: period1Mean,
        period2: period2Mean,
        delta: delta,
        delta_percentage: deltaPercentage,
        improvement_status: result.improvement_status,
        improvement_magnitude: result.improvement_magnitude,
        rsd_period1: parseFloat(result.rsd_period1) || 0,
        rsd_period2: parseFloat(result.rsd_period2) || 0,
        // 차트 색상 결정
        color: result.improvement_status === 'improved' ? '#22c55e' :
               result.improvement_status === 'degraded' ? '#ef4444' : '#3b82f6',
        // 파이 차트용 절대값
        abs_delta: Math.abs(delta),
        abs_delta_percentage: Math.abs(deltaPercentage)
      }
    })
  }, [comparisonResults])
  
  // 개선 상태별 데이터 분류
  const improvementData = useMemo(() => {
    if (!chartData.length) return []
    
    const improved = chartData.filter(d => d.improvement_status === 'improved').length
    const degraded = chartData.filter(d => d.improvement_status === 'degraded').length
    const stable = chartData.filter(d => d.improvement_status === 'stable').length
    
    return [
      { name: '개선', value: improved, color: '#22c55e' },
      { name: '악화', value: degraded, color: '#ef4444' },
      { name: '안정', value: stable, color: '#3b82f6' }
    ].filter(item => item.value > 0)
  }, [chartData])
  
  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <h4 className="font-semibold text-sm">{label}</h4>
          <div className="space-y-1 mt-2">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span>{entry.name}: {entry.value}</span>
              </div>
            ))}
            {data.improvement_status && (
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                상태: {data.improvement_status === 'improved' ? '개선' :
                      data.improvement_status === 'degraded' ? '악화' : '안정'}
                {data.improvement_magnitude && ` (${data.improvement_magnitude})`}
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }
  
  // 막대 차트 렌더링
  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={isFullscreen ? "80vh" : height}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name" 
          angle={-45} 
          textAnchor="end" 
          height={100}
          fontSize={12}
        />
        <YAxis fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {selectedMetric === 'mean' && (
          <>
            <Bar dataKey="period1" fill="#8884d8" name="기간 1" />
            <Bar dataKey="period2" fill="#82ca9d" name="기간 2" />
          </>
        )}
        
        {selectedMetric === 'delta' && (
          <Bar dataKey="delta" name="Delta">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        )}
        
        {selectedMetric === 'delta_percentage' && (
          <Bar dataKey="delta_percentage" name="Delta %">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  )
  
  // 라인 차트 렌더링
  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={isFullscreen ? "80vh" : height}>
      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name" 
          angle={-45} 
          textAnchor="end" 
          height={100}
          fontSize={12}
        />
        <YAxis fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {selectedMetric === 'mean' && (
          <>
            <Line type="monotone" dataKey="period1" stroke="#8884d8" strokeWidth={2} name="기간 1" />
            <Line type="monotone" dataKey="period2" stroke="#82ca9d" strokeWidth={2} name="기간 2" />
          </>
        )}
        
        {selectedMetric === 'delta' && (
          <Line type="monotone" dataKey="delta" stroke="#ff7300" strokeWidth={2} name="Delta" />
        )}
        
        {selectedMetric === 'delta_percentage' && (
          <Line type="monotone" dataKey="delta_percentage" stroke="#ff7300" strokeWidth={2} name="Delta %" />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
  
  // 영역 차트 렌더링
  const renderAreaChart = () => (
    <ResponsiveContainer width="100%" height={isFullscreen ? "80vh" : height}>
      <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name" 
          angle={-45} 
          textAnchor="end" 
          height={100}
          fontSize={12}
        />
        <YAxis fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {selectedMetric === 'mean' && (
          <>
            <Area type="monotone" dataKey="period1" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="기간 1" />
            <Area type="monotone" dataKey="period2" stackId="2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} name="기간 2" />
          </>
        )}
        
        {selectedMetric === 'delta' && (
          <Area type="monotone" dataKey="delta" stroke="#ff7300" fill="#ff7300" fillOpacity={0.6} name="Delta" />
        )}
        
        {selectedMetric === 'delta_percentage' && (
          <Area type="monotone" dataKey="delta_percentage" stroke="#ff7300" fill="#ff7300" fillOpacity={0.6} name="Delta %" />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
  
  // 파이 차트 렌더링 (개선 상태별)
  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={isFullscreen ? "80vh" : height}>
      <PieChart>
        <Pie
          data={improvementData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value, percent }) => `${name}: ${value}개 (${(percent * 100).toFixed(0)}%)`}
          outerRadius={isFullscreen ? 200 : 100}
          fill="#8884d8"
          dataKey="value"
        >
          {improvementData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
  
  // 레이더 차트 렌더링
  const renderRadarChart = () => {
    // 레이더 차트용 데이터 정규화 (0-100 스케일)
    const radarData = chartData.map(item => ({
      peg: item.name.length > 10 ? item.name.substring(0, 8) + '...' : item.name,
      period1: Math.min(Math.max((item.period1 / Math.max(...chartData.map(d => d.period1))) * 100, 0), 100),
      period2: Math.min(Math.max((item.period2 / Math.max(...chartData.map(d => d.period2))) * 100, 0), 100)
    }))
    
    return (
      <ResponsiveContainer width="100%" height={isFullscreen ? "80vh" : height}>
        <RadarChart data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="peg" fontSize={10} />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            fontSize={10}
            tick={false}
          />
          <Radar 
            name="기간 1" 
            dataKey="period1" 
            stroke="#8884d8" 
            fill="#8884d8" 
            fillOpacity={0.3} 
          />
          <Radar 
            name="기간 2" 
            dataKey="period2" 
            stroke="#82ca9d" 
            fill="#82ca9d" 
            fillOpacity={0.3} 
          />
          <Legend />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    )
  }
  
  // 복합 차트 렌더링
  const renderComposedChart = () => (
    <ResponsiveContainer width="100%" height={isFullscreen ? "80vh" : height}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name" 
          angle={-45} 
          textAnchor="end" 
          height={100}
          fontSize={12}
        />
        <YAxis yAxisId="left" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        <Bar yAxisId="left" dataKey="period1" fill="#8884d8" name="기간 1" />
        <Bar yAxisId="left" dataKey="period2" fill="#82ca9d" name="기간 2" />
        <Line yAxisId="right" type="monotone" dataKey="delta_percentage" stroke="#ff7300" strokeWidth={3} name="Delta %" />
      </ComposedChart>
    </ResponsiveContainer>
  )
  
  // 차트 렌더링 함수
  const renderChart = () => {
    switch (chartType) {
      case 'bar': return renderBarChart()
      case 'line': return renderLineChart()
      case 'area': return renderAreaChart()
      case 'pie': return renderPieChart()
      case 'radar': return renderRadarChart()
      case 'composed': return renderComposedChart()
      default: return renderBarChart()
    }
  }
  
  // 데이터가 없는 경우
  if (!comparisonResults || !chartData.length) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">차트 데이터 없음</h3>
          <p className="text-muted-foreground text-center">
            비교 분석을 실행하면 결과를 차트로 볼 수 있습니다
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-4 z-50 bg-white' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {title}
            <Badge variant="outline" className="ml-2">
              {chartData.length}개 PEG
            </Badge>
          </CardTitle>
          
          {showControls && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
        
        {showControls && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {/* 차트 타입 선택 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">차트 타입</label>
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chartTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            
            {/* 메트릭 선택 (파이/레이더 차트 제외) */}
            {!['pie', 'radar'].includes(chartType) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">표시 메트릭</label>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metrics.map((metric) => (
                      <SelectItem key={metric.value} value={metric.value}>
                        <div>
                          <div className="font-medium">{metric.label}</div>
                          <div className="text-xs text-muted-foreground">{metric.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* 차트 정보 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">차트 정보</label>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>총 {chartData.length}개 PEG 비교</div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    개선: {chartData.filter(d => d.improvement_status === 'improved').length}
                  </Badge>
                  <Badge variant="destructive" className="text-xs">
                    악화: {chartData.filter(d => d.improvement_status === 'degraded').length}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="w-full">
          {renderChart()}
        </div>
        
        {/* 범례 정보 */}
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>개선 ({chartData.filter(d => d.improvement_status === 'improved').length}개)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>악화 ({chartData.filter(d => d.improvement_status === 'degraded').length}개)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>안정 ({chartData.filter(d => d.improvement_status === 'stable').length}개)</span>
              </div>
              <div className="text-muted-foreground">
                총 {chartData.length}개 PEG 분석
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ComparisonChart
