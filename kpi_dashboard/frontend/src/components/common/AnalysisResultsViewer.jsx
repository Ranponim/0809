/**
 * AnalysisResultsViewer.jsx
 *
 * 분석 결과를 표시하기 위한 범용 컴포넌트
 * 테이블 뷰와 차트 뷰를 지원하며 다양한 분석 타입에 맞게 확장 가능
 *
 * 사용법:
 * ```jsx
 * <AnalysisResultsViewer
 *   results={analysisResults}
 *   analysisType="statistics" // "statistics" | "llm" | "trend"
 *   displayType="table" // "table" | "chart" | "mixed"
 *   showExport={true}
 *   onExport={handleExport}
 * />
 * ```
 */

import React, { useState, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table.jsx'
import {
  Eye, BarChart3, Download, TrendingUp, TrendingDown, Minus,
  CheckCircle, AlertTriangle, FileText, Database
} from 'lucide-react'
import { toast } from 'sonner'

import ComparisonChart from '../ComparisonChart.jsx'

const AnalysisResultsViewer = memo(({
  // 필수 Props
  results,

  // 옵션 Props
  analysisType = 'statistics', // "statistics" | "llm" | "trend"
  displayType = 'mixed', // "table" | "chart" | "mixed"
  title = '분석 결과',

  // 내보내기 옵션
  showExport = false,
  exportOptions = ['csv', 'json', 'pdf'],
  onExport,

  // 선택 옵션
  showSelection = false,
  selectedItems = new Set(),
  onSelectionChange,

  // 차트 옵션
  chartConfig = {},
  showChartControls = true,

  // 스타일링
  className = '',
  compact = false,

  // 기타 옵션
  loading = false,
  error = null
}) => {
  // 로컬 상태
  const [activeTab, setActiveTab] = useState(displayType === 'mixed' ? 'table' : displayType)
  const [isExporting, setIsExporting] = useState(false)

  // 결과 데이터 처리
  const processedResults = useMemo(() => {
    if (!results) return null

    // 분석 타입별 데이터 처리
    switch (analysisType) {
      case 'statistics':
        return processStatisticsResults(results)
      case 'llm':
        return processLLMResults(results)
      case 'trend':
        return processTrendResults(results)
      default:
        return results
    }
  }, [results, analysisType])

  // 통계 분석 결과 처리
  const processStatisticsResults = (results) => {
    if (!results?.analysis_results) return null

    return {
      summary: results.summary || {},
      data: results.analysis_results.map((result, index) => ({
        id: index + 1,
        peg_name: result.peg_name,
        period1_mean: result.period1_stats?.mean || 0,
        period2_mean: result.period2_stats?.mean || 0,
        delta: result.delta || 0,
        delta_percentage: result.delta_percentage || 0,
        improvement_status: result.improvement_status,
        improvement_magnitude: result.improvement_magnitude,
        period1_rsd: result.rsd_period1 || 0,
        period2_rsd: result.rsd_period2 || 0,
        selected: selectedItems?.has(result.peg_name) || false
      })),
      metadata: results.metadata || {}
    }
  }

  // LLM 분석 결과 처리
  const processLLMResults = (results) => {
    if (!results) return null

    return {
      summary: {
        total_analyses: 1,
        status: results.status,
        analysis_type: results.analysis_type
      },
      data: [{
        id: 1,
        analysis_id: results.analysis_id,
        status: results.status,
        report_path: results.report_path,
        analysis_date: results.analysis_date,
        results_summary: results.results?.analysis || '분석 완료'
      }],
      metadata: results.metadata || {}
    }
  }

  // 트렌드 분석 결과 처리
  const processTrendResults = (results) => {
    // 트렌드 분석 결과 처리 로직
    return results
  }

  // 개선 상태 아이콘 렌더링
  const renderImprovementIcon = (status) => {
    switch (status) {
      case 'improved':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      case 'stable':
        return <Minus className="h-4 w-4 text-blue-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
  }

  // 개선 상태 뱃지 렌더링
  const renderImprovementBadge = (status, magnitude) => {
    const colors = {
      improved: 'bg-green-100 text-green-800 border-green-200',
      degraded: 'bg-red-100 text-red-800 border-red-200',
      stable: 'bg-blue-100 text-blue-800 border-blue-200'
    }

    const magnitudeText = {
      significant: '상당한',
      moderate: '보통',
      minor: '미미한',
      none: '변화없음'
    }

    return (
      <Badge className={`${colors[status] || 'bg-gray-100 text-gray-800'} text-xs`}>
        {renderImprovementIcon(status)}
        <span className="ml-1">
          {status === 'improved' ? '개선' :
           status === 'degraded' ? '악화' : '안정'}
          {magnitude && ` (${magnitudeText[magnitude]})`}
        </span>
      </Badge>
    )
  }

  // 내보내기 핸들러
  const handleExport = async (format) => {
    if (!onExport) return

    setIsExporting(true)
    try {
      await onExport(format, processedResults)
      toast.success(`${format.toUpperCase()} 파일로 내보내기가 완료되었습니다.`)
    } catch (error) {
      console.error('내보내기 오류:', error)
      toast.error('내보내기 중 오류가 발생했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  // 항목 선택 토글
  const handleItemSelection = (itemId) => {
    if (!onSelectionChange) return

    const newSelection = new Set(selectedItems)
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId)
    } else {
      newSelection.add(itemId)
    }
    onSelectionChange(newSelection)
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (!onSelectionChange || !processedResults?.data) return

    const allIds = processedResults.data.map(item =>
      analysisType === 'statistics' ? item.peg_name : item.id
    )

    if (selectedItems.size === allIds.length) {
      // 전체 해제
      onSelectionChange(new Set())
    } else {
      // 전체 선택
      onSelectionChange(new Set(allIds))
    }
  }

  // 로딩 상태
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <h3 className="text-lg font-medium mb-2">결과 로드 중...</h3>
          <p className="text-muted-foreground text-center">
            분석 결과를 불러오고 있습니다. 잠시만 기다려주세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <Card className={`${className} border-red-200`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-700 font-medium">결과 로드 오류</span>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </CardContent>
      </Card>
    )
  }

  // 결과 없음
  if (!processedResults) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">분석 결과 없음</h3>
          <p className="text-muted-foreground text-center">
            분석을 실행하면 결과를 확인할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 헤더 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {title}
            </CardTitle>

            {/* 내보내기 버튼들 */}
            {showExport && (
              <div className="flex items-center gap-2">
                {exportOptions.map((format) => (
                  <Button
                    key={format}
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(format)}
                    disabled={isExporting}
                    className="text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {format.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* 요약 정보 */}
          {processedResults.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {analysisType === 'statistics' && (
                <>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-600">
                      {processedResults.summary.total_pegs_analyzed || processedResults.data?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">분석된 PEG</div>
                  </div>

                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">
                      {processedResults.summary.improved_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">개선</div>
                  </div>

                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-xl font-bold text-red-600">
                      {processedResults.summary.degraded_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">악화</div>
                  </div>

                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl font-bold text-gray-600">
                      {processedResults.summary.stable_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">안정</div>
                  </div>
                </>
              )}

              {analysisType === 'llm' && (
                <div className="col-span-full text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-semibold text-purple-600">
                    {processedResults.summary.status === 'completed' ? '분석 완료' : '분석 중'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    분석 ID: {processedResults.data?.[0]?.analysis_id}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 결과 표시 */}
      <Card>
        <CardContent className="p-0">
          {displayType === 'mixed' ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6 pt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="table" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    테이블 뷰
                  </TabsTrigger>
                  <TabsTrigger value="chart" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    차트 뷰
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="table" className="px-6 pb-6">
                {renderTableView()}
              </TabsContent>

              <TabsContent value="chart" className="px-6 pb-6">
                {renderChartView()}
              </TabsContent>
            </Tabs>
          ) : displayType === 'table' ? (
            <div className="p-6">
              {renderTableView()}
            </div>
          ) : (
            <div className="p-6">
              {renderChartView()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  // 테이블 뷰 렌더링
  function renderTableView() {
    if (!processedResults?.data?.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          표시할 데이터가 없습니다.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* 선택 컨트롤 */}
        {showSelection && processedResults.data.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedItems.size === processedResults.data.length && processedResults.data.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium">
                  전체 선택 ({selectedItems.size}/{processedResults.data.length})
                </span>
              </div>
              {selectedItems.size > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {selectedItems.size}개 선택됨
                </Badge>
              )}
            </div>

            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectionChange?.(new Set())}
                >
                  선택 해제
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  적용하기
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 테이블 */}
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                {showSelection && <TableHead className="w-12">선택</TableHead>}

                {analysisType === 'statistics' ? (
                  <>
                    <TableHead>PEG 이름</TableHead>
                    <TableHead className="text-right">기간 1 평균</TableHead>
                    <TableHead className="text-right">기간 2 평균</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead className="text-right">Delta %</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">기간 1 RSD</TableHead>
                    <TableHead className="text-right">기간 2 RSD</TableHead>
                  </>
                ) : analysisType === 'llm' ? (
                  <>
                    <TableHead>분석 ID</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>분석 일시</TableHead>
                    <TableHead>결과 요약</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>항목</TableHead>
                    <TableHead>값</TableHead>
                    <TableHead>상태</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedResults.data.map((item, index) => (
                <TableRow key={index}>
                  {showSelection && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={item.selected || false}
                        onChange={() => handleItemSelection(
                          analysisType === 'statistics' ? item.peg_name : item.id
                        )}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </TableCell>
                  )}

                  {analysisType === 'statistics' ? (
                    <>
                      <TableCell className="font-medium">{item.peg_name}</TableCell>
                      <TableCell className="text-right">{item.period1_mean?.toFixed(4)}</TableCell>
                      <TableCell className="text-right">{item.period2_mean?.toFixed(4)}</TableCell>
                      <TableCell className={`text-right ${
                        item.delta > 0 ? 'text-green-600' :
                        item.delta < 0 ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {item.delta > 0 ? '+' : ''}{item.delta?.toFixed(4)}
                      </TableCell>
                      <TableCell className={`text-right ${
                        item.delta_percentage > 0 ? 'text-green-600' :
                        item.delta_percentage < 0 ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {item.delta_percentage > 0 ? '+' : ''}{item.delta_percentage?.toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        {renderImprovementBadge(item.improvement_status, item.improvement_magnitude)}
                      </TableCell>
                      <TableCell className="text-right">{item.period1_rsd?.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{item.period2_rsd?.toFixed(2)}%</TableCell>
                    </>
                  ) : analysisType === 'llm' ? (
                    <>
                      <TableCell className="font-mono text-sm">{item.analysis_id}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                          {item.status === 'completed' ? '완료' : '처리 중'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.analysis_date).toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={item.results_summary}>
                        {item.results_summary}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{item.name || `항목 ${index + 1}`}</TableCell>
                      <TableCell>{item.value || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status || '알 수 없음'}</Badge>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    )
  }

  // 차트 뷰 렌더링
  function renderChartView() {
    if (analysisType === 'statistics' && processedResults) {
      return (
        <ComparisonChart
          comparisonResults={results}
          title="분석 결과 차트"
          showControls={showChartControls}
          defaultChartType="bar"
          height={400}
          {...chartConfig}
        />
      )
    }

    return (
      <div className="text-center py-8 text-muted-foreground">
        차트 뷰가 지원되지 않는 분석 타입입니다.
      </div>
    )
  }
})

AnalysisResultsViewer.displayName = 'AnalysisResultsViewer'

export default AnalysisResultsViewer
