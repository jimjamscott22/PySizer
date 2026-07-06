import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

export type ThemeId = 'amber' | 'blueprint' | 'night-ops' | 'warning-label' | 'server-rack' | 'punch-card'

export const THEME_STORAGE_KEY = 'pysizer-theme'

export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'amber', label: 'Amber Panel', swatch: '#f2a338' },
  { id: 'blueprint', label: 'Blueprint', swatch: '#5ec8f2' },
  { id: 'night-ops', label: 'Night Ops', swatch: '#6ee23a' },
  { id: 'warning-label', label: 'Warning Label', swatch: '#ffcc00' },
  { id: 'server-rack', label: 'Server Rack', swatch: '#4f9dff' },
  { id: 'punch-card', label: 'Punch Card', swatch: '#efe6d0' },
]

type ThemeSelectorProps = {
  theme: ThemeId
  onChange: (theme: ThemeId) => void
}

export function ThemeSelector({ theme, onChange }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Choose instrument panel"
        aria-label="Choose instrument panel"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-sm border border-steel-700 bg-graphite-850 px-3 py-2 font-data text-xs uppercase tracking-wider text-paper-300 transition hover:border-amber-signal/50 hover:text-paper-100"
      >
        <SlidersHorizontal size={14} className="text-amber-signal" />
        Panel
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-sm border border-steel-700 bg-graphite-850 shadow-lg"
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={theme === t.id}
              onClick={() => {
                onChange(t.id)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 font-data text-xs uppercase tracking-wider transition ${
                theme === t.id ? 'bg-graphite-800 text-paper-100' : 'text-paper-300 hover:bg-graphite-800/60'
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-steel-600"
                style={{ background: t.swatch }}
              />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
