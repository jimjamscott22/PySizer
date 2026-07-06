import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { HardDrive } from 'lucide-react'
import { ProjectForm } from './components/ProjectForm'
import { ProjectList } from './components/ProjectList'
import { StatsCards } from './components/StatsCards'
import { createProject, deleteProject, getScanStatus, listProjects, listSnapshots, scanProject } from './lib/api'
import { formatBytes, formatDate } from './lib/format'
import type { Project, ScanStatus, Snapshot } from './lib/types'

const Charts = lazy(() => import('./components/Charts'))

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [scanStatuses, setScanStatuses] = useState<Record<number, ScanStatus>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  )

  const selectedStatus = selectedProject ? scanStatuses[selectedProject.id]?.status ?? 'idle' : 'idle'
  const isScanningSelected = selectedStatus === 'queued' || selectedStatus === 'running'

  async function refreshProjects() {
    const nextProjects = await listProjects()
    setProjects(nextProjects)
    if (!selectedProjectId && nextProjects.length) {
      setSelectedProjectId(nextProjects[0].id)
    }
  }

  useEffect(() => {
    refreshProjects()
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Failed to load projects'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedProject) {
      setSnapshots([])
      return
    }
    listSnapshots(selectedProject.id)
      .then(setSnapshots)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Failed to load snapshots'))
  }, [selectedProject])

  useEffect(() => {
    const activeProjectIds = projects
      .map((project) => project.id)
      .filter((projectId) => {
        const status = scanStatuses[projectId]?.status
        return status === 'queued' || status === 'running'
      })
    if (!activeProjectIds.length) return

    const interval = window.setInterval(() => {
      activeProjectIds.forEach((projectId) => {
        getScanStatus(projectId)
          .then((status) => {
            setScanStatuses((current) => ({ ...current, [projectId]: status }))
            if (status.status === 'completed') {
              refreshProjects().catch(console.error)
              if (selectedProject?.id === projectId) {
                listSnapshots(projectId).then(setSnapshots).catch(console.error)
              }
            }
          })
          .catch(console.error)
      })
    }, 1200)

    return () => window.clearInterval(interval)
  }, [projects, scanStatuses, selectedProject])

  async function handleCreateProject(name: string, rootPath: string) {
    setError(null)
    const project = await createProject(name, rootPath)
    await refreshProjects()
    setSelectedProjectId(project.id)
  }

  async function handleScan(project: Project) {
    setError(null)
    await scanProject(project.id)
    const status = await getScanStatus(project.id)
    setScanStatuses((current) => ({ ...current, [project.id]: status }))
    await refreshProjects()
    if (selectedProject?.id === project.id) {
      setSnapshots(await listSnapshots(project.id))
    }
  }

  async function handleDelete(project: Project) {
    setError(null)
    await deleteProject(project.id)
    if (selectedProjectId === project.id) {
      setSelectedProjectId(null)
    }
    await refreshProjects()
  }

  return (
    <main className="min-h-screen bg-graphite-950 text-paper-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-steel-700 pb-5">
          <div className="flex items-center gap-3">
            <HardDrive size={30} className="text-amber-signal" strokeWidth={1.75} />
            <div>
              <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide text-paper-100">
                PySizer
              </h1>
              <p className="mt-1 font-data text-xs uppercase tracking-[0.25em] text-steel-600">
                Local storage diagnostic unit
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-sm border border-steel-700 bg-graphite-850 px-3 py-2 font-data text-xs uppercase tracking-wider text-paper-300">
            <span className="h-2 w-2 rounded-full bg-cyan-signal led-active" />
            Reads local disk only — no network egress
          </div>
        </header>

        {error && (
          <div className="rounded-sm border border-red-signal/50 bg-red-signal/10 px-4 py-3 font-data text-sm text-red-signal">
            {error}
          </div>
        )}

        {selectedProject && (
          <section className="scanlines rounded-sm border border-steel-700 bg-graphite-850 px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="font-data text-[10px] uppercase tracking-[0.3em] text-steel-600">Selected volume</div>
                <div className="font-display text-2xl font-bold text-paper-100">{selectedProject.name}</div>
                <div className="mt-0.5 break-all font-data text-xs text-paper-300">{selectedProject.root_path}</div>
              </div>
              <div className="text-right">
                <div className="font-data text-[10px] uppercase tracking-[0.3em] text-steel-600">Stamped capacity</div>
                <div className="font-display text-4xl font-extrabold leading-none text-amber-signal">
                  {selectedProject.latest_snapshot ? formatBytes(selectedProject.latest_snapshot.total_size_bytes) : '—'}
                </div>
                <div className="mt-1 font-data text-xs text-steel-600">
                  {selectedProject.latest_snapshot
                    ? `last read ${formatDate(selectedProject.latest_snapshot.taken_at)}`
                    : 'not yet scanned'}
                </div>
              </div>
            </div>
          </section>
        )}

        <StatsCards projects={projects} />

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <ProjectForm onSubmit={handleCreateProject} />
            <ProjectList
              projects={projects}
              selectedProjectId={selectedProject?.id ?? null}
              scanStatuses={scanStatuses}
              onSelect={(project) => setSelectedProjectId(project.id)}
              onScan={handleScan}
              onDelete={handleDelete}
            />
          </aside>

          <div className="space-y-4">
            {isLoading ? (
              <div className="rounded-sm border border-steel-700 bg-graphite-850 p-8 font-data text-steel-600">
                Loading volumes…
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="rounded-sm border border-steel-700 bg-graphite-850 p-8 font-data text-steel-600">
                    Loading readout…
                  </div>
                }
              >
                <Charts
                  selectedProject={selectedProject}
                  projects={projects}
                  snapshots={snapshots}
                  isScanning={isScanningSelected}
                />
              </Suspense>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
