'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { MessageCircle, UserPlus, Globe, DollarSign, Users, ChevronDown, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { leadStatusConfig, formatDate } from '@/lib/utils'
import { Lead, LeadStatus } from '@/types'

const statusOptions: { value: LeadStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'novo', label: 'Novos' },
  { value: 'contatado', label: 'Contatados' },
  { value: 'qualificado', label: 'Qualificados' },
  { value: 'descartado', label: 'Descartados' },
  { value: 'convertido', label: 'Convertidos' },
]

const emptyForm = {
  name: '',
  whatsapp: '',
  revenue: '',
  patients_per_month: '',
  has_site: 'Não',
  status: 'novo' as LeadStatus,
}

function SkeletonRow() {
  return (
    <tr>
      <td><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" /><div className="space-y-1.5"><div className="h-3 w-28 bg-gray-200 animate-pulse rounded" /><div className="h-2.5 w-20 bg-gray-100 animate-pulse rounded" /></div></div></td>
      <td><div className="h-3 w-20 bg-gray-200 animate-pulse rounded" /></td>
      <td><div className="h-3 w-16 bg-gray-200 animate-pulse rounded" /></td>
      <td><div className="h-3 w-12 bg-gray-100 animate-pulse rounded" /></td>
      <td><div className="h-5 w-16 bg-gray-200 animate-pulse rounded-full" /></td>
      <td><div className="h-3 w-16 bg-gray-100 animate-pulse rounded" /></td>
      <td><div className="flex gap-2"><div className="w-6 h-6 bg-gray-100 animate-pulse rounded" /></div></td>
    </tr>
  )
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'todos'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [convertModal, setConvertModal] = useState<Lead | null>(null)
  const [toast, setToast] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
        if (data) setLeads(data)
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

  const filtered = leads
    .filter(l => statusFilter === 'todos' || l.status === statusFilter)

  const counts = leads.reduce(
    (acc, l) => { acc[l.status]++; acc.todos++; return acc },
    { todos: 0, novo: 0, contatado: 0, qualificado: 0, descartado: 0, convertido: 0 } as Record<LeadStatus | 'todos', number>
  )

  function handleOpenModal() {
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.whatsapp.trim()) { setSaveError('Nome e WhatsApp são obrigatórios.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          name: form.name.trim(),
          whatsapp: form.whatsapp.trim(),
          revenue: form.revenue.trim() || null,
          patients_per_month: form.patients_per_month.trim() || null,
          has_site: form.has_site,
          status: form.status,
        }])
        .select()
        .single()
      if (error) throw error
      setLeads(prev => [data, ...prev])
      setToast(`${data.name} adicionado com sucesso!`)
      setShowModal(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateStatus(id: string, status: LeadStatus): Promise<boolean> {
    const prev = leads.find(l => l.id === id)?.status
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l))
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) {
      if (prev) setLeads(ls => ls.map(l => l.id === id ? { ...l, status: prev } : l))
      return false
    }
    return true
  }

  async function handleConvert(lead: Lead) {
    const ok = await handleUpdateStatus(lead.id, 'convertido')
    if (!ok) return
    setConvertModal(null)
    setToast(`${lead.name} convertido em cliente!`)
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('leads').delete().eq('id', deleteModal.id)
      if (error) throw error
      setLeads(prev => prev.filter(l => l.id !== deleteModal.id))
      setToast(`${deleteModal.name} removido.`)
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <Header
        title="Leads"
        subtitle={loading ? 'Carregando...' : `${counts.novo} novo${counts.novo !== 1 ? 's' : ''} · ${counts.qualificado} qualificado${counts.qualificado !== 1 ? 's' : ''}`}
      />

      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="overflow-x-auto pb-1">
          <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1 w-fit">
            {statusOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
                  statusFilter === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  statusFilter === value ? 'bg-[#40916C]/10 text-[#40916C]' : 'bg-gray-200 text-gray-500'
                }`}>
                  {counts[value]}
                </span>
              </button>
            ))}
          </div>
          </div>
          <Button onClick={handleOpenModal}><Plus size={14} /> Novo lead</Button>
        </div>

        <Card padding="none">
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Faturamento</th>
                <th>Pacientes/mês</th>
                <th>Tem site?</th>
                <th>Status</th>
                <th>Recebido em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    {leads.length === 0 ? 'Nenhum lead cadastrado ainda' : 'Nenhum lead encontrado'}
                  </td>
                </tr>
              ) : (
                filtered.map(lead => {
                  const cfg = leadStatusConfig[lead.status]
                  return (
                    <tr key={lead.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#40916C]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[13px] font-bold text-[#40916C]">{lead.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-[13px]">{lead.name}</p>
                            <p className="text-[11px] text-gray-400">{lead.whatsapp}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {lead.revenue ? (
                          <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                            <DollarSign size={11} className="text-gray-400" />
                            {lead.revenue}
                          </div>
                        ) : <span className="text-gray-300 text-[12px]">—</span>}
                      </td>
                      <td>
                        {lead.patients_per_month ? (
                          <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                            <Users size={11} className="text-gray-400" />
                            {lead.patients_per_month}
                          </div>
                        ) : <span className="text-gray-300 text-[12px]">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                          <Globe size={11} className="text-gray-400" />
                          {lead.has_site ?? '—'}
                        </div>
                      </td>
                      <td>
                        <div className="relative group">
                          <button type="button" className="flex items-center gap-1 cursor-pointer">
                            <Badge color={cfg.color as never}>{cfg.label}</Badge>
                            <ChevronDown size={10} className="text-gray-400" />
                          </button>
                          <div className="absolute z-10 left-0 top-7 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                            {(['novo', 'contatado', 'qualificado', 'descartado', 'convertido'] as LeadStatus[]).map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleUpdateStatus(lead.id, s)}
                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 cursor-pointer ${lead.status === s ? 'font-semibold text-[#40916C]' : 'text-gray-700'}`}
                              >
                                {leadStatusConfig[s].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-[11px] text-gray-400">{formatDate(lead.created_at)}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-0.5">
                          <a
                            href={`https://wa.me/55${lead.whatsapp}?text=Olá ${lead.name.split(' ')[0]}!`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Abrir WhatsApp"
                          >
                            <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                              <MessageCircle size={13} />
                            </Button>
                          </a>
                          {lead.status !== 'convertido' && lead.status !== 'descartado' && (
                            <Button variant="ghost" size="sm" className="text-[#40916C] hover:bg-[#40916C]/10" onClick={() => setConvertModal(lead)}>
                              <UserPlus size={13} />
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteModal(lead)}
                            aria-label="Remover lead"
                            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      {/* New lead modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Lead" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo *</label>
              <input className="input-field" placeholder="Dr. Nome Sobrenome" value={form.name} onChange={set('name')} required />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp *</label>
              <input className="input-field" placeholder="11999990000" value={form.whatsapp} onChange={set('whatsapp')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Faturamento mensal</label>
              <input className="input-field" placeholder="Ex: R$ 30k–50k" value={form.revenue} onChange={set('revenue')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Pacientes/mês</label>
              <input className="input-field" placeholder="Ex: 80–120" value={form.patients_per_month} onChange={set('patients_per_month')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tem site?</label>
              <select className="input-field cursor-pointer" value={form.has_site} onChange={set('has_site')} aria-label="Tem site?">
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
                <option value="Precisa renovar">Precisa renovar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select className="input-field cursor-pointer" value={form.status} onChange={set('status')} aria-label="Status">
                {(['novo', 'contatado', 'qualificado', 'descartado', 'convertido'] as LeadStatus[]).map(s => (
                  <option key={s} value={s}>{leadStatusConfig[s].label}</option>
                ))}
              </select>
            </div>
          </div>

          {saveError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{saveError}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar lead</Button>
          </div>
        </form>
      </Modal>

      {/* Convert modal */}
      <Modal isOpen={!!convertModal} onClose={() => setConvertModal(null)} title="Converter em Cliente" size="sm">
        {convertModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Deseja marcar <strong>{convertModal.name}</strong> como convertido? Após isso, cadastre o cliente na seção Clientes.
            </p>
            <div className="bg-[#F8FBF9] border border-[#40916C]/20 rounded-lg p-3 text-sm space-y-1.5">
              {convertModal.revenue && <div className="flex justify-between"><span className="text-gray-500">Faturamento:</span><span className="font-medium">{convertModal.revenue}</span></div>}
              {convertModal.patients_per_month && <div className="flex justify-between"><span className="text-gray-500">Pacientes/mês:</span><span className="font-medium">{convertModal.patients_per_month}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">WhatsApp:</span><span className="font-medium">{convertModal.whatsapp}</span></div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConvertModal(null)}>Cancelar</Button>
              <Button onClick={() => handleConvert(convertModal)}>
                <UserPlus size={13} /> Converter
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Lead" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Tem certeza que deseja remover <strong>{deleteModal.name}</strong>?
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
