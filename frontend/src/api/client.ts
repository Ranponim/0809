import axios from 'axios'
import { z } from 'zod'
import {
  LLMAnalysisResultSchema,
  MetricsListResponseSchema,
  StatsQueryRequest,
  StatsQueryResponseSchema,
  UserPreferences,
  UserPreferencesSchema,
} from './types'

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const api = axios.create({
  baseURL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers = config.headers ?? {}
    ;(config.headers as any)['Authorization'] = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    return Promise.reject(error)
  },
)

export async function fetchResults(params: {
  userId?: string
  from?: string | number
  to?: string | number
  limit?: number
  offset?: number
}) {
  const res = await api.get('/results', { params })
  return z.array(LLMAnalysisResultSchema).parse(res.data)
}

export async function fetchMetrics() {
  const res = await api.get('/stats/metrics')
  return MetricsListResponseSchema.parse(res.data).metrics
}

export async function fetchStats(query: StatsQueryRequest) {
  const res = await api.post('/stats/query', query)
  return StatsQueryResponseSchema.parse(res.data)
}

export async function fetchUserPreferences() {
  const res = await api.get('/users/me/preferences')
  return UserPreferencesSchema.parse(res.data)
}

export async function updateUserPreferences(pref: UserPreferences) {
  const res = await api.put('/users/me/preferences', pref)
  return UserPreferencesSchema.parse(res.data)
}