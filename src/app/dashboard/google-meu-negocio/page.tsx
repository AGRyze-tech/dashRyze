'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { TableSetupNotice } from '@/components/ui/TableSetupNotice'
import {
  MapPin, Plus, Pencil, Trash2, CheckCircle2, Star, ExternalLink, Clock, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientRepository } from '@/lib/repositories'
import { useToast } from '@/hooks/useToast'
import type { GmbProfile, GmbStatus, Client } from '@/types'

const statusConfig: Record<GmbStatus, { label: string; color: 'green' | 'yellow' | 'red' | 'blue' }> = {
  verificado: { label: 'Verificado', color: 'green' },
  ativo:      { label: 'Ativo',      color: 'blue' },
  pendente:   { label: 'Pendente',   color: 'yellow' },
  suspenso:   { label: 'Suspenso',   color: 'red' },
}

const SQL_CREATE = `create table if not exists gmb_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  client_name text not null,
  business_name text not null,
  google_url text,
  category text,
  phone text,
  address text,
  rating numeric(2,1),
  total_reviews int,
  status text not null default 'ativo'
    check (status in ('ativo','pendente','verificado','suspenso')),
  notes text,
  created_at timestamptz default now()
);
alter table gmb_profiles enable row level security;
create policy "allow all" on gmb_profiles
  for all using (true) with check (true);`

const emptyForm = {
  client_id: '',
  client_name: '',
  business_name: '',
  google_url: '',
  category: '',
  phone: '',
  address: '',
  rating: '',
  total_reviews: '',
  status: 'ativo' as GmbStatus,
  notes: '',
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          className={i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-[#28282d]'}
        />
      ))}
      <span className="ml-1 text-[11px] font-semibold text-gray-600 dark:text-[#A7C4AF]">{rating.toFixed(1)}</span>
    </span>
  )
}

export default function GoogleMeuNegocioPage() {
  const [profiles, setProfiles] = useState<GmbProfile[]>([])
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name' | 'specialty'>[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<GmbProfile | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<GmbProfile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()
  const db = useMemo(() => createClient(), [])
  const clientRepo = useMemo(() => clientRepository(db), [db])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db
        .from('gmb_profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01') { setTableExists(false); return }
        throw error
      }
      setProfiles((data ?? []) as GmbProfile[])
    } finally {
      setLoading(false)
    }
  }, [db])

  useEffect(() => {
    clientRepo.findForSelect()
      .then(data => setClients(data))
      .catch(err => console.error('Erro ao carregar clientes:', err))
    load()
  }, [load, clientRepo])

  const stats = useMemo(() => {
    let verificados = 0, totalRating = 0, ratingCount = 0
    for (const p of profiles) {
      if (p.status === 'verificado') verificados++
      if (p.rating != null) { totalRating += p.rating; ratingCount++ }
    }
    return {
      total: profiles.length,
      verificados,
      avgRating: ratingCount > 0 ? totalRating / ratingCount : null,
    }
  }, [profiles])

  function handleOpenModal() {
    setEditing(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  function handleOpenEdit(p: GmbProfile) {
    setEditing(p)
    setForm({
      client_id: p.client_id ?? '',
      client_name: p.client_name,
      business_name: p.business_name,
      google_url: p.google_url ?? '',
      category: p.category ?? '',
      phone: p.phone ?? '',
      address: p.address ?? '',
      rating: p.rating != null ? String(p.rating) : '',
      total_reviews: p.total_reviews != null ? String(p.total_reviews) : '',
      status: p.status,
      notes: p.notes ?? '',
    })
    setSaveError('')
    setShowModal(true)
  }

  const set = (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const clientNameFinal = form.client_name.trim()
    if (!clientNameFinal) { setSaveError('Cliente é obrigatório.'); return }
    if (!form.business_name.trim()) { setSaveError('Nome do perfil é obrigatório.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        client_id: form.client_id || null,
        client_name: clientNameFinal,
        business_name: form.business_name.trim(),
        google_url: form.google_url.trim() || null,
        category: form.category.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        rating: form.rating ? parseFloat(form.rating) : null,
        total_reviews: form.total_reviews ? parseInt(form.total_reviews) : null,
        status: form.status,
        notes: form.notes.trim() || null,
      }

      if (editing) {
        const { data, error } = await db.from('gmb_profiles').update(payload).eq('id', editing.id).select().single()
        if (error) throw error
        setProfiles(prev => prev.map(p => p.id === editing.id ? (data as GmbProfile) : p))
        showToast('Perfil atualizado!')
      } else {
        const { data, error } = await db.from('gmb_profiles').insert([payload]).select().single()
        if (error) throw error
        setProfiles(prev => [data as GmbProfile, ...prev])
        showToast('Perfil adicionado!')
      }
      setShowModal(false)
      setEditing(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message) : 'Erro ao salvar.'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const { error } = await db.from('gmb_profiles').delete().eq('id', deleteModal.id)
      if (error) throw error
      setProfiles(prev => prev.filter(p => p.id !== deleteModal.id))
      showToast('Perfil removido.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!tableExists) {
    return (
      <TableSetupNotice
        title="Google Meu Negócio"
        subtitle="Perfis GMB dos clientes"
        icon={MapPin}
        iconBgClass="bg-amber-50 dark:bg-amber-900/20"
        iconColorClass="text-amber-500 dark:text-amber-400"
        sql={SQL_CREATE}
      />
    )
  }

  return (
    <div>
      <Header title="Google Meu Negócio" subtitle="Perfis GMB dos clientes" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-3">
              <MapPin size={16} className="text-amber-600 dark:text-amber-400" />
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
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Verificados</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-[#00FF41]">{stats.verificados}</p>
            )}
          </div>

          <div className="stat-card p-5 col-span-2 xl:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-3">
              <Star size={16} className="text-amber-500 fill-amber-500" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Avaliação média</p>
            {loading ? <Skeleton className="h-7 w-16" /> : (
              <p className="text-[28px] font-bold leading-none text-amber-600 dark:text-amber-400">
                {stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
              </p>
            )}
          </div>
        </div>

        {/* List */}
        <div className="card-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Perfis</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                {profiles.length} perfil{profiles.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button size="sm" onClick={handleOpenModal}><Plus size={13} /> Adicionar</Button>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50 dark:divide-[#181819]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center mb-3">
                <MapPin size={18} className="text-gray-300 dark:text-[#00a02a]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]">Nenhum perfil cadastrado</p>
              <p className="text-[12px] text-gray-300 dark:text-[#00a02a] mt-0.5">Clique em &quot;Adicionar&quot; para começar</p>
            </div>
          ) : (
            <div>
              {profiles.map(p => {
                const sCfg = statusConfig[p.status]
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 dark:border-[#181819] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#111114] transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                      <MapPin size={15} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{p.business_name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#00a02a] truncate">
                        {p.client_name}
                        {p.category ? ` · ${p.category}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 hidden sm:block">
                      {p.rating != null ? (
                        <StarRating rating={p.rating} />
                      ) : (
                        <span className="text-[11px] text-gray-300 dark:text-[#28282d]">sem avaliação</span>
                      )}
                      {p.total_reviews != null && (
                        <p className="text-[10px] text-gray-400 dark:text-[#00a02a] mt-0.5 text-right">{p.total_reviews} avaliações</p>
                      )}
                    </div>
                    <Badge color={sCfg.color}>{sCfg.label}</Badge>
                    {p.google_url && (
                      <a
                        href={p.google_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Abrir no Google"
                        className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors flex-shrink-0"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        aria-label="Editar"
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-[#00FF41]/10 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-[#00FF41] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModal(p)}
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

      {/* Add/Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? 'Editar Perfil GMB' : 'Novo Perfil GMB'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliente *</label>
              <select
                className="input-field"
                value={form.client_id}
                onChange={e => {
                  const id = e.target.value
                  const client = clients.find(c => c.id === id)
                  setForm(f => ({ ...f, client_id: id, client_name: client?.name ?? '' }))
                }}
              >
                <option value="">Selecionar cliente...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!form.client_id && (
                <input
                  className="input-field mt-2"
                  placeholder="Ou digitar o nome manualmente"
                  value={form.client_name}
                  onChange={set('client_name')}
                />
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nome do perfil no Google *</label>
              <input
                className="input-field"
                placeholder="Nome exato do estabelecimento no GMB"
                value={form.business_name}
                onChange={set('business_name')}
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Categoria</label>
              <input
                className="input-field"
                placeholder="Ex: Clínica médica, Nutricionista..."
                value={form.category}
                onChange={set('category')}
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
              <select className="input-field" value={form.status} onChange={set('status')}>
                <option value="ativo">Ativo</option>
                <option value="verificado">Verificado</option>
                <option value="pendente">Pendente</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Avaliação (0–5)</label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                className="input-field"
                placeholder="4.8"
                value={form.rating}
                onChange={set('rating')}
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nº de avaliações</label>
              <input
                type="number"
                min="0"
                className="input-field"
                placeholder="152"
                value={form.total_reviews}
                onChange={set('total_reviews')}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Link do Google</label>
              <input
                className="input-field"
                placeholder="https://maps.google.com/..."
                value={form.google_url}
                onChange={set('google_url')}
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Telefone</label>
              <input className="input-field" placeholder="(11) 99999-9999" value={form.phone} onChange={set('phone')} />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Endereço</label>
              <input className="input-field" placeholder="Cidade, Estado" value={form.address} onChange={set('address')} />
            </div>

            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="Senhas de acesso, pendências, notas..."
                value={form.notes}
                onChange={set('notes')}
              />
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowModal(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editing ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Perfil" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover o perfil{' '}
              <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.business_name}</strong>?
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

      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#111114] dark:border dark:border-[#28282d] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
