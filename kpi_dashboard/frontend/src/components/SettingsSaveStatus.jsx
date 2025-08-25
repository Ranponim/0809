/**
 * SettingsSaveStatus 컴포넌트
 * 
 * PreferenceContext와 연동하여 설정 저장 상태를 실시간으로 표시합니다.
 * toast 알림과 인라인 상태 표시를 모두 지원합니다.
 */

import React, { useEffect } from 'react'
import { usePreference } from '@/contexts/PreferenceContext'
import { SaveStatusIndicator, SAVE_STATUS, useSaveStatusIndicator } from '@/components/ui/save-status-indicator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * 설정 저장 상태 표시 컴포넌트
 */
export const SettingsSaveStatus = ({
  className,
  variant = 'compact',
  showToast = true,
  showInlineStatus = true,
  position = 'top-right', // 'top-right', 'bottom-right', 'top-left', 'bottom-left', 'inline'
  autoHide = true,
  customMessages = {}
}) => {
  const { 
    saving, 
    error, 
    lastSaved, 
    hasUnsavedChanges,
    localStorageAvailable,
    syncStatus 
  } = usePreference()

  const {
    status,
    message,
    error: statusError,
    showSaving,
    showSaved,
    showError,
    reset
  } = useSaveStatusIndicator()

  // PreferenceContext 상태 변화 감지 및 UI 업데이트
  useEffect(() => {
    if (saving) {
      const savingMessage = customMessages.saving || 
        (syncStatus === 'syncing' ? '서버와 동기화 중...' : '설정 저장 중...')
      
      showSaving(savingMessage)
      
      if (showToast) {
        toast.loading(savingMessage, {
          id: 'settings-save'
        })
      }
    } else if (error) {
      const errorMessage = customMessages.error || error
      showError(errorMessage)
      
      if (showToast) {
        toast.error(errorMessage, {
          id: 'settings-save',
          duration: 5000,
          action: localStorageAvailable ? undefined : {
            label: '새로고침',
            onClick: () => window.location.reload()
          }
        })
      }
    } else if (lastSaved && !hasUnsavedChanges && !saving) {
      const savedMessage = customMessages.saved || '설정이 저장되었습니다!'
      showSaved(savedMessage)
      
      if (showToast) {
        toast.success(savedMessage, {
          id: 'settings-save',
          duration: 3000
        })
      }
    }
  }, [
    saving, 
    error, 
    lastSaved, 
    hasUnsavedChanges, 
    syncStatus,
    localStorageAvailable,
    showSaving, 
    showSaved, 
    showError, 
    showToast,
    customMessages
  ])

  // 인라인 상태 표시가 비활성화된 경우 null 반환
  if (!showInlineStatus) {
    return null
  }

  // position이 'inline'이 아닌 경우 고정 위치 표시
  if (position !== 'inline') {
    const positionClasses = {
      'top-right': 'fixed top-4 right-4 z-50',
      'bottom-right': 'fixed bottom-4 right-4 z-50',
      'top-left': 'fixed top-4 left-4 z-50',
      'bottom-left': 'fixed bottom-4 left-4 z-50'
    }

    return (
      <div className={cn(positionClasses[position], className)}>
        <SaveStatusIndicator
          status={status}
          message={message}
          error={statusError}
          variant={variant}
          autoHide={autoHide}
          onHide={reset}
        />
      </div>
    )
  }

  // 인라인 표시
  return (
    <SaveStatusIndicator
      status={status}
      message={message}
      error={statusError}
      variant={variant}
      autoHide={autoHide}
      onHide={reset}
      className={className}
    />
  )
}

/**
 * 미저장 변경사항 경고 컴포넌트
 */
export const UnsavedChangesWarning = ({ 
  className,
  variant = 'compact',
  showIcon = true 
}) => {
  const { hasUnsavedChanges, saving } = usePreference()

  if (!hasUnsavedChanges || saving) {
    return null
  }

  return (
    <SaveStatusIndicator
      status="warning"
      message="저장되지 않은 변경사항이 있습니다"
      variant={variant}
      showIcon={showIcon}
      autoHide={false}
      className={cn('bg-yellow-50 border-yellow-200', className)}
    />
  )
}

/**
 * LocalStorage 상태 표시 컴포넌트
 */
export const LocalStorageStatus = ({ 
  className,
  variant = 'icon-only' 
}) => {
  const { localStorageAvailable, syncStatus } = usePreference()

  if (localStorageAvailable && syncStatus !== 'error') {
    return null
  }

  const getStatusInfo = () => {
    if (!localStorageAvailable) {
      return {
        status: SAVE_STATUS.ERROR,
        message: 'LocalStorage 사용 불가',
        error: '브라우저 저장소에 접근할 수 없습니다'
      }
    }
    
    if (syncStatus === 'error') {
      return {
        status: SAVE_STATUS.ERROR,
        message: '동기화 오류',
        error: '서버와의 동기화에 실패했습니다'
      }
    }

    return {
      status: SAVE_STATUS.IDLE,
      message: '정상',
      error: ''
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <SaveStatusIndicator
      status={statusInfo.status}
      message={statusInfo.message}
      error={statusInfo.error}
      variant={variant}
      autoHide={false}
      className={className}
    />
  )
}

/**
 * 통합 설정 상태 패널
 */
export const SettingsStatusPanel = ({ 
  className,
  showSaveStatus = true,
  showUnsavedWarning = true,
  showLocalStorageStatus = true 
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLocalStorageStatus && <LocalStorageStatus />}
      {showUnsavedWarning && <UnsavedChangesWarning />}
      {showSaveStatus && (
        <SettingsSaveStatus 
          position="inline" 
          variant="compact"
          showToast={false}
        />
      )}
    </div>
  )
}

export default SettingsSaveStatus
