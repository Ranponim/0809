/**
 * AnalysisErrorDisplay.jsx
 *
 * 분석 오류를 표시하는 범용 컴포넌트
 * 다양한 오류 타입에 맞게 커스터마이징된 오류 메시지 표시
 *
 * 사용법:
 * ```jsx
 * <AnalysisErrorDisplay
 *   error={error}
 *   analysisType="statistics"
 *   onRetry={handleRetry}
 *   showDetails={true}
 * />
 * ```
 */

import React, { useState, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx'
import {
  AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
  Database, Brain, BarChart3, AlertCircle,
  HelpCircle, ExternalLink, Copy
} from 'lucide-react'
import { toast } from 'sonner'

const AnalysisErrorDisplay = memo(({
  // 필수 Props
  error,

  // 옵션 Props
  analysisType = 'general', // 'general' | 'statistics' | 'llm' | 'database' | 'network'
  title = '오류가 발생했습니다',
  showRetry = true,
  showDetails = true,
  compact = false,

  // 이벤트 핸들러
  onRetry,
  onClose,

  // 커스터마이징 옵션
  customMessage = '',
  suggestedActions = [],

  // 스타일링
  className = '',
  variant = 'card' // 'card' | 'inline' | 'banner'
}) => {
  const [showErrorDetails, setShowErrorDetails] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // 오류 타입 분석
  const analyzeError = (error) => {
    if (!error) return { type: 'unknown', message: '알 수 없는 오류' }

    // 네트워크 오류
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
      return {
        type: 'network',
        message: '네트워크 연결 오류',
        description: '서버와의 연결에 문제가 있습니다.',
        suggestions: [
          '인터넷 연결을 확인해주세요.',
          '잠시 후 다시 시도해주세요.',
          '방화벽 설정을 확인해주세요.'
        ]
      }
    }

    // 타임아웃 오류
    if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
      return {
        type: 'timeout',
        message: '요청 시간 초과',
        description: '서버 응답이 너무 오래 걸렸습니다.',
        suggestions: [
          '네트워크 속도를 확인해주세요.',
          '요청량이 많은 시간대에는 재시도해주세요.',
          '관리자에게 문의해주세요.'
        ]
      }
    }

    // 데이터베이스 오류
    if (error.message?.includes('database') || error.message?.includes('connection')) {
      return {
        type: 'database',
        message: '데이터베이스 오류',
        description: '데이터베이스 연결에 문제가 있습니다.',
        suggestions: [
          'Database 설정을 확인해주세요.',
          'Database 서버 상태를 확인해주세요.',
          '관리자에게 문의해주세요.'
        ]
      }
    }

    // API 오류
    if (error.response) {
      const status = error.response.status
      const statusText = error.response.statusText

      if (status === 400) {
        return {
          type: 'validation',
          message: '잘못된 요청',
          description: '요청 데이터가 올바르지 않습니다.',
          suggestions: [
            '입력값을 다시 확인해주세요.',
            '필수 필드가 모두 입력되었는지 확인해주세요.'
          ]
        }
      }

      if (status === 401) {
        return {
          type: 'auth',
          message: '인증 오류',
          description: '접근 권한이 없습니다.',
          suggestions: [
            '로그인을 다시 시도해주세요.',
            '관리자에게 권한을 요청해주세요.'
          ]
        }
      }

      if (status === 403) {
        return {
          type: 'forbidden',
          message: '접근 거부',
          description: '이 작업을 수행할 권한이 없습니다.',
          suggestions: [
            '관리자에게 권한을 요청해주세요.',
            '다른 계정으로 시도해주세요.'
          ]
        }
      }

      if (status === 404) {
        return {
          type: 'not_found',
          message: '데이터를 찾을 수 없음',
          description: '요청한 데이터를 찾을 수 없습니다.',
          suggestions: [
            '검색 조건을 변경해보세요.',
            '데이터가 존재하는지 확인해주세요.'
          ]
        }
      }

      if (status >= 500) {
        return {
          type: 'server',
          message: '서버 오류',
          description: '서버에서 오류가 발생했습니다.',
          suggestions: [
            '잠시 후 다시 시도해주세요.',
            '관리자에게 문의해주세요.'
          ]
        }
      }

      return {
        type: 'api',
        message: `${status} ${statusText}`,
        description: 'API 요청 중 오류가 발생했습니다.',
        suggestions: [
          '네트워크 연결을 확인해주세요.',
          '관리자에게 문의해주세요.'
        ]
      }
    }

    // 기타 오류
    return {
      type: 'general',
      message: error.message || '오류가 발생했습니다',
      description: '예상치 못한 오류가 발생했습니다.',
      suggestions: [
        '페이지를 새로고침해보세요.',
        '관리자에게 문의해주세요.'
      ]
    }
  }

  const errorInfo = analyzeError(error)
  const finalMessage = customMessage || errorInfo.message

  // 오류 타입별 아이콘
  const getErrorIcon = () => {
    switch (errorInfo.type) {
      case 'network':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'database':
        return <Database className="h-5 w-5 text-orange-500" />
      case 'timeout':
        return <RefreshCw className="h-5 w-5 text-yellow-500" />
      case 'validation':
        return <AlertTriangle className="h-5 w-5 text-blue-500" />
      case 'auth':
      case 'forbidden':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <AlertTriangle className="h-5 w-5 text-red-500" />
    }
  }

  // 분석 타입별 배경색
  const getBackgroundColor = () => {
    switch (analysisType) {
      case 'statistics':
        return 'bg-blue-50 border-blue-200'
      case 'llm':
        return 'bg-purple-50 border-purple-200'
      case 'database':
        return 'bg-orange-50 border-orange-200'
      case 'network':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-red-50 border-red-200'
    }
  }

  // 재시도 핸들러
  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      if (onRetry) {
        await onRetry()
        toast.success('재시도 중...')
      }
    } catch (retryError) {
      console.error('재시도 실패:', retryError)
      toast.error('재시도에 실패했습니다.')
    } finally {
      setIsRetrying(false)
    }
  }

  // 오류 정보 복사
  const copyErrorDetails = () => {
    const errorDetails = {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data,
      timestamp: new Date().toISOString(),
      analysisType,
      userAgent: navigator.userAgent
    }

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => toast.success('오류 정보가 클립보드에 복사되었습니다.'))
      .catch(() => toast.error('클립보드 복사에 실패했습니다.'))
  }

  // Inline 버전
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-md ${getBackgroundColor()} ${className}`}>
        {getErrorIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700">{finalMessage}</p>
          {errorInfo.description && (
            <p className="text-xs text-red-600">{errorInfo.description}</p>
          )}
        </div>
        {showRetry && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="text-xs"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                재시도 중...
              </>
            ) : (
              '재시도'
            )}
          </Button>
        )}
      </div>
    )
  }

  // Banner 버전
  if (variant === 'banner') {
    return (
      <div className={`flex items-center justify-between p-4 ${getBackgroundColor()} ${className}`}>
        <div className="flex items-center gap-3">
          {getErrorIcon()}
          <div>
            <p className="font-medium text-red-700">{finalMessage}</p>
            {errorInfo.description && (
              <p className="text-sm text-red-600">{errorInfo.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="text-red-700 hover:text-red-800"
            >
              {showErrorDetails ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  숨기기
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  자세히
                </>
              )}
            </Button>
          )}

          {showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                  재시도 중...
                </>
              ) : (
                '재시도'
              )}
            </Button>
          )}
        </div>

        {/* 상세 정보 */}
        {showDetails && showErrorDetails && (
          <div className="mt-4 p-3 bg-white rounded border">
            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  }

  // Card 버전 (기본)
  return (
    <Card className={`${getBackgroundColor()} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-700">
          {getErrorIcon()}
          {title}
          <Badge variant="outline" className="text-xs">
            {analysisType === 'statistics' ? '통계 분석' :
             analysisType === 'llm' ? 'LLM 분석' :
             analysisType === 'database' ? '데이터베이스' :
             analysisType === 'network' ? '네트워크' :
             '일반 오류'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 오류 메시지 */}
        <div>
          <p className="font-medium text-red-700 mb-1">{finalMessage}</p>
          {errorInfo.description && (
            <p className="text-sm text-red-600">{errorInfo.description}</p>
          )}
        </div>

        {/* 제안 사항 */}
        {(errorInfo.suggestions?.length > 0 || suggestedActions.length > 0) && (
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
              <HelpCircle className="h-4 w-4" />
              해결 방법
            </h4>
            <ul className="space-y-1 text-sm text-red-600">
              {[...(errorInfo.suggestions || []), ...suggestedActions].map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 액션 버튼들 */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {showRetry && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                    재시도 중...
                  </>
                ) : (
                  '재시도'
                )}
              </Button>
            )}

            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                닫기
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyErrorDetails}
              className="text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              오류 복사
            </Button>

            {showDetails && (
              <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    {showErrorDetails ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        숨기기
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        자세히
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-3">
                  <div className="p-3 bg-white rounded border border-red-200">
                    <h5 className="text-xs font-medium text-red-700 mb-2">오류 상세 정보</h5>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-32">
                      {error ? JSON.stringify({
                        message: error.message,
                        stack: error.stack,
                        response: error.response?.data,
                        status: error.response?.status,
                        timestamp: new Date().toISOString()
                      }, null, 2) : '오류 정보가 없습니다.'}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

AnalysisErrorDisplay.displayName = 'AnalysisErrorDisplay'

export default AnalysisErrorDisplay
