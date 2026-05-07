'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TrendingUp, TrendingDown, DollarSign, Plus, ArrowUpRight, ArrowDownLeft, Trash2, CheckCircle2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Transaction, TransactionType, TransactionCategory } from '@/types'

const categoryLabels: Record<TransactionCategory, string> = {
  ferramentas: 'Ferramentas',
  infraestrutura: 'Infraestrutura',
  marketing: 'Marketing',
  pessoal: 'Pessoal',
  outros: 'Outros',
  contrato: 'Contrato',
}

const categoryOptions = Object.entries(categoryLabels) as [TransactionCategory, string][]

const pieColors = ['#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7', '#D8F3DC']

const emptyForm = {
  type: 'entrada' as TransactionType,
  category: 'outros' as TransactionCategory,
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
  return Object.entries(map).map(([name, value]) => ({ name: categoryLabels[name as TransactionCategory] ?? name, value }))
}

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
        if (data) setTransactions(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  let totalEntradas = 0
  let totalSaidas = 0
  let countEntradas = 0
  let countSaidas = 0
  for (const t of transactions) {
    if (t.type === 'entrada') { totalEntradas += t.amount; countEntradas++ }
    else { totalSaidas += t.amount; countSaidas++ }
  }
  const saldo = totalEntradas - totalSaidas

  const filtered = transactions.filter(t => typeFilter === 'todos' || t.type === typeFilter)

  const monthlyData = useMemo(() => buildMonthlyData(transactions), [transactions])
  const categoryData = useMemo(() => buildCategoryData(transactions), [transactions])

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  function handleOpenModal() {
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
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
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          type: form.type,
          category: form.category,
          description: form.description.trim(),
          amount,
          date: form.date,
        }])
        .select()
        .single()
      if (error) throw error
      setTransactions(prev => [data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      setToast('Lançamento registrado!')
      setShowModal(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', deleteModal.id)
      if (error) throw error
      setTransactions(prev => prev.filter(t => t.id !== deleteModal.id))
      setToast('Lançamento removido.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <Header title="Financeiro" subtitle="Controle de entradas, saídas e saldo" />

      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Entradas do Mês</span>
            </div>
            <div className="tabular text-2xl font-bold text-emerald-600">{formatCurrency(totalEntradas)}</div>
            <div className="text-xs text-gray-400 mt-1">{countEntradas} transações</div>
          </div>
          <div className="stat-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown size={16} className="text-red-500" />
              </div>
              <span className="text-sm font-medium text-gray-500">Saídas do Mês</span>
            </div>
            <div className="tabular text-2xl font-bold text-red-500">{formatCurrency(totalSaidas)}</div>
            <div className="text-xs text-gray-400 mt-1">{countSaidas} transações</div>
          </div>
          <div className="stat-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${saldo >= 0 ? 'bg-[#40916C]/10' : 'bg-red-50'}`}>
                <DollarSign size={16} className={saldo >= 0 ? 'text-[#40916C]' : 'text-red-500'} />
              </div>
              <span className="text-sm font-medium text-gray-500">Saldo do Mês</span>
            </div>
            <div className={`tabular text-2xl font-bold ${saldo >= 0 ? 'text-[#40916C]' : 'text-red-500'}`}>{formatCurrency(saldo)}</div>
            <div className="text-xs text-gray-400 mt-1">{saldo >= 0 ? 'Positivo' : 'Negativo'}</div>
          </div>
        </div>

        {transactions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card padding="none">
                <CardHeader className="px-5 pt-5 pb-2">
                  <CardTitle>Evolução Mensal</CardTitle>
                </CardHeader>
                <div className="px-2 pb-4 pt-2">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="receita" name="Receita" fill="#40916C" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" name="Despesa" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-2">
                <CardTitle>Despesas por Tipo</CardTitle>
              </CardHeader>
              <div className="flex justify-center py-2">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value">
                      {categoryData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <CardTitle>Lançamentos</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {(['todos', 'entrada', 'saida'] as const).map(f => (
                  <button type="button" key={f} onClick={() => setTypeFilter(f)}
                    className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all cursor-pointer ${typeFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {f === 'todos' ? 'Todos' : f === 'entrada' ? 'Entradas' : 'Saídas'}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={handleOpenModal}><Plus size={13} /> Lançamento</Button>
            </div>
          </div>
          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-gray-200 animate-pulse rounded" />
                    <div className="h-2.5 w-24 bg-gray-100 animate-pulse rounded" />
                  </div>
                  <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <DollarSign size={16} className="text-gray-400" />
              </div>
              <p className="text-[13px] text-gray-400">Nenhum lançamento ainda</p>
              <p className="text-[12px] text-gray-300 mt-0.5">Registre entradas e saídas para ver o histórico</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors group">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${t.type === 'entrada' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {t.type === 'entrada'
                      ? <ArrowDownLeft size={14} className="text-emerald-600" />
                      : <ArrowUpRight size={14} className="text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800">{t.description}</p>
                    <p className="text-[11px] text-gray-400">{categoryLabels[t.category]} · {formatDate(t.date)}</p>
                  </div>
                  <span className={`tabular text-[14px] font-semibold ${t.type === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {t.type === 'entrada' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteModal(t)}
                    aria-label="Remover lançamento"
                    className="p-1.5 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Lançamento" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['entrada', 'saida'] as TransactionType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-2 text-sm font-medium transition-all cursor-pointer ${
                      form.type === t
                        ? t === 'entrada' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t === 'entrada' ? 'Entrada' : 'Saída'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoria *</label>
              <select className="input-field cursor-pointer" value={form.category} onChange={set('category')} aria-label="Categoria">
                {categoryOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição *</label>
              <input className="input-field" placeholder="Ex: Mensalidade Notion, Pagamento cliente..." value={form.description} onChange={set('description')} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">R$</span>
                <input type="number" className="input-field pl-9" placeholder="0,00" min="0" step="0.01" value={form.amount} onChange={set('amount')} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Data *</label>
              <input type="date" className="input-field" value={form.date} onChange={set('date')} required aria-label="Data" />
            </div>
          </div>

          {saveError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{saveError}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Registrar</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Lançamento" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Remover o lançamento <strong>{deleteModal.description}</strong> de <strong>{formatCurrency(deleteModal.amount)}</strong>?
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

      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#52B788] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
