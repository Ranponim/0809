import { z } from 'zod'

export const StatsPointSchema = z.object({
  timestamp: z.union([z.string(), z.number()]),
  value: z.number().nullable().default(null),
})
export type StatsPoint = z.infer<typeof StatsPointSchema>

export const TimeSeriesSchema = z.object({
  name: z.string(),
  points: z.array(StatsPointSchema),
})
export type TimeSeries = z.infer<typeof TimeSeriesSchema>

export const StatsQueryRequestSchema = z.object({
  metrics: z.array(z.string()).min(1),
  from: z.string().datetime().or(z.number()),
  to: z.string().datetime().or(z.number()),
  interval: z.string().default('1h'),
  aggregator: z.enum(['avg', 'sum', 'min', 'max']).default('avg'),
  userId: z.string().optional(),
  filters: z.record(z.string(), z.any()).optional(),
})
export type StatsQueryRequest = z.infer<typeof StatsQueryRequestSchema>

export const StatsQueryResponseSchema = z.object({
  series: z.array(TimeSeriesSchema),
})
export type StatsQueryResponse = z.infer<typeof StatsQueryResponseSchema>

export const LLMAnalysisResultSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime().or(z.number()),
  model: z.string().optional(),
  prompt: z.string().optional(),
  response: z.string().optional(),
  score: z.number().optional(),
  metrics: z.record(z.string(), z.number()).optional(),
})
export type LLMAnalysisResult = z.infer<typeof LLMAnalysisResultSchema>

export const DerivedFormulaSchema = z.object({
  id: z.string(),
  name: z.string(),
  expression: z.string(),
  variables: z.array(z.string()).default([]),
  color: z.string().optional(),
})
export type DerivedFormula = z.infer<typeof DerivedFormulaSchema>

export const ChartSeriesConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['metric', 'formula']),
  key: z.string(),
  color: z.string().optional(),
  yAxisIndex: z.number().default(0),
  smoothing: z.boolean().default(true),
})
export type ChartSeriesConfig = z.infer<typeof ChartSeriesConfigSchema>

export const ChartConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  series: z.array(ChartSeriesConfigSchema),
})
export type ChartConfig = z.infer<typeof ChartConfigSchema>

export const UserPreferencesSchema = z.object({
  defaultMetrics: z.array(z.string()).default([]),
  derivedFormulas: z.array(DerivedFormulaSchema).default([]),
  charts: z.array(ChartConfigSchema).default([]),
  dateRangeDays: z.number().default(7),
})
export type UserPreferences = z.infer<typeof UserPreferencesSchema>

export const MetricsListResponseSchema = z.object({
  metrics: z.array(z.string()),
})
export type MetricsListResponse = z.infer<typeof MetricsListResponseSchema>