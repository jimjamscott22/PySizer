const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  const sign = bytes < 0 ? '-' : ''
  const abs = Math.abs(bytes)
  if (abs < 1024) return `${sign}${abs} B`

  let value = abs
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1)

  return `${sign}${value.toFixed(value < 10 ? 2 : 1)} ${BYTE_UNITS[unitIndex]}`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDelta(bytes: number | null): string {
  if (bytes === null) return 'baseline'
  if (bytes === 0) return '±0 B'
  const sign = bytes > 0 ? '+' : ''
  return `${sign}${formatBytes(bytes)}`
}
