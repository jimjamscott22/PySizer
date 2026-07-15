import { useState } from 'react'
import type { FormEvent } from 'react'
import { FolderPlus } from 'lucide-react'

type ProjectFormProps = {
  onSubmit: (name: string, rootPath: string) => Promise<void>
}

export function ProjectForm({ onSubmit }: ProjectFormProps) {
  const [name, setName] = useState('')
  const [rootPath, setRootPath] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    try {
      await onSubmit(name, rootPath)
      setName('')
      setRootPath('')
    } catch {
      // App owns the visible error; retain the submitted values for correction.
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-sm border border-steel-700 bg-graphite-850 p-4">
      <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-amber-signal">
        <FolderPlus size={16} />
        Register volume
      </div>
      <label className="grid gap-1">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-steel-600">Label</span>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. api-gateway"
          className="h-10 rounded-sm border border-steel-700 bg-graphite-900 px-3 font-data text-sm text-paper-100 outline-none transition focus:border-amber-signal"
        />
      </label>
      <label className="grid gap-1">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-steel-600">Root path</span>
        <input
          required
          value={rootPath}
          onChange={(event) => setRootPath(event.target.value)}
          placeholder="/home/you/path/to/repo"
          className="h-10 rounded-sm border border-steel-700 bg-graphite-900 px-3 font-data text-sm text-paper-100 outline-none transition focus:border-amber-signal"
        />
      </label>
      <button
        disabled={isSaving}
        className="h-10 rounded-sm bg-amber-signal px-4 font-display text-sm font-bold uppercase tracking-wider text-graphite-950 transition hover:bg-amber-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Registering…' : 'Add volume'}
      </button>
    </form>
  )
}
