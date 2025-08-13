import dayjs from 'dayjs'

export type DateRange = { from: Date; to: Date }

export function lastNDaysRange(days: number): DateRange {
  const to = dayjs().endOf('day')
  const from = to.subtract(days - 1, 'day').startOf('day')
  return { from: from.toDate(), to: to.toDate() }
}

export function toIsoOrEpoch(input: Date | number | string): string | number {
  if (input instanceof Date) return input.toISOString()
  return input
}

export function toEpochMs(input: Date | number | string): number {
  if (input instanceof Date) return input.getTime()
  if (typeof input === 'number') return input
  return dayjs(input).valueOf()
}

export function formatDateTime(input: Date | number | string): string {
  const ms = toEpochMs(input)
  return dayjs(ms).format('YYYY-MM-DD HH:mm:ss')
}