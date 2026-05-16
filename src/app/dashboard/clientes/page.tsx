'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import {
  Search, Plus, Phone, Mail, Instagram, ExternalLink, ChevronRight,
  CheckCircle2, Pencil, Trash2, Paperclip, X, FileCheck, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientRepository, ClientInput } from '@/lib/repositories'
import { clientStatusConfig, formatDate, formatCurrency, specialties } from '@/lib/utils'
import { Client, ClientStatus } from '@/types'

const statusOptions: { value: ClientStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...Object.entries(clientStatusConfig).map(([value, { label }]) => ({ value: value as ClientStatus, label })),
]

const emptyForm = {
  name: '', specialty: '', email: '', whatsapp: '',
  instagram: '', website: '', status: 'prospecto' as ClientStatus, notes: '',
  closed_at: '', delivery_date: '',
  total_value: '', payment_mode: '' as '' | '50%' | '100%',
}

function SkeletonRow() {
  return (
    <tr>
      <td>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-gray-200 animate-pulse rounded" />
            <div className="h-2.5 w-24 bg-gray-100 animate-pulse rounded" />
          </div>
        </div>
      </td>
      <td><div className="h-3 w-24 bg-gray-200 animate-pulse rounded" /></td>
      <td><div className="flex gap-2">{[0,1,2].map(i => <div key={i} className="w-6 h-6 bg-gray-200 animate-pulse rounded" />)}</div></td>
      <td><div className="h-5 w-16 bg-gray-200 animate-pulse rounded-full" /></td>
      <td><div className="h-3 w-20 bg-gray-100 animate-pulse rounded" /></td>
      <td><div className="w-6 h-6 bg-gray-100 animate-pulse rounded" /></td>
    </tr>
  )
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'todos'>('todos')
  const [specialtyFilter, setSpecialtyFilter] = useState('todas')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState('')
  const [deleteModal, setDeleteModal] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [contractFile, setContractFile] = useState<File | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const repo = clientRepository(createClient())
        const data = await repo.findAll()
        setClients(data)
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

  const lowerSearch = search.toLowerCase()
  const filtered = clients.filter(c => {
    const matchSearch = (c.name ?? '').toLowerCase().includes(lowerSearch) ||
      (c.specialty ?? '').toLowerCase().includes(lowerSearch) ||
      (c.email ?? '').toLowerCase().includes(lowerSearch)
    const matchStatus = statusFilter === 'todos' || c.status === statusFilter
    const matchSpec = specialtyFilter === 'todas' || c.specialty === specialtyFilter
    return matchSearch && matchStatus && matchSpec
  })

  const statusCounts = clients.reduce(
    (acc, c) => { acc[c.status]++; return acc },
    { todos: clients.length, prospecto: 0, ativo: 0, inativo: 0, churned: 0 } as Record<ClientStatus | 'todos', number>
  )

  // Clients with outstanding balance
  const inadimplentes = clients.filter(c => {
    const total = c.total_value ?? 0
    const paid = c.paid_value ?? 0
    return total > 0 && paid < total
  })
  const totalPendente = inadimplentes.reduce((sum, c) => sum + ((c.total_value ?? 0) - (c.paid_value ?? 0)), 0)

  function handleOpenModal() {
    setEditingClient(null)
    setForm(emptyForm)
    setSaveError('')
    setContractFile(null)
    setShowModal(true)
  }

  function handleOpenEdit(client: Client) {
    setEditingClient(client)
    setForm({
      name: client.name,
      specialty: client.specialty,
      email: client.email ?? '',
      whatsapp: client.whatsapp,
      instagram: client.instagram ?? '',
      website: client.website ?? '',
      status: client.status,
      notes: client.notes ?? '',
      closed_at: client.closed_at ?? '',
      delivery_date: client.delivery_date ?? '',
      total_value: client.total_value != null ? String(client.total_value) : '',
      payment_mode: (() => {
        if (!client.total_value || !client.paid_value) return ''
        const ratio = client.paid_value / client.total_value
        if (Math.abs(ratio - 1) < 0.01) return '100%'
        if (Math.abs(ratio - 0.5) < 0.01) return '50%'
        return ''
      })() as '' | '50%' | '100%',
    })
    setSaveError('')
    setContractFile(null)
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditingClient(null)
    setContractFile(null)
  }

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const { computedPaid, pendingAmount } = (() => {
    const total = parseFloat(form.total_value) || 0
    const paid = form.payment_mode === '100%' ? total : form.payment_mode === '50%' ? total * 0.5 : 0
    return { computedPaid: paid, pendingAmount: Math.max(0, total - paid) }
  })()

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const repo = clientRepository(createClient())
      const totalVal = form.total_value ? parseFloat(form.total_value) : null
      const paidVal = totalVal != null && form.payment_mode
        ? form.payment_mode === '100%' ? totalVal : totalVal * 0.5
        : null
      const payload: ClientInput = {
        name: form.name,
        specialty: form.specialty,
        email: form.email,
        whatsapp: form.whatsapp,
        instagram: form.instagram || undefined,
        website: form.website || undefined,
        status: form.status,
        notes: form.notes || undefined,
        closed_at: form.closed_at || null,
        delivery_date: form.delivery_date || null,
        total_value: totalVal,
        paid_value: paidVal,
      }

      let contractUrl: string | null = null
      if (contractFile) {
        contractUrl = await repo.uploadContract(contractFile)
      }

      const fullPayload = contractUrl ? { ...payload, contract_url: contractUrl } : payload

      if (editingClient) {
        const data = await repo.update(editingClient.id, fullPayload)
        setClients(prev => prev.map(c => c.id === editingClient.id ? data : c))
        setToast(`${data.name} atualizado com sucesso!`)
      } else {
        const data = await repo.create(fullPayload)
        setClients(prev => [data, ...prev])
        setToast(`${data.name} adicionado com sucesso!`)
      }
      setForm(emptyForm)
      setContractFile(null)
      setEditingClient(null)
      setShowModal(false)
    } catch (err: unknown) {
      console.error('Erro ao salvar cliente:', err)
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido ao salvar.')
    } finally {
      setSaving(false)
    }
  }, [form, editingClient, contractFile])

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await clientRepository(createClient()).remove(deleteModal.id)
      setClients(prev => prev.filter(c => c.id !== deleteModal.id))
      setToast(`${deleteModal.name} removido.`)
      setDeleteModal(null)
    } catch (err) {
      console.error('Erro ao deletar cliente:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <Header
        title="Clientes"
        subtitle={loading ? 'Carregando...' : `${filtered.length} cliente${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
      />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Alerta de inadimplentes ───────────────────────────────────── */}
        {!loading && inadimplentes.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/10">
            <AlertCircle size={16} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
                {inadimplentes.length} cliente{inadimplentes.length !== 1 ? 's' : ''} com pagamento pendente
              </p>
              <p className="text-[12px] text-amber-600 dark:text-amber-400/80 mt-0.5">
                Total a receber: <span className="font-bold">{formatCurrency(totalPendente)}</span>
                {' · '}
                {inadimplentes.map(c => c.name).join(', ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0"
            >
              Ver todos
            </button>
          </div>
        )}

        {/* Filters bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, especialidade ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 py-2"
            />
          </div>

          <select
            value={specialtyFilter}
            onChange={e => setSpecialtyFilter(e.target.value)}
            className="input-field w-auto py-2 cursor-pointer"
            aria-label="Filtrar por especialidade"
          >
            <option value="todas">Todas especialidades</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="ml-auto">
            <Button onClick={handleOpenModal}>
              <Plus size={15} />
              Novo cliente
            </Button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1.5 bg-gray-100 dark:bg-[#152218] rounded-lg p-1 w-fit">
            {statusOptions.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  statusFilter === value
                    ? 'bg-white dark:bg-[#1A2C1F] text-gray-900 dark:text-[#F8FBF9] shadow-sm'
                    : 'text-gray-500 dark:text-[#4A6B52] hover:text-gray-700 dark:hover:text-[#8BA891]'
                }`}
              >
                {label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                  statusFilter === value
                    ? 'bg-[#40916C]/10 text-[#40916C] dark:text-[#52B788]'
                    : 'bg-gray-200 dark:bg-[#1E3020] text-gray-500 dark:text-[#4A6B52]'
                }`}>
                  {statusCounts[value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Especialidade</th>
                  <th>Contato</th>
                  <th>Status</th>
                  <th>Fechamento</th>
                  <th>Entrega</th>
                  <th>Financeiro</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      {clients.length === 0 ? 'Nenhum cliente cadastrado ainda' : 'Nenhum cliente encontrado'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(client => {
                    const totalV = client.total_value ?? 0
                    const paidV = client.paid_value ?? 0
                    const pendingV = Math.max(0, totalV - paidV)
                    const hasPaymentData = totalV > 0
                    return (
                      <tr key={client.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#40916C]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[13px] font-semibold text-[#40916C]">{client.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px]">{client.name}</p>
                              {client.email && <p className="text-[11px] text-gray-400 dark:text-[#4A6B52]">{client.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td><span className="text-[13px] text-gray-600 dark:text-[#8BA891]">{client.specialty}</span></td>
                        <td>
                          <div className="flex items-center gap-2">
                            {client.whatsapp && (
                              <a href={`https://wa.me/55${client.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                                className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-400 dark:text-[#4A6B52] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <Phone size={13} />
                              </a>
                            )}
                            {client.email && (
                              <a href={`mailto:${client.email}`} aria-label="Email"
                                className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 dark:text-[#4A6B52] hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                <Mail size={13} />
                              </a>
                            )}
                            {client.instagram && (
                              <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                                className="p-1.5 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 dark:text-[#4A6B52] hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                                <Instagram size={13} />
                              </a>
                            )}
                            {client.website && (
                              <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" aria-label="Site"
                                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#1E3020] text-gray-400 dark:text-[#4A6B52] hover:text-gray-600 dark:hover:text-[#8BA891] transition-colors">
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge color={clientStatusConfig[client.status].color as never}>
                            {clientStatusConfig[client.status].label}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-[12px] text-gray-400 dark:text-[#4A6B52]">
                            {client.closed_at ? formatDate(client.closed_at) : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-[12px] text-gray-400 dark:text-[#4A6B52]">
                            {client.delivery_date ? formatDate(client.delivery_date) : '—'}
                          </span>
                        </td>
                        <td>
                          {hasPaymentData ? (
                            <div className="space-y-0.5">
                              <p className="text-[11px] text-gray-500 dark:text-[#8BA891]">
                                {formatCurrency(totalV)}
                              </p>
                              {pendingV > 0 ? (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                                  Falta {formatCurrency(pendingV)}
                                </p>
                              ) : (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  ✓ Quitado
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-gray-300 dark:text-[#2A4030]">—</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(client)}
                              aria-label="Editar"
                              className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 dark:text-[#4A6B52] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModal(client)}
                              aria-label="Remover"
                              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-[#4A6B52] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                            <Link href={`/dashboard/clientes/${client.id}`} aria-label="Ver perfil"
                              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#1E3020] text-gray-400 dark:text-[#4A6B52] hover:text-gray-600 dark:hover:text-[#8BA891] transition-colors inline-flex cursor-pointer">
                              <ChevronRight size={15} />
                            </Link>
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

      {/* ── New / Edit client modal ─────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={editingClient ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <label htmlFor="cli-name" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nome completo / Razão social *</label>
              <input id="cli-name" className="input-field" placeholder="Dr. Nome Sobrenome" value={form.name} onChange={set('name')} required />
            </div>

            <div>
              <label htmlFor="cli-specialty" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Especialidade *</label>
              <input
                id="cli-specialty"
                list="specialties-list"
                className="input-field"
                placeholder="Ex: Psicanalista, Sexólogo..."
                value={form.specialty}
                onChange={set('specialty')}
                required
                autoComplete="off"
              />
              <datalist id="specialties-list">
                {specialties.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div>
              <label htmlFor="cli-status" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
              <select id="cli-status" className="input-field cursor-pointer" value={form.status} onChange={set('status')}>
                {Object.entries(clientStatusConfig).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cli-email" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Email *</label>
              <input id="cli-email" type="email" className="input-field" placeholder="email@exemplo.com" value={form.email} onChange={set('email')} required />
            </div>

            <div>
              <label htmlFor="cli-whatsapp" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">WhatsApp *</label>
              <input id="cli-whatsapp" className="input-field" placeholder="11999990000" value={form.whatsapp} onChange={set('whatsapp')} required />
            </div>

            <div>
              <label htmlFor="cli-instagram" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Instagram</label>
              <input id="cli-instagram" className="input-field" placeholder="@perfil" value={form.instagram} onChange={set('instagram')} />
            </div>

            <div>
              <label htmlFor="cli-website" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Site</label>
              <input id="cli-website" className="input-field" placeholder="exemplo.com.br" value={form.website} onChange={set('website')} />
            </div>

            <div>
              <label htmlFor="cli-closed-at" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data de fechamento</label>
              <input id="cli-closed-at" type="date" className="input-field" value={form.closed_at} onChange={set('closed_at')} />
            </div>

            <div>
              <label htmlFor="cli-delivery" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data de entrega</label>
              <input id="cli-delivery" type="date" className="input-field" value={form.delivery_date} onChange={set('delivery_date')} />
            </div>

            {/* ── Financeiro do cliente ──────────────────────────────────── */}
            <div className="col-span-2">
              <div className="h-px bg-gray-100 dark:bg-[#1E3020] mb-4" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A6B52] mb-3">Financeiro do contrato</p>
            </div>

            <div>
              <label htmlFor="cli-total" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Total da venda (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#4A6B52] text-sm font-medium select-none">R$</span>
                <input id="cli-total" type="number" className="input-field pl-10" placeholder="0,00" min="0" step="0.01" value={form.total_value} onChange={set('total_value')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Forma de pagamento</label>
              <div className="flex rounded-xl border border-gray-200 dark:border-[#2A4030] overflow-hidden">
                {([
                  { value: '', label: 'Não definido' },
                  { value: '50%', label: '50% (entrada)' },
                  { value: '100%', label: 'Total (100%)' },
                ] as { value: '' | '50%' | '100%'; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: opt.value }))}
                    className={`flex-1 py-2.5 text-[12px] font-semibold transition-all cursor-pointer ${
                      form.payment_mode === opt.value
                        ? opt.value === '100%'
                          ? 'bg-[#40916C] dark:bg-[#2D6A4F] text-white'
                          : opt.value === '50%'
                          ? 'bg-amber-500 dark:bg-amber-600 text-white'
                          : 'bg-gray-200 dark:bg-[#2A4030] text-gray-700 dark:text-[#D1FAE5]'
                        : 'bg-white dark:bg-[#152218] text-gray-400 dark:text-[#4A6B52] hover:bg-gray-50 dark:hover:bg-[#1A2C1F]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {(parseFloat(form.total_value) > 0 && form.payment_mode) && (
              <div className="col-span-2">
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  pendingAmount > 0
                    ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-900/10'
                    : 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-900/10'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${pendingAmount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className="text-[12px] font-medium text-gray-600 dark:text-[#A7C4AF]">
                      {pendingAmount > 0 ? 'Falta pagar' : 'Quitado'}
                    </span>
                  </div>
                  <div className="text-right">
                    {pendingAmount > 0 && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Pago: {formatCurrency(computedPaid)}
                      </p>
                    )}
                    <span className={`text-[15px] font-bold tabular ${
                      pendingAmount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {pendingAmount > 0 ? `Falta: ${formatCurrency(pendingAmount)}` : '✓ Quitado'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Contrato ──────────────────────────────────────────────── */}
            <div className="col-span-2">
              <div className="h-px bg-gray-100 dark:bg-[#1E3020] mb-4" />
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Contrato (anexo)</label>
              {contractFile ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#40916C]/40 bg-[#40916C]/5">
                  <FileCheck size={16} className="text-[#40916C] flex-shrink-0" />
                  <span className="text-[13px] text-gray-700 dark:text-[#A7C4AF] flex-1 truncate">{contractFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setContractFile(null)}
                    className="p-0.5 rounded text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label="Remover arquivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed border-gray-200 dark:border-[#2A4030] hover:border-[#40916C]/50 hover:bg-[#40916C]/5 transition-colors cursor-pointer">
                  <Paperclip size={18} className="text-gray-400" />
                  <div className="text-center">
                    <span className="text-[13px] font-medium text-[#40916C] dark:text-[#52B788]">Clique para anexar</span>
                    <p className="text-[11px] text-gray-400 dark:text-[#4A6B52] mt-0.5">PDF, DOC, DOCX — até 10MB</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={e => setContractFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            <div className="col-span-2">
              <label htmlFor="cli-notes" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações internas</label>
              <textarea id="cli-notes" className="input-field resize-none" rows={3} placeholder="Notas privadas sobre o cliente..." value={form.notes} onChange={set('notes')} />
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">{saveError}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={handleCloseModal}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editingClient ? 'Salvar alterações' : 'Salvar cliente'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Cliente" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Tem certeza que deseja remover <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Button>
              <Button
                onClick={handleDelete}
                loading={deleting}
                className="bg-red-500 hover:bg-red-600 text-white border-red-500"
              >
                <Trash2 size={13} /> Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success toast */}
      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#52B788] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
