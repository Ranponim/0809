import axios from 'axios'
import { toast } from 'sonner'

// 공용 API 클라이언트: 환경변수 우선, 없으면 로컬 백엔드로 폴백
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const apiClient = axios.create({
  baseURL,
  timeout: 15000,
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


