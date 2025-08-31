// 런타임 구성 파일
// 개발 환경용 설정

// 백엔드 API 기본 URL
window.__RUNTIME_CONFIG__ = {
  BACKEND_BASE_URL: 'http://localhost:8000',
  VITE_API_BASE_URL: 'http://localhost:8000'
};

// 전역 설정
window.RUNTIME_CONFIG = {
  API_BASE_URL: 'http://localhost:8000',
  APP_ENV: 'development',
  APP_VERSION: '1.0.0'
};

console.log('[Runtime Config] Loaded development configuration:', window.__RUNTIME_CONFIG__);
