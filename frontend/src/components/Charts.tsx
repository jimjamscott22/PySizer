import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Project, Snapshot } from '../lib/types'
import { formatBytes, formatDate } from '../lib/format'

const colors = ['#34d399', '#22d3ee', '#a78bfa', '#fbbf24', '#fb7185', '#94a3b8']

type ChartsProps = {
  selectedProject: Project | null
  projects: Project[]
  snapshots: Snapshot[]
}

export function Charts({ selectedProject, projects, snapshots }: ChartsProps) {
  const latest = selectedProject?.latest_snapshot
  const languageData = latest
    ? Object.entries(latest.language_distribution)
        .map(([name, value]) => ({ name, bytes: value.bytes, files: value.files }))
        .sort((a, b) => b.bytes - a.bytes)
    : []
  const comparisonData = projects
    .filter((project) => project.latest_snapshot)
    .map((project) => ({
      name: project.name,
      bytes: project.latest_snapshot?.total_size_bytes ?? 0,
    }))
  const timelineData = [...snapshots]
    .reverse()
    .map((snapshot) => ({
      taken_at: formatDate(snapshot.taken_at),
      bytes: snapshot.total_size_bytes,
      files: snapshot.file_count,
    }))

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <ChartPanel title="Language distribution" empty={!languageData.length}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={languageData} dataKey="bytes" nameKey="name" outerRadius={98} innerRadius={54}>
              {languageData.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatBytes(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Project size comparison" empty={!comparisonData.length}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={comparisonData}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
            <YAxis stroke="#94a3b8" tickFormatter={(value) => formatBytes(Number(value))} width={72} />
            <Tooltip formatter={(value) => formatBytes(Number(value))} cursor={{ fill: '#0f172a' }} />
            <Bar dataKey="bytes" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <div className="xl:col-span-2">
        <ChartPanel title="Size timeline" empty={!timelineData.length}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="taken_at" stroke="#94a3b8" tickLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value) => formatBytes(Number(value))} width={72} />
              <Tooltip formatter={(value) => formatBytes(Number(value))} />
              <Line type="monotone" dataKey="bytes" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </section>
  )
}

export default Charts

function ChartPanel({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</h2>
      {empty ? (
        <div className="grid h-[280px] place-items-center text-sm text-slate-500">Run a scan to populate this chart.</div>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </div>
  )
}
