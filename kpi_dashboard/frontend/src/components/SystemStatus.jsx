/**
 * Phase 6: 시스템 상태 컴포넌트
 *
 * 이 컴포넌트는 시스템의 전반적인 건강 상태를 모니터링하고 표시합니다.
 * Phase 4의 헬스 체크 시스템과 연동하여 실시간 상태 정보를 제공합니다.
 *
 * 주요 기능:
 * - 헬스 체크 상태 표시
 * - 시스템 컴포넌트 상태 모니터링
 * - 성능 메트릭스 표시
 * - 장애 감지 및 알림
 * - 상태 히스토리 추적
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import {
  Heart,
  Server,
  Database,
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Settings,
  RefreshCw,
  TrendingUp,
  Zap
} from 'lucide-react'

const SystemStatus = () => {
  // 시스템 상태 데이터
  const [systemStatus, setSystemStatus] = useState({
    overall: 'healthy',
    lastCheck: new Date().toISOString(),
    components: {
      database: {
        status: 'healthy',
        responseTime: 12,
        uptime: '99.9%',
        lastError: null
      },
      llm_service: {
        status: 'active',
        responseTime: 8500,
        uptime: '98.5%',
        activeConnections: 3,
        lastError: null
      },
      memory: {
        status: 'healthy',
        usage: 67,
        available: '4.2GB',
        lastError: null
      },
      disk: {
        status: 'healthy',
        usage: 23,
        available: '156GB',
        lastError: null
      },
      network: {
        status: 'connected',
        latency: 15,
        throughput: '100Mbps',
        lastError: null
      }
    },
    metrics: {
      totalRequests: 15420,
      successRate: 98.7,
      avgResponseTime: 1250,
      errorRate: 1.3,
      uptime: '99.8%'
    },
    alerts: []
  })

  const [selectedComponent, setSelectedComponent] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [statusHistory, setStatusHistory] = useState([])

  // 헬스 체크 시뮬레이션
  useEffect(() => {
    const checkHealth = () => {
      const newStatus = {
        ...systemStatus,
        lastCheck: new Date().toISOString(),
        components: {
          ...systemStatus.components,
          database: {
            ...systemStatus.components.database,
            responseTime: Math.max(5, systemStatus.components.database.responseTime + (Math.random() - 0.5) * 5),
            status: Math.random() > 0.95 ? 'error' : 'healthy'
          },
          llm_service: {
            ...systemStatus.components.llm_service,
            responseTime: Math.max(1000, systemStatus.components.llm_service.responseTime + (Math.random() - 0.5) * 1000),
            status: Math.random() > 0.9 ? 'busy' : 'active',
            activeConnections: Math.max(0, Math.floor(systemStatus.components.llm_service.activeConnections + (Math.random() - 0.5) * 2))
          },
          memory: {
            ...systemStatus.components.memory,
            usage: Math.max(20, Math.min(90, systemStatus.components.memory.usage + (Math.random() - 0.5) * 5))
          },
          network: {
            ...systemStatus.components.network,
            latency: Math.max(5, systemStatus.components.network.latency + (Math.random() - 0.5) * 10),
            status: Math.random() > 0.98 ? 'disconnected' : 'connected'
          }
        }
      }

      // 전체 상태 계산
      const componentStatuses = Object.values(newStatus.components).map(c => c.status)
      const hasErrors = componentStatuses.includes('error') || componentStatuses.includes('disconnected')
      const hasWarnings = componentStatuses.includes('busy') || componentStatuses.includes('warning')

      newStatus.overall = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy'

      setSystemStatus(newStatus)

      // 상태 히스토리 업데이트
      setStatusHistory(prev => [{
        timestamp: new Date().toISOString(),
        status: newStatus.overall,
        components: Object.keys(newStatus.components).reduce((acc, key) => ({
          ...acc,
          [key]: newStatus.components[key].status
        }), {})
      }, ...prev.slice(0, 19)]) // 최근 20개만 유지
    }

    const interval = setInterval(checkHealth, 10000) // 10초마다 체크
    return () => clearInterval(interval)
  }, [])

  // 컴포넌트 상태별 색상 및 아이콘
  const getStatusConfig = (status) => {
    const configs = {
      healthy: {
        color: 'text-green-600 bg-green-100 border-green-200',
        bgColor: 'bg-green-50',
        icon: <CheckCircle className="h-5 w-5" />,
        label: '정상'
      },
      active: {
        color: 'text-blue-600 bg-blue-100 border-blue-200',
        bgColor: 'bg-blue-50',
        icon: <Activity className="h-5 w-5" />,
        label: '활성'
      },
      busy: {
        color: 'text-yellow-600 bg-yellow-100 border-yellow-200',
        bgColor: 'bg-yellow-50',
        icon: <Clock className="h-5 w-5" />,
        label: '혼잡'
      },
      error: {
        color: 'text-red-600 bg-red-100 border-red-200',
        bgColor: 'bg-red-50',
        icon: <XCircle className="h-5 w-5" />,
        label: '오류'
      },
      disconnected: {
        color: 'text-red-600 bg-red-100 border-red-200',
        bgColor: 'bg-red-50',
        icon: <XCircle className="h-5 w-5" />,
        label: '연결 끊김'
      },
      warning: {
        color: 'text-orange-600 bg-orange-100 border-orange-200',
        bgColor: 'bg-orange-50',
        icon: <AlertTriangle className="h-5 w-5" />,
        label: '경고'
      }
    }
    return configs[status] || configs.error
  }

  // 컴포넌트 상세 정보 표시
  const ComponentDetails = ({ component }) => {
    if (!component) return null

    const config = getStatusConfig(component.status)
    const details = systemStatus.components[component]

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center">
            {config.icon}
            <span className="ml-2">{component} 상세 정보</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">상태</p>
              <Badge className={`mt-1 ${config.color}`}>
                {config.label}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">업타임</p>
              <p className="font-medium">{details.uptime}</p>
            </div>
            {details.responseTime && (
              <div>
                <p className="text-sm text-gray-600">응답 시간</p>
                <p className="font-medium">{details.responseTime}ms</p>
              </div>
            )}
            {details.usage && (
              <div>
                <p className="text-sm text-gray-600">사용량</p>
                <p className="font-medium">{details.usage}%</p>
              </div>
            )}
            {details.available && (
              <div>
                <p className="text-sm text-gray-600">가용 용량</p>
                <p className="font-medium">{details.available}</p>
              </div>
            )}
            {details.activeConnections !== undefined && (
              <div>
                <p className="text-sm text-gray-600">활성 연결</p>
                <p className="font-medium">{details.activeConnections}개</p>
              </div>
            )}
            {details.latency && (
              <div>
                <p className="text-sm text-gray-600">지연 시간</p>
                <p className="font-medium">{details.latency}ms</p>
              </div>
            )}
          </div>
          {details.lastError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">
                <strong>최근 오류:</strong> {details.lastError}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">시스템 상태</h1>
          <p className="text-gray-600 mt-1">
            시스템 컴포넌트의 건강 상태 및 성능 메트릭스를 모니터링합니다
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            마지막 체크: {new Date(systemStatus.lastCheck).toLocaleString()}
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            수동 체크
          </Button>
        </div>
      </div>

      {/* 전체 시스템 상태 */}
      <Card className={`border-2 ${getStatusConfig(systemStatus.overall).bgColor}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {getStatusConfig(systemStatus.overall).icon}
              <div>
                <h2 className="text-xl font-semibold">전체 시스템 상태</h2>
                <p className="text-gray-600">모든 컴포넌트의 통합 건강 상태</p>
              </div>
            </div>
            <Badge className={`text-lg px-4 py-2 ${getStatusConfig(systemStatus.overall).color}`}>
              {getStatusConfig(systemStatus.overall).label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 컴포넌트 상태 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(systemStatus.components).map(([name, component]) => {
          const config = getStatusConfig(component.status)
          return (
            <Card
              key={name}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedComponent === name ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedComponent(selectedComponent === name ? null : name)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium capitalize">
                  {name.replace('_', ' ')}
                </CardTitle>
                {config.icon}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge className={config.color}>
                    {config.label}
                  </Badge>

                  {component.responseTime && (
                    <p className="text-xs text-gray-600">
                      응답 시간: {component.responseTime}ms
                    </p>
                  )}

                  {component.usage !== undefined && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>사용량</span>
                        <span>{component.usage}%</span>
                      </div>
                      <Progress value={component.usage} className="h-1" />
                    </div>
                  )}

                  <p className="text-xs text-gray-600">
                    업타임: {component.uptime}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 선택된 컴포넌트 상세 정보 */}
      {selectedComponent && (
        <ComponentDetails component={selectedComponent} />
      )}

      {/* 성능 메트릭스 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              성능 메트릭스
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">총 요청 수</span>
                <span className="font-medium">{systemStatus.metrics.totalRequests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">성공률</span>
                <span className="font-medium">{systemStatus.metrics.successRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">평균 응답 시간</span>
                <span className="font-medium">{systemStatus.metrics.avgResponseTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">오류율</span>
                <span className="font-medium">{systemStatus.metrics.errorRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">업타임</span>
                <span className="font-medium">{systemStatus.metrics.uptime}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              상태 히스토리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {statusHistory.slice(0, 10).map((entry, index) => {
                const config = getStatusConfig(entry.status)
                return (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      {config.icon}
                      <span className="text-sm">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <Badge variant="outline" className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                )
              })}
              {statusHistory.length === 0 && (
                <p className="text-gray-500 text-center py-4">히스토리 데이터가 없습니다</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 시스템 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            시스템 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">헬스 체크 간격</label>
              <p className="text-sm text-gray-600">10초</p>
            </div>
            <div>
              <label className="text-sm font-medium">알림 임계값</label>
              <p className="text-sm text-gray-600">CPU 80%, 메모리 85%</p>
            </div>
            <div>
              <label className="text-sm font-medium">모니터링 대상</label>
              <p className="text-sm text-gray-600">5개 컴포넌트</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm">
              설정 수정
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemStatus




