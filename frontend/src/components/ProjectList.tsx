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
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/70 p-6 text-sm text-slate-400">
        No projects are tracked yet. Register a local project path to create the first snapshot.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const latest = project.latest_snapshot
        const status = scanStatuses[project.id]?.status ?? 'idle'
        const isSelected = selectedProjectId === project.id
        return (
          <article
            key={project.id}
            className={`rounded-lg border p-4 transition ${
              isSelected
                ? 'border-emerald-400/60 bg-emerald-400/10'
                : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
            }`}
          >
            <button type="button" onClick={() => onSelect(project)} className="block w-full text-left">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-50">{project.name}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-slate-500">{project.root_path}</p>
                </div>
                <span className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">{status}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-4">
                <Metric label="Size" value={latest ? formatBytes(latest.total_size_bytes) : 'not scanned'} />
                <Metric label="Files" value={latest ? latest.file_count.toLocaleString() : 'not scanned'} />
                <Metric label="Delta" value={latest ? formatDelta(latest.size_delta_bytes) : 'baseline'} />
                <Metric label="Updated" value={latest ? formatDate(latest.taken_at) : 'never'} />
              </div>
            </button>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onScan(project)}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-400 px-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
              >
                <Play size={15} />
                Scan
              </button>
              <button
                onClick={() => onDelete(project)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition hover:border-red-400 hover:text-red-300"
              >
                <Trash2 size={15} />
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
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-100">{value}</div>
    </div>
  )
}
