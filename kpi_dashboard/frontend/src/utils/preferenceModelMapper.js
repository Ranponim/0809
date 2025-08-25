/**
 * Preference Model Mapper
 * 
 * 프론트엔드 userSettings와 백엔드 UserPreferenceModel 간의 
 * 데이터 변환을 담당하는 유틸리티 함수들입니다.
 * 
 * Task 8.1: Initial Load Server-First Sync 구현을 위한 핵심 유틸리티
 */

import { logInfo, logError, logWarning } from './loggingUtils.js'

/**
 * 프론트엔드 userSettings를 백엔드 UserPreferenceUpdate 형태로 변환
 * @param {Object} userSettings - 프론트엔드 userSettings 객체
 * @returns {Object} 백엔드 UserPreferenceUpdate 형태의 객체
 */
export const mapUserSettingsToBackend = (userSettings) => {
  try {
    logInfo('userSettings를 백엔드 형태로 변환 시작', { userId: userSettings.userId })

    // 기본 구조 생성
    const backendData = {
      // Dashboard 설정 매핑
      dashboardSettings: {
        selected_pegs: userSettings.preferences?.dashboard?.selectedPegs || [],
        selected_nes: [], // 백엔드 호환성을 위해 빈 배열로 초기화
        selected_cell_ids: [], // 백엔드 호환성을 위해 빈 배열로 초기화
        auto_refresh: userSettings.preferences?.dashboard?.autoRefreshInterval ? 
          userSettings.preferences.dashboard.autoRefreshInterval > 0 : true,
        refresh_interval: userSettings.preferences?.dashboard?.autoRefreshInterval || 30,
        layout_config: {
          theme: userSettings.preferences?.dashboard?.theme || 'light',
          chartStyle: userSettings.preferences?.dashboard?.chartStyle || 'line',
          showLegend: userSettings.preferences?.dashboard?.showLegend !== false,
          showGrid: userSettings.preferences?.dashboard?.showGrid !== false
        },
        chart_preferences: {
          chartType: userSettings.preferences?.charts?.chartType || 'bar',
          showDelta: userSettings.preferences?.charts?.showDelta !== false,
          showRsd: userSettings.preferences?.charts?.showRsd !== false,
          decimalPlaces: userSettings.preferences?.charts?.decimalPlaces || 2
        }
      },

      // Statistics 설정 매핑
      statisticsSettings: {
        default_pegs: userSettings.preferences?.dashboard?.selectedPegs || [],
        default_filters: {
          dateFormat: userSettings.preferences?.filters?.dateFormat || 'YYYY-MM-DD',
          numberFormat: userSettings.preferences?.filters?.numberFormat || 'comma',
          timezone: userSettings.preferences?.filters?.timezone || 'Asia/Seoul'
        },
        comparison_options: {
          show_delta: userSettings.preferences?.charts?.showDelta !== false,
          show_rsd: userSettings.preferences?.charts?.showRsd !== false,
          show_percentage: true,
          decimal_places: userSettings.preferences?.charts?.decimalPlaces || 2,
          chart_type: userSettings.preferences?.charts?.chartType || 'bar'
        },
        date_range_1: {
          preset: `last_${userSettings.preferences?.charts?.defaultDateRange || 7}_days`
        },
        date_range_2: {
          preset: `last_${(userSettings.preferences?.charts?.defaultDateRange || 7) * 2}_days`
        }
      },

      // 분석 필터 설정 (기본값)
      analysisFilterSettings: {
        saved_filters: [],
        default_filter: {},
        favorite_ne_ids: [],
        favorite_cell_ids: [],
        multi_cell_selections: [],
        filter_auto_apply: false
      },

      // 데이터베이스 설정 (기존 설정 유지)
      databaseSettings: userSettings.databaseSettings || {
        host: '',
        port: 5432,
        user: 'postgres',
        password: '',
        dbname: 'postgres',
        table: 'summary'
      },

      // 알림 설정 (기본값)
      notificationSettings: userSettings.notificationSettings || {
        email_notifications: false,
        browser_notifications: true,
        threshold_alerts: true,
        alert_email: null
      },

      // 테마 및 언어
      theme: userSettings.preferences?.dashboard?.theme || 'light',
      language: userSettings.preferences?.filters?.language || 'ko'
    }

    logInfo('userSettings 백엔드 변환 완료', { 
      theme: backendData.theme,
      selectedPegs: backendData.dashboardSettings.selected_pegs.length 
    })

    return backendData

  } catch (error) {
    logError('userSettings 백엔드 변환 중 오류', error)
    // 변환 실패 시 기본 구조 반환
    return {
      dashboardSettings: {},
      statisticsSettings: {},
      analysisFilterSettings: {},
      databaseSettings: {},
      notificationSettings: {},
      theme: 'light',
      language: 'ko'
    }
  }
}

/**
 * 백엔드 UserPreferenceModel을 프론트엔드 userSettings 형태로 변환
 * @param {Object} backendPreference - 백엔드에서 받은 UserPreferenceModel 객체
 * @returns {Object} 프론트엔드 userSettings 형태의 객체
 */
export const mapBackendToUserSettings = (backendPreference) => {
  try {
    logInfo('백엔드 데이터를 userSettings로 변환 시작', { 
      userId: backendPreference.user_id || backendPreference.userId 
    })

    // 백엔드 응답에서 실제 데이터 추출 (data 래퍼가 있을 수 있음)
    const preference = backendPreference.data || backendPreference

    const userSettings = {
      userId: preference.user_id || preference.userId || 'default',
      
      preferences: {
        dashboard: {
          selectedPegs: preference.dashboardSettings?.selected_pegs || 
                      preference.dashboard_settings?.selected_pegs || [],
          defaultNe: preference.dashboardSettings?.selectedNEs?.[0] || 
                    preference.dashboard_settings?.selected_nes?.[0] || '',
          defaultCellId: preference.dashboardSettings?.selectedCellIds?.[0] || 
                        preference.dashboard_settings?.selected_cell_ids?.[0] || '',
          autoRefreshInterval: preference.dashboardSettings?.refresh_interval || 
                              preference.dashboard_settings?.refresh_interval || 30,
          chartStyle: preference.dashboard_settings?.layout_config?.chartStyle || 
                     preference.dashboardSettings?.layout_config?.chartStyle || 'line',
          showLegend: preference.dashboard_settings?.layout_config?.showLegend !== false,
          showGrid: preference.dashboard_settings?.layout_config?.showGrid !== false,
          theme: preference.theme || 
                preference.dashboard_settings?.layout_config?.theme || 'light'
        },

        charts: {
          defaultDateRange: (() => {
            const preset1 = preference.statistics_settings?.date_range_1?.preset || 
                           preference.statisticsSettings?.date_range_1?.preset || 'last_7_days'
            const match = preset1.match(/last_(\d+)_days/)
            return match ? parseInt(match[1], 10) : 7
          })(),
          comparisonEnabled: preference.statistics_settings?.comparison_options !== undefined ||
                           preference.statisticsSettings?.comparison_options !== undefined,
          showDelta: preference.statistics_settings?.comparison_options?.show_delta !== false ||
                    preference.statisticsSettings?.comparison_options?.show_delta !== false,
          showRsd: preference.statistics_settings?.comparison_options?.show_rsd !== false ||
                  preference.statisticsSettings?.comparison_options?.show_rsd !== false,
          chartType: preference.statistics_settings?.comparison_options?.chart_type || 
                    preference.statisticsSettings?.comparison_options?.chart_type ||
                    preference.dashboard_settings?.chart_preferences?.chartType || 'bar',
          decimalPlaces: preference.statistics_settings?.comparison_options?.decimal_places || 
                        preference.statisticsSettings?.comparison_options?.decimal_places ||
                        preference.dashboard_settings?.chart_preferences?.decimalPlaces || 2,
          autoAnalysis: false
        },

        filters: {
          dateFormat: preference.statistics_settings?.default_filters?.dateFormat || 
                     preference.statisticsSettings?.default_filters?.dateFormat || 'YYYY-MM-DD',
          numberFormat: preference.statistics_settings?.default_filters?.numberFormat || 
                       preference.statisticsSettings?.default_filters?.numberFormat || 'comma',
          language: preference.language || 'ko',
          timezone: preference.statistics_settings?.default_filters?.timezone || 
                   preference.statisticsSettings?.default_filters?.timezone || 'Asia/Seoul'
        }
      },

      pegConfigurations: preference.pegConfigurations || [],
      statisticsConfigurations: preference.statisticsConfigurations || [],

      metadata: {
        version: preference.metadata?.version || 1,
        createdAt: preference.metadata?.created_at || 
                  preference.metadata?.createdAt || 
                  new Date().toISOString(),
        lastModified: preference.metadata?.updated_at || 
                     preference.metadata?.lastModified || 
                     new Date().toISOString(),
        checksum: null // 백엔드에서는 체크섬을 계산하지 않음
      }
    }

    logInfo('백엔드 데이터 userSettings 변환 완료', {
      userId: userSettings.userId,
      selectedPegs: userSettings.preferences.dashboard.selectedPegs.length,
      theme: userSettings.preferences.dashboard.theme,
      language: userSettings.preferences.filters.language
    })

    return userSettings

  } catch (error) {
    logError('백엔드 데이터 변환 중 오류', error)
    // 변환 실패 시 기본 userSettings 반환
    return {
      userId: 'default',
      preferences: {
        dashboard: {
          selectedPegs: [],
          defaultNe: '',
          defaultCellId: '',
          autoRefreshInterval: 30,
          chartStyle: 'line',
          showLegend: true,
          showGrid: true,
          theme: 'light'
        },
        charts: {
          defaultDateRange: 7,
          comparisonEnabled: true,
          showDelta: true,
          showRsd: true,
          chartType: 'bar',
          decimalPlaces: 2,
          autoAnalysis: false
        },
        filters: {
          dateFormat: 'YYYY-MM-DD',
          numberFormat: 'comma',
          language: 'ko',
          timezone: 'Asia/Seoul'
        }
      },
      pegConfigurations: [],
      statisticsConfigurations: [],
      metadata: {
        version: 1,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        checksum: null
      }
    }
  }
}

/**
 * 두 타임스탬프를 비교하여 어느 것이 더 최신인지 확인
 * @param {string} timestamp1 - 첫 번째 타임스탬프 (ISO 문자열)
 * @param {string} timestamp2 - 두 번째 타임스탬프 (ISO 문자열)
 * @returns {number} -1: timestamp1이 더 오래됨, 0: 같음, 1: timestamp1이 더 최신
 */
export const compareTimestamps = (timestamp1, timestamp2) => {
  try {
    if (!timestamp1 && !timestamp2) return 0
    if (!timestamp1) return -1
    if (!timestamp2) return 1

    const date1 = new Date(timestamp1)
    const date2 = new Date(timestamp2)

    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      logWarning('잘못된 타임스탬프 형식', { timestamp1, timestamp2 })
      return 0
    }

    return date1.getTime() > date2.getTime() ? 1 : 
           date1.getTime() < date2.getTime() ? -1 : 0

  } catch (error) {
    logError('타임스탬프 비교 중 오류', error)
    return 0
  }
}

/**
 * userSettings 객체의 유효성을 검증
 * @param {Object} userSettings - 검증할 userSettings 객체
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export const validateUserSettings = (userSettings) => {
  const errors = []

  try {
    // 필수 필드 검증
    if (!userSettings || typeof userSettings !== 'object') {
      errors.push('userSettings가 유효한 객체가 아닙니다')
      return { isValid: false, errors }
    }

    if (!userSettings.userId || typeof userSettings.userId !== 'string') {
      errors.push('userId가 없거나 유효하지 않습니다')
    }

    if (!userSettings.preferences || typeof userSettings.preferences !== 'object') {
      errors.push('preferences 객체가 없거나 유효하지 않습니다')
    } else {
      // preferences 내부 구조 검증
      if (!userSettings.preferences.dashboard) {
        errors.push('preferences.dashboard가 없습니다')
      }
      if (!userSettings.preferences.charts) {
        errors.push('preferences.charts가 없습니다')
      }
      if (!userSettings.preferences.filters) {
        errors.push('preferences.filters가 없습니다')
      }
    }

    if (!Array.isArray(userSettings.pegConfigurations)) {
      errors.push('pegConfigurations가 배열이 아닙니다')
    }

    if (!Array.isArray(userSettings.statisticsConfigurations)) {
      errors.push('statisticsConfigurations가 배열이 아닙니다')
    }

    if (!userSettings.metadata || typeof userSettings.metadata !== 'object') {
      errors.push('metadata 객체가 없거나 유효하지 않습니다')
    }

    logInfo('userSettings 유효성 검증 완료', { 
      isValid: errors.length === 0, 
      errorCount: errors.length 
    })

    return {
      isValid: errors.length === 0,
      errors
    }

  } catch (error) {
    logError('userSettings 유효성 검증 중 오류', error)
    return {
      isValid: false,
      errors: ['유효성 검증 중 예외가 발생했습니다']
    }
  }
}
