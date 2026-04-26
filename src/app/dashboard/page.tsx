'use client'
import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Users, FolderKanban, DollarSign, UserPlus, Clock, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

const stats = [
  { label: 'Clientes Ativos', value: 0, total: '0 total', icon: Users, iconCls: 'bg-[#F0FBF5] text-[#40916C]' },
  { label: 'Projetos em Andamento', value: 0, total: '0 projetos', icon: FolderKanban, iconCls: 'bg-[#F5F3FF] text-[#7C3AED]' },
  { label: 'Receita do Mês', value: formatCurrency(0), total: 'R$ 0 em despesas', icon: DollarSign, iconCls: 'bg-[#F0FBF5] text-[#40916C]' },
  { label: 'Leads Novos', value: 0, total: '0 total', icon: UserPlus, iconCls: 'bg-[#FFFBEB] text-[#F59E0B]' },
]

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <Clock size={16} className="text-gray-400" />
      </div>
      <p className="text-[13px] text-gray-400">{message}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [today, setToday] = useState('')
  useEffect(() => {
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
  }, [])

  return (
    <div>
      <Header title="Dashboard" subtitle={`Bem-vindo, Isaac${today ? ` · ${today}` : ''}`} />

      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
          {stats.map(({ label, value, total, icon: Icon, iconCls }) => (
            <div key={label} className="stat-card p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconCls}`}>
                <Icon size={18} />
              </div>
              <div className="tabular text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
              <div className="text-[13px] font-medium text-gray-700 mb-1">{label}</div>
              <div className="text-[11px] text-gray-400">{total}</div>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-4">
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
              <CardTitle>Prazos Próximos</CardTitle>
              <Link href="/dashboard/projetos">
                <Button variant="ghost" size="sm" className="text-[#40916C] hover:text-[#40916C] hover:bg-[#40916C]/8 gap-1 -mr-2">
                  Ver todos <ArrowRight size={12} />
                </Button>
              </Link>
            </CardHeader>
            <EmptyState message="Nenhum projeto cadastrado ainda" />
          </Card>

          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
              <CardTitle>Leads Recentes</CardTitle>
              <Link href="/dashboard/leads">
                <Button variant="ghost" size="sm" className="text-[#40916C] hover:text-[#40916C] hover:bg-[#40916C]/8 gap-1 -mr-2">
                  Ver todos <ArrowRight size={12} />
                </Button>
              </Link>
            </CardHeader>
            <EmptyState message="Nenhum lead recebido ainda" />
          </Card>
        </div>
      </div>
    </div>
  )
}
