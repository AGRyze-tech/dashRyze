'use client'
import { Search, Bell, Menu, CalendarDays, ChevronDown, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useMobileNav } from './DashboardShell'
import { useDateFilter, type DatePreset } from '@/contexts/DateFilterContext'

interface HeaderProps {
  title: string
  subtitle?: string
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'mes-atual',   label: 'Este mês' },
  { value: 'mes-passado', label: 'Mês passado' },
  { value: 'ultimos-3',   label: 'Últimos 3 meses' },
  { value: 'este-ano',    label: 'Este ano' },
  { value: 'custom',      label: 'Personalizado' },
]

export function Header({ title, subtitle }: HeaderProps) {
  const [search, setSearch]       = useState('')
  const [open, setOpen]           = useState(false)
  const [customFrom, setFrom]     = useState('')
  const [customTo, setTo]         = useState('')
  const { toggle } = useMobileNav()
  const { preset, label, setPreset, setCustomRange } = useDateFilter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handlePreset(p: DatePreset) {
    if (p !== 'custom') {
      setPreset(p)
      setOpen(false)
    } else {
      setPreset('custom')
    }
  }

  function applyCustom() {
    if (customFrom && customTo) {
      setCustomRange({ from: customFrom, to: customTo })
      setOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-[#F8FBF9]/90 dark:bg-[#0c0c0e]/90 backdrop-blur-md border-b border-gray-200/80 dark:border-[#181819]">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14">

        <button
          type="button"
          onClick={toggle}
          aria-label="Abrir menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-500 dark:text-[#00a02a] hover:bg-gray-100 dark:hover:bg-[#181819] transition-colors"
        >
          <Menu size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-[#F8FBF9] leading-none truncate">{title}</h1>
          {subtitle && <p className="text-[12px] text-gray-500 dark:text-[#00a02a] mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

          {/* ── Date filter ─────────────────────────────────── */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-medium transition-all ${
                open
                  ? 'border-[#00FF41] text-[#00FF41] bg-[#00FF41]/8 dark:bg-[#00FF41]/8'
                  : 'border-gray-200 dark:border-[#28282d] text-gray-600 dark:text-[#00a02a] hover:border-[#00FF41]/60 hover:text-[#00FF41] bg-white dark:bg-transparent'
              }`}
            >
              <CalendarDays size={13} />
              <span className="max-w-[120px] truncate">{label}</span>
              <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-gray-200 dark:border-[#1e1e22] bg-white dark:bg-[#111114] shadow-xl shadow-black/30 z-50 overflow-hidden">
                <div className="p-1">
                  {PRESETS.filter(p => p.value !== 'custom').map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handlePreset(p.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                        preset === p.value
                          ? 'bg-[#00FF41]/10 text-[#00FF41] font-medium'
                          : 'text-gray-700 dark:text-[#D1FAE5] hover:bg-gray-50 dark:hover:bg-[#181819]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-100 dark:border-[#1e1e22] p-3 space-y-2">
                  <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
                    preset === 'custom' ? 'text-[#00FF41]' : 'text-gray-400 dark:text-[#00a02a]'
                  }`}>Personalizado</p>
                  <div className="space-y-1.5">
                    <div>
                      <label htmlFor="filter-date-from" className="text-[11px] text-gray-500 dark:text-[#00a02a] block mb-1">De</label>
                      <input
                        id="filter-date-from"
                        type="date"
                        value={customFrom}
                        onChange={e => setFrom(e.target.value)}
                        className="input-field h-8 text-[12px] px-2"
                      />
                    </div>
                    <div>
                      <label htmlFor="filter-date-to" className="text-[11px] text-gray-500 dark:text-[#00a02a] block mb-1">Até</label>
                      <input
                        id="filter-date-to"
                        type="date"
                        value={customTo}
                        onChange={e => setTo(e.target.value)}
                        className="input-field h-8 text-[12px] px-2"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={applyCustom}
                    disabled={!customFrom || !customTo}
                    className="w-full mt-2 h-8 rounded-lg bg-[#00FF41] text-black text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00e038] transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Search ──────────────────────────────────────── */}
          <div className="relative hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#00a02a]" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-1.5 text-sm bg-white dark:bg-[#111A14] border border-gray-200 dark:border-[#28282d] rounded-lg w-44 focus:outline-none focus:border-[#00FF41] focus:ring-2 focus:ring-[#00FF41]/10 transition-all placeholder:text-gray-400 dark:placeholder:text-[#006620] text-gray-900 dark:text-[#F8FBF9]"
            />
          </div>

          <button type="button" aria-label="Notificações" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#181819] text-gray-500 dark:text-[#00a02a] hover:text-gray-700 dark:hover:text-[#00a02a] transition-colors">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
          </button>

          <div className="w-7 h-7 rounded-full bg-[#00FF41] flex items-center justify-center text-black text-xs font-bold cursor-pointer">
            I
          </div>
        </div>
      </div>
    </header>
  )
}
