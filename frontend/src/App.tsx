import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Activity, Terminal } from 'lucide-react'
import { ProjectForm } from './components/ProjectForm'
import { ProjectList } from './components/ProjectList'
import { StatsCards } from './components/StatsCards'
import { createProject, deleteProject, getScanStatus, listProjects, listSnapshots, scanProject } from './lib/api'
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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3 text-emerald-300">
              <Terminal size={26} />
              <h1 className="text-3xl font-bold tracking-tight text-slate-50">PySizer</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Local project size snapshots, language distribution, and growth trends.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
            <Activity size={16} className="text-emerald-300" />
            Local-first scanner
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
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
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-8 text-slate-400">Loading projects...</div>
            ) : (
              <Suspense fallback={<div className="rounded-lg border border-slate-800 bg-slate-950/80 p-8 text-slate-400">Loading charts...</div>}>
                <Charts selectedProject={selectedProject} projects={projects} snapshots={snapshots} />
              </Suspense>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
