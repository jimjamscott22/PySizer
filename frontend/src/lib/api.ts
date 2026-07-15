import type { Project, ScanQueued, ScanStatus, Snapshot } from './types'

const BASE_URL = '/projects'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.detail ?? `Request failed with status ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export function listProjects(): Promise<Project[]> {
  return request<Project[]>('/')
}

export function createProject(name: string, rootPath: string): Promise<Project> {
  return request<Project>('/', {
    method: 'POST',
    body: JSON.stringify({ name, root_path: rootPath }),
  })
}

export function deleteProject(projectId: number): Promise<void> {
  return request<void>(`/${projectId}`, { method: 'DELETE' })
}

export function scanProject(projectId: number): Promise<ScanQueued> {
  return request<ScanQueued>(`/${projectId}/scan`, {
    method: 'POST',
    body: JSON.stringify({ trigger: 'manual' }),
  })
}

export function getScanStatus(projectId: number): Promise<ScanStatus> {
  return request<ScanStatus>(`/${projectId}/scan-status`)
}

export function listSnapshots(projectId: number): Promise<Snapshot[]> {
  return request<Snapshot[]>(`/${projectId}/snapshots`)
}
