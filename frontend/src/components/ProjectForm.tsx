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
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-emerald-400/20 bg-slate-950/70 p-4 shadow-2xl shadow-emerald-950/20">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
        <FolderPlus size={16} />
        Register project
      </div>
      <input
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Project name"
        className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400"
      />
      <input
        required
        value={rootPath}
        onChange={(event) => setRootPath(event.target.value)}
        placeholder="/home/you/path/to/repo"
        className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 font-mono text-sm text-slate-100 outline-none transition focus:border-emerald-400"
      />
      <button
        disabled={isSaving}
        className="h-10 rounded-md bg-emerald-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Registering...' : 'Add project'}
      </button>
    </form>
  )
}
