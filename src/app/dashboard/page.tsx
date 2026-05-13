'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Users, FolderKanban, TrendingUp, TrendingDown, Wallet,
  ArrowRight, AlertTriangle, Target, MousePointer, Eye,
  Zap, CheckCircle2, Clock, BarChart2, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react'
import { formatCurrency, formatDateShort, daysUntil, projectStatusConfig, leadStatusConfig } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Client, Project, Transaction, Lead, MetaCampaign } from '@/types'

const META_KEY = 'ryze_meta_campaigns'

function loadMeta(): MetaCampaign[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(META_KEY) ?? '[]') } catch { return [] }
}

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-[#1A2C1F] ${className}`} />
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

// ─── Deadline row ──────────────────────────────────────────────────────────────
function DeadlineRow({ project }: { project: Project & { client?: Pick<Client, 'name'> } }) {
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
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.color === 'yellow' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400' : cfg.color === 'blue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-400' : 'bg-[#F0FBF5] text-[#40916C] dark:bg-[#1B4332] dark:text-[#52B788]'}`}>
          {cfg.label}
        </span>
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
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
        cfg.color === 'green' ? 'bg-[#F0FBF5] text-[#40916C] dark:bg-[#1B4332] dark:text-[#52B788]' :
        cfg.color === 'yellow' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400' :
        cfg.color === 'blue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-400' :
        cfg.color === 'red' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
        'bg-gray-100 text-gray-500 dark:bg-[#1A2C1F] dark:text-[#4A6B52]'
      }`}>
        {cfg.label}
      </span>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(true)

  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<(Project & { client?: Pick<Client, 'name'> })[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [meta, setMeta] = useState<MetaCampaign[]>([])

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
    const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    setGreeting(`${period}, Isaac · ${date}`)

    async function load() {
      try {
        const [{ data: cli }, { data: proj }, { data: txn }, { data: lds }] = await Promise.all([
          supabase.from('clients').select('*').order('name'),
          supabase.from('projects').select('*, client:clients(name)').order('deadline'),
          supabase.from('transactions').select('type, amount, date').gte('date', monthStart()),
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
        ])
        if (cli) setClients(cli)
        if (proj) setProjects(proj as (Project & { client?: Pick<Client, 'name'> })[])
        if (txn) setTransactions(txn as Transaction[])
        if (lds) setLeads(lds)
      } finally {
        setLoading(false)
      }
    }

    load()
    setMeta(loadMeta())
  }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeClients = clients.filter(c => c.status === 'ativo').length
  const activeProjects = projects.filter(p => !['entregue', 'concluido'].includes(p.status))
  const deliveredThisMonth = projects.filter(p => p.status === 'entregue' || p.status === 'concluido').length

  const monthRevenue = transactions.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0)
  const monthExpenses = transactions.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0)
  const salesCount = transactions.filter(t => t.type === 'entrada').length
  const balance = monthRevenue - monthExpenses

  const newLeads = leads.filter(l => l.status === 'novo').length
  const recentLeads = leads.slice(0, 4)

  const urgentProjects = activeProjects
    .filter(p => daysUntil(p.deadline) <= 14 || daysUntil(p.deadline) < 0)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)

  const allDeadlineProjects = activeProjects
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, urgentProjects.length > 0 ? 0 : 5)

  const deadlineProjects = urgentProjects.length > 0 ? urgentProjects : activeProjects
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)

  // Meta aggregate
  const metaSpend = meta.reduce((s, c) => s + c.spend, 0)
  const metaImpressions = meta.reduce((s, c) => s + c.impressions, 0)
  const metaClicks = meta.reduce((s, c) => s + c.clicks, 0)
  const metaCTR = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0
  const metaActive = meta.filter(c => c.status === 'ACTIVE').length

  return (
    <div>
      <Header title="Dashboard" subtitle={greeting} />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Primary KPI row ────────────────────────────────────────────── */}
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
            value={loading ? '—' : activeClients}
            sub={`${clients.length} total cadastrado${clients.length !== 1 ? 's' : ''}`}
            icon={Users}
            iconCls="bg-[#F0FBF5] dark:bg-[#1B4332] text-[#40916C] dark:text-[#52B788]"
            accent="from-[#40916C]/5"
            loading={loading}
            href="/dashboard/clientes"
          />
          <KpiCard
            label="Projetos em Andamento"
            value={loading ? '—' : activeProjects.length}
            sub={`${deliveredThisMonth} entregue${deliveredThisMonth !== 1 ? 's' : ''} este mês`}
            icon={FolderKanban}
            iconCls="bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400"
            accent="from-blue-500/5"
            loading={loading}
            href="/dashboard/projetos"
          />
          <KpiCard
            label="Leads Novos"
            value={loading ? '—' : newLeads}
            sub={`${leads.length} lead${leads.length !== 1 ? 's' : ''} no total`}
            icon={Zap}
            iconCls="bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400"
            accent="from-amber-500/5"
            loading={loading}
            href="/dashboard/leads"
          />
        </div>

        {/* ── Financial balance + Meta Ads ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Saldo + mini financeiro */}
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

            <Link href="/dashboard/financeiro" className="flex items-center justify-between text-[12px] font-medium text-[#40916C] dark:text-[#52B788] hover:opacity-80 transition-opacity mt-auto pt-1 border-t border-gray-100 dark:border-[#1E3020]">
              Ver lançamentos completos
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Meta Ads summary */}
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

        {/* ── Deadlines + Leads ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Projects / deadlines */}
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
              <div>
                {deadlineProjects.map(p => <DeadlineRow key={p.id} project={p} />)}
              </div>
            )}
          </div>

          {/* Recent leads */}
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
              <div>
                {recentLeads.map(l => <LeadRow key={l.id} lead={l} />)}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
