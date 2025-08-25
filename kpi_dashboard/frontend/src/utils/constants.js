/**
 * Application-wide constants
 * 
 * 순환 참조를 방지하기 위해 다른 파일에서 사용되는 상수들을
 * 별도의 파일로 분리하여 관리합니다.
 */

// from: utils/backgroundSyncUtils.js
export const SYNC_STRATEGIES = {
  PERIODIC_POLLING: 'periodic_polling',
  VISIBILITY_BASED: 'visibility_based',
  CHANGE_TRIGGERED: 'change_triggered',
  HYBRID: 'hybrid',
  ON_DEMAND: 'on_demand'
};

export const SYNC_STATES = {
  IDLE: 'idle',
  POLLING: 'polling',
  SYNCING: 'syncing',
  WAITING: 'waiting',
  OFFLINE: 'offline',
  ERROR: 'error'
};

// from: utils/dataComparisonUtils.js
export const CONFLICT_TYPES = {
  NO_CONFLICT: 'no_conflict',
  TIMESTAMP_CONFLICT: 'timestamp_conflict',
  DATA_MISMATCH: 'data_mismatch',
  MISSING_DATA: 'missing_data',
  VERSION_MISMATCH: 'version_mismatch',
  CORRUPTION_DETECTED: 'corruption_detected'
};

export const CONFLICT_SEVERITY = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

// from: utils/lastWriteWinsUtils.js
export const LWW_STRATEGIES = {
  STRICT_TIMESTAMP: 'strict_timestamp',
  HYBRID_METADATA: 'hybrid_metadata',
  FIELD_LEVEL_LWW: 'field_level_lww',
  CONFIDENCE_WEIGHTED: 'confidence_weighted',
  SMART_MERGE: 'smart_merge'
};

export const CONFIDENCE_LEVELS = {
  VERY_HIGH: 0.95,
  HIGH: 0.85,
  MEDIUM: 0.65,
  LOW: 0.45,
  VERY_LOW: 0.25
};
