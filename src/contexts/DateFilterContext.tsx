'use client'
import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'

export type DatePreset = 'mes-atual' | 'mes-passado' | 'ultimos-3' | 'este-ano' | 'custom'

export interface DateRange {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
}

interface DateFilterCtx {
  range: DateRange
  preset: DatePreset
  label: string
  setPreset: (p: DatePreset) => void
  setCustomRange: (r: DateRange) => void
}

function pad(n: number) { return String(n).padStart(2, '0') }

function computeRange(preset: DatePreset, custom: DateRange): DateRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  switch (preset) {
    case 'mes-atual':
      return {
        from: `${y}-${pad(m + 1)}-01`,
        to:   `${y}-${pad(m + 1)}-31`,
      }
    case 'mes-passado': {
      const pm = m === 0 ? 11 : m - 1
      const py = m === 0 ? y - 1 : y
      const lastDay = new Date(y, m, 0).getDate()
      return {
        from: `${py}-${pad(pm + 1)}-01`,
        to:   `${py}-${pad(pm + 1)}-${lastDay}`,
      }
    }
    case 'ultimos-3': {
      const start = new Date(y, m - 2, 1)
      return {
        from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
        to:   `${y}-${pad(m + 1)}-31`,
      }
    }
    case 'este-ano':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'custom':
      return custom
  }
}

const LABELS: Record<DatePreset, string> = {
  'mes-atual':    'Este mês',
  'mes-passado':  'Mês passado',
  'ultimos-3':    'Últimos 3 meses',
  'este-ano':     'Este ano',
  'custom':       'Personalizado',
}

const DateFilterContext = createContext<DateFilterCtx>({
  range:          { from: '', to: '' },
  preset:         'mes-atual',
  label:          'Este mês',
  setPreset:      () => {},
  setCustomRange: () => {},
})

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<DatePreset>('mes-atual')
  const [custom, setCustom]      = useState<DateRange>({ from: '', to: '' })

  const range = useMemo(() => computeRange(preset, custom), [preset, custom])
  const label = preset === 'custom' && custom.from && custom.to
    ? `${custom.from.slice(8)}/${custom.from.slice(5, 7)} – ${custom.to.slice(8)}/${custom.to.slice(5, 7)}`
    : LABELS[preset]

  function setPreset(p: DatePreset) { setPresetState(p) }

  function setCustomRange(r: DateRange) {
    setCustom(r)
    setPresetState('custom')
  }

  return (
    <DateFilterContext.Provider value={{ range, preset, label, setPreset, setCustomRange }}>
      {children}
    </DateFilterContext.Provider>
  )
}

export function useDateFilter() { return useContext(DateFilterContext) }
