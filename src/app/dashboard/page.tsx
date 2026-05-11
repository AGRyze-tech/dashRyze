'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Users, FolderKanban, DollarSign, UserPlus, ArrowRight, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency, formatDateShort, daysUntil, deadlineLabel, projectStatusConfig, leadStatusConfig } from '@/lib/utils'
import { mockClients, mockProjects, mockTransactions, mockLeads } from '@/lib/mock-data'
import Link from 'next/link'

function DeadlineRow({ project }: { project: typeof mockProjects[number] }) {
  const client = mockClients.find(c => c.id === project.client_id)
  const days = daysUntil(project.deadline)
  const isOverdue = days < 0
  const isWarning = days >= 0 && days <= 7
  const cfg = projectStatusConfig[project.status]

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-[#1E3020] last:border-0 hover:bg-gray-50/60 dark:hover:bg-[#1A2C1F] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 dark:text-[#E2F5EC] truncate">{project.name}</p>
        <p className="text-[11px] text-gray-400 dark:text-[#8BA891] truncate">{client?.name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge color={cfg.color as 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'} dot={false}>
          {cfg.label}
        </Badge>
        <span className={`flex items-center gap-1 text-[11px] font-medium ${isOverdue ? 'text-red-500 dark:text-red-400' : isWarning ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-[#8BA891]'}`}>
          {(isOverdue || isWarning) && <AlertTriangle size={10} />}
          {formatDateShort(project.deadline)}
        </span>
      </div>
    </div>
  )
}

function LeadRow({ lead }: { lead: typeof mockLeads[number] }) {
  const cfg = leadStatusConfig[lead.status]
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-[#1E3020] last:border-0 hover:bg-gray-50/60 dark:hover:bg-[#1A2C1F] transition-colors">
      <div className="w-8 h-8 rounded-full bg-[#F0FBF5] dark:bg-[#1B4332] flex items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-[#40916C] dark:text-[#52B788]">
          {lead.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 dark:text-[#E2F5EC] truncate">{lead.name}</p>
        <p className="text-[11px] text-gray-400 dark:text-[#8BA891]">{lead.revenue}</p>
      </div>
      <Badge color={cfg.color as 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'} dot={false}>
        {cfg.label}
      </Badge>
    </div>
  )
}

export default function DashboardPage() {
  const [today, setToday] = useState('')
  useEffect(() => {
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
  }, [])

  const stats = useMemo(() => {
    const activeClients = mockClients.filter(c => c.status === 'ativo').length
    const activeProjects = mockProjects.filter(p => p.status !== 'entregue' && p.status !== 'concluido').length
    const monthlyRevenue = mockTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + t.amount, 0)
    const monthlyExpenses = mockTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + t.amount, 0)
    const newLeads = mockLeads.filter(l => l.status === 'novo').length

    return [
      {
        label: 'Clientes Ativos',
        value: activeClients,
        total: `${mockClients.length} total`,
        icon: Users,
        iconCls: 'bg-[#F0FBF5] text-[#40916C] dark:bg-[#1B4332] dark:text-[#52B788]',
      },
      {
        label: 'Projetos em Andamento',
        value: activeProjects,
        total: `${mockProjects.length} projetos`,
        icon: FolderKanban,
        iconCls: 'bg-[#F5F3FF] text-[#7C3AED] dark:bg-purple-900/40 dark:text-purple-400',
      },
      {
        label: 'Receita do Mês',
        value: formatCurrency(monthlyRevenue),
        total: `${formatCurrency(monthlyExpenses)} em despesas`,
        icon: DollarSign,
        iconCls: 'bg-[#F0FBF5] text-[#40916C] dark:bg-[#1B4332] dark:text-[#52B788]',
      },
      {
        label: 'Leads Novos',
        value: newLeads,
        total: `${mockLeads.length} total`,
        icon: UserPlus,
        iconCls: 'bg-[#FFFBEB] text-[#F59E0B] dark:bg-amber-900/40 dark:text-amber-400',
      },
    ]
  }, [])

  const upcomingProjects = useMemo(() =>
    mockProjects
      .filter(p => p.status !== 'entregue' && p.status !== 'concluido')
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5),
    []
  )

  const recentLeads = useMemo(() =>
    [...mockLeads]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    []
  )

  return (
    <div>
      <Header title="Dashboard" subtitle={`Bem-vindo, Isaac${today ? ` · ${today}` : ''}`} />

      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
          {stats.map(({ label, value, total, icon: Icon, iconCls }) => (
            <div key={label} className="stat-card p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconCls}`}>
                <Icon size={18} />
              </div>
              <div className="tabular text-2xl font-bold text-gray-900 dark:text-[#F0FDF4] mb-0.5">{value}</div>
              <div className="text-[13px] font-medium text-gray-700 dark:text-[#D1FAE5] mb-1">{label}</div>
              <div className="text-[11px] text-gray-400 dark:text-[#8BA891]">{total}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#1E3020]">
              <CardTitle>Prazos Próximos</CardTitle>
              <Link href="/dashboard/projetos">
                <Button variant="ghost" size="sm" className="text-[#40916C] hover:text-[#40916C] hover:bg-[#40916C]/8 gap-1 -mr-2">
                  Ver todos <ArrowRight size={12} />
                </Button>
              </Link>
            </CardHeader>
            {upcomingProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#1B4332] flex items-center justify-center mb-3">
                  <Clock size={16} className="text-gray-400 dark:text-[#52B788]" />
                </div>
                <p className="text-[13px] text-gray-400 dark:text-[#8BA891]">Nenhum projeto cadastrado ainda</p>
              </div>
            ) : (
              <div>
                {upcomingProjects.map(p => <DeadlineRow key={p.id} project={p} />)}
              </div>
            )}
          </Card>

          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#1E3020]">
              <CardTitle>Leads Recentes</CardTitle>
              <Link href="/dashboard/leads">
                <Button variant="ghost" size="sm" className="text-[#40916C] hover:text-[#40916C] hover:bg-[#40916C]/8 gap-1 -mr-2">
                  Ver todos <ArrowRight size={12} />
                </Button>
              </Link>
            </CardHeader>
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Clock size={16} className="text-gray-400" />
                </div>
                <p className="text-[13px] text-gray-400">Nenhum lead recebido ainda</p>
              </div>
            ) : (
              <div>
                {recentLeads.map(l => <LeadRow key={l.id} lead={l} />)}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
