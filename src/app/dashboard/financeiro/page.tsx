'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TrendingUp, TrendingDown, DollarSign, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Transaction } from '@/types'

const categoryLabels: Record<string, string> = {
  ferramentas: 'Ferramentas',
  infraestrutura: 'Infraestrutura',
  marketing: 'Marketing',
  pessoal: 'Pessoal',
  outros: 'Outros',
  contrato: 'Contrato',
}

export default function FinanceiroPage() {
  const [transactions] = useState<Transaction[]>([])
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos')

  let totalEntradas = 0
  let totalSaidas = 0
  let countEntradas = 0
  let countSaidas = 0
  for (const t of transactions) {
    if (t.type === 'entrada') { totalEntradas += t.amount; countEntradas++ }
    else { totalSaidas += t.amount; countSaidas++ }
  }
  const saldo = totalEntradas - totalSaidas

  const filtered = transactions
    .filter(t => typeFilter === 'todos' || t.type === typeFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div>
      <Header title="Financeiro" subtitle="Controle de entradas, saídas e saldo" />

      <div className="p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
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

        {/* Charts — only shown when there's data */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Card padding="none">
                <CardHeader className="px-5 pt-5 pb-2">
                  <CardTitle>Evolução Mensal</CardTitle>
                </CardHeader>
                <div className="px-2 pb-4 pt-2">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={[]} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
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
                    <Pie data={[]} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* Transactions */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <CardTitle>Lançamentos</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {(['todos', 'entrada', 'saida'] as const).map(f => (
                  <button type="button" key={f} onClick={() => setTypeFilter(f)}
                    className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all ${typeFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {f === 'todos' ? 'Todos' : f === 'entrada' ? 'Entradas' : 'Saídas'}
                  </button>
                ))}
              </div>
              <Button size="sm"><Plus size={13} /> Lançamento</Button>
            </div>
          </div>
          {filtered.length === 0 ? (
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
                <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
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
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
