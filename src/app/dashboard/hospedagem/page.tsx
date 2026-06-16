'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import {
  Server, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Clock, Globe,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Hosting } from '@/types'
import { useToast } from '@/hooks/useToast'

const statusConfig: Record<Hosting['status'], { label: string; color: 'green' | 'yellow' | 'red'; icon: React.ElementType }> = {
  ativo:   { label: 'Ativo',   color: 'green',  icon: CheckCircle2 },
  inativo: { label: 'Inativo', color: 'yellow', icon: Clock },
  vencido: { label: 'Vencido', color: 'red',    icon: AlertCircle },
}

const emptyForm = {
  client_name: '',
  domain: '',
  plan: '',
  monthly_value: '',
  renewal_date: '',
  status: 'ativo' as Hosting['status'],
  notes: '',
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-[#181819] ${className}`} />
}

function daysUntilRenewal(date: string): number {
  const target = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function HospedagemPage() {
  const [hostings, setHostings] = useState<Hosting[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Hosting | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Hosting | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()
  const db = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await db
          .from('hosting')
          .select('*')
          .order('renewal_date', { ascending: true })
        if (error) {
          if (error.code === '42P01') { setTableExists(false); return }
          throw error
        }
        setHostings((data ?? []) as Hosting[])
      } catch (err) {
        console.error('Erro ao carregar hospedagens:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [db])

  const stats = useMemo(() => {
    let ativos = 0, totalMonthly = 0, vencendo = 0
    for (const h of hostings) {
      if (h.status === 'ativo') ativos++
      totalMonthly += h.monthly_value
      if (h.renewal_date) {
        const days = daysUntilRenewal(h.renewal_date)
        if (days >= 0 && days <= 30) vencendo++
      }
    }
    return { total: hostings.length, ativos, totalMonthly, vencendo }
  }, [hostings])

  function handleOpenModal() {
    setEditing(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  function handleOpenEdit(h: Hosting) {
    setEditing(h)
    setForm({
      client_name: h.client_name,
      domain: h.domain,
      plan: h.plan ?? '',
      monthly_value: String(h.monthly_value),
      renewal_date: h.renewal_date ?? '',
      status: h.status,
      notes: h.notes ?? '',
    })
    setSaveError('')
    setShowModal(true)
  }

  const set = (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name.trim()) { setSaveError('Nome do cliente é obrigatório.'); return }
    if (!form.domain.trim()) { setSaveError('Domínio é obrigatório.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        client_name: form.client_name.trim(),
        domain: form.domain.trim(),
        plan: form.plan.trim() || null,
        monthly_value: parseFloat(form.monthly_value) || 0,
        renewal_date: form.renewal_date || null,
        status: form.status,
        notes: form.notes.trim() || null,
      }
      if (editing) {
        const { data, error } = await db.from('hosting').update(payload).eq('id', editing.id).select().single()
        if (error) throw error
        setHostings(prev => prev.map(h => h.id === editing.id ? (data as Hosting) : h))
        showToast('Hospedagem atualizada!')
      } else {
        const { data, error } = await db.from('hosting').insert([payload]).select().single()
        if (error) throw error
        setHostings(prev => [...prev, data as Hosting].sort((a, b) =>
          (a.renewal_date ?? '').localeCompare(b.renewal_date ?? '')
        ))
        showToast('Hospedagem registrada!')
      }
      setShowModal(false)
      setEditing(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const { error } = await db.from('hosting').delete().eq('id', deleteModal.id)
      if (error) throw error
      setHostings(prev => prev.filter(h => h.id !== deleteModal.id))
      showToast('Hospedagem removida.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!tableExists) {
    return (
      <div>
        <Header title="Hospedagem" subtitle="Clientes com planos de hospedagem" />
        <div className="p-4 sm:p-6">
          <div className="card-light p-8 flex flex-col items-center text-center gap-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Server size={20} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-800 dark:text-[#D1FAE5] mb-1">Tabela não encontrada</p>
              <p className="text-[13px] text-gray-500 dark:text-[#00a02a]">Execute o SQL abaixo no Supabase para ativar esta seção.</p>
            </div>
            <pre className="w-full text-left text-[11px] bg-gray-900 text-emerald-400 rounded-xl p-4 overflow-x-auto leading-relaxed">
{`create table if not exists hosting (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  domain text not null,
  plan text,
  monthly_value numeric(10,2) not null default 0,
  renewal_date date,
  status text not null default 'ativo'
    check (status in ('ativo', 'inativo', 'vencido')),
  notes text,
  created_at timestamptz default now()
);
alter table hosting enable row level security;
create policy "allow all" on hosting
  for all using (true) with check (true);`}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Hospedagem" subtitle="Clientes com planos de hospedagem ativa" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center mb-3">
              <Server size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Total</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{stats.total}</p>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-[#00FF41]/10 dark:bg-[#00FF41]/20 flex items-center justify-center mb-3">
              <CheckCircle2 size={16} className="text-[#00FF41]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Ativos</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-[#00FF41]">{stats.ativos}</p>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 flex items-center justify-center mb-3">
              <Globe size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Receita mensal</p>
            {loading ? <Skeleton className="h-7 w-24" /> : (
              <p className="text-[22px] font-bold leading-none text-emerald-700 dark:text-emerald-400">{formatCurrency(stats.totalMonthly)}</p>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-3">
              <Clock size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Venc. em 30d</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className={`text-[28px] font-bold leading-none ${stats.vencendo > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-[#F0FDF4]'}`}>{stats.vencendo}</p>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Clientes</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">{hostings.length} plano{hostings.length !== 1 ? 's' : ''}</p>
            </div>
            <Button size="sm" onClick={handleOpenModal}><Plus size={13} /> Adicionar</Button>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50 dark:divide-[#181819]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : hostings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center mb-3">
                <Server size={18} className="text-gray-300 dark:text-[#00a02a]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]">Nenhum plano cadastrado</p>
              <p className="text-[12px] text-gray-300 dark:text-[#00a02a] mt-0.5">Clique em &quot;Adicionar&quot; para começar</p>
            </div>
          ) : (
            <div>
              {hostings.map(h => {
                const sCfg = statusConfig[h.status]
                const SIcon = sCfg.icon
                const daysLeft = h.renewal_date ? daysUntilRenewal(h.renewal_date) : null
                const isWarning = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
                const isOverdue = daysLeft !== null && daysLeft < 0
                return (
                  <div key={h.id} className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 dark:border-[#181819] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#111114] transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <Globe size={15} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{h.client_name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#00a02a] flex items-center gap-1.5">
                        <span className="font-mono">{h.domain}</span>
                        {h.plan && <span className="opacity-70">· {h.plan}</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5]">{formatCurrency(h.monthly_value)}<span className="text-[10px] font-normal text-gray-400 dark:text-[#00a02a]">/mês</span></p>
                      {h.renewal_date && (
                        <p className={`text-[11px] font-medium ${isOverdue ? 'text-red-500 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-[#00a02a]'}`}>
                          {isOverdue ? `Venceu há ${Math.abs(daysLeft!)}d` : daysLeft === 0 ? 'Vence hoje' : `Vence em ${daysLeft}d · ${formatDate(h.renewal_date)}`}
                        </p>
                      )}
                    </div>
                    <Badge color={sCfg.color} dot={false}>
                      <SIcon size={10} className="mr-0.5" />{sCfg.label}
                    </Badge>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(h)}
                        aria-label="Editar"
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-[#00FF41]/10 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-[#00FF41] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModal(h)}
                        aria-label="Remover"
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? 'Editar Hospedagem' : 'Nova Hospedagem'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="host-client" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliente *</label>
              <input id="host-client" className="input-field" placeholder="Nome do cliente" value={form.client_name} onChange={set('client_name')} required />
            </div>
            <div>
              <label htmlFor="host-domain" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Domínio *</label>
              <input id="host-domain" className="input-field" placeholder="exemplo.com.br" value={form.domain} onChange={set('domain')} required />
            </div>
            <div>
              <label htmlFor="host-plan" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Plano</label>
              <input id="host-plan" className="input-field" placeholder="Ex: Básico, Pro..." value={form.plan} onChange={set('plan')} />
            </div>
            <div>
              <label htmlFor="host-value" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Valor mensal (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">R$</span>
                <input id="host-value" type="number" min="0" step="0.01" className="input-field pl-10" placeholder="0,00" value={form.monthly_value} onChange={set('monthly_value')} />
              </div>
            </div>
            <div>
              <label htmlFor="host-renewal" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Vencimento</label>
              <input id="host-renewal" type="date" className="input-field" value={form.renewal_date} onChange={set('renewal_date')} />
            </div>
            <div>
              <label htmlFor="host-status" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
              <select id="host-status" className="input-field" value={form.status} onChange={set('status')}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="host-notes" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações</label>
              <textarea id="host-notes" className="input-field resize-none" rows={2} placeholder="Credenciais, acessos, notas..." value={form.notes} onChange={set('notes')} />
            </div>
          </div>
          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">{saveError}</div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowModal(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editing ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Hospedagem" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover a hospedagem de <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.client_name}</strong> ({deleteModal.domain})?
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
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#111114] dark:border dark:border-[#28282d] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
