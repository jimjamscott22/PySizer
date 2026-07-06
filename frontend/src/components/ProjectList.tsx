import { Play, Trash2 } from 'lucide-react'
import type { Project, ScanStatus } from '../lib/types'
import { formatBytes, formatDate, formatDelta } from '../lib/format'

type ProjectListProps = {
  projects: Project[]
  selectedProjectId: number | null
  scanStatuses: Record<number, ScanStatus>
  onSelect: (project: Project) => void
  onScan: (project: Project) => void
  onDelete: (project: Project) => void
}

const STATUS_COLOR: Record<string, string> = {
  idle: 'bg-steel-600',
  queued: 'bg-amber-signal',
  running: 'bg-amber-signal led-active',
  completed: 'bg-cyan-signal',
  failed: 'bg-red-signal',
}

export function ProjectList({
  projects,
  selectedProjectId,
  scanStatuses,
  onSelect,
  onScan,
  onDelete,
}: ProjectListProps) {
  if (!projects.length) {
    return (
      <div className="rounded border border-dashed border-steel-700 bg-graphite-850 p-6 font-data text-sm text-paper-300">
        No volumes registered. Add a local project path below to run the first scan.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const latest = project.latest_snapshot
        const status = scanStatuses[project.id]?.status ?? 'idle'
        const isSelected = selectedProjectId === project.id
        const isBusy = status === 'queued' || status === 'running'
        return (
          <article
            key={project.id}
            className={`label-perforation rounded-sm border p-4 pl-4 transition ${
              isSelected
                ? 'border-amber-signal/50 bg-graphite-800'
                : 'border-steel-700 bg-graphite-850 hover:border-steel-600'
            }`}
          >
            <button type="button" onClick={() => onSelect(project)} className="block w-full text-left">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-data text-[10px] uppercase tracking-[0.25em] text-steel-600">Model</div>
                  <h3 className="font-display text-lg font-bold leading-tight text-paper-100">{project.name}</h3>
                  <p className="mt-1 break-all font-data text-[11px] text-paper-300">{project.root_path}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-sm border border-steel-700 px-2 py-1 font-data text-[10px] uppercase tracking-wider text-paper-300">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`} />
                  {status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-dashed border-steel-700 pt-3 font-data text-sm sm:grid-cols-4">
                <Metric label="Capacity" value={latest ? formatBytes(latest.total_size_bytes) : '—'} />
                <Metric label="Files" value={latest ? latest.file_count.toLocaleString() : '—'} />
                <Metric label="Delta" value={latest ? formatDelta(latest.size_delta_bytes) : 'baseline'} />
                <Metric label="Last read" value={latest ? formatDate(latest.taken_at) : 'never'} />
              </div>
            </button>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onScan(project)}
                disabled={isBusy}
                className="inline-flex h-9 items-center gap-2 rounded-sm bg-amber-signal px-3 font-display text-sm font-bold uppercase tracking-wider text-graphite-950 transition hover:bg-amber-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play size={14} />
                {isBusy ? 'Scanning' : 'Scan'}
              </button>
              <button
                onClick={() => onDelete(project)}
                className="inline-flex h-9 items-center gap-2 rounded-sm border border-steel-700 px-3 font-display text-sm font-semibold uppercase tracking-wider text-paper-300 transition hover:border-red-signal hover:text-red-signal"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-steel-600">{label}</div>
      <div className="mt-0.5 font-medium text-paper-100">{value}</div>
    </div>
  )
}
