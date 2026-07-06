import type { Project } from '../lib/types'
import { formatBytes, formatDelta } from '../lib/format'

type StatsCardsProps = {
  projects: Project[]
}

export function StatsCards({ projects }: StatsCardsProps) {
  const snapshots = projects
    .map((project) => project.latest_snapshot)
    .filter((snapshot) => snapshot !== null)
  const totalBytes = snapshots.reduce((sum, snapshot) => sum + snapshot.total_size_bytes, 0)
  const fileCount = snapshots.reduce((sum, snapshot) => sum + snapshot.file_count, 0)
  const totalDelta = snapshots.reduce((sum, snapshot) => sum + (snapshot.size_delta_bytes ?? 0), 0)

  const attributes = [
    { id: '01', name: 'TRACKED VOLUMES', value: projects.length.toString(), unit: 'projects' },
    { id: '02', name: 'ALLOCATED CAPACITY', value: formatBytes(totalBytes), unit: 'combined' },
    { id: '03', name: 'INDEXED FILES', value: fileCount.toLocaleString(), unit: 'entries' },
    {
      id: '04',
      name: 'GROWTH SINCE LAST SCAN',
      value: formatDelta(totalDelta),
      unit: totalDelta > 0 ? 'expanding' : totalDelta < 0 ? 'shrinking' : 'steady',
      flag: totalDelta > 0,
    },
  ]

  return (
    <section className="overflow-hidden rounded border border-steel-700 bg-graphite-850">
      <div className="flex items-center justify-between border-b border-steel-700 px-4 py-2">
        <span className="font-display text-sm uppercase tracking-[0.2em] text-paper-300">Diagnostic readout</span>
        <span className="font-data text-[11px] uppercase tracking-widest text-steel-600">Live · all volumes</span>
      </div>
      <div className="grid divide-y divide-steel-700 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {attributes.map((attr) => (
          <div key={attr.id} className="flex items-start gap-3 px-4 py-4">
            <span className="font-data text-xs text-steel-600">{attr.id}</span>
            <div>
              <div className="font-data text-[11px] uppercase tracking-wider text-paper-300">{attr.name}</div>
              <div className="mt-1 font-display text-2xl font-bold leading-none text-paper-100">{attr.value}</div>
              <div
                className={`mt-1 font-data text-[11px] uppercase tracking-wider ${
                  attr.flag ? 'text-amber-signal' : 'text-steel-600'
                }`}
              >
                {attr.unit}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
