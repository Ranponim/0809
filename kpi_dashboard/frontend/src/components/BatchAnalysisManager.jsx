/**
 * Phase 6: 배치 분석 관리자 컴포넌트
 *
 * 이 컴포넌트는 여러 분석 작업을 일괄로 처리하고 관리합니다.
 * 대용량 데이터 분석, 다중 NE/Cell 동시 분석, 분석 결과 일괄 처리를 지원합니다.
 *
 * 주요 기능:
 * - 배치 분석 작업 생성 및 관리
 * - 분석 큐 관리 및 진행 상태 모니터링
 * - 다중 분석 결과 통합 및 비교
 * - 배치 처리 설정 및 최적화
 * - 분석 결과 일괄 내보내기
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  Upload,
  Settings,
  Plus,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Users,
  Database,
  Zap
} from 'lucide-react'

const BatchAnalysisManager = () => {
  // 배치 작업 상태
  const [batchJobs, setBatchJobs] = useState([
    {
      id: 'batch-001',
      name: '5G 네트워크 전반 분석',
      description: '전체 네트워크의 KPI 성능 분석',
      status: 'completed',
      progress: 100,
      totalTasks: 50,
      completedTasks: 50,
      failedTasks: 0,
      createdAt: '2025-08-29T08:00:00Z',
      startedAt: '2025-08-29T08:05:00Z',
      completedAt: '2025-08-29T09:30:00Z',
      estimatedTime: '1시간 25분',
      actualTime: '1시간 25분',
      priority: 'high',
      neCount: 25,
      cellCount: 150,
      kpiCount: 8,
      resultSummary: {
        successRate: 100,
        totalFindings: 45,
        criticalIssues: 2,
        warnings: 15
      }
    },
    {
      id: 'batch-002',
      name: 'RACH 성능 심층 분석',
      description: 'Random Access Channel 성능 분석',
      status: 'running',
      progress: 67,
      totalTasks: 30,
      completedTasks: 20,
      failedTasks: 1,
      createdAt: '2025-08-29T09:00:00Z',
      startedAt: '2025-08-29T09:10:00Z',
      estimatedTime: '45분',
      priority: 'medium',
      neCount: 15,
      cellCount: 90,
      kpiCount: 5
    },
    {
      id: 'batch-003',
      name: '트래픽 패턴 분석',
      description: '시간대별 트래픽 패턴 및 예측',
      status: 'queued',
      progress: 0,
      totalTasks: 20,
      completedTasks: 0,
      failedTasks: 0,
      createdAt: '2025-08-29T10:00:00Z',
      estimatedTime: '30분',
      priority: 'low',
      neCount: 10,
      cellCount: 60,
      kpiCount: 6
    }
  ])

  const [selectedJob, setSelectedJob] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeTab, setActiveTab] = useState('jobs')

  // 새 배치 작업 생성 폼
  const [newJob, setNewJob] = useState({
    name: '',
    description: '',
    priority: 'medium',
    neSelection: 'all',
    cellSelection: 'all',
    kpiSelection: ['pmRachAtt', 'pmRachFail', 'pmRachSetupFail'],
    timeRange: {
      start: '',
      end: ''
    },
    maxConcurrentTasks: 5,
    retryAttempts: 3
  })

  // 진행 중인 작업 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      setBatchJobs(prev => prev.map(job => {
        if (job.status === 'running' && job.progress < 100) {
          const newProgress = Math.min(100, job.progress + Math.random() * 5)
          const newCompleted = Math.floor((newProgress / 100) * job.totalTasks)

          return {
            ...job,
            progress: newProgress,
            completedTasks: newCompleted,
            status: newProgress >= 100 ? 'completed' : 'running',
            completedAt: newProgress >= 100 ? new Date().toISOString() : null
          }
        }
        return job
      }))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // 작업 상태별 색상 및 아이콘
  const getStatusConfig = (status) => {
    const configs = {
      queued: {
        color: 'text-gray-600 bg-gray-100',
        icon: <Clock className="h-4 w-4" />,
        label: '대기중'
      },
      running: {
        color: 'text-blue-600 bg-blue-100',
        icon: <Play className="h-4 w-4" />,
        label: '실행중'
      },
      paused: {
        color: 'text-yellow-600 bg-yellow-100',
        icon: <Pause className="h-4 w-4" />,
        label: '일시정지'
      },
      completed: {
        color: 'text-green-600 bg-green-100',
        icon: <CheckCircle className="h-4 w-4" />,
        label: '완료'
      },
      failed: {
        color: 'text-red-600 bg-red-100',
        icon: <XCircle className="h-4 w-4" />,
        label: '실패'
      }
    }
    return configs[status] || configs.queued
  }

  // 작업 제어 함수들
  const handleStartJob = (jobId) => {
    setBatchJobs(prev => prev.map(job =>
      job.id === jobId
        ? { ...job, status: 'running', startedAt: new Date().toISOString() }
        : job
    ))
  }

  const handlePauseJob = (jobId) => {
    setBatchJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, status: 'paused' } : job
    ))
  }

  const handleStopJob = (jobId) => {
    setBatchJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, status: 'failed' } : job
    ))
  }

  const handleRetryJob = (jobId) => {
    setBatchJobs(prev => prev.map(job =>
      job.id === jobId
        ? { ...job, status: 'queued', progress: 0, completedTasks: 0, failedTasks: 0 }
        : job
    ))
  }

  const handleCreateJob = () => {
    const job = {
      id: `batch-${Date.now()}`,
      name: newJob.name,
      description: newJob.description,
      status: 'queued',
      progress: 0,
      totalTasks: Math.floor(Math.random() * 50) + 10,
      completedTasks: 0,
      failedTasks: 0,
      createdAt: new Date().toISOString(),
      priority: newJob.priority,
      neCount: newJob.neSelection === 'all' ? 25 : Math.floor(Math.random() * 10) + 5,
      cellCount: newJob.cellSelection === 'all' ? 150 : Math.floor(Math.random() * 50) + 25,
      kpiCount: newJob.kpiSelection.length,
      estimatedTime: `${Math.floor(Math.random() * 60) + 15}분`
    }

    setBatchJobs(prev => [job, ...prev])
    setShowCreateForm(false)
    setNewJob({
      name: '',
      description: '',
      priority: 'medium',
      neSelection: 'all',
      cellSelection: 'all',
      kpiSelection: ['pmRachAtt', 'pmRachFail', 'pmRachSetupFail'],
      timeRange: { start: '', end: '' },
      maxConcurrentTasks: 5,
      retryAttempts: 3
    })
  }

  const handleDeleteJob = (jobId) => {
    setBatchJobs(prev => prev.filter(job => job.id !== jobId))
    if (selectedJob?.id === jobId) {
      setSelectedJob(null)
    }
  }

  // 작업 상세 정보 컴포넌트
  const JobDetails = ({ job }) => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{job.name}</span>
            <Badge className={getStatusConfig(job.status).color}>
              {getStatusConfig(job.status).icon}
              <span className="ml-1">{getStatusConfig(job.status).label}</span>
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{job.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">총 작업</p>
              <p className="font-medium">{job.totalTasks}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">완료</p>
              <p className="font-medium text-green-600">{job.completedTasks}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">실패</p>
              <p className="font-medium text-red-600">{job.failedTasks}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">진행률</p>
              <p className="font-medium">{job.progress.toFixed(1)}%</p>
            </div>
          </div>

          <div className="mt-4">
            <Progress value={job.progress} className="h-2" />
          </div>

          {job.resultSummary && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">성공률</p>
                <p className="font-medium">{job.resultSummary.successRate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">발견사항</p>
                <p className="font-medium">{job.resultSummary.totalFindings}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">중요 이슈</p>
                <p className="font-medium text-red-600">{job.resultSummary.criticalIssues}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">경고</p>
                <p className="font-medium text-yellow-600">{job.resultSummary.warnings}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 작업 제어 버튼들 */}
      <div className="flex space-x-2">
        {job.status === 'queued' && (
          <Button onClick={() => handleStartJob(job.id)} size="sm">
            <Play className="h-4 w-4 mr-2" />
            시작
          </Button>
        )}
        {job.status === 'running' && (
          <Button onClick={() => handlePauseJob(job.id)} variant="outline" size="sm">
            <Pause className="h-4 w-4 mr-2" />
            일시정지
          </Button>
        )}
        {(job.status === 'running' || job.status === 'paused') && (
          <Button onClick={() => handleStopJob(job.id)} variant="destructive" size="sm">
            <Square className="h-4 w-4 mr-2" />
            중지
          </Button>
        )}
        {(job.status === 'failed' || job.status === 'completed') && (
          <Button onClick={() => handleRetryJob(job.id)} variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            재시도
          </Button>
        )}
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          결과 다운로드
        </Button>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          상세 결과
        </Button>
      </div>
    </div>
  )

  // 새 작업 생성 폼
  const CreateJobForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>새 배치 분석 작업 생성</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="jobName">작업명</Label>
            <Input
              id="jobName"
              value={newJob.name}
              onChange={(e) => setNewJob(prev => ({ ...prev, name: e.target.value }))}
              placeholder="분석 작업명을 입력하세요"
            />
          </div>
          <div>
            <Label htmlFor="priority">우선순위</Label>
            <Select value={newJob.priority} onValueChange={(value) => setNewJob(prev => ({ ...prev, priority: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">높음</SelectItem>
                <SelectItem value="medium">중간</SelectItem>
                <SelectItem value="low">낮음</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">설명</Label>
          <Textarea
            id="description"
            value={newJob.description}
            onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
            placeholder="작업에 대한 상세 설명을 입력하세요"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>NE 선택</Label>
            <Select value={newJob.neSelection} onValueChange={(value) => setNewJob(prev => ({ ...prev, neSelection: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 NE</SelectItem>
                <SelectItem value="selected">선택된 NE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cell 선택</Label>
            <Select value={newJob.cellSelection} onValueChange={(value) => setNewJob(prev => ({ ...prev, cellSelection: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 Cell</SelectItem>
                <SelectItem value="selected">선택된 Cell</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>KPI 선택</Label>
            <Select value={newJob.kpiSelection.join(',')} onValueChange={(value) => setNewJob(prev => ({ ...prev, kpiSelection: value.split(',') }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pmRachAtt,pmRachFail,pmRachSetupFail">RACH 메트릭</SelectItem>
                <SelectItem value="pmErabEstabAtt,pmErabEstabFail">ERAB 메트릭</SelectItem>
                <SelectItem value="pmPdcpSduDelayDl,pmPdcpSduDelayUl">PDCP 메트릭</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setShowCreateForm(false)}>
            취소
          </Button>
          <Button onClick={handleCreateJob} disabled={!newJob.name.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            작업 생성
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">배치 분석 관리</h1>
          <p className="text-gray-600 mt-1">
            다중 분석 작업을 일괄로 처리하고 관리합니다
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          새 작업 생성
        </Button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'jobs', label: '작업 목록', icon: Database },
          { id: 'queue', label: '분석 큐', icon: Clock },
          { id: 'results', label: '결과 요약', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1"
            >
              <Icon className="h-4 w-4 mr-2" />
              {tab.label}
            </Button>
          )
        })}
      </div>

      {/* 새 작업 생성 폼 */}
      {showCreateForm && (
        <CreateJobForm />
      )}

      {/* 메인 콘텐츠 */}
      {activeTab === 'jobs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 작업 목록 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  배치 작업 목록
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>작업명</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>진행률</TableHead>
                      <TableHead>생성시간</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchJobs.map((job) => {
                      const config = getStatusConfig(job.status)
                      return (
                        <TableRow
                          key={job.id}
                          className={`cursor-pointer hover:bg-gray-50 ${
                            selectedJob?.id === job.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{job.name}</p>
                              <p className="text-sm text-gray-600">{job.neCount} NE, {job.cellCount} 셀</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={config.color}>
                              {config.icon}
                              <span className="ml-1">{config.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress value={job.progress} className="w-16 h-2" />
                              <span className="text-sm">{job.progress.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              {job.status === 'queued' && (
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleStartJob(job.id); }}>
                                  <Play className="h-3 w-3" />
                                </Button>
                              )}
                              {job.status === 'running' && (
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handlePauseJob(job.id); }}>
                                  <Pause className="h-3 w-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* 선택된 작업 상세 정보 */}
          <div>
            {selectedJob ? (
              <JobDetails job={selectedJob} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>작업을 선택하여 상세 정보를 확인하세요</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 분석 큐 탭 */}
      {activeTab === 'queue' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              분석 큐 상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{batchJobs.filter(j => j.status === 'running').length}</p>
                  <p className="text-sm text-gray-600">실행중</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{batchJobs.filter(j => j.status === 'queued').length}</p>
                  <p className="text-sm text-gray-600">대기중</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{batchJobs.filter(j => j.status === 'completed').length}</p>
                  <p className="text-sm text-gray-600">완료</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">실행중인 작업</h3>
                {batchJobs.filter(job => job.status === 'running').map(job => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{job.name}</p>
                      <p className="text-sm text-gray-600">
                        {job.completedTasks}/{job.totalTasks} 작업 완료
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Progress value={job.progress} className="w-20 h-2" />
                      <span className="text-sm">{job.progress.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
                {batchJobs.filter(job => job.status === 'running').length === 0 && (
                  <p className="text-gray-500 text-center py-4">실행중인 작업이 없습니다</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과 요약 탭 */}
      {activeTab === 'results' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                분석 결과 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">총 분석 작업</span>
                  <span className="font-medium">{batchJobs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">완료된 작업</span>
                  <span className="font-medium text-green-600">
                    {batchJobs.filter(j => j.status === 'completed').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">총 발견사항</span>
                  <span className="font-medium">
                    {batchJobs.reduce((sum, job) => sum + (job.resultSummary?.totalFindings || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">중요 이슈</span>
                  <span className="font-medium text-red-600">
                    {batchJobs.reduce((sum, job) => sum + (job.resultSummary?.criticalIssues || 0), 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="h-5 w-5 mr-2" />
                내보내기 옵션
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  전체 결과 CSV 내보내기
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  분석 리포트 PDF 생성
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  요약 대시보드 내보내기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default BatchAnalysisManager




