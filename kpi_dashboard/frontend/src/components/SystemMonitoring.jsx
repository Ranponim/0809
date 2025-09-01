/**
 * Phase 6: 실시간 모니터링 컴포넌트
 *
 * 이 컴포넌트는 시스템의 실시간 상태를 모니터링하고 시각화합니다.
 * LLM 분석 진행 상태, 시스템 리소스 사용량, 데이터베이스 연결 상태 등을 실시간으로 보여줍니다.
 *
 * 주요 기능:
 * - 실시간 메트릭스 모니터링
 * - LLM 분석 진행 상태 추적
 * - 시스템 리소스 사용량 표시
 * - 데이터베이스 연결 상태 모니터링
 * - 자동 새로고침 및 알림
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import {
  Activity,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react'

const SystemMonitoring = () => {
  // 모니터링 상태
  const [monitoringData, setMonitoringData] = useState({
    timestamp: new Date().toISOString(),
    system: {
      cpu: 45,
      memory: 67,
      disk: 23,
      network: 'connected'
    },
    database: {
      status: 'healthy',
      connections: 5,
      responseTime: 12
    },
    llm: {
      status: 'active',
      activeRequests: 2,
      queueLength: 3,
      avgResponseTime: 8500
    },
    analysis: {
      todayCount: 24,
      successRate: 98.5,
      avgProcessingTime: 12500
    }
  })

  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [alerts, setAlerts] = useState([])

  // 실시간 데이터 업데이트 시뮬레이션
  useEffect(() => {
    if (!isAutoRefresh) return

    const interval = setInterval(() => {
      // 시스템 메트릭스 업데이트
      setMonitoringData(prev => ({
        ...prev,
        timestamp: new Date().toISOString(),
        system: {
          cpu: Math.max(10, Math.min(95, prev.system.cpu + (Math.random() - 0.5) * 10)),
          memory: Math.max(20, Math.min(90, prev.system.memory + (Math.random() - 0.5) * 8)),
          disk: Math.max(10, Math.min(80, prev.system.disk + (Math.random() - 0.5) * 5)),
          network: Math.random() > 0.95 ? 'disconnected' : 'connected'
        },
        llm: {
          status: Math.random() > 0.9 ? 'busy' : 'active',
          activeRequests: Math.max(0, Math.floor(prev.llm.activeRequests + (Math.random() - 0.5) * 2)),
          queueLength: Math.max(0, Math.floor(prev.llm.queueLength + (Math.random() - 0.5) * 1)),
          avgResponseTime: Math.max(1000, prev.llm.avgResponseTime + (Math.random() - 0.5) * 1000)
        }
      }))

      setLastUpdate(new Date())

      // 알림 생성 로직
      checkForAlerts()

    }, 3000) // 3초마다 업데이트

    return () => clearInterval(interval)
  }, [isAutoRefresh])

  // 알림 체크
  const checkForAlerts = () => {
    const newAlerts = []

    if (monitoringData.system.cpu > 80) {
      newAlerts.push({
        id: Date.now(),
        type: 'warning',
        title: 'CPU 사용률 높음',
        message: `CPU 사용률이 ${monitoringData.system.cpu.toFixed(1)}%입니다`,
        timestamp: new Date()
      })
    }

    if (monitoringData.system.memory > 85) {
      newAlerts.push({
        id: Date.now() + 1,
        type: 'error',
        title: '메모리 부족',
        message: `메모리 사용률이 ${monitoringData.system.memory.toFixed(1)}%입니다`,
        timestamp: new Date()
      })
    }

    if (monitoringData.llm.queueLength > 5) {
      newAlerts.push({
        id: Date.now() + 2,
        type: 'info',
        title: 'LLM 큐 길이 증가',
        message: `LLM 요청 대기열이 ${monitoringData.llm.queueLength}개입니다`,
        timestamp: new Date()
      })
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10)) // 최대 10개 알림 유지
    }
  }

  // 수동 새로고침
  const handleRefresh = () => {
    setLastUpdate(new Date())
    // 실제로는 여기서 API 호출
    console.log('🔄 수동 새로고침 실행')
  }

  // 알림 제거
  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  // 상태별 색상 및 아이콘
  const getStatusColor = (status, type = 'status') => {
    const statusMap = {
      healthy: 'text-green-600 bg-green-100',
      active: 'text-blue-600 bg-blue-100',
      busy: 'text-yellow-600 bg-yellow-100',
      error: 'text-red-600 bg-red-100',
      disconnected: 'text-red-600 bg-red-100',
      connected: 'text-green-600 bg-green-100'
    }
    return statusMap[status] || 'text-gray-600 bg-gray-100'
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <CheckCircle className="h-4 w-4" />
      case 'busy':
        return <Clock className="h-4 w-4" />
      case 'error':
      case 'disconnected':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">실시간 모니터링</h1>
          <p className="text-gray-600 mt-1">
            시스템 상태 및 LLM 분석 진행 상황을 실시간으로 모니터링합니다
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            마지막 업데이트: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button
            variant={isAutoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAutoRefresh ? 'animate-spin' : ''}`} />
            {isAutoRefresh ? '자동' : '수동'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      {/* 알림 패널 */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              시스템 알림 ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <Badge variant={alert.type === 'error' ? 'destructive' : 'secondary'}>
                      {alert.type.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 메인 모니터링 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 시스템 리소스 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">시스템 리소스</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span>CPU</span>
                  <span>{monitoringData.system.cpu.toFixed(1)}%</span>
                </div>
                <Progress value={monitoringData.system.cpu} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>메모리</span>
                  <span>{monitoringData.system.memory.toFixed(1)}%</span>
                </div>
                <Progress value={monitoringData.system.memory} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>디스크</span>
                  <span>{monitoringData.system.disk.toFixed(1)}%</span>
                </div>
                <Progress value={monitoringData.system.disk} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 데이터베이스 상태 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">데이터베이스</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">상태</span>
                <Badge className={getStatusColor(monitoringData.database.status)}>
                  {getStatusIcon(monitoringData.database.status)}
                  <span className="ml-1">{monitoringData.database.status}</span>
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>활성 연결</span>
                <span>{monitoringData.database.connections}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>응답 시간</span>
                <span>{monitoringData.database.responseTime}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LLM 서비스 상태 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LLM 서비스</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">상태</span>
                <Badge className={getStatusColor(monitoringData.llm.status)}>
                  {getStatusIcon(monitoringData.llm.status)}
                  <span className="ml-1">{monitoringData.llm.status}</span>
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>활성 요청</span>
                <span>{monitoringData.llm.activeRequests}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>대기열</span>
                <span>{monitoringData.llm.queueLength}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>평균 응답</span>
                <span>{(monitoringData.llm.avgResponseTime / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 분석 통계 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">분석 통계</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>오늘 분석</span>
                <span>{monitoringData.analysis.todayCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>성공률</span>
                <span>{monitoringData.analysis.successRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>평균 처리시간</span>
                <span>{(monitoringData.analysis.avgProcessingTime / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">네트워크</span>
                <Badge className={getStatusColor(monitoringData.system.network)}>
                  {getStatusIcon(monitoringData.system.network)}
                  <span className="ml-1">{monitoringData.system.network}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 상세 모니터링 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>실시간 메트릭스 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              📊 실시간 차트 컴포넌트 (추후 구현)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LLM 분석 진행 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">현재 분석 중</span>
                <Badge variant="outline">
                  {monitoringData.llm.activeRequests} 개
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">대기 중</span>
                <Badge variant="outline">
                  {monitoringData.llm.queueLength} 개
                </Badge>
              </div>
              <div className="h-32 flex items-center justify-center text-gray-500">
                🔄 진행 상태 바 (추후 구현)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 시스템 로그 */}
      <Card>
        <CardHeader>
          <CardTitle>최근 시스템 로그</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              <span className="font-mono text-xs">[INFO]</span> 시스템 모니터링 시작
            </div>
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              <span className="font-mono text-xs text-blue-600">[DEBUG]</span> 데이터베이스 연결 확인
            </div>
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              <span className="font-mono text-xs text-green-600">[SUCCESS]</span> LLM 서비스 정상
            </div>
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              <span className="font-mono text-xs">[INFO]</span> 메모리 사용량: 67%
            </div>
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              <span className="font-mono text-xs text-yellow-600">[WARN]</span> CPU 사용량 증가: 78%
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemMonitoring







