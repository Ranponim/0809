import React from 'react'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { BarChart3, TrendingUp } from 'lucide-react'
import BasicComparison from './BasicComparison.jsx'
import { useStatisticsSettings } from '@/hooks/usePreference.js'

const Statistics = () => {
  // usePreference 훅 사용
  const {
    settings: statisticsSettings,
  } = useStatisticsSettings()

  // 설정에서 기본값 추출
  const defaultDateRange = statisticsSettings.defaultDateRange || 7
  const defaultNe = statisticsSettings.defaultNe || ''
  const defaultCellId = statisticsSettings.defaultCellId || ''
  const decimalPlaces = statisticsSettings.decimalPlaces || 2
  const showComparisonOptions = statisticsSettings.showComparisonOptions !== false
  const autoCalculateStats = statisticsSettings.autoCalculateStats !== false

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Statistics</h2>
          <p className="text-muted-foreground">
            기본 날짜 범위: {defaultDateRange}일 • 소수점: {decimalPlaces}자리
            {defaultNe && ` • 기본 NE: ${defaultNe}`}
            {defaultCellId && ` • 기본 Cell: ${defaultCellId}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 상태 뱃지들 */}
          {autoCalculateStats && (
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              자동 통계 계산
            </Badge>
          )}

          {showComparisonOptions && (
            <Badge variant="outline" className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1" />
              비교 옵션 활성
            </Badge>
          )}
        </div>
      </div>

      {/* 설정 요약 */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">
          기본 기간: {defaultDateRange}일
        </Badge>
        <Badge variant="outline">
          소수점: {decimalPlaces}자리
        </Badge>
        {autoCalculateStats && (
          <Badge variant="secondary">자동 통계 계산</Badge>
        )}
        {showComparisonOptions && (
          <Badge variant="secondary">비교 옵션</Badge>
        )}
      </div>
      {/* 데이터 선택 UI는 Preference > Statistics 탭으로 이동됨 */}
      
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="basic">Basic Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-6">
          <BasicComparison />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Statistics