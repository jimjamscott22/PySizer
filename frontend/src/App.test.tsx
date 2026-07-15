import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import * as api from './lib/api'
import type { Project } from './lib/types'

vi.mock('./lib/api', () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getScanStatus: vi.fn(),
  listProjects: vi.fn(),
  listSnapshots: vi.fn(),
  scanProject: vi.fn(),
}))

vi.mock('./components/Charts', () => ({
  default: () => <div>Charts</div>,
}))

const project: Project = {
  id: 1,
  name: 'PySizer',
  root_path: 'C:/source/PySizer',
  created_at: '2026-07-14T12:00:00Z',
  latest_snapshot: null,
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(api.listProjects).mockResolvedValue([project])
  vi.mocked(api.listSnapshots).mockResolvedValue([])
  vi.mocked(api.getScanStatus).mockResolvedValue({
    project_id: project.id,
    status: 'idle',
    message: null,
    snapshot_id: null,
  })
})

test('shows a create-project error and retains the submitted values', async () => {
  vi.mocked(api.listProjects).mockResolvedValue([])
  vi.mocked(api.createProject).mockRejectedValue(new Error('Path is not readable'))
  render(<App />)
  const name = screen.getByLabelText('Label')
  const rootPath = screen.getByLabelText('Root path')

  fireEvent.change(name, { target: { value: 'Broken Project' } })
  fireEvent.change(rootPath, { target: { value: 'C:/missing' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add volume' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Path is not readable')
  expect(name).toHaveValue('Broken Project')
  expect(rootPath).toHaveValue('C:/missing')
})

test('shows a scan error', async () => {
  vi.mocked(api.scanProject).mockRejectedValue(new Error('Scan already in progress'))
  render(<App />)

  fireEvent.click(await screen.findByRole('button', { name: 'Scan' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Scan already in progress')
})

test('shows a delete error', async () => {
  vi.mocked(api.deleteProject).mockRejectedValue(new Error('Project scan is in progress'))
  render(<App />)

  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Project scan is in progress')
})
