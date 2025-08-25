/**
 * SaveStatusIndicator 컴포넌트
 * 
 * 설정 저장 상태를 시각적으로 표시하는 재사용 가능한 컴포넌트입니다.
 * saving, saved, error 등의 상태를 아이콘과 텍스트로 표현합니다.
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, Loader2, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// 저장 상태 타입 정의
export const SAVE_STATUS = {
  IDLE: 'idle',
  SAVING: 'saving', 
  SAVED: 'saved',
  ERROR: 'error'
}

/**
 * 저장 상태 표시 컴포넌트
 */
export const SaveStatusIndicator = ({
  status = SAVE_STATUS.IDLE,
  message,
  error,
  className,
  variant = 'default', // 'default', 'compact', 'icon-only'
  showIcon = true,
  showText = true,
  autoHide = true,
  autoHideDuration = 3000,
  onHide
}) => {
  const [visible, setVisible] = React.useState(true)
  const [isAnimating, setIsAnimating] = React.useState(false)

  // 자동 숨김 처리 (saved 상태에서만)
  React.useEffect(() => {
    if (autoHide && status === SAVE_STATUS.SAVED && visible) {
      setIsAnimating(true)
      
      const hideTimer = setTimeout(() => {
        setVisible(false)
        setIsAnimating(false)
        if (onHide) onHide()
      }, autoHideDuration)

      return () => clearTimeout(hideTimer)
    }
  }, [status, autoHide, autoHideDuration, visible, onHide])

  // idle 상태이거나 숨겨진 경우 렌더링 안함
  if (status === SAVE_STATUS.IDLE || !visible) {
    return null
  }

  // 상태별 설정
  const getStatusConfig = () => {
    switch (status) {
      case SAVE_STATUS.SAVING:
        return {
          icon: Loader2,
          text: message || '저장 중...',
          variant: 'secondary',
          iconClass: 'animate-spin text-blue-600',
          bgClass: 'bg-blue-50 border-blue-200'
        }
      
      case SAVE_STATUS.SAVED:
        return {
          icon: CheckCircle,
          text: message || '저장 완료!',
          variant: 'default',
          iconClass: 'text-green-600',
          bgClass: 'bg-green-50 border-green-200'
        }
      
      case SAVE_STATUS.ERROR:
        return {
          icon: AlertCircle,
          text: message || error || '저장 실패',
          variant: 'destructive',
          iconClass: 'text-red-600',
          bgClass: 'bg-red-50 border-red-200'
        }
      
      default:
        return {
          icon: Clock,
          text: message || '대기 중',
          variant: 'outline',
          iconClass: 'text-gray-600',
          bgClass: 'bg-gray-50 border-gray-200'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  // compact 버전
  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-md text-sm',
        config.bgClass,
        isAnimating && 'animate-pulse',
        className
      )}>
        {showIcon && <Icon className={cn('h-3 w-3', config.iconClass)} />}
        {showText && <span className="text-xs font-medium">{config.text}</span>}
      </div>
    )
  }

  // icon-only 버전
  if (variant === 'icon-only') {
    return (
      <div className={cn(
        'flex items-center justify-center p-1 rounded-full',
        config.bgClass,
        isAnimating && 'animate-pulse',
        className
      )}>
        <Icon className={cn('h-4 w-4', config.iconClass)} />
      </div>
    )
  }

  // 기본 버전 (Badge 사용)
  return (
    <Badge 
      variant={config.variant}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 transition-all duration-300',
        isAnimating && 'animate-pulse scale-105',
        className
      )}
    >
      {showIcon && <Icon className={cn('h-4 w-4', config.iconClass)} />}
      {showText && <span className="font-medium">{config.text}</span>}
    </Badge>
  )
}

/**
 * 설정 저장 상태를 표시하는 Hook
 */
export const useSaveStatusIndicator = (initialStatus = SAVE_STATUS.IDLE) => {
  const [status, setStatus] = React.useState(initialStatus)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  const showSaving = React.useCallback((customMessage) => {
    setStatus(SAVE_STATUS.SAVING)
    setMessage(customMessage || '')
    setError('')
  }, [])

  const showSaved = React.useCallback((customMessage) => {
    setStatus(SAVE_STATUS.SAVED)
    setMessage(customMessage || '')
    setError('')
  }, [])

  const showError = React.useCallback((errorMessage) => {
    setStatus(SAVE_STATUS.ERROR)
    setMessage('')
    setError(errorMessage || '')
  }, [])

  const reset = React.useCallback(() => {
    setStatus(SAVE_STATUS.IDLE)
    setMessage('')
    setError('')
  }, [])

  return {
    status,
    message,
    error,
    showSaving,
    showSaved,
    showError,
    reset,
    // 편의 메서드
    isSaving: status === SAVE_STATUS.SAVING,
    isSaved: status === SAVE_STATUS.SAVED,
    isError: status === SAVE_STATUS.ERROR,
    isIdle: status === SAVE_STATUS.IDLE
  }
}

export default SaveStatusIndicator
