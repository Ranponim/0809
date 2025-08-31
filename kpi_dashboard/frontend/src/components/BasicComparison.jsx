/**
 * BasicComparison.jsx
 *
 * Statistics Basic 탭 - 두 기간 비교 분석 컴포넌트 (리팩토링 버전)
 * 공통 컴포넌트들을 사용하여 모듈화된 구조로 개선
 *
 * 사용자가 두 날짜 구간을 선택하고 PEG 데이터를 비교 분석할 수 있습니다.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import {
  Play, RefreshCw, AlertTriangle,
  CheckCircle, Download, Settings, BarChart3
} from 'lucide-react'
import { toast } from 'sonner'

import DateRangeSelector from './DateRangeSelector.jsx'
import ComparisonChart from './ComparisonChart.jsx'
import apiClient from '@/lib/apiClient.js'
import { useStatisticsSettings, usePreference } from '@/hooks/usePreference.js'

// 공통 컴포넌트들 import
import AnalysisConfigPanel from './common/AnalysisConfigPanel.jsx'
import AnalysisResultsViewer from './common/AnalysisResultsViewer.jsx'
import AnalysisLoadingState from './common/AnalysisLoadingState.jsx'
import AnalysisErrorDisplay from './common/AnalysisErrorDisplay.jsx'

const BasicComparison = () => {
  // Preference 설정 훅
  const {
    settings: statisticsSettings,
    updateSettings: updateStatisticsSettings
  } = useStatisticsSettings()

  // 전역 Preference 훅 (Dashboard 설정 업데이트용)
  const {
    preferences,
    updatePreference,
    isSaving: preferenceSaving
  } = usePreference()

  // 통합된 분석 설정 상태 (공통 컴포넌트와 연동)
  const [analysisConfig, setAnalysisConfig] = useState({
    // 기간 설정
    period1: {
      startDate: '',
      endDate: '',
      preset: 'last7days'
    },
    period2: {
      startDate: '',
      endDate: '',
      preset: 'last14days'
    },

    // PEG 선택
    selectedPegs: ['availability', 'rrc', 'erab'],

    // 분석 옵션
    includeOutliers: true,
    decimalPlaces: 4,
    showComparison: true,
    showSecondaryAxis: false,
    showThreshold: false,
    thresholdValue: 99.0,

    // 필터링
    ne: '',
    cellid: ''
  })

  // 분석 상태 관리
  const [comparisonResults, setComparisonResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastAnalysisTime, setLastAnalysisTime] = useState(null)
  const [selectedResults, setSelectedResults] = useState(new Set())
  
  // 초기 설정 로드
  useEffect(() => {
    const today = new Date()

    // 기간 1: 최근 7일
    const period1End = new Date(today)
    const period1Start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 기간 2: 그 이전 7일
    const period2End = new Date(period1Start)
    const period2Start = new Date(period1Start.getTime() - 7 * 24 * 60 * 60 * 1000)

    setAnalysisConfig(prev => ({
      ...prev,
      period1: {
        startDate: period1Start.toISOString().split('T')[0],
        endDate: period1End.toISOString().split('T')[0],
        preset: 'last7days'
      },
      period2: {
        startDate: period2Start.toISOString().split('T')[0],
        endDate: period2End.toISOString().split('T')[0],
        preset: 'custom'
      }
    }))
  }, [])

  // Settings에서 기본값 가져오기
  useEffect(() => {
    if (statisticsSettings.defaultPegs) {
      setAnalysisConfig(prev => ({
        ...prev,
        selectedPegs: statisticsSettings.defaultPegs
      }))
    }

    if (statisticsSettings.decimalPlaces !== undefined) {
      setAnalysisConfig(prev => ({
        ...prev,
        decimalPlaces: statisticsSettings.decimalPlaces
      }))
    }

    if (statisticsSettings.includeOutliers !== undefined) {
      setAnalysisConfig(prev => ({
        ...prev,
        includeOutliers: statisticsSettings.includeOutliers
      }))
    }
  }, [statisticsSettings])
  
  // 분석 설정 변경 핸들러
  const handleConfigChange = useCallback((newConfig) => {
    setAnalysisConfig(newConfig)
  }, [])

  // PEG 목록 새로고침 핸들러
  const handlePegOptionsRefresh = useCallback(async () => {
    // Database에서 PEG 목록을 다시 로드하는 로직
    console.log('🔄 PEG 옵션 새로고침')
    try {
      const response = await apiClient.get('/api/master/pegs')
      if (response.data && Array.isArray(response.data)) {
        const pegOptions = response.data.map(peg => ({
          value: peg.peg_name || peg.value || peg.id,
          label: peg.display_name || peg.label || `${peg.peg_name} (${peg.unit || 'N/A'})`
        }))
        // PEG 옵션이 업데이트되면 AnalysisConfigPanel에서 자동으로 반영됨
        console.log('✅ PEG 옵션 새로고침 완료:', pegOptions.length, '개')
      }
    } catch (error) {
      console.error('❌ PEG 옵션 새로고침 실패:', error)
      toast.error('PEG 옵션 새로고침에 실패했습니다.')
    }
  }, [])

  // 비교 분석 실행
  const executeComparison = async () => {
    // 유효성 검증
    if (!analysisConfig.period1.startDate || !analysisConfig.period1.endDate ||
        !analysisConfig.period2.startDate || !analysisConfig.period2.endDate) {
      toast.error('두 기간의 날짜를 모두 설정해주세요')
      return
    }

    if (analysisConfig.selectedPegs.length === 0) {
      toast.error('분석할 PEG를 최소 1개 이상 선택해주세요')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('🔍 Statistics 비교 분석 시작:', analysisConfig)

      // API 요청 페이로드 구성
      const requestPayload = {
        period1: {
          start_date: `${analysisConfig.period1.startDate}T00:00:00`,
          end_date: `${analysisConfig.period1.endDate}T23:59:59`
        },
        period2: {
          start_date: `${analysisConfig.period2.startDate}T00:00:00`,
          end_date: `${analysisConfig.period2.endDate}T23:59:59`
        },
        peg_names: analysisConfig.selectedPegs,
        include_outliers: analysisConfig.includeOutliers,
        decimal_places: analysisConfig.decimalPlaces,
        // 필터 옵션
        ne_filter: analysisConfig.ne ? [analysisConfig.ne] : null,
        cell_id_filter: analysisConfig.cellid ? [analysisConfig.cellid] : null
      }

      console.log('📤 API 요청 페이로드:', requestPayload)

      // API 호출
      const response = await apiClient.post('/api/statistics/compare', requestPayload)

      console.log('📥 API 응답:', response.data)

      // 결과 저장
      setComparisonResults(response.data)
      setLastAnalysisTime(new Date())

      toast.success(`비교 분석 완료! ${response.data.analysis_results?.length || 0}개 PEG 분석됨`)

    } catch (err) {
      console.error('❌ 비교 분석 실패:', err)
      setError(err)
      toast.error('비교 분석 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  // 분석 가능 상태 확인
  const canAnalyze = analysisConfig.period1.startDate && analysisConfig.period1.endDate &&
                    analysisConfig.period2.startDate && analysisConfig.period2.endDate &&
                    analysisConfig.selectedPegs.length > 0

  // 선택된 결과를 Dashboard에 저장
  const saveToDashboard = async () => {
    if (selectedResults.size === 0) {
      toast.error('저장할 PEG를 선택해주세요')
      return
    }

    try {
      console.log('💾 Dashboard에 저장할 PEG:', Array.from(selectedResults))

      // 현재 Dashboard 설정 가져오기
      const currentDashboardSettings = preferences?.dashboardSettings || {}
      const currentSelectedPegs = currentDashboardSettings?.selectedPegs || []

      // 새로 선택된 PEG 중 중복되지 않은 것들만 추가
      const newPegs = Array.from(selectedResults).filter(peg => !currentSelectedPegs.includes(peg))
      const updatedSelectedPegs = [...currentSelectedPegs, ...newPegs]

      console.log('📊 현재 Dashboard PEG:', currentSelectedPegs)
      console.log('🆕 추가할 새 PEG:', newPegs)
      console.log('📈 업데이트된 PEG 목록:', updatedSelectedPegs)

      // Preference API를 통해 Dashboard 설정 업데이트
      await updatePreference('dashboardSettings', {
        ...currentDashboardSettings,
        selectedPegs: updatedSelectedPegs
      })

      toast.success(`${selectedResults.size}개 PEG가 Dashboard에 추가되었습니다`, {
        description: `총 ${updatedSelectedPegs.length}개 PEG가 Dashboard에 설정되어 있습니다. Dashboard로 이동해서 확인해보세요!`,
        duration: 5000
      })

      // 선택 상태 초기화
      setSelectedResults(new Set())

    } catch (err) {
      console.error('❌ Dashboard 저장 실패:', err)
      toast.error('Dashboard 저장 중 오류가 발생했습니다', {
        description: err.message || '네트워크 오류일 수 있습니다'
      })
    }
  }
  
  // 로딩 상태 표시
  if (loading) {
    return (
      <AnalysisLoadingState
        message="Statistics 비교 분석을 진행하고 있습니다..."
        analysisType="statistics"
        estimatedTime="약 30-60초"
        size="large"
      />
    )
  }

  // 에러 상태 표시
  if (error) {
    return (
      <AnalysisErrorDisplay
        error={error}
        analysisType="statistics"
        onRetry={executeComparison}
        showDetails={true}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 제어 패널 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Basic 비교 분석</h2>
          <p className="text-muted-foreground">
            두 기간의 KPI 데이터를 비교하여 성능 변화를 분석합니다
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastAnalysisTime && (
            <Badge variant="outline" className="text-xs">
              마지막 분석: {lastAnalysisTime.toLocaleTimeString('ko-KR')}
            </Badge>
          )}

          <Button
            onClick={executeComparison}
            disabled={!canAnalyze}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Play className="h-4 w-4 mr-2" />
            비교 분석 실행
          </Button>
        </div>
      </div>

      {/* 분석 설정 패널 */}
      <AnalysisConfigPanel
        config={analysisConfig}
        onConfigChange={handleConfigChange}
        analysisType="statistics"
        onPegOptionsRefresh={handlePegOptionsRefresh}
        compact={false}
      />
      
      {/* 분석 결과 */}
      {comparisonResults && (
        <AnalysisResultsViewer
          results={comparisonResults}
          analysisType="statistics"
          title="비교 분석 결과"
          displayType="mixed"
          showSelection={true}
          selectedItems={selectedResults}
          onSelectionChange={setSelectedResults}
          showExport={true}
          onExport={async (format, results) => {
            // 결과 내보내기 로직
            console.log(`📤 ${format.toUpperCase()} 내보내기:`, results)
          }}
        />
      )}

      {/* 분석 대기 상태 */}
      {!comparisonResults && !loading && !error && (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">비교 분석 준비</h3>
          <p className="text-muted-foreground mb-4">
            두 기간과 분석할 PEG를 선택한 후 '비교 분석 실행' 버튼을 클릭하세요
          </p>
          <Badge variant="outline">
            {canAnalyze ? "분석 준비 완료" : "설정 필요"}
          </Badge>
        </div>
      )}
    </div>
  )
}

export default BasicComparison
