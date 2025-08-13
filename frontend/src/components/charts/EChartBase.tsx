import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export type EChartBaseProps = {
  option: echarts.EChartsOption
  height?: number | string
  width?: number | string
  onInit?: (chart: echarts.ECharts) => void
}

export default function EChartBase({ option, height = 360, width = '100%', onInit }: EChartBaseProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    if (onInit) onInit(chart)

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOption(option, true)
    }
  }, [option])

  return <div ref={containerRef} style={{ height, width }} />
}