/**
 * 분석 워크플로우 컴포넌트
 * 
 * 작업 1: System Architecture & Asynchronous Workflow Setup
 * 분석 요청을 위한 UI와 작업 상태 폴링 기능을 구현합니다.
 */

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { Loader2, Play, CheckCircle, XCircle, Clock } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const AnalysisWorkflow = () => {
  const [analysisRequest, setAnalysisRequest] = useState({
    start_date: '',
    end_date: '',
    analysis_type: 'kpi_comparison',
    parameters: {}
  })
  
  const [currentTask, setCurrentTask] = useState(null)
  const [taskStatus, setTaskStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pollingInterval, setPollingInterval] = useState(null)

  // 분석 요청 시작
  const startAnalysis = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/api/analyze/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisRequest)
      })

      if (!response.ok) {
        throw new Error(`분석 요청 실패: ${response.status}`)
      }

      const result = await response.json()
      setCurrentTask(result.task_id)
      setTaskStatus({
        status: result.status,
        progress: 0,
        current_step: '대기 중'
      })

      // 폴링 시작
      startPolling(result.task_id)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 작업 상태 폴링
  const startPolling = (taskId) => {
    // 기존 폴링 중지
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    // 즉시 첫 번째 상태 조회
    checkTaskStatus(taskId)

    // 2초마다 상태 조회
    const interval = setInterval(() => {
      checkTaskStatus(taskId)
    }, 2000)

    setPollingInterval(interval)
  }

  // 작업 상태 조회
  const checkTaskStatus = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze/${taskId}/status`)
      
      if (!response.ok) {
        throw new Error(`상태 조회 실패: ${response.status}`)
      }

      const status = await response.json()
      setTaskStatus(status)

      // 작업이 완료되면 폴링 중지
      if (status.status === 'SUCCESS' || status.status === 'FAILURE') {
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
      }

    } catch (err) {
      console.error('상태 조회 오류:', err)
    }
  }

  // 작업 취소
  const cancelAnalysis = async () => {
    if (!currentTask) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze/${currentTask}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCurrentTask(null)
        setTaskStatus(null)
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
      }
    } catch (err) {
      setError(err.message)
    }
  }

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // 상태에 따른 아이콘과 색상
  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILURE':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800'
      case 'SUCCESS':
        return 'bg-green-100 text-green-800'
      case 'FAILURE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            KPI 분석 워크플로우
          </CardTitle>
          <CardDescription>
            분석 요청을 시작하고 실시간으로 진행 상황을 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 분석 요청 폼 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">분석 요청</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">시작 날짜</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={analysisRequest.start_date}
                  onChange={(e) => setAnalysisRequest({
                    ...analysisRequest,
                    start_date: e.target.value
                  })}
                  disabled={isLoading || currentTask}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end_date">종료 날짜</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={analysisRequest.end_date}
                  onChange={(e) => setAnalysisRequest({
                    ...analysisRequest,
                    end_date: e.target.value
                  })}
                  disabled={isLoading || currentTask}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="analysis_type">분석 유형</Label>
              <select
                id="analysis_type"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={analysisRequest.analysis_type}
                onChange={(e) => setAnalysisRequest({
                  ...analysisRequest,
                  analysis_type: e.target.value
                })}
                disabled={isLoading || currentTask}
              >
                <option value="kpi_comparison">KPI 비교 분석</option>
                <option value="anomaly_detection">이상 탐지</option>
                <option value="trend_analysis">트렌드 분석</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={startAnalysis}
                disabled={isLoading || !analysisRequest.start_date || !analysisRequest.end_date || currentTask}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    분석 시작 중...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    분석 시작
                  </>
                )}
              </Button>
              
              {currentTask && (
                <Button
                  variant="outline"
                  onClick={cancelAnalysis}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  취소
                </Button>
              )}
            </div>
          </div>

          {/* 오류 메시지 */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 작업 상태 표시 */}
          {taskStatus && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">작업 상태</h3>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* 작업 ID */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">작업 ID:</span>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {currentTask}
                      </code>
                    </div>

                    {/* 상태 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">상태:</span>
                      <Badge className={getStatusColor(taskStatus.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(taskStatus.status)}
                          {taskStatus.status}
                        </div>
                      </Badge>
                    </div>

                    {/* 진행률 */}
                    {taskStatus.progress !== undefined && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">진행률:</span>
                          <span className="text-sm font-medium">{taskStatus.progress}%</span>
                        </div>
                        <Progress value={taskStatus.progress} className="w-full" />
                      </div>
                    )}

                    {/* 현재 단계 */}
                    {taskStatus.current_step && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">현재 단계:</span>
                        <span className="text-sm font-medium">{taskStatus.current_step}</span>
                      </div>
                    )}

                    {/* 오류 메시지 */}
                    {taskStatus.error && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>{taskStatus.error}</AlertDescription>
                      </Alert>
                    )}

                    {/* 결과 미리보기 */}
                    {taskStatus.result && (
                      <div className="space-y-2">
                        <span className="text-sm text-gray-600">분석 결과:</span>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(taskStatus.result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AnalysisWorkflow
