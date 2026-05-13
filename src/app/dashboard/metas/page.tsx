'use client'
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Target, TrendingUp, Zap,
  Pencil, Check, X as XIcon, CheckCircle2, Trophy, Flame,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type GoalKey = 'revenue' | 'sales'
type Goals = Record<GoalKey, number>

const GOALS_KEY = 'ryze_dashboard_goals'
const DEFAULT_GOALS: Goals = { revenue: 10000, sales: 10 }

function loadGoals(): Goals {
  if (typeof window === 'undefined') return DEFAULT_GOALS
  try { return { ...DEFAULT_GOALS, ...JSON.parse(localStorage.getItem(GOALS_KEY) ?? 'null') } } catch { return DEFAULT_GOALS }
}

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-[#1A2C1F] ${className}`} />
}

function pct(value: number, goal: number) {
  if (goal <= 0) return 0
  return Math.min((value / goal) * 100, 100)
}

function barColor(p: number) {
  if (p >= 100) return 'bg-[#40916C]'
  if (p >= 70)  return 'bg-emerald-500'
  if (p >= 40)  return 'bg-amber-500'
  return 'bg-red-500'
}

function textColor(p: number) {
  if (p >= 100) return 'text-[#40916C] dark:text-[#52B788]'
  if (p >= 70)  return 'text-emerald-600 dark:text-emerald-400'
  if (p >= 40)  return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function ringColor(p: number) {
  if (p >= 100) return 'ring-[#40916C]/30 dark:ring-[#40916C]/40'
  if (p >= 70)  return 'ring-emerald-500/30'
  if (p >= 40)  return 'ring-amber-500/30'
  return 'ring-red-500/30'
}

// ─── Edit row ─────────────────────────────────────────────────────────────────
interface EditRowProps {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
}
function EditRow({ label, placeholder, value, onChange, onCommit, onCancel }: EditRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-gray-700 dark:text-[#D1FAE5]">Nova meta — {label}</p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          className="input-field h-9 text-[13px]"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          min="1"
          step="any"
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        />
        <button type="button" onClick={onCommit} className="h-9 px-3 rounded-lg bg-[#40916C] hover:bg-[#2D6A4F] text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors flex-shrink-0">
          <Check size={12} /> Salvar
        </button>
        <button type="button" onClick={onCancel} aria-label="Cancelar" className="h-9 px-2.5 rounded-lg border border-gray-200 dark:border-[#2A4030] hover:bg-gray-50 dark:hover:bg-[#1A2C1F] text-gray-500 dark:text-[#8BA891] transition-colors flex-shrink-0">
          <XIcon size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Revenue card (featured) ──────────────────────────────────────────────────
interface RevenueCardProps {
  current: number
  goal: number
  loading: boolean
  editing: boolean
  editValue: string
  onEditChange: (v: string) => void
  onEdit: () => void
  onCommit: () => void
  onCancel: () => void
}
function RevenueCard({ current, goal, loading, editing, editValue, onEditChange, onEdit, onCommit, onCancel }: RevenueCardProps) {
  const p = pct(current, goal)
  const done = p >= 100
  const remaining = Math.max(0, goal - current)
  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { barRef.current?.style.setProperty('--bar-w', `${p}%`) }, [p])

  return (
    <div className={`card-light overflow-hidden relative ring-1 ${done ? 'ring-[#40916C]/30 dark:ring-[#40916C]/40' : `ring-transparent ${ringColor(p)}`}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${done ? 'from-[#40916C]/8' : 'from-emerald-500/5'} via-transparent to-transparent pointer-events-none`} />
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#40916C]/15 dark:bg-[#40916C]/25' : 'bg-emerald-50 dark:bg-emerald-900/30'}`}>
              <TrendingUp size={19} className={done ? 'text-[#40916C] dark:text-[#52B788]' : 'text-emerald-600 dark:text-emerald-400'} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Meta Principal</p>
              <p className="text-[15px] font-bold text-gray-800 dark:text-[#D1FAE5] mt-0.5">Faturamento</p>
            </div>
          </div>
          <button type="button" onClick={onEdit} aria-label="Editar meta de faturamento" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A2C1F] text-gray-300 dark:text-[#2A4030] hover:text-gray-500 dark:hover:text-[#8BA891] transition-colors">
            <Pencil size={13} />
          </button>
        </div>

        {editing ? (
          <EditRow label="Faturamento (R$)" placeholder="Ex: 30000" value={editValue} onChange={onEditChange} onCommit={onCommit} onCancel={onCancel} />
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-4 flex-wrap">
              <span className={`tabular text-[38px] font-bold leading-none ${textColor(p)}`}>{formatCurrency(current)}</span>
              <div className="pb-1 flex items-center gap-2">
                <span className={`text-[20px] font-bold tabular ${textColor(p)}`}>{p.toFixed(1)}%</span>
                {done && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-[#40916C]/10 dark:bg-[#40916C]/20 text-[#40916C] dark:text-[#52B788]">
                    <CheckCircle2 size={10} /> Atingida!
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-3 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
              <div ref={barRef} className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out w-[var(--bar-w,0%)] ${barColor(p)}`} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
            </div>
            <div className="flex items-center justify-between">
              {done
                ? <span className="text-[12px] text-[#40916C] dark:text-[#52B788] font-medium">Meta do mês superada!</span>
                : <span className="text-[12px] text-gray-400 dark:text-[#4A6B52]">Faltam <span className="font-semibold text-gray-700 dark:text-[#D1FAE5]">{formatCurrency(remaining)}</span> para a meta</span>
              }
              <span className="text-[12px] text-gray-400 dark:text-[#4A6B52]">Meta: <span className="font-semibold text-gray-700 dark:text-[#D1FAE5]">{formatCurrency(goal)}</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sales card ───────────────────────────────────────────────────────────────
interface SalesCardProps {
  current: number
  goal: number
  loading: boolean
  editing: boolean
  editValue: string
  onEditChange: (v: string) => void
  onEdit: () => void
  onCommit: () => void
  onCancel: () => void
}
function SalesCard({ current, goal, loading, editing, editValue, onEditChange, onEdit, onCommit, onCancel }: SalesCardProps) {
  const p = pct(current, goal)
  const done = p >= 100
  const remaining = Math.max(0, goal - current)
  const fmt = (v: number) => `${Math.round(v)} venda${Math.round(v) !== 1 ? 's' : ''}`
  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { barRef.current?.style.setProperty('--bar-w', `${p}%`) }, [p])

  return (
    <div className={`card-light p-5 flex flex-col gap-4 ring-1 ${done ? 'ring-[#40916C]/25 dark:ring-[#40916C]/35' : `ring-transparent ${ringColor(p)}`}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#40916C]/15 dark:bg-[#40916C]/25' : 'bg-amber-50 dark:bg-amber-900/25'}`}>
            <Zap size={17} className={done ? 'text-[#40916C] dark:text-[#52B788]' : 'text-amber-500 dark:text-amber-400'} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5]">Número de Vendas</p>
            <p className="text-[11px] text-gray-400 dark:text-[#4A6B52] mt-0.5">Transações de entrada</p>
          </div>
        </div>
        <button type="button" onClick={onEdit} aria-label="Editar meta de vendas" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A2C1F] text-gray-300 dark:text-[#2A4030] hover:text-gray-500 dark:hover:text-[#8BA891] transition-colors flex-shrink-0">
          <Pencil size={12} />
        </button>
      </div>

      {editing ? (
        <EditRow label="Vendas (nº)" placeholder="Ex: 20" value={editValue} onChange={onEditChange} onCommit={onCommit} onCancel={onCancel} />
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-end justify-between">
            <span className={`tabular text-[22px] font-bold leading-none ${textColor(p)}`}>{fmt(current)}</span>
            <span className={`text-[13px] font-bold tabular ${textColor(p)}`}>{p.toFixed(1)}%</span>
          </div>
          <div className="relative h-2 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
            <div ref={barRef} className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out w-[var(--bar-w,0%)] ${barColor(p)}`} />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
          </div>
          <div className="flex items-center justify-between">
            {done
              ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#40916C] dark:text-[#52B788]"><CheckCircle2 size={11} /> Meta atingida!</span>
              : <span className="text-[11px] text-gray-400 dark:text-[#4A6B52]">Faltam <span className="font-semibold text-gray-600 dark:text-[#8BA891]">{fmt(remaining)}</span></span>
            }
            <span className="text-[11px] text-gray-400 dark:text-[#4A6B52]">meta: <span className="font-semibold">{fmt(goal)}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function MetasPage() {
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goals>(loadGoals)
  const [editing, setEditing] = useState<GoalKey | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [salesCount, setSalesCount] = useState(0)

  const supabase   = useMemo(() => createClient(), [])
  const monthLabel = useMemo(() => new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), [])

  useEffect(() => {
    async function load() {
      try {
        const { data: txn } = await supabase
          .from('transactions')
          .select('type, amount')
          .gte('date', monthStart())
        if (txn) {
          let revenue = 0, sales = 0
          for (const t of txn) {
            if (t.type === 'entrada') { revenue += t.amount; sales++ }
          }
          setMonthRevenue(revenue)
          setSalesCount(sales)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const revenuePct = pct(monthRevenue, goals.revenue)
  const salesPct   = pct(salesCount, goals.sales)
  const overallPct = (revenuePct + salesPct) / 2
  const achieved   = (revenuePct >= 100 ? 1 : 0) + (salesPct >= 100 ? 1 : 0)

  function startEdit(key: GoalKey) {
    setInputVal(String(goals[key]))
    setEditing(key)
  }

  function commitEdit() {
    if (!editing) return
    const val = parseFloat(inputVal.replace(',', '.'))
    if (val > 0) {
      const next = { ...goals, [editing]: val }
      setGoals(next)
      localStorage.setItem(GOALS_KEY, JSON.stringify(next))
    }
    setEditing(null)
  }

  return (
    <div>
      <Header title="Metas" subtitle={`Acompanhamento mensal · ${monthLabel}`} />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Summary KPIs ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card p-5 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#40916C]/5 via-transparent to-transparent pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-[#40916C]/10 dark:bg-[#40916C]/20 flex items-center justify-center mb-3">
              <Target size={17} className="text-[#40916C] dark:text-[#52B788]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-1">Progresso Geral</p>
            <p className={`tabular text-[28px] font-bold leading-none ${textColor(overallPct)}`}>{overallPct.toFixed(0)}%</p>
            <div className="mt-3 h-1.5 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor(overallPct)}`} style={{ width: `${overallPct}%` }} />
            </div>
          </div>

          <div className="stat-card p-5 overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${achieved > 0 ? 'from-[#40916C]/5' : 'from-gray-500/3'} via-transparent to-transparent pointer-events-none`} />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${achieved > 0 ? 'bg-[#40916C]/10 dark:bg-[#40916C]/20' : 'bg-gray-100 dark:bg-[#1A2C1F]'}`}>
              <Trophy size={17} className={achieved > 0 ? 'text-[#40916C] dark:text-[#52B788]' : 'text-gray-400 dark:text-[#2A4030]'} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-1">Metas Atingidas</p>
            <p className={`tabular text-[28px] font-bold leading-none ${achieved > 0 ? 'text-[#40916C] dark:text-[#52B788]' : 'text-gray-500 dark:text-[#8BA891]'}`}>
              {achieved}<span className="text-[16px] font-medium text-gray-400 dark:text-[#4A6B52] ml-1">/ 2</span>
            </p>
          </div>

          <div className="stat-card p-5 overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${overallPct >= 70 ? 'from-amber-500/5' : 'from-gray-500/3'} via-transparent to-transparent pointer-events-none`} />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${overallPct >= 70 ? 'bg-amber-50 dark:bg-amber-900/25' : 'bg-gray-100 dark:bg-[#1A2C1F]'}`}>
              <Flame size={17} className={overallPct >= 70 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-[#2A4030]'} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-1">Ritmo do Mês</p>
            <p className={`tabular text-[28px] font-bold leading-none ${overallPct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-[#8BA891]'}`}>
              {overallPct >= 100 ? 'Ótimo' : overallPct >= 70 ? 'Bom' : overallPct >= 40 ? 'Ok' : 'Baixo'}
            </p>
          </div>
        </div>

        {/* ── Goal Cards ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Objetivos do Mês</p>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5 capitalize">{monthLabel}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-[#4A6B52]">
              <Pencil size={11} />
              <span>Clique no lápis para editar</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <RevenueCard
                current={monthRevenue}
                goal={goals.revenue}
                loading={loading}
                editing={editing === 'revenue'}
                editValue={inputVal}
                onEditChange={setInputVal}
                onEdit={() => startEdit('revenue')}
                onCommit={commitEdit}
                onCancel={() => setEditing(null)}
              />
            </div>
            <SalesCard
              current={salesCount}
              goal={goals.sales}
              loading={loading}
              editing={editing === 'sales'}
              editValue={inputVal}
              onEditChange={setInputVal}
              onEdit={() => startEdit('sales')}
              onCommit={commitEdit}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
