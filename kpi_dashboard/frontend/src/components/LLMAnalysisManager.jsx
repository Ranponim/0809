/**
 * LLM 분석 관리 컴포넌트
 * 
 * Frontend Database Setting을 활용하여 LLM 분석을 요청하고 결과를 관리합니다.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  Brain, 
  Database, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Settings,
  Calendar,
  Filter,
  FileText
} from 'lucide-react'

import { triggerLLMAnalysis, getLLMAnalysisResult, testDatabaseConnection } from '@/lib/apiClient'

const LLMAnalysisManager = () => {
  // Database 설정 상태
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    dbname: 'postgres'
  })

  // 분석 파라미터 상태
  const [analysisParams, setAnalysisParams] = useState({
    n_minus_1: '',
    n: '',
    table: 'summary',
    ne: '',
    cellid: '',
    preference: '',
    columns: {
      time: 'datetime',
      peg_name: 'peg_name',
      value: 'value',
      ne: 'ne',
      cellid: 'cellid'
    }
  })

  // UI 상태
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentAnalysis, setCurrentAnalysis] = useState(null)
  const [analysisHistory, setAnalysisHistory] = useState([])

  // Database 연결 테스트
  const handleTestConnection = async () => {
    if (!dbConfig.host || !dbConfig.password) {
      toast.error('Host와 Password는 필수 입력값입니다.')
      return
    }

    setIsConnecting(true)
    try {
      const result = await testDatabaseConnection(dbConfig)
      
      if (result.success) {
        setConnectionStatus({ type: 'success', message: 'Database 연결 성공' })
        toast.success('Database 연결이 성공했습니다.')
      } else {
        setConnectionStatus({ type: 'error', message: result.error })
        toast.error(`Database 연결 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Connection test error:', error)
      setConnectionStatus({ type: 'error', message: error.message })
      toast.error('연결 테스트 중 오류가 발생했습니다.')
    } finally {
      setIsConnecting(false)
    }
  }

  // LLM 분석 실행
  const handleStartAnalysis = async () => {
    // 필수 파라미터 검증
    if (!analysisParams.n_minus_1 || !analysisParams.n) {
      toast.error('분석 기간(N-1, N)을 모두 입력해주세요.')
      return
    }

    if (connectionStatus?.type !== 'success') {
      toast.error('먼저 Database 연결을 확인해주세요.')
      return
    }

    setIsAnalyzing(true)
    try {
      console.log('🚀 LLM 분석 시작:', { dbConfig, analysisParams })
      
      const result = await triggerLLMAnalysis(dbConfig, analysisParams)
      
      console.log('✅ LLM 분석 트리거 성공:', result)
      
      setCurrentAnalysis({
        id: result.analysis_id,
        status: 'processing',
        message: result.message,
        startTime: new Date()
      })

      toast.success('LLM 분석이 시작되었습니다. 잠시 후 결과를 확인할 수 있습니다.')
      
      // 결과 폴링 시작
      pollAnalysisResult(result.analysis_id)
      
    } catch (error) {
      console.error('❌ LLM 분석 요청 실패:', error)
      toast.error(`분석 요청 실패: ${error.message}`)
      setIsAnalyzing(false)
    }
  }

  // 분석 결과 폴링
  const pollAnalysisResult = (analysisId) => {
    const pollInterval = setInterval(async () => {
      try {
        const result = await getLLMAnalysisResult(analysisId)
        
        console.log('📊 폴링 결과:', result)
        
        if (result.status === 'completed' || result.status === 'error') {
          clearInterval(pollInterval)
          setIsAnalyzing(false)
          
          setCurrentAnalysis(prev => ({
            ...prev,
            status: result.status,
            result: result,
            endTime: new Date()
          }))

          // 히스토리에 추가
          setAnalysisHistory(prev => [
            {
              id: analysisId,
              status: result.status,
              startTime: new Date(),
              params: analysisParams,
              result: result
            },
            ...prev
          ])

          if (result.status === 'completed') {
            toast.success('LLM 분석이 완료되었습니다!')
          } else {
            toast.error('LLM 분석 중 오류가 발생했습니다.')
          }
        }
      } catch (error) {
        console.error('폴링 오류:', error)
        clearInterval(pollInterval)
        setIsAnalyzing(false)
      }
    }, 5000) // 5초마다 폴링

    // 10분 후 타임아웃
    setTimeout(() => {
      clearInterval(pollInterval)
      if (isAnalyzing) {
        setIsAnalyzing(false)
        toast.error('분석 시간이 초과되었습니다. 관리자에게 문의하세요.')
      }
    }, 600000)
  }

  // 입력 핸들러들
  const handleDbConfigChange = (field, value) => {
    setDbConfig(prev => ({
      ...prev,
      [field]: value
    }))
    setConnectionStatus(null) // 설정 변경 시 연결 상태 초기화
  }

  const handleAnalysisParamChange = (field, value) => {
    setAnalysisParams(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            LLM 분석 관리자
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            PostgreSQL Database에서 데이터를 조회하여 LLM 기반 성능 분석을 수행합니다.
          </p>
        </CardContent>
      </Card>

      {/* Database 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={dbConfig.host}
                onChange={(e) => handleDbConfigChange('host', e.target.value)}
                placeholder="localhost"
              />
            </div>
            <div>
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={dbConfig.port}
                onChange={(e) => handleDbConfigChange('port', parseInt(e.target.value))}
                placeholder="5432"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="user">User</Label>
              <Input
                id="user"
                value={dbConfig.user}
                onChange={(e) => handleDbConfigChange('user', e.target.value)}
                placeholder="postgres"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={dbConfig.password}
                onChange={(e) => handleDbConfigChange('password', e.target.value)}
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dbname">Database Name</Label>
            <Input
              id="dbname"
              value={dbConfig.dbname}
              onChange={(e) => handleDbConfigChange('dbname', e.target.value)}
              placeholder="postgres"
            />
          </div>

          {/* 연결 상태 표시 */}
          {connectionStatus && (
            <Alert variant={connectionStatus.type === 'success' ? 'default' : 'destructive'}>
              <AlertDescription className="flex items-center gap-2">
                {connectionStatus.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {connectionStatus.message}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleTestConnection} 
            disabled={isConnecting}
            variant="outline"
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                연결 확인 중...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                연결 테스트
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 분석 파라미터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            분석 파라미터
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="n_minus_1">기간 N-1</Label>
              <Input
                id="n_minus_1"
                value={analysisParams.n_minus_1}
                onChange={(e) => handleAnalysisParamChange('n_minus_1', e.target.value)}
                placeholder="2025-07-01_00:00~2025-07-01_23:59"
              />
            </div>
            <div>
              <Label htmlFor="n">기간 N</Label>
              <Input
                id="n"
                value={analysisParams.n}
                onChange={(e) => handleAnalysisParamChange('n', e.target.value)}
                placeholder="2025-07-02_00:00~2025-07-02_23:59"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="table">테이블명</Label>
            <Input
              id="table"
              value={analysisParams.table}
              onChange={(e) => handleAnalysisParamChange('table', e.target.value)}
              placeholder="summary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ne">Network Element (선택)</Label>
              <Input
                id="ne"
                value={analysisParams.ne}
                onChange={(e) => handleAnalysisParamChange('ne', e.target.value)}
                placeholder="nvgnb#10000"
              />
            </div>
            <div>
              <Label htmlFor="cellid">Cell ID (선택)</Label>
              <Input
                id="cellid"
                value={analysisParams.cellid}
                onChange={(e) => handleAnalysisParamChange('cellid', e.target.value)}
                placeholder="2010,2011"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="preference">특정 PEG 분석 (선택)</Label>
            <Textarea
              id="preference"
              value={analysisParams.preference}
              onChange={(e) => handleAnalysisParamChange('preference', e.target.value)}
              placeholder="Random_access_preamble_count,Random_access_response"
              rows={2}
            />
          </div>

          <Button 
            onClick={handleStartAnalysis} 
            disabled={isAnalyzing || connectionStatus?.type !== 'success'}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                분석 실행 중...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                LLM 분석 시작
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 현재 분석 상태 */}
      {currentAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              현재 분석 상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">분석 ID: {currentAnalysis.id}</p>
                <p className="text-sm text-muted-foreground">{currentAnalysis.message}</p>
              </div>
              <Badge variant={
                currentAnalysis.status === 'processing' ? 'default' :
                currentAnalysis.status === 'completed' ? 'success' : 'destructive'
              }>
                {currentAnalysis.status === 'processing' ? '처리 중' :
                 currentAnalysis.status === 'completed' ? '완료' : '오류'}
              </Badge>
            </div>
            
            {currentAnalysis.result && currentAnalysis.status === 'completed' && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">분석 결과</p>
                <div className="space-y-2 text-sm">
                  {currentAnalysis.result.report_path && (
                    <p>📄 리포트: {currentAnalysis.result.report_path}</p>
                  )}
                  {currentAnalysis.result.results?.analysis && (
                    <p>🧠 LLM 분석: 완료</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 분석 히스토리 */}
      {analysisHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              분석 히스토리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisHistory.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">분석 #{index + 1}</p>
                    <Badge variant={item.status === 'completed' ? 'success' : 'destructive'}>
                      {item.status === 'completed' ? '완료' : '오류'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>기간: {item.params.n_minus_1} vs {item.params.n}</p>
                    <p>시간: {item.startTime.toLocaleString()}</p>
                    <p>ID: {item.id}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default LLMAnalysisManager

