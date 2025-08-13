import { Parser } from 'expr-eval'
import type { TimeSeries } from '../api/types'

export function computeDerivedSeries(
  name: string,
  expression: string,
  inputSeries: Record<string, TimeSeries>,
): TimeSeries {
  const parser = new Parser()
  const expr = parser.parse(expression)

  const firstSeries = Object.values(inputSeries)[0]
  if (!firstSeries) return { name, points: [] }

  const length = Math.max(
    0,
    ...Object.values(inputSeries).map((s) => s.points.length),
  )

  const points = [] as { timestamp: number | string; value: number | null }[]

  for (let i = 0; i < length; i += 1) {
    const timestamp = (firstSeries.points[i]?.timestamp ?? null) as any
    const scope: Record<string, number> = {}
    let hasNull = false

    for (const key of Object.keys(inputSeries)) {
      const s = inputSeries[key]
      const p = s.points[i]
      if (!p || p.value === null || p.value === undefined) {
        hasNull = true
        break
      }
      scope[key] = Number(p.value)
    }

    if (hasNull || timestamp == null) {
      points.push({ timestamp: timestamp ?? i, value: null })
      continue
    }

    try {
      const value = Number(expr.evaluate(scope))
      if (Number.isFinite(value)) {
        points.push({ timestamp, value })
      } else {
        points.push({ timestamp, value: null })
      }
    } catch {
      points.push({ timestamp, value: null })
    }
  }

  return { name, points }
}

export function pickSeriesByKeys(series: TimeSeries[], keys: string[]): Record<string, TimeSeries> {
  const map: Record<string, TimeSeries> = {}
  for (const key of keys) {
    const found = series.find((s) => s.name === key)
    if (found) map[key] = found
  }
  return map
}