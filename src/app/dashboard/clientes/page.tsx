'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import {
  Search, Plus, Phone, Mail, Instagram, ExternalLink, ChevronRight,
  CheckCircle2, Pencil, Trash2, Paperclip, X, FileCheck, Globe,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientRepository, ClientInput } from '@/lib/repositories'
import { transactionRepository, projectRepository } from '@/lib/repositories'
import { clientStatusConfig, activeClientStatuses, formatDate, formatCurrency, specialties } from '@/lib/utils'
import { Client, ClientStatus } from '@/types'
import type { ProjectType } from '@/types'

const statusOptions: { value: ClientStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...activeClientStatuses.map(s => ({ value: s, label: clientStatusConfig[s].label })),
]

function detectPaymentMode(client: Client): '' | '50%' | '100%' {
  if (!client.total_value || !client.paid_value) return ''
  const ratio = client.paid_value / client.total_value
  if (Math.abs(ratio - 1) < 0.01) return '100%'
  if (Math.abs(ratio - 0.5) < 0.01) return '50%'
  return ''
}

function computePaidValue(mode: '' | '50%' | '100%', total: number | null, custom: string): number | null {
  if (mode === '100%') return total
  if (mode === '50%') return total != null ? total * 0.5 : null
  return custom ? parseFloat(custom) : null
}

const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: 'site',    label: 'Site' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'outro',   label: 'Outro' },
]

const emptyForm = {
  name: '', specialty: '', email: '', whatsapp: '',
  status: 'prospecto' as ClientStatus, notes: '',
  closed_at: '', delivery_date: '',
  total_value: '',
  payment_mode: '' as '' | '50%' | '100%',
  custom_paid_value: '',
  domain_included: false,
  project_type: 'site' as ProjectType,
  responsible: 'isaac' as 'isaac' | 'vinicius',
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

  const filtered = useMemo(() => {
    const lower = search.toLowerCase()
    return clients.filter(c => {
      const matchSearch = (c.name ?? '').toLowerCase().includes(lower) ||
        (c.specialty ?? '').toLowerCase().includes(lower) ||
        (c.email ?? '').toLowerCase().includes(lower)
      const matchStatus = statusFilter === 'todos' || c.status === statusFilter
      const matchSpec = specialtyFilter === 'todas' || c.specialty === specialtyFilter
      return matchSearch && matchStatus && matchSpec
    })
  }, [clients, search, statusFilter, specialtyFilter])

  const statusCounts = useMemo(() =>
    clients.reduce(
      (acc, c) => { acc.todos++; if (c.status in acc) acc[c.status as ClientStatus]++; return acc },
      { todos: 0, prospecto: 0, ativo: 0, inativo: 0, churned: 0 } as Record<ClientStatus | 'todos', number>
    ),
  [clients])

  function handleOpenModal() {
    setEditingClient(null)
    setForm(emptyForm)
    setSaveError('')
    setContractFile(null)
    setShowModal(true)
  }

  async function handleOpenEdit(client: Client) {
    setEditingClient(client)
    const detectedMode = detectPaymentMode(client)

    // Load project to pre-fill type and responsible
    const db = createClient()
    const { data: projects } = await db
      .from('projects')
      .select('type, responsible')
      .eq('client_id', client.id)
      .order('created_at')
      .limit(1)
    const proj = projects?.[0]

    setForm({
      name: client.name,
      specialty: client.specialty,
      email: client.email ?? '',
      whatsapp: client.whatsapp,
      status: client.status,
      notes: client.notes ?? '',
      closed_at: client.closed_at ?? '',
      delivery_date: client.delivery_date ?? '',
      total_value: client.total_value != null ? String(client.total_value) : '',
      payment_mode: detectedMode,
      custom_paid_value: detectedMode === '' && client.paid_value ? String(client.paid_value) : '',
      domain_included: client.domain_included ?? false,
      project_type: (proj?.type as ProjectType) ?? 'site',
      responsible: (proj?.responsible as 'isaac' | 'vinicius') ?? 'isaac',
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

  const { computedPaid, pendingAmount } = useMemo(() => {
    const total = parseFloat(form.total_value) || 0
    const paid = computePaidValue(form.payment_mode, total, form.custom_paid_value) ?? 0
    return { computedPaid: paid, pendingAmount: Math.max(0, total - paid) }
  }, [form.total_value, form.payment_mode, form.custom_paid_value])

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const db = createClient()
      const repo = clientRepository(db)
      const totalVal = form.total_value ? parseFloat(form.total_value) : null
      const paidVal = computePaidValue(form.payment_mode, totalVal, form.custom_paid_value)
      const payload: ClientInput = {
        name: form.name,
        specialty: form.specialty,
        email: form.email,
        whatsapp: form.whatsapp,
        status: form.status,
        notes: form.notes || undefined,
        closed_at: form.closed_at || null,
        delivery_date: form.delivery_date || null,
        total_value: totalVal,
        paid_value: paidVal,
        domain_included: form.domain_included,
      }

      let contractUrl: string | null = null
      if (contractFile) {
        contractUrl = await repo.uploadContract(contractFile)
      }

      const fullPayload = contractUrl ? { ...payload, contract_url: contractUrl } : payload

      const wasNotDomain = !editingClient?.domain_included
      let savedClient: typeof editingClient
      if (editingClient) {
        const data = await repo.update(editingClient.id, fullPayload)
        savedClient = data
        setClients(prev => prev.map(c => c.id === editingClient.id ? data : c))
        setToast(`${data.name} atualizado com sucesso!`)
      } else {
        const data = await repo.create(fullPayload)
        savedClient = data
        setClients(prev => [data, ...prev])
        setToast(`${data.name} adicionado com sucesso!`)
      }

      // ── Domínio ──────────────────────────────────────────────────────────
      const txRepo = transactionRepository(db)
      if (form.domain_included && wasNotDomain) {
        await txRepo.create({
          type: 'saida',
          category: 'dominio',
          description: `Domínio - ${form.name}`,
          amount: 40,
          date: new Date().toISOString().split('T')[0],
        })
      }

      // ── Projeto (sempre cria ou atualiza) ────────────────────────────────
      const projRepo = projectRepository(db)
      const today = new Date().toISOString().split('T')[0]
      const deadline30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      const projectBase = {
        client_id: savedClient!.id,
        name: form.name,
        type: form.project_type,
        responsible: form.responsible,
        start_date: form.closed_at || today,
        deadline: form.delivery_date || deadline30,
        notes: form.notes || null,
      }

      const { data: existingProjs } = await db
        .from('projects')
        .select('id, status')
        .eq('client_id', savedClient!.id)
        .order('created_at')
        .limit(1)

      if (existingProjs && existingProjs.length > 0) {
        // Update preserving the project status (don't reset to briefing)
        await projRepo.update(existingProjs[0].id, projectBase)
      } else {
        await projRepo.create({ ...projectBase, status: 'briefing' })
      }

      // ── Transação de recebimento (só clientes ativos com valor pago) ──────
      if (form.status === 'ativo' && paidVal && paidVal > 0) {
        const txDate = form.closed_at || today
        const txPayload = {
          type: 'entrada' as const,
          category: 'clientes' as const,
          description: `Recebimento - ${form.name}`,
          amount: paidVal,
          date: txDate,
          client_id: savedClient!.id,
        }
        const existing = await txRepo.findClientReceipt(savedClient!.id)
        if (existing) {
          await txRepo.update(existing.id, txPayload)
        } else {
          await txRepo.create(txPayload)
        }
      }
      setForm(emptyForm)
      setContractFile(null)
      setEditingClient(null)
      setShowModal(false)
    } catch (err: unknown) {
      console.error('Erro ao salvar cliente:', err)
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err)
      setSaveError(msg || 'Erro desconhecido ao salvar.')
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
          <div className="flex gap-1.5 bg-gray-100 dark:bg-[#111114] rounded-lg p-1 w-fit">
            {statusOptions.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  statusFilter === value
                    ? 'bg-white dark:bg-[#181819] text-gray-900 dark:text-[#F8FBF9] shadow-sm'
                    : 'text-gray-500 dark:text-[#006620] hover:text-gray-700 dark:hover:text-[#00a02a]'
                }`}
              >
                {label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                  statusFilter === value
                    ? 'bg-[#00FF41]/10 text-[#00FF41] dark:text-[#00FF41]'
                    : 'bg-gray-200 dark:bg-[#181819] text-gray-500 dark:text-[#006620]'
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
                            <div className="w-8 h-8 rounded-full bg-[#00FF41]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[13px] font-semibold text-[#00FF41]">{client.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px]">{client.name}</p>
                              {client.email && <p className="text-[11px] text-gray-400 dark:text-[#006620]">{client.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td><span className="text-[13px] text-gray-600 dark:text-[#00a02a]">{client.specialty}</span></td>
                        <td>
                          <div className="flex items-center gap-2">
                            {client.whatsapp && (
                              <a href={`https://wa.me/55${client.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                                className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-400 dark:text-[#006620] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <Phone size={13} />
                              </a>
                            )}
                            {client.email && (
                              <a href={`mailto:${client.email}`} aria-label="Email"
                                className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 dark:text-[#006620] hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                <Mail size={13} />
                              </a>
                            )}
                            {client.instagram && (
                              <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                                className="p-1.5 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 dark:text-[#006620] hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                                <Instagram size={13} />
                              </a>
                            )}
                            {client.website && (
                              <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" aria-label="Site"
                                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#181819] text-gray-400 dark:text-[#006620] hover:text-gray-600 dark:hover:text-[#00a02a] transition-colors">
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
                          <span className="text-[12px] text-gray-400 dark:text-[#006620]">
                            {client.closed_at ? formatDate(client.closed_at) : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-[12px] text-gray-400 dark:text-[#006620]">
                            {client.delivery_date ? formatDate(client.delivery_date) : '—'}
                          </span>
                        </td>
                        <td>
                          {hasPaymentData ? (
                            <div className="space-y-0.5">
                              <p className="text-[11px] text-gray-500 dark:text-[#00a02a]">
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
                            <span className="text-[12px] text-gray-300 dark:text-[#28282d]">—</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(client)}
                              aria-label="Editar"
                              className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 dark:text-[#006620] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModal(client)}
                              aria-label="Remover"
                              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-[#006620] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                            <Link href={`/dashboard/clientes/${client.id}`} aria-label="Ver perfil"
                              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#181819] text-gray-400 dark:text-[#006620] hover:text-gray-600 dark:hover:text-[#00a02a] transition-colors inline-flex cursor-pointer">
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
                {activeClientStatuses.map(s => (
                  <option key={s} value={s}>{clientStatusConfig[s].label}</option>
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
              <label htmlFor="cli-closed-at" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data de fechamento</label>
              <input id="cli-closed-at" type="date" className="input-field" value={form.closed_at} onChange={set('closed_at')} />
            </div>

            <div>
              <label htmlFor="cli-delivery" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data de entrega</label>
              <input id="cli-delivery" type="date" className="input-field" value={form.delivery_date} onChange={set('delivery_date')} />
            </div>

            {/* ── Projeto ───────────────────────────────────────────────── */}
            <div className="col-span-2">
              <div className="h-px bg-gray-100 dark:bg-[#181819] mb-4" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#006620] mb-3">Projeto</p>
            </div>

            <div>
              <label htmlFor="cli-proj-type" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo de projeto *</label>
              <select id="cli-proj-type" className="input-field cursor-pointer" value={form.project_type} onChange={set('project_type')}>
                {PROJECT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cli-responsible" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Responsável *</label>
              <select id="cli-responsible" className="input-field cursor-pointer" value={form.responsible} onChange={set('responsible')}>
                <option value="isaac">Isaac</option>
                <option value="vinicius">Vinicius</option>
              </select>
            </div>

            {/* ── Financeiro do cliente ──────────────────────────────────── */}
            <div className="col-span-2">
              <div className="h-px bg-gray-100 dark:bg-[#181819] mb-4" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#006620] mb-3">Financeiro do contrato</p>
            </div>

            <div>
              <label htmlFor="cli-total" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Total da venda (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#006620] text-sm font-medium select-none">R$</span>
                <input id="cli-total" type="number" className="input-field pl-10" placeholder="0,00" min="0" step="0.01" value={form.total_value} onChange={set('total_value')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Forma de pagamento</label>
              <div className="flex rounded-xl border border-gray-200 dark:border-[#28282d] overflow-hidden">
                {([
                  { value: '', label: 'Personalizado' },
                  { value: '50%', label: '50% (entrada)' },
                  { value: '100%', label: 'Total (100%)' },
                ] as { value: '' | '50%' | '100%'; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: opt.value, custom_paid_value: '' }))}
                    className={`flex-1 py-2.5 text-[12px] font-semibold transition-all cursor-pointer ${
                      form.payment_mode === opt.value
                        ? opt.value === '100%'
                          ? 'bg-[#00FF41] dark:bg-[#003810] text-white'
                          : opt.value === '50%'
                          ? 'bg-amber-500 dark:bg-amber-600 text-white'
                          : 'bg-blue-500 dark:bg-blue-600 text-white'
                        : 'bg-white dark:bg-[#111114] text-gray-400 dark:text-[#006620] hover:bg-gray-50 dark:hover:bg-[#181819]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Campo livre de valor pago (modo Personalizado) */}
            {form.payment_mode === '' && parseFloat(form.total_value) > 0 && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Valor já pago (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#006620] text-sm font-medium select-none">R$</span>
                  <input
                    type="number"
                    className="input-field pl-10"
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                    value={form.custom_paid_value}
                    onChange={e => setForm(f => ({ ...f, custom_paid_value: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Resumo financeiro */}
            {parseFloat(form.total_value) > 0 && (form.payment_mode !== '' || parseFloat(form.custom_paid_value) > 0) && (
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

            {/* Domínio incluso */}
            <div className="col-span-2">
              <div className="h-px bg-gray-100 dark:bg-[#181819] mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-[#A7C4AF]">Domínio incluso</p>
                  <p className="text-[11px] text-gray-400 dark:text-[#006620] mt-0.5">Gera saída de R$40 automaticamente</p>
                </div>
                <div className="flex rounded-lg border border-gray-200 dark:border-[#28282d] overflow-hidden">
                  {([{ v: false, l: 'Não' }, { v: true, l: 'Sim' }] as { v: boolean; l: string }[]).map(opt => (
                    <button
                      key={String(opt.v)}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, domain_included: opt.v }))}
                      className={`px-4 py-2 text-[12px] font-semibold transition-all cursor-pointer ${
                        form.domain_included === opt.v
                          ? opt.v
                            ? 'bg-[#00FF41] dark:bg-[#003810] text-white'
                            : 'bg-gray-200 dark:bg-[#28282d] text-gray-700 dark:text-[#D1FAE5]'
                          : 'bg-white dark:bg-[#111114] text-gray-400 dark:text-[#006620] hover:bg-gray-50 dark:hover:bg-[#181819]'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Contrato ──────────────────────────────────────────────── */}
            <div className="col-span-2">
              <div className="h-px bg-gray-100 dark:bg-[#181819] mb-4" />
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Contrato (anexo)</label>
              {contractFile ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#00FF41]/40 bg-[#00FF41]/5">
                  <FileCheck size={16} className="text-[#00FF41] flex-shrink-0" />
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
                <label className="flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed border-gray-200 dark:border-[#28282d] hover:border-[#00FF41]/50 hover:bg-[#00FF41]/5 transition-colors cursor-pointer">
                  <Paperclip size={18} className="text-gray-400" />
                  <div className="text-center">
                    <span className="text-[13px] font-medium text-[#00FF41] dark:text-[#00FF41]">Clique para anexar</span>
                    <p className="text-[11px] text-gray-400 dark:text-[#006620] mt-0.5">PDF, DOC, DOCX — até 10MB</p>
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
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
