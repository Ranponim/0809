/**
 * UserSettings TypeScript 인터페이스 정의
 * 
 * PRD 요구사항에 맞는 사용자 설정 구조를 정의합니다.
 * LocalStorage와 서버 API 간의 일관성을 보장합니다.
 */

export interface DashboardPreferences {
  /** 기본 선택된 NE ID */
  defaultNeId: string
  /** 기본 선택된 Cell ID */
  defaultCellId: string
  /** 자동 새로고침 간격 (초) */
  autoRefreshInterval: number
  /** 차트 기본 스타일 */
  chartStyle: 'line' | 'bar' | 'area'
  /** 범례 표시 여부 */
  showLegend: boolean
  /** 그리드 표시 여부 */
  showGrid: boolean
  /** 테마 설정 */
  theme: 'light' | 'dark' | 'auto'
}

export interface ChartPreferences {
  /** 기본 차트 높이 */
  defaultHeight: number
  /** 애니메이션 활성화 */
  enableAnimations: boolean
  /** 툴팁 표시 방식 */
  tooltipMode: 'hover' | 'click' | 'disabled'
  /** 색상 팔레트 */
  colorPalette: string[]
}

export interface FilterPreferences {
  /** 저장된 필터 프리셋 */
  savedFilters: Array<{
    id: string
    name: string
    filters: Record<string, any>
    isDefault?: boolean
  }>
  /** 마지막 사용한 필터 */
  lastUsedFilter?: Record<string, any>
  /** 필터 자동 적용 여부 */
  autoApplyLastFilter: boolean
}

export interface PegConfiguration {
  /** PEG 고유 ID */
  id: string
  /** PEG 이름 */
  name: string
  /** 활성화 여부 */
  enabled: boolean
  /** 설정값 */
  config: Record<string, any>
  /** 생성 시간 */
  createdAt: string
  /** 마지막 수정 시간 */
  updatedAt: string
}

export interface StatisticsConfiguration {
  /** Statistics 고유 ID */
  id: string
  /** Statistics 이름 */
  name: string
  /** 활성화 여부 */
  enabled: boolean
  /** 설정값 */
  config: Record<string, any>
  /** 생성 시간 */
  createdAt: string
  /** 마지막 수정 시간 */
  updatedAt: string
}

/**
 * PRD 호환 UserSettings 구조
 */
export interface UserSettings {
  /** 사용자 고유 ID */
  userId: string
  /** 일반 환경설정 */
  preferences: {
    dashboard: DashboardPreferences
    charts: ChartPreferences
    filters: FilterPreferences
  }
  /** PEG 설정 배열 */
  pegConfigurations: PegConfiguration[]
  /** Statistics 설정 배열 */
  statisticsConfigurations: StatisticsConfiguration[]
  /** 메타데이터 */
  metadata: {
    version: number
    createdAt: string
    lastModified: string
    lastSyncedAt?: string
  }
}

/**
 * LocalStorage 전용 설정 구조
 */
export interface LocalStorageSettings {
  /** 설정 데이터 */
  data: UserSettings
  /** LocalStorage 버전 */
  version: string
  /** 저장 시간 */
  timestamp: string
  /** 데이터 무결성 체크섬 */
  checksum?: string
}

/**
 * 직렬화/역직렬화 결과 타입
 */
export interface SerializationResult {
  success: boolean
  data?: string
  error?: string
}

export interface DeserializationResult {
  success: boolean
  data?: LocalStorageSettings
  error?: string
}

/**
 * LocalStorage 오류 타입
 */
export type LocalStorageError = 
  | 'QUOTA_EXCEEDED'
  | 'PARSE_ERROR'
  | 'INVALID_FORMAT'
  | 'VERSION_MISMATCH'
  | 'CHECKSUM_FAILED'
  | 'UNKNOWN_ERROR'

/**
 * LocalStorage 상태
 */
export interface LocalStorageStatus {
  available: boolean
  error?: LocalStorageError
  errorMessage?: string
  lastOperation?: 'save' | 'load' | 'clear'
  lastOperationTime?: string
}
