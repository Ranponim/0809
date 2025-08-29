/**
 * Phase 6: 트렌드 분석 컴포넌트
 *
 * 이 컴포넌트는 KPI 데이터의 시간적 변화 추이와 패턴을 분석하고 시각화합니다.
 * 과거 데이터와 현재 데이터를 비교하여 트렌드를 예측하고 경고합니다.
 *
 * 주요 기능:
 * - 시간 기반 KPI 추이 분석
 * - 트렌드 예측 및 경고
 * - 비교 분석 (기간별, NE별, Cell별)
 * - 시계열 데이터 시각화
 * - 이상 패턴 탐지
 * - 예측 모델링
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
  Calendar,
  BarChart3,
  LineChart,
  Activity,
  Target,
  Clock,
  Zap,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react'

const TrendAnalysis = () => {
  // 트렌드 분석 데이터
  const [trendData, setTrendData] = useState({
    kpiTrends: [
      {
        kpi: 'pmRachAtt',
        currentValue: 15240,
        previousValue: 14850,
        changePercent: 2.6,
        trend: 'up',
        prediction: 15800,
        confidence: 0.85,
        alertLevel: 'normal',
        dataPoints: [
          { date: '2025-08-20', value: 14500 },
          { date: '2025-08-21', value: 14750 },
          { date: '2025-08-22', value: 14900 },
          { date: '2025-08-23', value: 15100 },
          { date: '2025-08-24', value: 15240 }
        ]
      },
      {
        kpi: 'pmRachFail',
        currentValue: 1240,
        previousValue: 1350,
        changePercent: -8.1,
        trend: 'down',
        prediction: 1180,
        confidence: 0.78,
        alertLevel: 'good',
        dataPoints: [
          { date: '2025-08-20', value: 1380 },
          { date: '2025-08-21', value: 1320 },
          { date: '2025-08-22', value: 1290 },
          { date: '2025-08-23', value: 1260 },
          { date: '2025-08-24', value: 1240 }
        ]
      },
      {
        kpi: 'randomaccessproblem',
        currentValue: 65.5,
        previousValue: 58.2,
        changePercent: 12.5,
        trend: 'up',
        prediction: 72.0,
        confidence: 0.92,
        alertLevel: 'warning',
        dataPoints: [
          { date: '2025-08-20', value: 52.1 },
          { date: '2025-08-21', value: 55.8 },
          { date: '2025-08-22', value: 61.3 },
          { date: '2025-08-23', value: 63.7 },
          { date: '2025-08-24', value: 65.5 }
        ]
      }
    ],
    neTrends: [
      {
        ne: 'NVGNB#101086',
        kpiCount: 8,
        avgChangePercent: 5.2,
        trend: 'up',
        criticalKpis: 2,
        status: 'warning'
      },
      {
        ne: 'NVGNB#101087',
        kpiCount: 8,
        avgChangePercent: -2.1,
        trend: 'down',
        criticalKpis: 0,
        status: 'normal'
      }
    ],
    predictions: [
      {
        kpi: 'pmRachAtt',
        timeframe: '7일',
        predictedValue: 16200,
        confidence: 0.82,
        riskLevel: 'low'
      },
      {
        kpi: 'randomaccessproblem',
        timeframe: '7일',
        predictedValue: 78.5,
        confidence: 0.75,
        riskLevel: 'high'
      }
    ],
    anomalies: [
      {
        kpi: 'randomaccessproblem',
        date: '2025-08-24',
        value: 65.5,
        threshold: 60.0,
        severity: 'medium',
        description: '임계값 초과'
      }
    ]
  })

  const [selectedTimeframe, setSelectedTimeframe] = useState('7d')
  const [selectedKpi, setSelectedKpi] = useState('all')
  const [comparisonMode, setComparisonMode] = useState('period')
  const [showPredictions, setShowPredictions] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // 실시간 데이터 업데이트 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      // KPI 트렌드 데이터 업데이트
      setTrendData(prev => ({
        ...prev,
        kpiTrends: prev.kpiTrends.map(trend => ({
          ...trend,
          currentValue: trend.currentValue + (Math.random() - 0.5) * trend.currentValue * 0.01,
          changePercent: trend.changePercent + (Math.random() - 0.5) * 2,
          prediction: trend.prediction + (Math.random() - 0.5) * trend.prediction * 0.02
        }))
      }))
      setLastUpdate(new Date())
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // 트렌드 상태별 색상 및 아이콘
  const getTrendConfig = (trend, alertLevel = 'normal') => {
    const configs = {
      up: {
        color: trend === 'up' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100',
        icon: trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
        label: trend === 'up' ? '상승' : '하락'
      },
      down: {
        color: trend === 'down' ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100',
        icon: trend === 'down' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />,
        label: trend === 'down' ? '하락' : '상승'
      }
    }

    // 경고 레벨에 따른 색상 오버라이드
    if (alertLevel === 'warning') {
      configs[trend].color = 'text-yellow-600 bg-yellow-100'
    } else if (alertLevel === 'critical') {
      configs[trend].color = 'text-red-600 bg-red-100'
    }

    return configs[trend] || configs.up
  }

  // 예측 정확도별 색상
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100'
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  // 수동 새로고침
  const handleRefresh = () => {
    setLastUpdate(new Date())
    console.log('🔄 트렌드 데이터 새로고침')
  }

  // 예측 토글
  const togglePredictions = () => {
    setShowPredictions(!showPredictions)
  }

  // KPI 트렌드 차트 컴포넌트 (시뮬레이션)
  const TrendChart = ({ kpi, dataPoints, prediction, showPrediction = true }) => (
    <div className="h-32 flex items-center justify-center bg-gray-50 rounded">
      <div className="text-center">
        <LineChart className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">
          {kpi} 추이 차트
        </p>
        {showPrediction && prediction && (
          <p className="text-xs text-blue-600 mt-1">
            예측: {prediction.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">트렌드 분석</h1>
          <p className="text-gray-600 mt-1">
            KPI 데이터의 시간적 변화 추이와 패턴을 분석합니다
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            마지막 업데이트: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button
            variant={showPredictions ? "default" : "outline"}
            size="sm"
            onClick={togglePredictions}
          >
            <Target className="h-4 w-4 mr-2" />
            {showPredictions ? '예측 표시' : '예측 숨김'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      {/* 필터 및 설정 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>시간 범위</Label>
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">1일</SelectItem>
                  <SelectItem value="7d">7일</SelectItem>
                  <SelectItem value="30d">30일</SelectItem>
                  <SelectItem value="90d">90일</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>KPI 필터</Label>
              <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 KPI</SelectItem>
                  <SelectItem value="rach">RACH 메트릭</SelectItem>
                  <SelectItem value="erab">ERAB 메트릭</SelectItem>
                  <SelectItem value="pdcp">PDCP 메트릭</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>비교 모드</Label>
              <Select value={comparisonMode} onValueChange={setComparisonMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period">기간별 비교</SelectItem>
                  <SelectItem value="ne">NE별 비교</SelectItem>
                  <SelectItem value="cell">Cell별 비교</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                필터 적용
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI 트렌드 분석 */}
      <div className="grid grid-cols-1 gap-6">
        {trendData.kpiTrends.map((kpiTrend) => {
          const config = getTrendConfig(kpiTrend.trend, kpiTrend.alertLevel)
          const isPositive = kpiTrend.changePercent > 0

          return (
            <Card key={kpiTrend.kpi}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="text-lg">{kpiTrend.kpi}</CardTitle>
                    <Badge className={config.color}>
                      {config.icon}
                      <span className="ml-1">{config.label}</span>
                    </Badge>
                    {kpiTrend.alertLevel !== 'normal' && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {kpiTrend.alertLevel === 'warning' ? '경고' : '심각'}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{kpiTrend.currentValue.toLocaleString()}</p>
                    <p className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{kpiTrend.changePercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 트렌드 차트 */}
                  <div className="lg:col-span-2">
                    <TrendChart
                      kpi={kpiTrend.kpi}
                      dataPoints={kpiTrend.dataPoints}
                      prediction={kpiTrend.prediction}
                      showPrediction={showPredictions}
                    />
                  </div>

                  {/* 트렌드 상세 정보 */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">현재 값</p>
                      <p className="font-medium">{kpiTrend.currentValue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">이전 값</p>
                      <p className="font-medium">{kpiTrend.previousValue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">변화율</p>
                      <p className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{kpiTrend.changePercent.toFixed(1)}%
                      </p>
                    </div>
                    {showPredictions && (
                      <>
                        <div>
                          <p className="text-sm text-gray-600">예측 값</p>
                          <p className="font-medium text-blue-600">
                            {kpiTrend.prediction.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">예측 신뢰도</p>
                          <div className="flex items-center space-x-2">
                            <Progress value={kpiTrend.confidence * 100} className="flex-1 h-2" />
                            <span className="text-sm">{(kpiTrend.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 데이터 포인트 테이블 */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">최근 데이터 포인트</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>날짜</TableHead>
                          <TableHead>값</TableHead>
                          <TableHead>변화</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kpiTrend.dataPoints.slice(-3).map((point, index) => {
                          const prevPoint = kpiTrend.dataPoints[index - 1]
                          const change = prevPoint ? ((point.value - prevPoint.value) / prevPoint.value * 100) : 0

                          return (
                            <TableRow key={point.date}>
                              <TableCell>{point.date}</TableCell>
                              <TableCell>{point.value.toLocaleString()}</TableCell>
                              <TableCell>
                                {prevPoint && (
                                  <span className={change > 0 ? 'text-green-600' : 'text-red-600'}>
                                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* NE별 트렌드 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            NE별 트렌드 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NE</TableHead>
                <TableHead>KPI 수</TableHead>
                <TableHead>평균 변화율</TableHead>
                <TableHead>트렌드</TableHead>
                <TableHead>중요 KPI</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trendData.neTrends.map((neTrend) => {
                const config = getTrendConfig(neTrend.trend)
                const statusConfig = {
                  normal: 'text-green-600 bg-green-100',
                  warning: 'text-yellow-600 bg-yellow-100',
                  critical: 'text-red-600 bg-red-100'
                }

                return (
                  <TableRow key={neTrend.ne}>
                    <TableCell className="font-medium">{neTrend.ne}</TableCell>
                    <TableCell>{neTrend.kpiCount}</TableCell>
                    <TableCell>
                      <span className={neTrend.avgChangePercent > 0 ? 'text-green-600' : 'text-red-600'}>
                        {neTrend.avgChangePercent > 0 ? '+' : ''}{neTrend.avgChangePercent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={config.color}>
                        {config.icon}
                        <span className="ml-1">{config.label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {neTrend.criticalKpis > 0 ? (
                        <Badge variant="destructive">{neTrend.criticalKpis}개</Badge>
                      ) : (
                        <span className="text-gray-500">없음</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[neTrend.status]}>
                        {neTrend.status === 'normal' ? '정상' :
                         neTrend.status === 'warning' ? '경고' : '심각'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 예측 및 이상 탐지 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 예측 분석 */}
        {showPredictions && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                예측 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendData.predictions.map((prediction) => (
                  <div key={prediction.kpi} className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{prediction.kpi}</h4>
                      <Badge className={getConfidenceColor(prediction.confidence)}>
                        {(prediction.confidence * 100).toFixed(0)}% 신뢰
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">예측 기간</p>
                        <p className="font-medium">{prediction.timeframe}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">예측 값</p>
                        <p className="font-medium">{prediction.predictedValue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">리스크 레벨</p>
                        <Badge variant={prediction.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                          {prediction.riskLevel === 'high' ? '높음' :
                           prediction.riskLevel === 'medium' ? '중간' : '낮음'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 이상 탐지 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              이상 탐지
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.anomalies.length > 0 ? (
              <div className="space-y-3">
                {trendData.anomalies.map((anomaly, index) => (
                  <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-yellow-800">{anomaly.kpi}</h4>
                      <Badge variant="outline" className="text-yellow-600">
                        {anomaly.severity === 'high' ? '높음' :
                         anomaly.severity === 'medium' ? '중간' : '낮음'}
                      </Badge>
                    </div>
                    <div className="text-sm text-yellow-700">
                      <p><strong>발생일:</strong> {anomaly.date}</p>
                      <p><strong>측정값:</strong> {anomaly.value.toLocaleString()}</p>
                      <p><strong>임계값:</strong> {anomaly.threshold.toLocaleString()}</p>
                      <p><strong>설명:</strong> {anomaly.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>현재 이상 징후가 감지되지 않았습니다</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 내보내기 옵션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            트렌드 분석 내보내기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start">
              <Download className="h-4 w-4 mr-2" />
              트렌드 리포트 PDF
            </Button>
            <Button variant="outline" className="justify-start">
              <Download className="h-4 w-4 mr-2" />
              CSV 데이터 내보내기
            </Button>
            <Button variant="outline" className="justify-start">
              <Download className="h-4 w-4 mr-2" />
              예측 모델 내보내기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TrendAnalysis



