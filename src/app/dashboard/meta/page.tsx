'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BarChart2, Eye, MousePointer, DollarSign, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const mockCampaigns: { id: string; name: string; status: string; daily_budget: number; spend: number; impressions: number; clicks: number; cpm: number; reach: number }[] = []

const periods = ['Últimos 7 dias', 'Últimos 30 dias', 'Mês atual']

const spendData: { day: string; spend: number }[] = []

export default function MetaPage() {
  const [period, setPeriod] = useState(0)

  const totalSpend = mockCampaigns.reduce((s, c) => s + c.spend, 0)
  const totalImpressions = mockCampaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = mockCampaigns.reduce((s, c) => s + c.clicks, 0)
  const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  return (
    <div>
      <Header title="Meta Ads" subtitle="Campanhas Facebook / Instagram" />

      <div className="p-6 space-y-5">
        {/* Period selector */}
        <div className="flex items-center justify-between">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {periods.map((p, i) => (
              <button key={p} onClick={() => setPeriod(i)}
                className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all ${period === i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                {p}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#40916C] transition-colors">
            <RefreshCw size={14} />
            Sincronizar Meta API
          </button>
        </div>

        {/* Warning — no credentials */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Credenciais Meta API não configuradas</p>
            <p className="text-xs text-amber-600 mt-0.5">Adicione META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no .env.local para dados reais.</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Gasto Total', value: formatCurrency(totalSpend), icon: DollarSign, color: '#EF4444', bg: '#FFF1F2' },
            { label: 'Impressões', value: totalImpressions.toLocaleString('pt-BR'), icon: Eye, color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Cliques', value: totalClicks.toLocaleString('pt-BR'), icon: MousePointer, color: '#40916C', bg: '#F0FBF5' },
            { label: 'CPM Médio', value: formatCurrency(avgCPM), icon: BarChart2, color: '#2563EB', bg: '#EFF6FF' },
            { label: 'CTR', value: `${ctr.toFixed(2)}%`, icon: TrendingUp, color: '#F59E0B', bg: '#FFFBEB' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="stat-card p-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div className="tabular text-lg font-bold text-gray-900">{value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Charts + campaigns */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-2">
                <CardTitle>Gasto Diário — Últimos 7 dias</CardTitle>
              </CardHeader>
              <div className="px-2 pb-4 pt-2">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={spendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="spend" name="Gasto" fill="#40916C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Campaigns */}
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
              <CardTitle>Campanhas ({mockCampaigns.length})</CardTitle>
            </CardHeader>
            <div className="divide-y divide-gray-50">
              {mockCampaigns.map(c => (
                <div key={c.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[12px] font-medium text-gray-800 leading-tight flex-1 mr-2">{c.name}</p>
                    <Badge color={c.status === 'ACTIVE' ? 'green' : 'gray'} className="text-[9px] flex-shrink-0">
                      {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                    </Badge>
                  </div>
                  {c.status === 'ACTIVE' && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2">
                      <div><span className="text-[10px] text-gray-400">Gasto</span><div className="text-[12px] font-semibold tabular text-red-500">{formatCurrency(c.spend)}</div></div>
                      <div><span className="text-[10px] text-gray-400">CPM</span><div className="text-[12px] font-semibold tabular text-gray-700">{formatCurrency(c.cpm)}</div></div>
                      <div><span className="text-[10px] text-gray-400">Impressões</span><div className="text-[12px] font-semibold tabular text-gray-700">{c.impressions.toLocaleString('pt-BR')}</div></div>
                      <div><span className="text-[10px] text-gray-400">Cliques</span><div className="text-[12px] font-semibold tabular text-gray-700">{c.clicks.toLocaleString('pt-BR')}</div></div>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Budget/dia: {formatCurrency(c.daily_budget)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
