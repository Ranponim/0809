import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Group, MultiSelect, Select, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { fetchMetrics, fetchStats } from '../api/client'
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import DateRangePicker from '../components/common/DateRangePicker'
import type { DateRange } from '../utils/dates'
import { lastNDaysRange, toIsoOrEpoch } from '../utils/dates'

export default function StatsExplorer() {
  const metricsQuery = useQuery({ queryKey: ['metrics'], queryFn: fetchMetrics })

  const [selected, setSelected] = useState<string[]>([])
  const [range, setRange] = useState<DateRange>(lastNDaysRange(7))
  const [interval, setInterval] = useState<string>('1h')
  const [aggregator, setAggregator] = useState<'avg' | 'sum' | 'min' | 'max'>('avg')

  const canQuery = selected.length > 0
  const [result, setResult] = useState<{ name: string; points: { timestamp: number | string; value: number | null }[] }[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function runQuery() {
    if (!canQuery) return
    setLoading(true)
    try {
      const res = await fetchStats({
        metrics: selected,
        from: toIsoOrEpoch(range.from),
        to: toIsoOrEpoch(range.to),
        interval,
        aggregator,
      })
      setResult(res.series)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (metricsQuery.data && metricsQuery.data.length && selected.length === 0) {
      setSelected(metricsQuery.data.slice(0, Math.min(2, metricsQuery.data.length)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsQuery.data])

  const seriesForChart = useMemo(() => {
    return (result ?? []).map((s) => ({
      name: s.name,
      points: s.points,
      yAxisIndex: 0,
      smoothing: true,
      color: undefined,
    }))
  }, [result])

  return (
    <Stack>
      <Card withBorder shadow="sm" p="md">
        <Group gap="md" wrap="wrap">
          <MultiSelect
            label="Metrics"
            placeholder="Select metrics"
            data={(metricsQuery.data ?? []).map((m) => ({ value: m, label: m }))}
            value={selected}
            onChange={setSelected}
            searchable
            clearable
            w={420}
          />
          <Select
            label="Interval"
            data={['5m', '15m', '1h', '6h', '1d']}
            value={interval}
            onChange={(v) => setInterval(v ?? '1h')}
            w={120}
          />
          <Select
            label="Aggregator"
            data={['avg', 'sum', 'min', 'max']}
            value={aggregator}
            onChange={(v) => setAggregator((v as any) ?? 'avg')}
            w={120}
          />
          <div style={{ minWidth: 360 }}>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
          <Button onClick={runQuery} disabled={!canQuery} loading={loading} mt={22}>
            Query
          </Button>
        </Group>
      </Card>

      <Card withBorder shadow="sm" p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Time Series</Text>
        </Group>
        {seriesForChart.length === 0 ? (
          <Text size="sm" c="dimmed">No data</Text>
        ) : (
          <TimeSeriesChart series={seriesForChart} title={selected.join(' / ')} />
        )}
      </Card>
    </Stack>
  )
}