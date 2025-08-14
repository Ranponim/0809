import axios from 'axios'
import { toast } from 'sonner'

// 공용 API 클라이언트: 환경변수 우선, 없으면 로컬 백엔드로 폴백
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const apiClient = axios.create({
  baseURL,
  timeout: 15000,
})

// 요청 인터셉터: 전송 전 PAYLOAD 구조 로깅
apiClient.interceptors.request.use((config) => {
  const method = (config.method || 'GET').toUpperCase()
  if (import.meta.env.DEV && ['POST', 'PUT', 'PATCH'].includes(method)) {
    let payload = config.data
    try {
      if (typeof payload === 'string') {
        payload = JSON.parse(payload)
      }
    } catch (_) {
      // 문자열이 JSON이 아니면 있는 그대로 출력
    }
    const logObject = {
      method,
      url: `${config.baseURL || ''}${config.url || ''}`,
      ...(config.params ? { params: config.params } : {}),
      payload,
    }
    try {
      console.info('PAYLOAD', JSON.stringify(logObject, null, 2))
    } catch (_) {
      console.info('PAYLOAD', logObject)
    }
  }
  return config
})

// 에러 인터셉터: 사용자에게 명확한 피드백 제공
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg = error?.response?.data?.detail || error?.message || '알 수 없는 오류가 발생했습니다.'
    toast.error(`요청 실패: ${msg}`)
    return Promise.reject(error)
  }
)

export default apiClient


