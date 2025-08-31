/**
 * AnalysisLoadingState.jsx
 *
 * 분석 중 로딩 상태를 표시하는 범용 컴포넌트
 * 다양한 로딩 시나리오에 맞게 커스터마이징 가능
 *
 * 사용법:
 * ```jsx
 * <AnalysisLoadingState
 *   message="데이터를 분석하고 있습니다..."
 *   progress={75}
 *   showProgress={true}
 *   size="large"
 *   analysisType="statistics"
 * />
 * ```
 */

import React, { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import {
  Loader2, Database, Brain, TrendingUp, Activity,
  Clock, BarChart3, FileText
} from 'lucide-react'

const AnalysisLoadingState = memo(({
  // 필수 Props
  message = '분석 중...',

  // 옵션 Props
  progress = null,
  showProgress = false,
  size = 'medium', // 'small' | 'medium' | 'large'
  analysisType = 'general', // 'general' | 'statistics' | 'llm' | 'trend' | 'database'

  // 커스터마이징 옵션
  icon = null,
  title = '분석 진행 중',
  description = '',
  estimatedTime = '',

  // 스타일링
  className = '',
  variant = 'default' // 'default' | 'compact' | 'card'
}) => {
  // 분석 타입별 아이콘 매핑
  const getAnalysisIcon = () => {
    if (icon) return icon

    switch (analysisType) {
      case 'statistics':
        return <BarChart3 className="h-6 w-6" />
      case 'llm':
        return <Brain className="h-6 w-6" />
      case 'trend':
        return <TrendingUp className="h-6 w-6" />
      case 'database':
        return <Database className="h-6 w-6" />
      default:
        return <Activity className="h-6 w-6" />
    }
  }

  // 분석 타입별 색상 매핑
  const getAnalysisColor = () => {
    switch (analysisType) {
      case 'statistics':
        return 'text-blue-600'
      case 'llm':
        return 'text-purple-600'
      case 'trend':
        return 'text-green-600'
      case 'database':
        return 'text-orange-600'
      default:
        return 'text-gray-600'
    }
  }

  // 크기별 스타일링
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          spinner: 'h-4 w-4',
          icon: 'h-4 w-4',
          title: 'text-sm',
          message: 'text-xs',
          container: 'h-24'
        }
      case 'large':
        return {
          spinner: 'h-8 w-8',
          icon: 'h-8 w-8',
          title: 'text-xl',
          message: 'text-base',
          container: 'h-64'
        }
      default: // medium
        return {
          spinner: 'h-6 w-6',
          icon: 'h-6 w-6',
          title: 'text-lg',
          message: 'text-sm',
          container: 'h-48'
        }
    }
  }

  const styles = getSizeStyles()

  // Compact 버전
  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center gap-3 p-4 ${className}`}>
        <Loader2 className={`${styles.spinner} animate-spin ${getAnalysisColor()}`} />
        <div className="flex-1">
          <p className={`${styles.message} font-medium`}>{message}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {showProgress && progress !== null && (
          <div className="w-16">
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </div>
    )
  }

  // Card 버전
  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardContent className={`flex flex-col items-center justify-center ${styles.container}`}>
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className={`${styles.spinner} animate-spin ${getAnalysisColor()}`} />
            {getAnalysisIcon()}
          </div>

          <h3 className={`${styles.title} font-medium mb-2`}>{title}</h3>
          <p className={`${styles.message} text-muted-foreground text-center mb-4`}>
            {message}
          </p>

          {description && (
            <p className="text-xs text-muted-foreground text-center mb-4">
              {description}
            </p>
          )}

          {showProgress && progress !== null && (
            <div className="w-full max-w-xs mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">진행률</span>
                <span className="text-xs font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {estimatedTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>예상 소요 시간: {estimatedTime}</span>
            </div>
          )}

          {/* 분석 타입별 추가 정보 */}
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {analysisType === 'statistics' ? '통계 분석' :
               analysisType === 'llm' ? 'LLM 분석' :
               analysisType === 'trend' ? '트렌드 분석' :
               analysisType === 'database' ? '데이터베이스 조회' :
               '분석 중'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default 버전
  return (
    <div className={`flex flex-col items-center justify-center ${styles.container} ${className}`}>
      {/* 아이콘과 스피너 */}
      <div className="relative mb-4">
        <Loader2 className={`${styles.spinner} animate-spin ${getAnalysisColor()}`} />
        <div className="absolute inset-0 flex items-center justify-center">
          {getAnalysisIcon()}
        </div>
      </div>

      {/* 타이틀 */}
      <h3 className={`${styles.title} font-medium mb-2 text-center`}>
        {title}
      </h3>

      {/* 메시지 */}
      <p className={`${styles.message} text-muted-foreground text-center mb-4`}>
        {message}
      </p>

      {/* 설명 */}
      {description && (
        <p className="text-xs text-muted-foreground text-center mb-4">
          {description}
        </p>
      )}

      {/* 진행률 바 */}
      {showProgress && progress !== null && (
        <div className="w-full max-w-xs mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">진행률</span>
            <span className="text-xs font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* 예상 소요 시간 */}
      {estimatedTime && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Clock className="h-3 w-3" />
          <span>예상 소요 시간: {estimatedTime}</span>
        </div>
      )}

      {/* 분석 정보 */}
      <div className="flex flex-col items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {analysisType === 'statistics' ? '📊 통계 분석' :
           analysisType === 'llm' ? '🤖 LLM 분석' :
           analysisType === 'trend' ? '📈 트렌드 분석' :
           analysisType === 'database' ? '🗄️ 데이터베이스 조회' :
           '🔄 분석 진행 중'}
        </Badge>

        {/* 단계별 진행 표시 (예시) */}
        <div className="flex items-center gap-1 mt-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  )
})

AnalysisLoadingState.displayName = 'AnalysisLoadingState'

export default AnalysisLoadingState
