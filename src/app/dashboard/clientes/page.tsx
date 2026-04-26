'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Search, Plus, Phone, Mail, Instagram, ExternalLink, ChevronRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientStatusConfig, formatDate, specialties } from '@/lib/utils'
import { Client, ClientStatus } from '@/types'

const statusOptions: { value: ClientStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...Object.entries(clientStatusConfig).map(([value, { label }]) => ({ value: value as ClientStatus, label })),
]

const emptyForm = {
  name: '', specialty: '', email: '', whatsapp: '',
  instagram: '', website: '', status: 'prospecto' as ClientStatus, notes: '',
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
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false })
        if (!error && data) setClients(data)
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

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('clients')
        .insert([form])
        .select()
        .single()
      if (error) throw error
      setClients(prev => [data, ...prev])
      setForm(emptyForm)
      setShowModal(false)
      setToast(`${data.name} adicionado com sucesso!`)
    } catch (err) {
      console.error('Erro ao salvar cliente:', err)
      setSaveError('Erro ao salvar. Verifique as credenciais do Supabase.')
    } finally {
      setSaving(false)
    }
  }, [form])

  function handleOpenModal() {
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  return (
    <div>
      <Header
        title="Clientes"
        subtitle={loading ? 'Carregando...' : `${filtered.length} cliente${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
      />

      <div className="p-6 space-y-5">
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
        <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1 w-fit">
          {statusOptions.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                statusFilter === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                statusFilter === value ? 'bg-[#40916C]/10 text-[#40916C]' : 'bg-gray-200 text-gray-500'
              }`}>
                {statusCounts[value]}
              </span>
            </button>
          ))}
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
                  <th>Desde</th>
                  <th aria-label="Ações"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      {clients.length === 0 ? 'Nenhum cliente cadastrado ainda' : 'Nenhum cliente encontrado'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(client => (
                    <tr key={client.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#40916C]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[13px] font-semibold text-[#40916C]">{client.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-[13px]">{client.name}</p>
                            {client.email && <p className="text-[11px] text-gray-400">{client.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td><span className="text-[13px] text-gray-600">{client.specialty}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          {client.whatsapp && (
                            <a href={`https://wa.me/55${client.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                              className="p-1.5 rounded-md hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors">
                              <Phone size={13} />
                            </a>
                          )}
                          {client.email && (
                            <a href={`mailto:${client.email}`} aria-label="Email"
                              className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                              <Mail size={13} />
                            </a>
                          )}
                          {client.instagram && (
                            <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                              className="p-1.5 rounded-md hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors">
                              <Instagram size={13} />
                            </a>
                          )}
                          {client.website && (
                            <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" aria-label="Site"
                              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
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
                      <td><span className="text-[12px] text-gray-400">{formatDate(client.created_at)}</span></td>
                      <td>
                        <Link href={`/dashboard/clientes/${client.id}`} aria-label="Ver perfil"
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors inline-flex cursor-pointer">
                          <ChevronRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* New client modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Cliente" size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo / Razão social *</label>
              <input className="input-field" placeholder="Dr. Nome Sobrenome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Especialidade *</label>
              <select className="input-field cursor-pointer" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} required aria-label="Especialidade">
                <option value="">Selecione...</option>
                {specialties.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select className="input-field cursor-pointer" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ClientStatus }))} aria-label="Status">
                {Object.entries(clientStatusConfig).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
              <input type="email" className="input-field" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp *</label>
              <input className="input-field" placeholder="11999990000" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Instagram</label>
              <input className="input-field" placeholder="@perfil" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Site</label>
              <input className="input-field" placeholder="seusite.com.br" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações internas</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Notas privadas sobre o cliente..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{saveError}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar cliente</Button>
          </div>
        </form>
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
