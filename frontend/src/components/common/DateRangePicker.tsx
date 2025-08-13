import { Button, Group, Stack } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useState } from 'react'
import type { DateRange } from '../../utils/dates'
import { lastNDaysRange } from '../../utils/dates'

export type DateRangePickerProps = {
  value: DateRange
  onChange: (value: DateRange) => void
}

function ensureDate(value: Date | string | null | undefined, fallback: Date): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return fallback
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [local, setLocal] = useState<DateRange>(value)

  return (
    <Stack gap="xs">
      <Group grow>
        <DatePickerInput
          label="From"
          value={local.from}
          onChange={(v) => {
            const next = { ...local, from: ensureDate(v as any, local.from) }
            setLocal(next)
            onChange(next)
          }}
        />
        <DatePickerInput
          label="To"
          value={local.to}
          onChange={(v) => {
            const next = { ...local, to: ensureDate(v as any, local.to) }
            setLocal(next)
            onChange(next)
          }}
        />
      </Group>
      <Group gap="xs">
        {[1, 3, 7, 14, 30].map((d) => (
          <Button key={d} variant="light" size="xs" onClick={() => onChange(lastNDaysRange(d))}>
            Last {d}d
          </Button>
        ))}
      </Group>
    </Stack>
  )
}