import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Project, Snapshot } from '../lib/types'
import { formatBytes, formatDate } from '../lib/format'
import { Platter } from './Platter'

const colors = [
  'var(--color-amber-signal)',
  'var(--color-cyan-signal)',
  'var(--color-red-signal)',
  '#8ea2b3',
  '#c9a76b',
  '#7d8b99',
]

const tooltipStyle = {
  background: 'var(--color-graphite-850)',
  border: '1px solid var(--color-steel-700)',
  borderRadius: 2,
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 12,
  color: 'var(--color-paper-100)',
}

type ChartsProps = {
  selectedProject: Project | null
  projects: Project[]
  snapshots: Snapshot[]
  isScanning?: boolean
}

export function Charts({ selectedProject, projects, snapshots, isScanning = false }: ChartsProps) {
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
      <ChartPanel title="Sector map — language distribution" subtitle={selectedProject?.name} empty={!languageData.length}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
          <Platter
            data={languageData}
            colors={colors}
            size={220}
            spinning={isScanning}
            centerLabel={latest ? formatBytes(latest.total_size_bytes) : undefined}
            centerSublabel="TOTAL"
          />
          <ul className="grid w-full max-w-[220px] gap-1.5 font-data text-xs">
            {languageData.slice(0, 8).map((entry, index) => (
              <li key={entry.name} className="flex items-center justify-between gap-3 border-b border-steel-700/60 pb-1">
                <span className="flex items-center gap-2 text-paper-100">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} />
                  {entry.name}
                </span>
                <span className="text-paper-300">{formatBytes(entry.bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      </ChartPanel>

      <ChartPanel title="Capacity comparison — all volumes" empty={!comparisonData.length}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={comparisonData} margin={{ bottom: 16 }}>
            <CartesianGrid stroke="var(--color-steel-700)" strokeOpacity={0.4} vertical={false} />
            <XAxis
              dataKey="name"
              stroke="var(--color-paper-300)"
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={48}
              tick={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}
            />
            <YAxis
              stroke="var(--color-paper-300)"
              tickFormatter={(value) => formatBytes(Number(value))}
              width={72}
              tick={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => formatBytes(Number(value))}
              cursor={{ fill: 'var(--color-graphite-800)' }}
              contentStyle={tooltipStyle}
            />
            <Bar dataKey="bytes" fill="var(--color-amber-signal)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <div className="xl:col-span-2">
        <ChartPanel title="Read/write log — capacity over time" empty={!timelineData.length}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timelineData}>
              <CartesianGrid stroke="var(--color-steel-700)" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="taken_at"
                stroke="var(--color-paper-300)"
                tickLine={false}
                tick={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}
              />
              <YAxis
                stroke="var(--color-paper-300)"
                tickFormatter={(value) => formatBytes(Number(value))}
                width={72}
                tick={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}
              />
              <Tooltip formatter={(value) => formatBytes(Number(value))} contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="bytes"
                stroke="var(--color-cyan-signal)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-cyan-signal)' }}
              />
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
  subtitle,
  empty,
  children,
}: {
  title: string
  subtitle?: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <div className="scanlines rounded-sm border border-steel-700 bg-graphite-850 p-4">
      <div className="flex items-baseline justify-between gap-2 border-b border-steel-700 pb-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-paper-300">{title}</h2>
        {subtitle && <span className="font-data text-[11px] text-steel-600">{subtitle}</span>}
      </div>
      {empty ? (
        <div className="grid h-[280px] place-items-center font-data text-sm text-steel-600">
          Run a scan to populate this readout.
        </div>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </div>
  )
}
