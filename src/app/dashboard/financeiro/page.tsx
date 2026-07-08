'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useTheme } from '@/components/layout/ThemeProvider'
import {
  TrendingUp, TrendingDown, Wallet, Plus, ArrowUpRight, ArrowDownLeft,
  Trash2, CheckCircle2, Activity, Pencil, Target,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { transactionRepository, clientRepository } from '@/lib/repositories'
import { formatCurrency, formatDate, firstOfMonthISO } from '@/lib/utils'
import { Transaction, TransactionType, TransactionCategory, Client } from '@/types'
import { useDateFilter } from '@/contexts/DateFilterContext'
import { useToast } from '@/hooks/useToast'

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
  '#00FF41', '#3B82F6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#00c832', '#6B7280',
]

const COLOR_CLASS_MAP: Record<string, string> = {
  '#00FF41': 'chart-border-entry',
  '#FCA5A5': 'chart-border-exit-light',
  '#7F1D1D': 'chart-border-exit-dark',
  '#00c832': 'chart-border-1',
  '#74C69D': 'chart-border-2',
  '#95D5B2': 'chart-border-3',
  '#003810': 'chart-border-4',
  '#001c08': 'chart-border-5',
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
  client_id: '',
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
    <div className={`rounded-xl border px-3 py-2.5 shadow-xl text-[12px] ${isDark ? 'bg-[#111114] border-[#28282d] text-[#D1FAE5]' : 'bg-white border-gray-100 text-gray-700'}`}>
      {label && <p className={`font-semibold mb-1.5 ${isDark ? 'text-[#00a02a]' : 'text-gray-500'}`}>{label}</p>}
      {payload.map(p => (
        <div key={p.name} className={`flex items-center gap-2 pl-2 border-l-2 ${COLOR_CLASS_MAP[p.color] ?? 'chart-border-entry'}`}>
          <span className={isDark ? 'text-[#00a02a]' : 'text-gray-500'}>{p.name}:</span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [chartTransactions, setChartTransactions] = useState<Transaction[]>([])
  const [pendingClients, setPendingClients] = useState<Client[]>([])
  const [totalPrevisto, setTotalPrevisto] = useState(0)
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string; specialty: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida' | 'pendentes'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()
  const repo = useMemo(() => transactionRepository(createClient()), [])
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { range, label } = useDateFilter()

  // Chart always shows last 6 months regardless of the active date filter
  useEffect(() => {
    async function loadChart() {
      try {
        const data = await repo.findFrom(firstOfMonthISO(5))
        setChartTransactions(data)
      } catch (err) {
        console.error('Erro ao carregar gráfico:', err)
      }
    }
    loadChart()
  }, [repo])

  useEffect(() => {
    clientRepository(createClient()).findForSelect()
      .then(data => setClientOptions(data))
      .catch(err => console.error('Erro ao carregar clientes:', err))
  }, [])

  useEffect(() => {
    if (!range.from || !range.to) return
    setLoading(true)
    async function load() {
      try {
        const db = createClient()
        const txRepo = transactionRepository(db)
        const [txns, clients] = await Promise.all([
          txRepo.findInRange(range.from, range.to),
          clientRepository(db).findAll(),
        ])
        setTransactions(txns)
        setPendingClients(
          clients.filter(c => (c.total_value ?? 0) > 0 && (c.paid_value ?? 0) < (c.total_value ?? 0))
        )
        // Faturamento total previsto: soma o orçado (pago ou não) dos clientes
        // fechados dentro do período selecionado no filtro de data global —
        // por padrão "Este mês", pra acompanhar o faturamento mês a mês.
        // Cliente sem data de fechamento não entra na conta (não dá pra saber
        // em qual mês contar). Cálculo isolado: não lê nem escreve nada usado
        // pelas outras 3 barras, então não tem como uma pisar na outra.
        setTotalPrevisto(
          clients
            .filter(c => c.closed_at && c.closed_at >= range.from && c.closed_at <= range.to)
            .reduce((sum, c) => sum + (c.total_value ?? 0), 0)
        )
      } catch (err) {
        console.error('Erro ao carregar financeiro:', err)
        showToast('Erro ao carregar dados. Tente recarregar a página.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [range.from, range.to])


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
  const monthlyData = useMemo(() => buildMonthlyData(chartTransactions), [chartTransactions])
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

  function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const clientId = e.target.value
    const client = clientOptions.find(c => c.id === clientId)
    const reference = client?.name ?? ''
    setForm(f => ({ ...f, client_id: clientId, reference, description: composeDesc(f.service, reference, f.type, f.category) }))
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const category = e.target.value as TransactionCategory
    setForm(f => ({ ...f, category, description: composeDesc(f.service, f.reference, f.type, category) }))
  }

  function setType(t: TransactionType) {
    const defaultCat: TransactionCategory = t === 'entrada' ? 'clientes' : 'meta_ads'
    setForm(f => ({ ...f, type: t, category: defaultCat, service: '', reference: '', client_id: '', description: '' }))
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
      client_id: t.client_id ?? '',
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
      const clientId = form.type === 'entrada' && form.client_id ? form.client_id : null
      const payload = {
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        amount,
        date: form.date,
        client_id: clientId,
      }
      const prevClientId = editingTransaction?.client_id ?? null
      if (editingTransaction) {
        const data = await repo.update(editingTransaction.id, payload)
        setTransactions(prev =>
          prev.map(t => t.id === editingTransaction.id ? data : t)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        )
        showToast('Lançamento atualizado!')
      } else {
        const data = await repo.create(payload)
        setTransactions(prev => [data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        showToast('Lançamento registrado!')
      }
      // Mantém o cliente em dia com o que acabou de ser lançado — se o
      // lançamento trocou de cliente na edição, os dois lados são recalculados.
      const clientRepo = clientRepository(createClient())
      if (clientId) await clientRepo.recalcFinancials(clientId)
      if (prevClientId && prevClientId !== clientId) await clientRepo.recalcFinancials(prevClientId)
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
      const db = createClient()
      await repo.remove(deleteModal.id)

      if (deleteModal.contract_id) {
        // Essa transação foi gerada automaticamente ao marcar uma parcela como
        // paga. Apagá-la sem reverter a parcela deixaria "parcela paga" em
        // Contratos com o dinheiro correspondente sumido do Financeiro — então
        // volta a parcela mais recente paga com esse valor pro estado pendente.
        const { data: match } = await db
          .from('contract_installments')
          .select('id')
          .eq('contract_id', deleteModal.contract_id)
          .eq('status', 'pago')
          .eq('value', deleteModal.amount)
          .order('paid_at', { ascending: false })
          .limit(1)
        if (match?.[0]) {
          await db.from('contract_installments').update({ status: 'pendente', paid_at: null }).eq('id', match[0].id)
        }
        const { data: contract } = await db.from('contracts').select('client_id').eq('id', deleteModal.contract_id).single()
        if (contract?.client_id) await clientRepository(db).recalcFinancials(contract.client_id)
      } else if (deleteModal.client_id) {
        await clientRepository(db).recalcFinancials(deleteModal.client_id)
      }

      setTransactions(prev => prev.filter(t => t.id !== deleteModal.id))
      showToast('Lançamento removido.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  // Chart theme
  const gridColor  = isDark ? '#181819' : '#F3F4F6'
  const tickColor  = isDark ? '#006620' : '#9CA3AF'

  return (
    <div>
      <Header title="Financeiro" subtitle="Controle de entradas, saídas e saldo" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Faturamento total previsto — soma independente, não entra na conta de entradas/saldo abaixo */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Target size={17} className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Faturamento total previsto</p>
            <p className="tabular text-[26px] font-bold leading-none text-blue-600 dark:text-blue-400">{formatCurrency(totalPrevisto)}</p>
            <p className="text-[11px] text-gray-400 dark:text-[#00a02a] mt-1">Período: {label} · fechados, pago ou não</p>
          </div>

          {/* Entradas */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp size={17} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Entradas totais</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Saídas totais</p>
            <p className="tabular text-[26px] font-bold leading-none text-red-500 dark:text-red-400">{formatCurrency(totalSaidas)}</p>
          </div>

          {/* Saldo */}
          <div className="stat-card p-5 overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${saldo >= 0 ? 'from-[#00FF41]/8' : 'from-red-500/5'} via-transparent to-transparent pointer-events-none`} />
            <div className="mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saldo >= 0 ? 'bg-[#00FF41]/10 dark:bg-[#00FF41]/20' : 'bg-red-50 dark:bg-red-900/30'}`}>
                <Wallet size={17} className={saldo >= 0 ? 'text-[#00FF41] dark:text-[#00FF41]' : 'text-red-500 dark:text-red-400'} />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Saldo atual</p>
            <p className={`tabular text-[26px] font-bold leading-none ${saldo >= 0 ? 'text-[#00FF41] dark:text-[#00FF41]' : 'text-red-500 dark:text-red-400'}`}>
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
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Evolução mensal</h3>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">Receita vs Despesa</p>
                </div>
                <Activity size={16} className="text-gray-300 dark:text-[#00a02a]" />
              </div>
              <div className="px-1 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(64,145,108,0.06)' : 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="receita" name="Receita" fill="#00FF41" radius={[5, 5, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="despesa" name="Despesa" fill={isDark ? '#7F1D1D' : '#FCA5A5'} radius={[5, 5, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut chart */}
            <div className="card-light overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Despesas por categoria</h3>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">Distribuição de custos</p>
              </div>
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-300 dark:text-[#00a02a] text-sm">Sem despesas registradas</div>
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
                          <span className="text-gray-500 dark:text-[#00a02a]">{cat.name}</span>
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Lançamentos</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                {typeFilter === 'pendentes'
                  ? `${pendingClients.length} cliente${pendingClients.length !== 1 ? 's' : ''} com pagamento pendente`
                  : `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-[#111114] rounded-lg p-0.5">
                {([
                  { key: 'todos',     label: 'Todos' },
                  { key: 'entrada',   label: 'Entradas' },
                  { key: 'saida',     label: 'Saídas' },
                  { key: 'pendentes', label: `Orçamentos${pendingClients.length > 0 ? ` (${pendingClients.length})` : ''}` },
                ] as { key: typeof typeFilter; label: string }[]).map(({ key, label }) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all cursor-pointer ${
                      typeFilter === key
                        ? key === 'pendentes'
                          ? 'bg-amber-500 dark:bg-amber-600 text-white shadow-sm'
                          : 'bg-white dark:bg-[#181819] shadow-sm text-gray-900 dark:text-[#F8FBF9]'
                        : 'text-gray-500 dark:text-[#00a02a] hover:text-gray-700 dark:hover:text-[#00a02a]'
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
              <div className="divide-y divide-gray-50 dark:divide-[#181819]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#181819] animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-36 bg-gray-200 dark:bg-[#181819] animate-pulse rounded" />
                      <div className="h-2.5 w-24 bg-gray-100 dark:bg-[#111114] animate-pulse rounded" />
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
                <p className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]">Nenhum pagamento pendente</p>
                <p className="text-[12px] text-gray-300 dark:text-[#00a02a] mt-0.5">Todos os clientes estão com pagamento em dia</p>
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
                      <div key={c.id} className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 dark:border-[#181819] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#181819] transition-colors">
                        <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">{c.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{c.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#181819] rounded-full overflow-hidden max-w-[120px]">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] text-gray-400 dark:text-[#00a02a]">
                              {formatCurrency(paid)} pago de {formatCurrency(total)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[14px] font-bold text-amber-600 dark:text-amber-400 tabular">{formatCurrency(remaining)}</p>
                          <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">a receber</p>
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
            <div className="divide-y divide-gray-50 dark:divide-[#181819]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#181819] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-gray-200 dark:bg-[#181819] animate-pulse rounded" />
                    <div className="h-2.5 w-24 bg-gray-100 dark:bg-[#111114] animate-pulse rounded" />
                  </div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-[#181819] animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center mb-3">
                <Wallet size={18} className="text-gray-300 dark:text-[#00a02a]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]">Nenhum lançamento</p>
              <p className="text-[12px] text-gray-300 dark:text-[#00a02a] mt-0.5">Registre entradas e saídas para ver o histórico</p>
            </div>
          ) : (
            <div>
              {grouped.map(({ date, items }) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 px-5 py-2 bg-gray-50/70 dark:bg-[#181819] border-y border-gray-100 dark:border-[#181819]">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">
                      {formatDate(date)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-[#181819]" />
                    <span className="text-[11px] text-gray-300 dark:text-[#00a02a]">{items.length} registro{items.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Transactions for that date */}
                  {items.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-[#181819] transition-colors group border-b border-gray-50 dark:border-[#181819] last:border-0">
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
                        <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">{categoryLabels[t.category]}</p>
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
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-[#00FF41]/8 text-gray-200 dark:text-[#181819] hover:text-blue-500 dark:hover:text-[#00FF41] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal(t)}
                          aria-label="Remover lançamento"
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-200 dark:text-[#181819] hover:text-red-500 dark:hover:text-red-400 transition-colors"
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
              <div className="flex rounded-xl border border-gray-200 dark:border-[#28282d] overflow-hidden">
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
                        : 'bg-white dark:bg-[#111114] text-gray-500 dark:text-[#00a02a] hover:bg-gray-50 dark:hover:bg-[#181819]'
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
                  <select id="fin-client" className="input-field cursor-pointer" value={form.client_id} onChange={handleClientChange}>
                    <option value="">Avulso (sem cliente cadastrado)</option>
                    {clientOptions.map(c => <option key={c.id} value={c.id}>{c.name} — {c.specialty}</option>)}
                  </select>
                  {!form.client_id && (
                    <input
                      type="text"
                      className="input-field mt-2"
                      placeholder="Ou digite o nome (ex: Anderson, Paulo, Dr. João...)"
                      value={form.reference}
                      onChange={handleReferenceChange}
                    />
                  )}
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
                  <span className="text-[10px] text-[#00FF41] dark:text-[#00FF41] font-medium">Auto-preenchida — editável</span>
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#00a02a] text-sm font-medium select-none">R$</span>
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
            {deleteModal.contract_id && (
              <p className="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
                Esse lançamento veio do pagamento de uma parcela em Contratos. Ao remover, a parcela volta para &quot;Pendente&quot; automaticamente.
              </p>
            )}
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
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#111114] dark:border dark:border-[#28282d] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
