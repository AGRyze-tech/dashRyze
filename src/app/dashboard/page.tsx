'use client'
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import {
  Users, FolderKanban, TrendingUp, TrendingDown, Wallet,
  ArrowRight, AlertTriangle, Target, MousePointer, Eye,
  Zap, CheckCircle2, Clock, BarChart2, ArrowUpRight, ArrowDownLeft,
  Pencil, Check, X as XIcon,
} from 'lucide-react'
import { formatCurrency, formatDateShort, daysUntil, projectStatusConfig, leadStatusConfig } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { clientRepository, projectRepository, transactionRepository, leadRepository } from '@/lib/repositories'
import { loadMetaCampaigns } from '@/lib/meta'
import Link from 'next/link'
import { Transaction, Lead, MetaCampaign } from '@/types'
import type { ClientStatus, ProjectStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type DashClient  = { id: string; name: string; status: ClientStatus; total_value?: number; paid_value?: number }
type DashProject = { id: string; name: string; status: ProjectStatus; deadline: string; client_id: string; client?: { name: string } }

type Goals = { revenue: number; sales: number }
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
  return <div className={`animate-pulse motion-reduce:animate-none rounded-lg bg-gray-100 dark:bg-[#1A2C1F] ${className}`} />
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

// ─── Progress row ─────────────────────────────────────────────────────────────
interface ProgressRowProps {
  label: string
  icon: React.ElementType
  current: number
  goal: number
  formatValue: (v: number) => string
  loading?: boolean
  onEditGoal: () => void
}
function ProgressRow({ label, icon: Icon, current, goal, formatValue, loading, onEditGoal }: ProgressRowProps) {
  const p = pct(current, goal)
  const done = p >= 100
  const remaining = goal - current
  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { barRef.current?.style.setProperty('--bar-w', `${p}%`) }, [p])

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#40916C]/15 dark:bg-[#40916C]/25' : 'bg-gray-100 dark:bg-[#1A2C1F]'}`}>
            <Icon size={13} className={done ? 'text-[#40916C] dark:text-[#52B788]' : 'text-gray-400 dark:text-[#4A6B52]'} />
          </div>
          <span className="text-[12px] font-semibold text-gray-700 dark:text-[#D1FAE5] truncate">{label}</span>
          {done && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#40916C]/10 dark:bg-[#40916C]/20 text-[#40916C] dark:text-[#52B788] flex-shrink-0">
              <CheckCircle2 size={9} /> Meta atingida!
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {loading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="text-[12px] tabular text-gray-500 dark:text-[#8BA891]">
              <span className={`font-bold ${textColor(p)}`}>{formatValue(current)}</span>
              <span className="text-gray-300 dark:text-[#2A4030] mx-1">/</span>
              <span>{formatValue(goal)}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onEditGoal}
            aria-label={`Editar meta de ${label}`}
            className="p-2.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#1A2C1F] text-gray-300 dark:text-[#2A4030] hover:text-gray-500 dark:hover:text-[#8BA891] transition-colors"
          >
            <Pencil size={11} />
          </button>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2.5 bg-gray-100 dark:bg-[#1A2C1F] rounded-full overflow-hidden">
        <div
          ref={barRef}
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out motion-reduce:transition-none w-[var(--bar-w,0%)] ${barColor(p)}`}
        />
        {/* shine */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400 dark:text-[#4A6B52]">
          {loading ? '' : done
            ? `🎉 Parabéns! Meta superada`
            : `Faltam ${formatValue(remaining)} para a meta`}
        </p>
        <span className={`text-[12px] font-bold tabular ${textColor(p)}`}>{p.toFixed(1)}%</span>
      </div>
    </div>
  )
}

// ─── Goals section ────────────────────────────────────────────────────────────
interface GoalsSectionProps {
  monthRevenue: number
  salesCount: number
  loading: boolean
}
function GoalsSection({ monthRevenue, salesCount, loading }: GoalsSectionProps) {
  const [goals, setGoals] = useState<Goals>(loadGoals)
  const [editing, setEditing] = useState<keyof Goals | null>(null)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function startEdit(key: keyof Goals) {
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

  function cancelEdit() {
    setEditing(null)
  }

  return (
    <div className="card-light p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Metas do Mês</p>
          <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-[#40916C]/10 dark:bg-[#40916C]/20 flex items-center justify-center">
          <Target size={16} className="text-[#40916C] dark:text-[#52B788]" />
        </div>
      </div>

      <div className="space-y-6">
        {/* Revenue goal */}
        {editing === 'revenue' ? (
          <EditGoalRow
            label="Meta de Faturamento (R$)"
            inputRef={inputRef}
            value={inputVal}
            onChange={setInputVal}
            onCommit={commitEdit}
            onCancel={cancelEdit}
            placeholder="Ex: 30000"
          />
        ) : (
          <ProgressRow
            label="Faturamento"
            icon={TrendingUp}
            current={monthRevenue}
            goal={goals.revenue}
            formatValue={formatCurrency}
            loading={loading}
            onEditGoal={() => startEdit('revenue')}
          />
        )}

        <div className="h-px bg-gray-100 dark:bg-[#1E3020]" />

        {/* Sales goal */}
        {editing === 'sales' ? (
          <EditGoalRow
            label="Meta de Vendas (nº)"
            inputRef={inputRef}
            value={inputVal}
            onChange={setInputVal}
            onCommit={commitEdit}
            onCancel={cancelEdit}
            placeholder="Ex: 20"
          />
        ) : (
          <ProgressRow
            label="Número de Vendas"
            icon={Zap}
            current={salesCount}
            goal={goals.sales}
            formatValue={v => `${Math.round(v)} venda${Math.round(v) !== 1 ? 's' : ''}`}
            loading={loading}
            onEditGoal={() => startEdit('sales')}
          />
        )}
      </div>
    </div>
  )
}

interface EditGoalRowProps {
  label: string
  inputRef: React.RefObject<HTMLInputElement>
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  placeholder: string
}
function EditGoalRow({ label, inputRef, value, onChange, onCommit, onCancel, placeholder }: EditGoalRowProps) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-gray-700 dark:text-[#D1FAE5]">{label}</p>
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
        <button type="button" onClick={onCancel} aria-label="Cancelar edição" className="h-9 px-2.5 rounded-lg border border-gray-200 dark:border-[#2A4030] hover:bg-gray-50 dark:hover:bg-[#1A2C1F] text-gray-500 dark:text-[#8BA891] transition-colors flex-shrink-0">
          <XIcon size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ─── Deadline row ─────────────────────────────────────────────────────────────
function DeadlineRow({ project }: { project: DashProject }) {
  const days = daysUntil(project.deadline)
  const isOverdue = days < 0
  const isWarning = days >= 0 && days <= 5
  const cfg = projectStatusConfig[project.status]

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-[#1E3020] last:border-0 hover:bg-gray-50/60 dark:hover:bg-[#1A2C1F] transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#40916C]'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 dark:text-[#E2F5EC] truncate">{project.name}</p>
        <p className="text-[11px] text-gray-400 dark:text-[#4A6B52] truncate">{project.client?.name ?? '—'}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge color={cfg.color as 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'} dot={false}>
          {cfg.label}
        </Badge>
        <span className={`flex items-center gap-1 text-[11px] font-medium tabular ${isOverdue ? 'text-red-500 dark:text-red-400' : isWarning ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-[#4A6B52]'}`}>
          {(isOverdue || isWarning) && <AlertTriangle size={9} />}
          {formatDateShort(project.deadline)}
        </span>
      </div>
    </div>
  )
}

// ─── Lead row ─────────────────────────────────────────────────────────────────
function LeadRow({ lead }: { lead: Lead }) {
  const cfg = leadStatusConfig[lead.status]
  const initials = lead.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-[#1E3020] last:border-0 hover:bg-gray-50/60 dark:hover:bg-[#1A2C1F] transition-colors">
      <div className="w-8 h-8 rounded-full bg-[#F0FBF5] dark:bg-[#1B4332] flex items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-[#40916C] dark:text-[#52B788]">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 dark:text-[#E2F5EC] truncate">{lead.name}</p>
        <p className="text-[11px] text-gray-400 dark:text-[#4A6B52]">{lead.revenue}</p>
      </div>
      <Badge color={cfg.color as 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'} dot={false}>
        {cfg.label}
      </Badge>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  iconCls: string
  accent?: string
  loading?: boolean
  href?: string
}
function KpiCard({ label, value, sub, icon: Icon, iconCls, accent = 'from-gray-500/5', loading, href }: KpiCardProps) {
  const inner = (
    <div className={`stat-card p-5 overflow-hidden relative group ${href ? 'cursor-pointer' : ''}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} via-transparent to-transparent pointer-events-none`} />
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls}`}>
          <Icon size={17} />
        </div>
        {href && (
          <ArrowUpRight size={14} className="text-gray-300 dark:text-[#2A4030] group-hover:text-[#40916C] group-hover:dark:text-[#52B788] transition-colors" />
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-1">{label}</p>
      {loading ? (
        <>
          <Skeleton className="h-7 w-28 mb-1" />
          <Skeleton className="h-3 w-20 mt-2" />
        </>
      ) : (
        <>
          <p className="tabular text-[26px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4] mb-1.5">{value}</p>
          {sub && <p className="text-[11px] text-gray-400 dark:text-[#8BA891]">{sub}</p>}
        </>
      )}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<DashClient[]>([])
  const [projects, setProjects] = useState<DashProject[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [meta] = useState<MetaCampaign[]>(loadMetaCampaigns)

  useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
    const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    setGreeting(`${period}, Isaac · ${date}`)

    const db = createClient()

    async function load() {
      try {
        const [cli, proj, txn, lds] = await Promise.all([
          clientRepository(db).findSummary(),
          projectRepository(db).findDashboard(),
          transactionRepository(db).findSince(monthStart()),
          leadRepository(db).findAll(),
        ])
        setClients(cli as DashClient[])
        setProjects(proj as DashProject[])
        setTransactions(txn as Transaction[])
        setLeads(lds)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activeClients = useMemo(() => {
    let count = 0
    for (const c of clients) { if (c.status === 'ativo') count++ }
    return count
  }, [clients])

  const totalACobrar = useMemo(() => {
    let total = 0
    for (const c of clients) {
      const pending = (c.total_value ?? 0) - (c.paid_value ?? 0)
      if (pending > 0) total += pending
    }
    return total
  }, [clients])

  const { activeProjects, deliveredCount } = useMemo(() => {
    const active: DashProject[] = []
    let deliveredCount = 0
    for (const p of projects) {
      if (p.status === 'entregue' || p.status === 'concluido') deliveredCount++
      else active.push(p)
    }
    return { activeProjects: active, deliveredCount }
  }, [projects])

  const { monthRevenue, monthExpenses, salesCount } = useMemo(() => {
    let monthRevenue = 0, monthExpenses = 0, salesCount = 0
    for (const t of transactions) {
      if (t.type === 'entrada') { monthRevenue += t.amount; salesCount++ }
      else monthExpenses += t.amount
    }
    return { monthRevenue, monthExpenses, salesCount }
  }, [transactions])
  const balance = monthRevenue - monthExpenses

  const { newLeads, recentLeads } = useMemo(() => {
    let newLeads = 0
    for (const l of leads) { if (l.status === 'novo') newLeads++ }
    return { newLeads, recentLeads: leads.slice(0, 4) }
  }, [leads])

  const deadlineProjects = useMemo(() => {
    const sorted = [...activeProjects].sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )
    const urgent = sorted.filter(p => daysUntil(p.deadline) <= 14)
    return (urgent.length > 0 ? urgent : sorted).slice(0, 5)
  }, [activeProjects])

  const { metaSpend, metaImpressions, metaClicks, metaActive } = useMemo(() => {
    let metaSpend = 0, metaImpressions = 0, metaClicks = 0, metaActive = 0
    for (const c of meta) {
      metaSpend += c.spend
      metaImpressions += c.impressions
      metaClicks += c.clicks
      if (c.status === 'ACTIVE') metaActive++
    }
    return { metaSpend, metaImpressions, metaClicks, metaActive }
  }, [meta])
  const metaCTR = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0

  return (
    <div>
      <Header title="Dashboard" subtitle={greeting} />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── KPI row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
          <KpiCard
            label="Receita do Mês"
            value={formatCurrency(monthRevenue)}
            sub={`${salesCount} venda${salesCount !== 1 ? 's' : ''} · ${formatCurrency(monthExpenses)} em despesas`}
            icon={TrendingUp}
            iconCls="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            accent="from-emerald-500/5"
            loading={loading}
            href="/dashboard/financeiro"
          />
          <KpiCard
            label="Clientes Ativos"
            value={activeClients}
            sub={`${clients.length} total cadastrado${clients.length !== 1 ? 's' : ''}`}
            icon={Users}
            iconCls="bg-[#F0FBF5] dark:bg-[#1B4332] text-[#40916C] dark:text-[#52B788]"
            accent="from-[#40916C]/5"
            loading={loading}
            href="/dashboard/clientes"
          />
          <KpiCard
            label="Projetos em Andamento"
            value={activeProjects.length}
            sub={`${deliveredCount} entregue${deliveredCount !== 1 ? 's' : ''} este mês`}
            icon={FolderKanban}
            iconCls="bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400"
            accent="from-blue-500/5"
            loading={loading}
            href="/dashboard/projetos"
          />
          <KpiCard
            label="Leads Novos"
            value={newLeads}
            sub={`${leads.length} lead${leads.length !== 1 ? 's' : ''} no total`}
            icon={Zap}
            iconCls="bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400"
            accent="from-amber-500/5"
            loading={loading}
            href="/dashboard/leads"
          />
        </div>

        {/* ── Metas do Mês ──────────────────────────────────────────────── */}
        <GoalsSection monthRevenue={monthRevenue} salesCount={salesCount} loading={loading} />

        {/* ── Saldo + Meta Ads ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 card-light p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Saldo do mês</p>
                {loading ? (
                  <Skeleton className="h-8 w-32 mt-1" />
                ) : (
                  <p className={`tabular text-[28px] font-bold leading-none mt-1 ${balance >= 0 ? 'text-[#40916C] dark:text-[#52B788]' : 'text-red-500 dark:text-red-400'}`}>
                    {formatCurrency(balance)}
                  </p>
                )}
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-[#40916C]/10 dark:bg-[#40916C]/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <Wallet size={18} className={balance >= 0 ? 'text-[#40916C] dark:text-[#52B788]' : 'text-red-500 dark:text-red-400'} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50/60 dark:bg-emerald-900/15 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowDownLeft size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-500/70">Entradas</span>
                </div>
                {loading ? <Skeleton className="h-5 w-20" /> : (
                  <p className="tabular text-[15px] font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(monthRevenue)}</p>
                )}
              </div>
              <div className="bg-red-50/60 dark:bg-red-900/15 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUpRight size={12} className="text-red-500 dark:text-red-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-red-500/70 dark:text-red-400/70">Saídas</span>
                </div>
                {loading ? <Skeleton className="h-5 w-20" /> : (
                  <p className="tabular text-[15px] font-bold text-red-600 dark:text-red-400">{formatCurrency(monthExpenses)}</p>
                )}
              </div>
            </div>

            {/* A cobrar de clientes */}
            {(loading || totalACobrar > 0) && (
              <div className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={12} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600/80 dark:text-amber-400/80">A cobrar de clientes</span>
                </div>
                {loading ? <Skeleton className="h-5 w-24" /> : (
                  <p className="tabular text-[15px] font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalACobrar)}</p>
                )}
              </div>
            )}

            <Link href="/dashboard/financeiro" className="flex items-center justify-between text-[12px] font-medium text-[#40916C] dark:text-[#52B788] hover:opacity-80 transition-opacity mt-auto pt-1 border-t border-gray-100 dark:border-[#1E3020]">
              Ver lançamentos completos
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="lg:col-span-3 card-light p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Meta Ads</p>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                  {meta.length === 0 ? 'Sem campanhas cadastradas' : `${metaActive} campanha${metaActive !== 1 ? 's' : ''} ativa${metaActive !== 1 ? 's' : ''}`}
                </p>
              </div>
              <Link href="/dashboard/meta" className="flex items-center gap-1 text-[11px] font-medium text-[#40916C] dark:text-[#52B788] hover:opacity-80 transition-opacity">
                Ver detalhes <ArrowRight size={11} />
              </Link>
            </div>

            {meta.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#1A2C1F] flex items-center justify-center mb-2">
                  <BarChart2 size={16} className="text-gray-300 dark:text-[#2A4030]" />
                </div>
                <p className="text-[12px] text-gray-400 dark:text-[#4A6B52]">Adicione campanhas na página de Meta Ads</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Investimento', value: formatCurrency(metaSpend), icon: TrendingDown, cls: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
                  { label: 'Impressões', value: metaImpressions >= 1000 ? `${(metaImpressions / 1000).toFixed(1)}k` : String(metaImpressions), icon: Eye, cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
                  { label: 'Cliques', value: metaClicks >= 1000 ? `${(metaClicks / 1000).toFixed(1)}k` : String(metaClicks), icon: MousePointer, cls: 'text-[#40916C] dark:text-[#52B788] bg-[#F0FBF5] dark:bg-[#1B4332]' },
                  { label: 'CTR', value: `${metaCTR.toFixed(2)}%`, icon: Target, cls: 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/25' },
                ].map(({ label, value, icon: Icon, cls }) => (
                  <div key={label} className="bg-gray-50/80 dark:bg-[#0F1A12] rounded-xl p-3.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${cls}`}>
                      <Icon size={13} />
                    </div>
                    <p className="tabular text-[16px] font-bold text-gray-900 dark:text-[#D1FAE5] leading-none">{value}</p>
                    <p className="text-[10px] text-gray-400 dark:text-[#4A6B52] mt-1">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Prazos + Leads ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-light overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1E3020]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Prazos próximos</p>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                  {loading ? '—' : `${activeProjects.length} projeto${activeProjects.length !== 1 ? 's' : ''} em andamento`}
                </p>
              </div>
              <Link href="/dashboard/projetos" className="flex items-center gap-1 text-[11px] font-medium text-[#40916C] dark:text-[#52B788] hover:opacity-80 transition-opacity">
                Ver todos <ArrowRight size={11} />
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50 dark:divide-[#1E3020]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : deadlineProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#1A2C1F] flex items-center justify-center mb-2">
                  <CheckCircle2 size={16} className="text-gray-300 dark:text-[#2A4030]" />
                </div>
                <p className="text-[12px] text-gray-400 dark:text-[#4A6B52]">Nenhum projeto em andamento</p>
              </div>
            ) : (
              <div>{deadlineProjects.map(p => <DeadlineRow key={p.id} project={p} />)}</div>
            )}
          </div>

          <div className="card-light overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1E3020]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52]">Leads recentes</p>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                  {loading ? '—' : `${newLeads} novo${newLeads !== 1 ? 's' : ''} · ${leads.length} total`}
                </p>
              </div>
              <Link href="/dashboard/leads" className="flex items-center gap-1 text-[11px] font-medium text-[#40916C] dark:text-[#52B788] hover:opacity-80 transition-opacity">
                Ver todos <ArrowRight size={11} />
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50 dark:divide-[#1E3020]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#1A2C1F] flex items-center justify-center mb-2">
                  <Clock size={16} className="text-gray-300 dark:text-[#2A4030]" />
                </div>
                <p className="text-[12px] text-gray-400 dark:text-[#4A6B52]">Nenhum lead registrado ainda</p>
              </div>
            ) : (
              <div>{recentLeads.map(l => <LeadRow key={l.id} lead={l} />)}</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
