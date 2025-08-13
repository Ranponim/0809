import { useMemo } from 'react'
import * as echarts from 'echarts'
import EChartBase from './EChartBase'

export type LineSeriesInput = {
  name: string
  color?: string
  yAxisIndex?: number
  smoothing?: boolean
  points: { timestamp: number | string; value: number | null }[]
}

export type TimeSeriesChartProps = {
  series: LineSeriesInput[]
  height?: number
  title?: string
}

export default function TimeSeriesChart({ series, height = 380, title }: TimeSeriesChartProps) {
  const option = useMemo<echarts.EChartsOption>(() => {
    const yAxisIndices = Array.from(new Set(series.map((s) => s.yAxisIndex ?? 0))).sort()

    const eSeries: echarts.SeriesOption[] = series.map((s) => ({
      type: 'line',
      name: s.name,
      yAxisIndex: s.yAxisIndex ?? 0,
      smooth: s.smoothing ?? true,
      showSymbol: false,
      emphasis: { focus: 'series' },
      lineStyle: { width: 2, color: s.color },
      connectNulls: false,
      data: s.points.map((p) => [p.timestamp, p.value]),
    }))

    const option: echarts.EChartsOption = {
      title: title ? { text: title } : undefined,
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { type: 'scroll' },
      grid: { left: 48, right: 24, top: 48, bottom: 72 },
      xAxis: { type: 'time' },
      yAxis: yAxisIndices.map((idx) => ({ type: 'value', nameLocation: 'end' })),
      dataZoom: [
        { type: 'inside', throttle: 50 },
        { type: 'slider', height: 24, bottom: 24 },
      ],
      series: eSeries,
    }

    return option
  }, [series, title])

  return <EChartBase option={option} height={height} />
}