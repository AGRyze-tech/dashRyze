'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useTheme } from '@/components/layout/ThemeProvider'
import {
  TrendingUp, TrendingDown, Wallet, Plus, ArrowUpRight, ArrowDownLeft,
  Trash2, CheckCircle2, Activity, Pencil,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { transactionRepository, clientRepository } from '@/lib/repositories'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Transaction, TransactionType, TransactionCategory, Client } from '@/types'

const categoryLabels: Record<TransactionCategory, string> = {
  clientes:      'Clientes',
  meta_ads:      'Meta ADS',
  imposto:       'Imposto',
  dominio:       'Domínio',
  ferramentas:   'Ferramentas',
  infraestrutura:'Infraestrutura',
  hospedagem:    'Hospedagem',
  marketing:     'Marketing',
  pessoal:       'Pessoal',
  outros:        'Outros',
  contrato:      'Contrato',
}

const entradaCategories: TransactionCategory[] = ['clientes']
const saidaCategories: TransactionCategory[] = ['meta_ads', 'imposto']

const PIE_COLORS = [
  '#01CA3C', '#3B82F6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#01CA3C', '#6B7280',
]

const COLOR_CLASS_MAP: Record<string, string> = {
  '#01CA3C': 'chart-border-entry',
  '#FCA5A5': 'chart-border-exit-light',
  '#7F1D1D': 'chart-border-exit-dark',
  '#01a832': 'chart-border-1',
  '#74C69D': 'chart-border-2',
  '#95D5B2': 'chart-border-3',
  '#014e18': 'chart-border-4',
  '#012a10': 'chart-border-5',
}

const serviceOptions = [
  'Landing Page', 'Site', 'Smartpage',
  'Gerenciamento de Tráfego',
  'Produção de Conteúdo',
]

function composeDesc(service: string, reference: string, type: TransactionType, category: TransactionCategory): string {
  if (type === 'entrada') {
    if (service && reference) return `${service} - ${reference}`
    return service || reference
  }
  if (reference) return `${categoryLabels[category]} - ${reference}`
  return ''
}

const emptyForm = {
  type: 'entrada' as TransactionType,
  category: 'clientes' as TransactionCategory,
  service: '',
  reference: '',
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
}

function buildMonthlyData(transactions: Transaction[]) {
  const map: Record<string, { month: string; receita: number; despesa: number }> = {}
  for (const t of transactions) {
    const key = t.date.slice(0, 7)
    if (!map[key]) map[key] = { month: key.slice(5) + '/' + key.slice(2, 4), receita: 0, despesa: 0 }
    if (t.type === 'entrada') map[key].receita += t.amount
    else map[key].despesa += t.amount
  }
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
}

function buildCategoryData(transactions: Transaction[]) {
  const map: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'saida')) {
    map[t.category] = (map[t.category] ?? 0) + t.amount
  }
  return Object.entries(map).map(([name, value]) => ({
    name: categoryLabels[name as TransactionCategory] ?? name,
    value,
  }))
}

function groupByDate(transactions: Transaction[]) {
  const groups: { date: string; items: Transaction[] }[] = []
  const map: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    const d = t.date.slice(0, 10)
    if (!map[d]) { map[d] = []; groups.push({ date: d, items: map[d] }) }
    map[d].push(t)
  }
  return groups
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, isDark }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; isDark: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl border px-3 py-2.5 shadow-xl text-[12px] ${isDark ? 'bg-[#1c1c1f] border-[#33333a] text-[#D1FAE5]' : 'bg-white border-gray-100 text-gray-700'}`}>
      {label && <p className={`font-semibold mb-1.5 ${isDark ? 'text-[#01992e]' : 'text-gray-500'}`}>{label}</p>}
      {payload.map(p => (
        <div key={p.name} className={`flex items-center gap-2 pl-2 border-l-2 ${COLOR_CLASS_MAP[p.color] ?? 'chart-border-entry'}`}>
          <span className={isDark ? 'text-[#01992e]' : 'text-gray-500'}>{p.name}:</span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pendingClients, setPendingClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida' | 'pendentes'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const repo = useMemo(() => transactionRepository(createClient()), [])
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    async function load() {
      try {
        const db = createClient()
        const [txns, clients] = await Promise.all([
          repo.findAll(),
          clientRepository(db).findAll(),
        ])
        setTransactions(txns)
        setPendingClients(
          clients.filter(c => (c.total_value ?? 0) > 0 && (c.paid_value ?? 0) < (c.total_value ?? 0))
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [repo])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  let totalEntradas = 0
  let totalSaidas = 0
  for (const t of transactions) {
    if (t.type === 'entrada') totalEntradas += t.amount
    else totalSaidas += t.amount
  }
  const saldo = totalEntradas - totalSaidas

  const filtered = useMemo(
    () => transactions.filter(t => typeFilter === 'todos' || t.type === typeFilter),
    [transactions, typeFilter]
  )
  const grouped = useMemo(() => groupByDate(filtered), [filtered])
  const monthlyData = useMemo(() => buildMonthlyData(transactions), [transactions])
  const categoryData = useMemo(() => buildCategoryData(transactions), [transactions])

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  function handleServiceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const service = e.target.value
    setForm(f => ({ ...f, service, description: composeDesc(service, f.reference, f.type, f.category) }))
  }

  function handleReferenceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const reference = e.target.value
    setForm(f => ({ ...f, reference, description: composeDesc(f.service, reference, f.type, f.category) }))
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const category = e.target.value as TransactionCategory
    setForm(f => ({ ...f, category, description: composeDesc(f.service, f.reference, f.type, category) }))
  }

  function setType(t: TransactionType) {
    const defaultCat: TransactionCategory = t === 'entrada' ? 'clientes' : 'meta_ads'
    setForm(f => ({ ...f, type: t, category: defaultCat, service: '', reference: '', description: '' }))
  }

  function handleOpenModal() {
    setEditingTransaction(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  function handleOpenEdit(t: Transaction) {
    setEditingTransaction(t)
    setForm({
      type: t.type,
      category: t.category,
      service: '',
      reference: '',
      description: t.description,
      amount: String(t.amount),
      date: t.date,
    })
    setSaveError('')
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditingTransaction(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.description.trim()) { setSaveError('Descrição é obrigatória.'); return }
    if (!amount || amount <= 0) { setSaveError('Informe um valor válido.'); return }
    if (!form.date) { setSaveError('Selecione a data.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        amount,
        date: form.date,
      }
      if (editingTransaction) {
        const data = await repo.update(editingTransaction.id, payload)
        setTransactions(prev =>
          prev.map(t => t.id === editingTransaction.id ? data : t)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        )
        setToast('Lançamento atualizado!')
      } else {
        const data = await repo.create(payload)
        setTransactions(prev => [data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        setToast('Lançamento registrado!')
      }
      handleCloseModal()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Erro ao salvar.'
      setSaveError(msg || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await repo.remove(deleteModal.id)
      setTransactions(prev => prev.filter(t => t.id !== deleteModal.id))
      setToast('Lançamento removido.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  // Chart theme
  const gridColor  = isDark ? '#2a2a2e' : '#F3F4F6'
  const tickColor  = isDark ? '#017e26' : '#9CA3AF'

  return (
    <div>
      <Header title="Financeiro" subtitle="Controle de entradas, saídas e saldo" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Entradas */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp size={17} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#017e26] mb-1">Entradas totais</p>
            <p className="tabular text-[26px] font-bold leading-none text-emerald-600 dark:text-emerald-400">{formatCurrency(totalEntradas)}</p>
          </div>

          {/* Saídas */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingDown size={17} className="text-red-500 dark:text-red-400" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#017e26] mb-1">Saídas totais</p>
            <p className="tabular text-[26px] font-bold leading-none text-red-500 dark:text-red-400">{formatCurrency(totalSaidas)}</p>
          </div>

          {/* Saldo */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${saldo >= 0 ? 'from-[#01CA3C]/8' : 'from-red-500/5'} via-transparent to-transparent pointer-events-none`} />
            <div className="mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saldo >= 0 ? 'bg-[#01CA3C]/10 dark:bg-[#01CA3C]/20' : 'bg-red-50 dark:bg-red-900/30'}`}>
                <Wallet size={17} className={saldo >= 0 ? 'text-[#01CA3C] dark:text-[#01CA3C]' : 'text-red-500 dark:text-red-400'} />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#017e26] mb-1">Saldo atual</p>
            <p className={`tabular text-[26px] font-bold leading-none ${saldo >= 0 ? 'text-[#01CA3C] dark:text-[#01CA3C]' : 'text-red-500 dark:text-red-400'}`}>
              {formatCurrency(saldo)}
            </p>
          </div>
        </div>

        {/* ── Charts ────────────────────────────────────────────────────── */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Bar chart */}
            <div className="lg:col-span-2 card-light overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#017e26]">Evolução mensal</h3>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">Receita vs Despesa</p>
                </div>
                <Activity size={16} className="text-gray-300 dark:text-[#33333a]" />
              </div>
              <div className="px-1 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(64,145,108,0.06)' : 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="receita" name="Receita" fill="#01CA3C" radius={[5, 5, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="despesa" name="Despesa" fill={isDark ? '#7F1D1D' : '#FCA5A5'} radius={[5, 5, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut chart */}
            <div className="card-light overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#017e26]">Despesas por categoria</h3>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">Distribuição de custos</p>
              </div>
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-300 dark:text-[#33333a] text-sm">Sem despesas registradas</div>
              ) : (
                <div className="pb-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                        {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip isDark={isDark} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="px-5 space-y-1.5 mt-1">
                    {categoryData.map((cat, i) => (
                      <div key={cat.name} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 pie-dot-${i % PIE_COLORS.length}`} />
                          <span className="text-gray-500 dark:text-[#01992e]">{cat.name}</span>
                        </div>
                        <span className="font-semibold tabular text-gray-700 dark:text-[#D1FAE5]">{formatCurrency(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Transaction Ledger ────────────────────────────────────────── */}
        <div className="card-light overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#2a2a2e]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#017e26]">Lançamentos</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                {typeFilter === 'pendentes'
                  ? `${pendingClients.length} cliente${pendingClients.length !== 1 ? 's' : ''} com pagamento pendente`
                  : `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-[#1c1c1f] rounded-lg p-0.5">
                {([
                  { key: 'todos',     label: 'Todos' },
                  { key: 'entrada',   label: 'Entradas' },
                  { key: 'saida',     label: 'Saídas' },
                  { key: 'pendentes', label: `Pendentes${pendingClients.length > 0 ? ` (${pendingClients.length})` : ''}` },
                ] as { key: typeof typeFilter; label: string }[]).map(({ key, label }) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all cursor-pointer ${
                      typeFilter === key
                        ? key === 'pendentes'
                          ? 'bg-amber-500 dark:bg-amber-600 text-white shadow-sm'
                          : 'bg-white dark:bg-[#252528] shadow-sm text-gray-900 dark:text-[#F8FBF9]'
                        : 'text-gray-500 dark:text-[#017e26] hover:text-gray-700 dark:hover:text-[#01992e]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={handleOpenModal}><Plus size={13} /> Lançamento</Button>
            </div>
          </div>

          {/* ── Pendentes body ─────────────────────────────────────────── */}
          {typeFilter === 'pendentes' ? (
            loading ? (
              <div className="divide-y divide-gray-50 dark:divide-[#2a2a2e]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#252528] animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-36 bg-gray-200 dark:bg-[#2a2a2e] animate-pulse rounded" />
                      <div className="h-2.5 w-24 bg-gray-100 dark:bg-[#1c1c1f] animate-pulse rounded" />
                    </div>
                    <div className="h-4 w-24 bg-amber-100 dark:bg-amber-900/20 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : pendingClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                  <Wallet size={18} className="text-emerald-500 dark:text-emerald-400" />
                </div>
                <p className="text-[13px] font-medium text-gray-400 dark:text-[#017e26]">Nenhum pagamento pendente</p>
                <p className="text-[12px] text-gray-300 dark:text-[#33333a] mt-0.5">Todos os clientes estão com pagamento em dia</p>
              </div>
            ) : (
              <>
                {/* Total summary */}
                <div className="flex items-center justify-between px-5 py-3 bg-amber-50/60 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/20">
                  <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-widest">Total a receber</span>
                  <span className="text-[16px] font-bold tabular text-amber-700 dark:text-amber-300">
                    {formatCurrency(pendingClients.reduce((s, c) => s + ((c.total_value ?? 0) - (c.paid_value ?? 0)), 0))}
                  </span>
                </div>
                <div>
                  {pendingClients.map(c => {
                    const total = c.total_value ?? 0
                    const paid  = c.paid_value ?? 0
                    const remaining = total - paid
                    const pct = total > 0 ? Math.round((paid / total) * 100) : 0
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 dark:border-[#2a2a2e] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#252528] transition-colors">
                        <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">{c.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{c.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#252528] rounded-full overflow-hidden max-w-[120px]">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] text-gray-400 dark:text-[#017e26]">
                              {formatCurrency(paid)} pago de {formatCurrency(total)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[14px] font-bold text-amber-600 dark:text-amber-400 tabular">{formatCurrency(remaining)}</p>
                          <p className="text-[11px] text-gray-400 dark:text-[#017e26]">a receber</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          ) : null}

          {/* ── Normal ledger body ─────────────────────────────────────── */}
          {typeFilter !== 'pendentes' && loading ? (
            <div className="divide-y divide-gray-50 dark:divide-[#2a2a2e]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#252528] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-gray-200 dark:bg-[#2a2a2e] animate-pulse rounded" />
                    <div className="h-2.5 w-24 bg-gray-100 dark:bg-[#1c1c1f] animate-pulse rounded" />
                  </div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-[#2a2a2e] animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#252528] flex items-center justify-center mb-3">
                <Wallet size={18} className="text-gray-300 dark:text-[#33333a]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#017e26]">Nenhum lançamento</p>
              <p className="text-[12px] text-gray-300 dark:text-[#33333a] mt-0.5">Registre entradas e saídas para ver o histórico</p>
            </div>
          ) : (
            <div>
              {grouped.map(({ date, items }) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 px-5 py-2 bg-gray-50/70 dark:bg-[#1e1e22] border-y border-gray-100 dark:border-[#2a2a2e]">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#017e26]">
                      {formatDate(date)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-[#2a2a2e]" />
                    <span className="text-[11px] text-gray-300 dark:text-[#33333a]">{items.length} registro{items.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Transactions for that date */}
                  {items.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-[#252528] transition-colors group border-b border-gray-50 dark:border-[#2a2a2e] last:border-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        t.type === 'entrada'
                          ? 'bg-emerald-50 dark:bg-emerald-900/25'
                          : 'bg-red-50 dark:bg-red-900/20'
                      }`}>
                        {t.type === 'entrada'
                          ? <ArrowDownLeft size={14} className="text-emerald-600 dark:text-emerald-400" />
                          : <ArrowUpRight size={14} className="text-red-500 dark:text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{t.description}</p>
                        <p className="text-[11px] text-gray-400 dark:text-[#017e26]">{categoryLabels[t.category]}</p>
                      </div>
                      <span className={`tabular text-[14px] font-bold ${
                        t.type === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                      }`}>
                        {t.type === 'entrada' ? '+' : '−'}{formatCurrency(t.amount)}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          aria-label="Editar lançamento"
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-200 dark:text-[#2a2a2e] hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal(t)}
                          aria-label="Remover lançamento"
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-200 dark:text-[#2a2a2e] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── New / Edit Transaction Modal ──────────────────────────────── */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Type toggle */}
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo *</label>
              <div className="flex rounded-xl border border-gray-200 dark:border-[#33333a] overflow-hidden">
                {(['entrada', 'saida'] as TransactionType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      form.type === t
                        ? t === 'entrada'
                          ? 'bg-emerald-500 dark:bg-emerald-600 text-white'
                          : 'bg-red-500 dark:bg-red-600 text-white'
                        : 'bg-white dark:bg-[#1c1c1f] text-gray-500 dark:text-[#017e26] hover:bg-gray-50 dark:hover:bg-[#252528]'
                    }`}
                  >
                    {t === 'entrada'
                      ? <><ArrowDownLeft size={14} /> Entrada</>
                      : <><ArrowUpRight size={14} /> Saída</>
                    }
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="fin-category" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Categoria *</label>
              <select id="fin-category" className="input-field cursor-pointer" value={form.category} onChange={handleCategoryChange}>
                {(form.type === 'entrada' ? entradaCategories : saidaCategories).map(v => (
                  <option key={v} value={v}>{categoryLabels[v]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fin-date" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data *</label>
              <input id="fin-date" type="date" className="input-field" value={form.date} onChange={set('date')} required />
            </div>

            {/* ── Detalhamento ───────────────────────────────────────────── */}
            {form.type === 'entrada' ? (
              <>
                <div>
                  <label htmlFor="fin-service" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Serviço</label>
                  <select id="fin-service" className="input-field cursor-pointer" value={form.service} onChange={handleServiceChange}>
                    <option value="">Selecione...</option>
                    {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fin-client" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliente</label>
                  <input
                    id="fin-client"
                    type="text"
                    className="input-field"
                    placeholder="Ex: Anderson, Paulo, Dr. João..."
                    value={form.reference}
                    onChange={handleReferenceChange}
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label htmlFor="fin-reference" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Fornecedor / Referência</label>
                <input
                  id="fin-reference"
                  type="text"
                  className="input-field"
                  placeholder="Ex: Notion, Hostinger, Freelancer João..."
                  value={form.reference}
                  onChange={handleReferenceChange}
                />
              </div>
            )}

            {/* Description — auto-filled, still editable */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="fin-description" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF]">Descrição *</label>
                {form.description && (form.service || form.reference) && (
                  <span className="text-[10px] text-[#01CA3C] dark:text-[#01CA3C] font-medium">Auto-preenchida — editável</span>
                )}
              </div>
              <input
                id="fin-description"
                className="input-field"
                placeholder={form.type === 'entrada' ? 'Ex: Landing Page - Anderson' : 'Ex: Assinatura Notion, Hostinger...'}
                value={form.description}
                onChange={set('description')}
                required
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="fin-amount" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Valor *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#017e26] text-sm font-medium select-none">R$</span>
                <input id="fin-amount" type="number" className="input-field pl-10" placeholder="0,00" min="0" step="0.01" value={form.amount} onChange={set('amount')} required />
              </div>
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={handleCloseModal}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editingTransaction ? 'Salvar alterações' : 'Registrar lançamento'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Lançamento" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover o lançamento <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.description}</strong> de{' '}
              <strong className={deleteModal.type === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
                {formatCurrency(deleteModal.amount)}
              </strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Button>
              <Button onClick={handleDelete} loading={deleting} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
                <Trash2 size={13} /> Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#1c1c1f] dark:border dark:border-[#33333a] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#01CA3C] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
