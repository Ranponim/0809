/**
 * localStorage 유틸리티 함수 모음
 * 
 * 브라우저의 localStorage를 안전하게 사용하기 위한 헬퍼 함수들을 제공합니다.
 * - 사용 가능 여부 확인
 * - 데이터 저장 (JSON 직렬화 포함)
 * - 데이터 로드 (JSON 파싱 포함)
 * - 데이터 삭제
 */

const STORAGE_KEY = 'kpi_dashboard_user_settings';

/**
 * localStorage 사용 가능 여부를 확인합니다.
 * (프라이빗 브라우징 모드 등에서 비활성화될 수 있음)
 * @returns {{available: boolean, error: string|null}}
 */
export const checkLocalStorageAvailability = () => {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return { available: true, error: null };
  } catch (e) {
    return { available: false, error: e.message };
  }
};

/**
 * 설정을 localStorage에 저장합니다.
 * @param {object} settings - 저장할 설정 객체
 * @returns {{available: boolean, error: string|null}}
 */
export const saveSettingsToLocalStorage = (settings) => {
  const availability = checkLocalStorageAvailability();
  if (!availability.available) {
    return { available: false, error: 'LocalStorage is not available.' };
  }

  try {
    const serializedSettings = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEY, serializedSettings);
    return { available: true, error: null };
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      return { available: true, error: 'QUOTA_EXCEEDED' };
    }
    return { available: true, error: e.message };
  }
};

/**
 * localStorage에서 설정을 불러옵니다.
 * @returns {{status: {available: boolean, error: string|null}, settings: object|null}}
 */
export const loadSettingsFromLocalStorage = () => {
  const availability = checkLocalStorageAvailability();
  if (!availability.available) {
    return { status: { available: false, error: 'LocalStorage is not available.' }, settings: null };
  }

  try {
    const serializedSettings = localStorage.getItem(STORAGE_KEY);
    if (serializedSettings === null) {
      return { status: { available: true, error: null }, settings: null };
    }
    const settings = JSON.parse(serializedSettings);
    return { status: { available: true, error: null }, settings };
  } catch (e) {
    return { status: { available: true, error: e.message }, settings: null };
  }
};

/**
 * localStorage에서 설정을 삭제합니다.
 * @returns {{available: boolean, error: string|null}}
 */
export const clearSettingsFromLocalStorage = () => {
  const availability = checkLocalStorageAvailability();
  if (!availability.available) {
    return { available: false, error: 'LocalStorage is not available.' };
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    return { available: true, error: null };
  } catch (e) {
    return { available: true, error: e.message };
  }
};