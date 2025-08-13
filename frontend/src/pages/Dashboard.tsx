import { Card, Group, Text } from '@mantine/core'
import TimeSeriesChart from '../components/charts/TimeSeriesChart'

export default function Dashboard() {
  const series = [
    {
      name: 'sample_metric_a',
      points: Array.from({ length: 24 }).map((_, i) => ({ timestamp: Date.now() - (24 - i) * 3600_000, value: Math.sin(i / 3) * 10 + 50 })),
    },
    {
      name: 'sample_metric_b',
      points: Array.from({ length: 24 }).map((_, i) => ({ timestamp: Date.now() - (24 - i) * 3600_000, value: Math.cos(i / 4) * 5 + 30 })),
    },
  ]

  return (
    <Card withBorder shadow="sm" p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Dashboard Overview</Text>
      </Group>
      <TimeSeriesChart series={series} title="Recent Sample Metrics" />
    </Card>
  )
}