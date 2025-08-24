/**
 * DetailedAnalysisView.jsx
 * 
 * Task 8: Frontend: Create Detailed View with Time-Series Chart and Anomaly Highlighting
 * 
 * 선택된 peg/cell에 대한 상세 진단 뷰
 * - 인터랙티브 시계열 차트
 * - 이상치 하이라이팅
 * - 상세 분석 정보 표시
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
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
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  Activity,
  Target,
  Info
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const DetailedAnalysisView = ({ 
  analysisId, 
  pegId, 
  onBack 
}) => {
  // 상태 관리
  const [analysisData, setAnalysisData] = useState(null)
  const [timeSeriesData, setTimeSeriesData] = useState([])
  const [anomalyData, setAnomalyData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('chart')

  // 분석 데이터 가져오기
  const fetchAnalysisData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📊 상세 분석 데이터 가져오기 시작...', { analysisId, pegId })
      
      // 실제 API 호출 (현재는 샘플 데이터 사용)
      const response = await fetch(`${API_BASE_URL}/api/analysis/${analysisId}/detail/${pegId}`)
      
      if (!response.ok) {
        throw new Error(`상세 분석 데이터 조회 실패: ${response.status}`)
      }
      
      const data = await response.json()
      setAnalysisData(data.analysis)
      setTimeSeriesData(data.timeSeries || [])
      setAnomalyData(data.anomalies || [])
      
      console.log('✅ 상세 분석 데이터 로드 완료')
      
    } catch (err) {
      console.error('❌ 상세 분석 데이터 조회 오류:', err)
      setError(err.message)
      
      // 샘플 데이터로 대체 (개발용)
      const sampleData = generateSampleDetailedData()
      setAnalysisData(sampleData.analysis)
      setTimeSeriesData(sampleData.timeSeries)
      setAnomalyData(sampleData.anomalies)
    } finally {
      setLoading(false)
    }
  }, [analysisId, pegId])

  // 샘플 데이터 생성 (개발용)
  const generateSampleDetailedData = () => {
    const now = new Date()
    const timeSeries = []
    const anomalies = []
    
    // 30일간의 시계열 데이터 생성
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const timestamp = date.toISOString()
      
      // 기본 메트릭 값들
      const responseTime = 100 + Math.random() * 50 + (Math.random() > 0.9 ? 200 : 0)
      const errorRate = Math.random() * 5 + (Math.random() > 0.95 ? 15 : 0)
      const throughput = 1000 + Math.random() * 200 + (Math.random() > 0.9 ? -300 : 0)
      
      const dataPoint = {
        timestamp,
        date: date.toISOString().split('T')[0],
        response_time: Math.round(responseTime * 100) / 100,
        error_rate: Math.round(errorRate * 100) / 100,
        throughput: Math.round(throughput)
      }
      
      timeSeries.push(dataPoint)
      
      // 이상치 감지
      if (responseTime > 200 || errorRate > 10 || throughput < 800) {
        anomalies.push({
          timestamp,
          type: responseTime > 200 ? 'performance' : errorRate > 10 ? 'quality' : 'capacity',
          severity: responseTime > 250 || errorRate > 15 ? 'high' : 'medium',
          metric: responseTime > 200 ? 'response_time' : errorRate > 10 ? 'error_rate' : 'throughput',
          value: responseTime > 200 ? responseTime : errorRate > 10 ? errorRate : throughput,
          description: responseTime > 200 ? '응답 시간 급증' : errorRate > 10 ? '에러율 증가' : '처리량 저하'
        })
      }
    }
    
    const analysis = {
      id: analysisId,
      pegId: pegId,
      analysisDate: now.toISOString(),
      summary: {
        totalAnomalies: anomalies.length,
        highSeverityAnomalies: anomalies.filter(a => a.severity === 'high').length,
        overallStatus: anomalies.length > 5 ? 'warning' : 'pass'
      }
    }
    
    return { analysis, timeSeries, anomalies }
  }

  // 상태 아이콘
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    if (analysisId && pegId) {
      fetchAnalysisData()
    }
  }, [analysisId, pegId, fetchAnalysisData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">상세 분석 데이터 로딩 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              상세 분석 뷰
            </h1>
            <p className="text-gray-600">
              분석 ID: {analysisId} | PEG ID: {pegId}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAnalysisData}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          새로고침
        </Button>
      </div>

      {/* 요약 카드 */}
      {analysisData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">총 이상치</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analysisData.summary.totalAnomalies}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">고심각도</p>
                  <p className="text-2xl font-bold text-red-600">
                    {analysisData.summary.highSeverityAnomalies}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">전체 상태</p>
                  <Badge className={analysisData.summary.overallStatus === 'pass' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(analysisData.summary.overallStatus)}
                      {analysisData.summary.overallStatus}
                    </div>
                  </Badge>
                </div>
                <Target className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chart">시계열 차트</TabsTrigger>
          <TabsTrigger value="anomalies">이상치 분석</TabsTrigger>
          <TabsTrigger value="statistics">통계 정보</TabsTrigger>
        </TabsList>

        {/* 시계열 차트 탭 */}
        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                시계열 분석 차트
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeSeriesData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <Info className="h-8 w-8 mr-2" />
                  시계열 데이터가 없습니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="response_time"
                      stroke="#8884d8"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="응답 시간 (ms)"
                    />
                    
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="error_rate"
                      stroke="#ff7300"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="에러율 (%)"
                    />
                    
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="throughput"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="처리량"
                    />
                    
                    {/* 임계값 라인 */}
                    <ReferenceLine y={200} stroke="#ff7300" strokeDasharray="3 3" />
                    <ReferenceLine y={10} stroke="#ff0000" strokeDasharray="3 3" />
                    <ReferenceLine y={800} stroke="#ff0000" strokeDasharray="3 3" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 이상치 분석 탭 */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                이상치 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {anomalyData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                    이상치가 없습니다.
                  </div>
                ) : (
                  anomalyData.map((anomaly, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge className={anomaly.severity === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                          {anomaly.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{anomaly.description}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(anomaly.timestamp).toLocaleString()} | {anomaly.metric}: {anomaly.value}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{anomaly.type}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 통계 정보 탭 */}
        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                통계 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysisData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">분석 정보</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          <strong>분석 ID:</strong> {analysisData.id}
                        </p>
                        <p className="text-sm">
                          <strong>PEG ID:</strong> {analysisData.pegId}
                        </p>
                        <p className="text-sm">
                          <strong>분석 날짜:</strong> {new Date(analysisData.analysisDate).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">요약 통계</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          <strong>총 이상치:</strong> {analysisData.summary.totalAnomalies}개
                        </p>
                        <p className="text-sm">
                          <strong>고심각도:</strong> {analysisData.summary.highSeverityAnomalies}개
                        </p>
                        <p className="text-sm">
                          <strong>전체 상태:</strong> 
                          <Badge className={analysisData.summary.overallStatus === 'pass' ? 'bg-green-100 text-green-800 ml-2' : 'bg-yellow-100 text-yellow-800 ml-2'}>
                            {analysisData.summary.overallStatus}
                          </Badge>
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DetailedAnalysisView
