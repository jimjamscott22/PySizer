import { Database, Files, FolderGit2, TrendingUp } from 'lucide-react'
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

  const stats = [
    { label: 'Tracked projects', value: projects.length.toString(), icon: FolderGit2 },
    { label: 'Scanned storage', value: formatBytes(totalBytes), icon: Database },
    { label: 'Files counted', value: fileCount.toLocaleString(), icon: Files },
    { label: 'Latest delta', value: formatDelta(totalDelta), icon: TrendingUp },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-[0.2em]">{stat.label}</span>
            <stat.icon size={16} />
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-50">{stat.value}</div>
        </div>
      ))}
    </section>
  )
}
