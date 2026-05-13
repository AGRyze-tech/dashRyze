'use client'
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Target, TrendingUp, Zap, Users, FolderKanban, UserPlus,
  Pencil, Check, X as XIcon, CheckCircle2, Trophy, Flame,
  ChevronRight, BarChart2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import type { ClientStatus, ProjectStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type GoalKey = 'revenue' | 'sales' | 'clients' | 'projects' | 'leads'
type Goals = Record<GoalKey, number>

const GOALS_KEY = 'ryze_dashboard_goals'
const DEFAULT_GOALS: Goals = {
  revenue: 10000,
  sales: 10,
  clients: 15,
  projects: 5,
  leads: 20,
}

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
  if (p >= 70) return 'bg-emerald-500'
  if (p >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function textColor(p: number) {
  if (p >= 100) return 'text-[#40916C] dark:text-[#52B788]'
  if (p >= 70) return 'text-emerald-600 dark:text-emerald-400'
  if (p >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function ringColor(p: number) {
  if (p >= 100) return 'ring-[#40916C]/30 dark:ring-[#40916C]/40'
  if (p >= 70) return 'ring-emerald-500/30'
  if (p >= 40) return 'ring-amber-500/30'
  return 'ring-red-500/30'
}

// ─── Goal config ──────────────────────────────────────────────────────────────
const GOAL_CONFIG: Record<GoalKey, {
  label: string
  icon: React.ElementType
  iconCls: string
  format: (v: number) => string
  placeholder: string
  hint: string
}> = {
  revenue: {
    label: 'Faturamento',
    icon: TrendingUp,
    iconCls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    format: formatCurrency,
    placeholder: 'Ex: 30000',
    hint: 'Total de entradas no mês',
  },
  sales: {
    label: 'Número de Vendas',
    icon: Zap,
    iconCls: 'bg-amber-50 dark:bg-amber-900/25 text-amber-500 dark:text-amber-400',
    format: v => `${Math.round(v)} venda${Math.round(v) !== 1 ? 's' : ''}`,
    placeholder: 'Ex: 20',
    hint: 'Transações de entrada registradas',
  },
  clients: {
    label: 'Clientes Ativos',
    icon: Users,
    iconCls: 'bg-[#F0FBF5] dark:bg-[#1B4332] text-[#40916C] dark:text-[#52B788]',
    format: v => `${Math.round(v)} cliente${Math.round(v) !== 1 ? 's' : ''}`,
    placeholder: 'Ex: 20',
    hint: 'Clientes com status ativo',
  },
  projects: {
    label: 'Projetos Entregues',
    icon: FolderKanban,
    iconCls: 'bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400',
    format: v => `${Math.round(v)} projeto${Math.round(v) !== 1 ? 's' : ''}`,
    placeholder: 'Ex: 8',
    hint: 'Projetos entregues ou concluídos',
  },
  leads: {
    label: 'Leads Novos',
    icon: UserPlus,
    iconCls: 'bg-purple-50 dark:bg-purple-900/25 text-purple-600 dark:text-purple-400',
    format: v => `${Math.round(v)} lead${Math.round(v) !== 1 ? 's' : ''}`,
    placeholder: 'Ex: 30',
    hint: 'Leads com status "novo"',
  },
}

const GOAL_ORDER: GoalKey[] = ['revenue', 'sales', 'clients', 'projects', 'leads']

// ─── Edit inline row ───────────────────────────────────────────────────────────
interface EditRowProps {
  goalKey: GoalKey
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
}
function EditRow({ goalKey, value, onChange, onCommit, onCancel }: EditRowProps) {
  const cfg = GOAL_CONFIG[goalKey]
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-gray-700 dark:text-[#D1FAE5]">Nova meta — {cfg.label}</p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          className="input-field h-9 text-[13px]"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={cfg.placeholder}
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

// ─── Goal card ────────────────────────────────────────────────────────────────
interface GoalCardProps {
  goalKey: GoalKey
  current: number
  goal: number
  loading: boolean
  onEdit: () => void
  editing: boolean
  editValue: string
  onEditChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  featured?: boolean
}
function GoalCard({ goalKey, current, goal, loading, onEdit, editing, editValue, onEditChange, onCommit, onCancel, featured }: GoalCardProps) {
  const cfg = GOAL_CONFIG[goalKey]
  const Icon = cfg.icon
  const p = pct(current, goal)
  const done = p >= 100
  const remaining = Math.max(0, goal - current)
  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { barRef.current?.style.setProperty('--bar-w', `${p}%`) }, [p])

  if (featured) {
    return (
      <div className={`card-light overflow-hidden relative ring-1 ${done ? 'ring-[#40916C]/30 dark:ring-[#40916C]/40' : `ring-transparent ${ringColor(p)}`}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${done ? 'from-[#40916C]/8' : 'from-emerald-500/5'} via-transparent to-transparent pointer-events-none`} />
        {editing ? (
          <div className="p-6">
            <EditRow goalKey={goalKey} value={editValue} onChange={onEditChange} onCommit={onCommit} onCancel={onCancel} />
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-5">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#40916C]/15 dark:bg-[#40916C]/25' : cfg.iconCls}`}>
                  <Icon size={19} className={done ? 'text-[#40916C] dark:text-[#52B788]' : ''} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Meta Principal</p>
                  <p className="text-[15px] font-bold text-gray-800 dark:text-[#D1FAE5] mt-0.5">{cfg.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Editar meta de ${cfg.label}`}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A2C1F] text-gray-300 dark:text-[#2A4030] hover:text-gray-500 dark:hover:text-[#8BA891] transition-colors"
              >
                <Pencil size={13} />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Big number row */}
                <div className="flex items-end gap-4 flex-wrap">
                  <span className={`tabular text-[38px] font-bold leading-none ${textColor(p)}`}>
                    {cfg.format(current)}
                  </span>
                  <div className="pb-1 flex items-center gap-2">
                    <span className={`text-[20px] font-bold tabular ${textColor(p)}`}>{p.toFixed(1)}%</span>
                    {done && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-[#40916C]/10 dark:bg-[#40916C]/20 text-[#40916C] dark:text-[#52B788]">
                        <CheckCircle2 size={10} /> Atingida!
                      </span>
                    )}
                  </div>
                </div>

                {/* Thick bar */}
                <div className="relative h-3 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
                  <div
                    ref={barRef}
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out w-[var(--bar-w,0%)] ${barColor(p)}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  {done ? (
                    <span className="text-[12px] text-[#40916C] dark:text-[#52B788] font-medium">Meta do mês superada!</span>
                  ) : (
                    <span className="text-[12px] text-gray-400 dark:text-[#4A6B52]">
                      Faltam <span className="font-semibold text-gray-700 dark:text-[#D1FAE5]">{cfg.format(remaining)}</span> para a meta
                    </span>
                  )}
                  <span className="text-[12px] text-gray-400 dark:text-[#4A6B52]">
                    Meta: <span className="font-semibold text-gray-700 dark:text-[#D1FAE5]">{cfg.format(goal)}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`card-light p-5 flex flex-col gap-4 ring-1 ${done ? 'ring-[#40916C]/25 dark:ring-[#40916C]/35' : `ring-transparent ${ringColor(p)}`}`}>
      {editing ? (
        <EditRow goalKey={goalKey} value={editValue} onChange={onEditChange} onCommit={onCommit} onCancel={onCancel} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#40916C]/15 dark:bg-[#40916C]/25' : cfg.iconCls}`}>
                <Icon size={17} className={done ? 'text-[#40916C] dark:text-[#52B788]' : ''} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5]">{cfg.label}</p>
                <p className="text-[11px] text-gray-400 dark:text-[#4A6B52] mt-0.5">{cfg.hint}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar meta de ${cfg.label}`}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A2C1F] text-gray-300 dark:text-[#2A4030] hover:text-gray-500 dark:hover:text-[#8BA891] transition-colors flex-shrink-0"
            >
              <Pencil size={12} />
            </button>
          </div>

          {/* Values */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-end justify-between">
                <span className={`tabular text-[22px] font-bold leading-none ${textColor(p)}`}>
                  {cfg.format(current)}
                </span>
                <span className={`text-[13px] font-bold tabular ${textColor(p)}`}>{p.toFixed(1)}%</span>
              </div>

              {/* Bar */}
              <div className="relative h-2 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
                <div
                  ref={barRef}
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out w-[var(--bar-w,0%)] ${barColor(p)}`}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                {done ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#40916C] dark:text-[#52B788]">
                    <CheckCircle2 size={11} /> Meta atingida!
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-400 dark:text-[#4A6B52]">
                    Faltam <span className="font-semibold text-gray-600 dark:text-[#8BA891]">{cfg.format(remaining)}</span>
                  </span>
                )}
                <span className="text-[11px] text-gray-400 dark:text-[#4A6B52]">
                  meta: <span className="font-semibold">{cfg.format(goal)}</span>
                </span>
              </div>
            </div>
          )}
        </>
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

  // Real data
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [salesCount, setSalesCount] = useState(0)
  const [activeClients, setActiveClients] = useState(0)
  const [deliveredProjects, setDeliveredProjects] = useState(0)
  const [newLeads, setNewLeads] = useState(0)

  const supabase = useMemo(() => createClient(), [])

  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    async function load() {
      try {
        const [
          { data: txn },
          { data: cli },
          { data: proj },
          { data: lds },
        ] = await Promise.all([
          supabase.from('transactions').select('type, amount').gte('date', monthStart()),
          supabase.from('clients').select('status'),
          supabase.from('projects').select('status'),
          supabase.from('leads').select('status'),
        ])

        if (txn) {
          let revenue = 0, sales = 0
          for (const t of txn) {
            if (t.type === 'entrada') { revenue += t.amount; sales++ }
          }
          setMonthRevenue(revenue)
          setSalesCount(sales)
        }
        if (cli) setActiveClients(cli.filter((c: { status: ClientStatus }) => c.status === 'ativo').length)
        if (proj) setDeliveredProjects(proj.filter((p: { status: ProjectStatus }) => p.status === 'entregue' || p.status === 'concluido').length)
        if (lds) setNewLeads(lds.filter((l: { status: string }) => l.status === 'novo').length)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const currentValues: Record<GoalKey, number> = {
    revenue: monthRevenue,
    sales: salesCount,
    clients: activeClients,
    projects: deliveredProjects,
    leads: newLeads,
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const { achieved, overallPct, onTrack } = useMemo(() => {
    let achieved = 0, onTrack = 0, totalPct = 0
    for (const key of GOAL_ORDER) {
      const p = pct(currentValues[key], goals[key])
      totalPct += p
      if (p >= 100) achieved++
      if (p >= 70) onTrack++
    }
    return { achieved, overallPct: totalPct / GOAL_ORDER.length, onTrack }
  }, [currentValues, goals])

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

          {/* Overall progress */}
          <div className="stat-card p-5 overflow-hidden relative col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-[#40916C]/5 via-transparent to-transparent pointer-events-none" />
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#40916C]/10 dark:bg-[#40916C]/20 flex items-center justify-center">
                <Target size={17} className="text-[#40916C] dark:text-[#52B788]" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-1">Progresso Geral</p>
            <p className={`tabular text-[28px] font-bold leading-none ${textColor(overallPct)}`}>{overallPct.toFixed(0)}%</p>
            <div className="mt-3 h-1.5 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor(overallPct)}`} style={{ width: `${overallPct}%` }} />
            </div>
          </div>

          {/* Goals achieved */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${achieved > 0 ? 'from-[#40916C]/5' : 'from-gray-500/3'} via-transparent to-transparent pointer-events-none`} />
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${achieved > 0 ? 'bg-[#40916C]/10 dark:bg-[#40916C]/20' : 'bg-gray-100 dark:bg-[#1A2C1F]'}`}>
                <Trophy size={17} className={achieved > 0 ? 'text-[#40916C] dark:text-[#52B788]' : 'text-gray-400 dark:text-[#2A4030]'} />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-1">Metas Atingidas</p>
            <p className={`tabular text-[28px] font-bold leading-none ${achieved > 0 ? 'text-[#40916C] dark:text-[#52B788]' : 'text-gray-500 dark:text-[#8BA891]'}`}>
              {achieved}
              <span className="text-[16px] font-medium text-gray-400 dark:text-[#4A6B52] ml-1">/ {GOAL_ORDER.length}</span>
            </p>
          </div>

          {/* On track */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${onTrack > 0 ? 'from-amber-500/5' : 'from-gray-500/3'} via-transparent to-transparent pointer-events-none`} />
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${onTrack > 0 ? 'bg-amber-50 dark:bg-amber-900/25' : 'bg-gray-100 dark:bg-[#1A2C1F]'}`}>
                <Flame size={17} className={onTrack > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-[#2A4030]'} />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-1">No Caminho Certo</p>
            <p className={`tabular text-[28px] font-bold leading-none ${onTrack > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-[#8BA891]'}`}>
              {onTrack}
              <span className="text-[16px] font-medium text-gray-400 dark:text-[#4A6B52] ml-1">/ {GOAL_ORDER.length}</span>
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
              <span>Clique no lápis para editar cada meta</span>
            </div>
          </div>

          {/* Revenue — featured, full width on its row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <GoalCard
                goalKey="revenue"
                current={currentValues.revenue}
                goal={goals.revenue}
                loading={loading}
                onEdit={() => startEdit('revenue')}
                editing={editing === 'revenue'}
                editValue={inputVal}
                onEditChange={setInputVal}
                onCommit={commitEdit}
                onCancel={() => setEditing(null)}
                featured
              />
            </div>
            <GoalCard
              goalKey="sales"
              current={currentValues.sales}
              goal={goals.sales}
              loading={loading}
              onEdit={() => startEdit('sales')}
              editing={editing === 'sales'}
              editValue={inputVal}
              onEditChange={setInputVal}
              onCommit={commitEdit}
              onCancel={() => setEditing(null)}
            />
          </div>

          {/* Remaining goals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {(['clients', 'projects', 'leads'] as GoalKey[]).map(key => (
              <GoalCard
                key={key}
                goalKey={key}
                current={currentValues[key]}
                goal={goals[key]}
                loading={loading}
                onEdit={() => startEdit(key)}
                editing={editing === key}
                editValue={inputVal}
                onEditChange={setInputVal}
                onCommit={commitEdit}
                onCancel={() => setEditing(null)}
              />
            ))}
          </div>
        </div>

        {/* ── How goals are measured ────────────────────────────────────── */}
        <div className="card-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1E3020]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Como as metas são medidas</p>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">Fonte dos dados por objetivo</p>
            </div>
            <BarChart2 size={16} className="text-gray-300 dark:text-[#2A4030]" />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-[#1E3020]">
            {GOAL_ORDER.map(key => {
              const cfg = GOAL_CONFIG[key]
              const Icon = cfg.icon
              const p = pct(currentValues[key], goals[key])
              return (
                <div key={key} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 dark:hover:bg-[#1A2C1F] transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconCls}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5]">{cfg.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-[#4A6B52] truncate">{cfg.hint}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-1.5 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor(p)}`} style={{ width: `${p}%` }} />
                    </div>
                    <span className={`text-[12px] font-bold tabular w-12 text-right ${textColor(p)}`}>{p.toFixed(0)}%</span>
                    <ChevronRight size={14} className="text-gray-200 dark:text-[#1E3020]" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
