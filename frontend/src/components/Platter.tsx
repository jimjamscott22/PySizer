type PlatterDatum = {
  name: string
  bytes: number
}

type PlatterProps = {
  data: PlatterDatum[]
  colors: string[]
  size?: number
  spinning?: boolean
  centerLabel?: string
  centerSublabel?: string
}

const TAU = Math.PI * 2

function polarPoint(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) }
}

function sectorPath(cx: number, cy: number, rInner: number, rOuter: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  const outerStart = polarPoint(cx, cy, rOuter, startAngle)
  const outerEnd = polarPoint(cx, cy, rOuter, endAngle)
  const innerStart = polarPoint(cx, cy, rInner, endAngle)
  const innerEnd = polarPoint(cx, cy, rInner, startAngle)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ')
}

export function Platter({ data, colors, size = 240, spinning = false, centerLabel, centerSublabel }: PlatterProps) {
  const cx = size / 2
  const cy = size / 2
  const rimOuter = size / 2 - 4
  const rimInner = rimOuter - 10
  const sectorOuter = rimInner - 4
  const sectorInner = sectorOuter * 0.42
  const spindleRadius = sectorOuter * 0.16

  const total = data.reduce((sum, d) => sum + d.bytes, 0)
  let cursor = 0
  const sectors = data.map((d, index) => {
    const startAngle = total ? (cursor / total) * TAU : 0
    cursor += d.bytes
    const endAngle = total ? (cursor / total) * TAU : 0
    return {
      ...d,
      color: colors[index % colors.length],
      path: sectorPath(cx, cy, sectorInner, sectorOuter, startAngle, endAngle),
    }
  })

  const ticks = Array.from({ length: 60 }, (_, i) => i)

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={centerLabel ? `Storage platter, ${centerLabel}` : 'Storage platter'}
    >
      <circle cx={cx} cy={cy} r={rimOuter} fill="none" stroke="var(--color-steel-700)" strokeWidth={1.5} />
      <g className={spinning ? 'platter-spin' : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {ticks.map((i) => {
          const angle = (i / ticks.length) * TAU
          const major = i % 5 === 0
          const p1 = polarPoint(cx, cy, rimInner, angle)
          const p2 = polarPoint(cx, cy, major ? rimInner - 6 : rimInner - 3, angle)
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="var(--color-steel-600)"
              strokeWidth={major ? 1.2 : 0.6}
            />
          )
        })}
        {sectors.length ? (
          sectors.map((s) => (
            <path key={s.name} d={s.path} fill={s.color} stroke="var(--color-graphite-900)" strokeWidth={1} />
          ))
        ) : (
          <circle cx={cx} cy={cy} r={sectorOuter} fill="none" stroke="var(--color-steel-700)" strokeWidth={1} strokeDasharray="4 4" />
        )}
        <circle cx={cx} cy={cy} r={spindleRadius} fill="var(--color-graphite-950)" stroke="var(--color-steel-600)" strokeWidth={1.5} />
      </g>
      {centerLabel && (
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize={size * 0.09}
          fontWeight={700}
          fill="var(--color-paper-100)"
        >
          {centerLabel}
        </text>
      )}
      {centerSublabel && (
        <text
          x={cx}
          y={cy + size * 0.07}
          textAnchor="middle"
          fontFamily="var(--font-data)"
          fontSize={size * 0.032}
          letterSpacing={1.5}
          fill="var(--color-paper-300)"
        >
          {centerSublabel}
        </text>
      )}
    </svg>
  )
}
