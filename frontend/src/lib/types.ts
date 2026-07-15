export type LanguageBucket = {
  bytes: number
  files: number
}

export type Snapshot = {
  id: number
  project_id: number
  taken_at: string
  total_size_bytes: number
  file_count: number
  language_distribution: Record<string, LanguageBucket>
  warnings: string[]
  size_delta_bytes: number | null
  trigger: string
}

export type Project = {
  id: number
  name: string
  root_path: string
  created_at: string
  latest_snapshot: Snapshot | null
}

export type ScanStatusValue = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

export type ScanStatus = {
  project_id: number
  status: ScanStatusValue
  message: string | null
  snapshot_id: number | null
}

export type ScanQueued = {
  project_id: number
  status: string
}
