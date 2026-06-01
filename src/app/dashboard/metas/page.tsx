'use client'
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Target, TrendingUp, Zap,
  Pencil, Check, X as XIcon, CheckCircle2, Flame,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type GoalKey = 'revenue' | 'sales'
type Goals = Record<GoalKey, number>

const DEFAULT_GOALS: Goals = { revenue: 10000, sales: 10 }

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-lg bg-gray-100 dark:bg-[#252525] ${className}`} />
}

function pct(value: number, goal: number) {
  if (goal <= 0) return 0
  return Math.min((value / goal) * 100, 100)
}

function barColor(p: number) {
  if (p >= 100) return 'bg-[#32B86A]'
  if (p >= 70)  return 'bg-emerald-500'
  if (p >= 40)  return 'bg-amber-500'
  return 'bg-red-500'
}

function textColor(p: number) {
  if (p >= 100) return 'text-[#32B86A] dark:text-[#4EE88A]'
  if (p >= 70)  return 'text-emerald-600 dark:text-emerald-400'
  if (p >= 40)  return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function ringColor(p: number) {
  if (p >= 100) return 'ring-[#32B86A]/30 dark:ring-[#32B86A]/40'
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
        <button type="button" onClick={onCommit} className="h-9 px-3 rounded-lg bg-[#32B86A] hover:bg-[#1A5C35] text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors flex-shrink-0">
          <Check size={12} /> Salvar
        </button>
        <button type="button" onClick={onCancel} aria-label="Cancelar" className="h-9 px-2.5 rounded-lg border border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#252525] text-gray-500 dark:text-[#3E9E60] transition-colors flex-shrink-0">
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
    <div className={`card-light overflow-hidden relative ring-1 ${done ? 'ring-[#32B86A]/30 dark:ring-[#32B86A]/40' : `ring-transparent ${ringColor(p)}`}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${done ? 'from-[#32B86A]/8' : 'from-emerald-500/5'} via-transparent to-transparent pointer-events-none`} />
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#32B86A]/15 dark:bg-[#32B86A]/25' : 'bg-emerald-50 dark:bg-emerald-900/30'}`}>
              <TrendingUp size={19} className={done ? 'text-[#32B86A] dark:text-[#4EE88A]' : 'text-emerald-600 dark:text-emerald-400'} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60]">Meta Principal</p>
              <p className="text-[15px] font-bold text-gray-800 dark:text-[#D1FAE5] mt-0.5">Faturamento</p>
            </div>
          </div>
          <button type="button" onClick={onEdit} aria-label="Editar meta de faturamento" className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252525] text-gray-300 dark:text-[#333333] hover:text-gray-500 dark:hover:text-[#3E9E60] transition-colors">
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
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-[#32B86A]/10 dark:bg-[#32B86A]/20 text-[#32B86A] dark:text-[#4EE88A]">
                    <CheckCircle2 size={10} /> Atingida!
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-3 bg-gray-100 dark:bg-[#252525] rounded-full overflow-hidden">
              <div ref={barRef} className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out motion-reduce:transition-none w-[var(--bar-w,0%)] ${barColor(p)}`} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
            </div>
            <div className="flex items-center justify-between">
              {done
                ? <span className="text-[12px] text-[#32B86A] dark:text-[#4EE88A] font-medium">Meta do mês superada!</span>
                : <span className="text-[12px] text-gray-400 dark:text-[#4d7a60]">Faltam <span className="font-semibold text-gray-700 dark:text-[#D1FAE5]">{formatCurrency(remaining)}</span> para a meta</span>
              }
              <span className="text-[12px] text-gray-400 dark:text-[#4d7a60]">Meta: <span className="font-semibold text-gray-700 dark:text-[#D1FAE5]">{formatCurrency(goal)}</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sales card ───────────────────────────────────────────────────────────────
function SalesCard({ current, loading }: { current: number; loading: boolean }) {
  const fmt = (v: number) => `${Math.round(v)} venda${Math.round(v) !== 1 ? 's' : ''}`
  return (
    <div className="card-light p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center flex-shrink-0">
          <Zap size={17} className="text-amber-500 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5]">Número de Vendas</p>
          <p className="text-[11px] text-gray-400 dark:text-[#4d7a60] mt-0.5">Transações de entrada este mês</p>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-28" />
      ) : (
        <p className="tabular text-[32px] font-bold leading-none text-amber-600 dark:text-amber-400">
          {Math.round(current)}
          <span className="text-[16px] font-medium text-gray-400 dark:text-[#4d7a60] ml-2">
            venda{Math.round(current) !== 1 ? 's' : ''}
          </span>
        </p>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function MetasPage() {
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS)
  const [editing, setEditing] = useState<GoalKey | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [salesCount, setSalesCount] = useState(0)

  const supabase   = useMemo(() => createClient(), [])
  const monthLabel = useMemo(() => new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), [])

  useEffect(() => {
    async function load() {
      try {
        const [{ data: txn }, { data: settings }] = await Promise.all([
          supabase.from('transactions').select('type, amount').gte('date', monthStart()),
          supabase.from('settings').select('value').eq('key', 'goals').single(),
        ])
        if (txn) {
          let revenue = 0, sales = 0
          for (const t of txn) {
            if (t.type === 'entrada') { revenue += t.amount; sales++ }
          }
          setMonthRevenue(revenue)
          setSalesCount(sales)
        }
        if (settings?.value) setGoals({ ...DEFAULT_GOALS, ...settings.value })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const revenuePct = pct(monthRevenue, goals.revenue)
  const overallPct = revenuePct

  function startEdit(key: GoalKey) {
    setInputVal(String(goals[key]))
    setEditing(key)
  }

  async function commitEdit() {
    if (!editing) return
    const val = parseFloat(inputVal.replace(',', '.'))
    if (val > 0) {
      const next = { ...goals, [editing]: val }
      setGoals(next)
      await supabase
        .from('settings')
        .upsert({ key: 'goals', value: next, updated_at: new Date().toISOString() })
    }
    setEditing(null)
  }

  return (
    <div>
      <Header title="Metas" subtitle={`Acompanhamento mensal · ${monthLabel}`} />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Summary KPIs ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card p-5 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#32B86A]/5 via-transparent to-transparent pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-[#32B86A]/10 dark:bg-[#32B86A]/20 flex items-center justify-center mb-3">
              <Target size={17} className="text-[#32B86A] dark:text-[#4EE88A]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60] mb-1">Progresso Geral</p>
            <p className={`tabular text-[28px] font-bold leading-none ${textColor(overallPct)}`}>{overallPct.toFixed(0)}%</p>
            <div className="mt-3 h-1.5 bg-gray-100 dark:bg-[#252525] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${barColor(overallPct)}`} style={{ width: `${overallPct}%` }} />
            </div>
          </div>

          <div className="stat-card p-5 overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${overallPct >= 70 ? 'from-amber-500/5' : 'from-gray-500/3'} via-transparent to-transparent pointer-events-none`} />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${overallPct >= 70 ? 'bg-amber-50 dark:bg-amber-900/25' : 'bg-gray-100 dark:bg-[#252525]'}`}>
              <Flame size={17} className={overallPct >= 70 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-[#333333]'} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60] mb-1">Ritmo do Mês</p>
            <p className={`tabular text-[28px] font-bold leading-none ${overallPct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-[#3E9E60]'}`}>
              {overallPct >= 100 ? 'Ótimo' : overallPct >= 70 ? 'Bom' : overallPct >= 40 ? 'Ok' : 'Baixo'}
            </p>
          </div>
        </div>

        {/* ── Goal Cards ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60]">Objetivos do Mês</p>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5 capitalize">{monthLabel}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-[#4d7a60]">
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
            <SalesCard current={salesCount} loading={loading} />
          </div>
        </div>

      </div>
    </div>
  )
}
