'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { TableSetupNotice } from '@/components/ui/TableSetupNotice'
import {
  Receipt, Plus, Pencil, Trash2, CheckCircle2, XCircle, Upload, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientRepository } from '@/lib/repositories'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import type { PaymentProof, Client } from '@/types'

const SQL_CREATE = `create table if not exists payment_proofs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  client_name text not null,
  name text not null,
  description text,
  amount numeric(10,2) not null default 0,
  payment_date date,
  start_file_url text,
  start_file_name text,
  end_file_url text,
  end_file_name text,
  notes text,
  created_at timestamptz default now()
);
alter table payment_proofs enable row level security;
create policy "allow all" on payment_proofs
  for all using (true) with check (true);`

const emptyForm = {
  client_id: '',
  client_name: '',
  name: '',
  description: '',
  amount: '',
  payment_date: '',
  notes: '',
}

function ProofBlock({
  label, url, uploading,
}: { label: string; url?: string | null; uploading?: boolean }) {
  const hasFile = !!url
  if (uploading) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-gray-100 dark:bg-[#181819] text-gray-400 animate-pulse">
        <Upload size={11} />
        {label}
      </span>
    )
  }
  if (hasFile) {
    return (
      <a
        href={url!}
        target="_blank"
        rel="noopener noreferrer"
        title={`Abrir comprovante de ${label}`}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <CheckCircle2 size={11} />
        {label}
      </a>
    )
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400">
      <XCircle size={11} />
      {label}
    </span>
  )
}

function FileInput({
  id, label, file, existingName, onChange, onClear,
}: {
  id: string
  label: string
  file: File | null
  existingName?: string | null
  onChange: (f: File | null) => void
  onClear: () => void
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">{label}</label>
      <input
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        id={id}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <label
        htmlFor={id}
        className="flex items-center gap-3 input-field cursor-pointer hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors"
      >
        <Upload size={14} className="text-gray-400 flex-shrink-0" />
        <span className={`text-sm truncate flex-1 ${file ? 'text-gray-800 dark:text-[#D1FAE5]' : 'text-gray-400'}`}>
          {file ? file.name : existingName ? `Atual: ${existingName}` : 'Selecionar imagem ou PDF'}
        </span>
        {file && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); onClear() }}
            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        )}
      </label>
      {existingName && !file && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
          <CheckCircle2 size={10} /> Arquivo já anexado
        </p>
      )}
    </div>
  )
}

export default function ComprovantePage() {
  const [proofs, setProofs] = useState<PaymentProof[]>([])
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name' | 'specialty'>[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PaymentProof | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [startFile, setStartFile] = useState<File | null>(null)
  const [endFile, setEndFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<PaymentProof | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()
  const db = useMemo(() => createClient(), [])
  const clientRepo = useMemo(() => clientRepository(db), [db])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db
        .from('payment_proofs')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01') { setTableExists(false); return }
        throw error
      }
      setProofs((data ?? []) as PaymentProof[])
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
    let total = 0, completos = 0
    for (const p of proofs) {
      total += p.amount
      if (p.start_file_url && p.end_file_url) completos++
    }
    return { count: proofs.length, total, completos, pendentes: proofs.length - completos }
  }, [proofs])

  function handleOpenModal() {
    setEditing(null)
    setForm({ ...emptyForm, payment_date: new Date().toISOString().split('T')[0] })
    setStartFile(null)
    setEndFile(null)
    setSaveError('')
    setShowModal(true)
  }

  function handleOpenEdit(p: PaymentProof) {
    setEditing(p)
    setForm({
      client_id: p.client_id ?? '',
      client_name: p.client_name,
      name: p.name,
      description: p.description ?? '',
      amount: p.amount > 0 ? String(p.amount) : '',
      payment_date: p.payment_date ?? '',
      notes: p.notes ?? '',
    })
    setStartFile(null)
    setEndFile(null)
    setSaveError('')
    setShowModal(true)
  }

  const set = (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  async function uploadFile(file: File, prefix: string): Promise<{ url: string; name: string }> {
    const path = `comprovantes/${prefix}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    const { error } = await db.storage.from('clientes').upload(path, file)
    if (error) throw error
    const { data: { publicUrl } } = db.storage.from('clientes').getPublicUrl(path)
    return { url: publicUrl, name: file.name }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const clientNameFinal = form.client_name.trim()
    if (!clientNameFinal) { setSaveError('Cliente é obrigatório.'); return }
    if (!form.name.trim()) { setSaveError('Nome é obrigatório.'); return }
    setSaving(true)
    setSaveError('')
    try {
      let start_file_url = editing?.start_file_url ?? null
      let start_file_name = editing?.start_file_name ?? null
      let end_file_url = editing?.end_file_url ?? null
      let end_file_name = editing?.end_file_name ?? null

      const [startResult, endResult] = await Promise.all([
        startFile ? uploadFile(startFile, 'inicio') : Promise.resolve(null),
        endFile ? uploadFile(endFile, 'finalizacao') : Promise.resolve(null),
      ])
      if (startResult) { start_file_url = startResult.url; start_file_name = startResult.name }
      if (endResult) { end_file_url = endResult.url; end_file_name = endResult.name }

      const payload = {
        client_id: form.client_id || null,
        client_name: clientNameFinal,
        name: form.name.trim(),
        description: form.description.trim() || null,
        amount: parseFloat(form.amount) || 0,
        payment_date: form.payment_date || null,
        start_file_url,
        start_file_name,
        end_file_url,
        end_file_name,
        notes: form.notes.trim() || null,
      }

      if (editing) {
        const { data, error } = await db.from('payment_proofs').update(payload).eq('id', editing.id).select().single()
        if (error) throw error
        setProofs(prev => prev.map(p => p.id === editing.id ? (data as PaymentProof) : p))
        showToast('Comprovante atualizado!')
      } else {
        const { data, error } = await db.from('payment_proofs').insert([payload]).select().single()
        if (error) throw error
        setProofs(prev => [data as PaymentProof, ...prev])
        showToast('Comprovante adicionado!')
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
      const { error } = await db.from('payment_proofs').delete().eq('id', deleteModal.id)
      if (error) throw error
      setProofs(prev => prev.filter(p => p.id !== deleteModal.id))
      showToast('Comprovante removido.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!tableExists) {
    return (
      <TableSetupNotice
        title="Comprovantes"
        subtitle="Comprovantes de início e finalização dos clientes"
        icon={Receipt}
        sql={SQL_CREATE}
      />
    )
  }

  return (
    <div>
      <Header title="Comprovantes" subtitle="Comprovantes de início e finalização dos clientes" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center mb-3">
              <Receipt size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Total</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{stats.count}</p>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-[#00FF41]/10 dark:bg-[#00FF41]/20 flex items-center justify-center mb-3">
              <CheckCircle2 size={16} className="text-[#00FF41]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Completos</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-[#00FF41]">{stats.completos}</p>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/25 flex items-center justify-center mb-3">
              <XCircle size={16} className="text-red-500 dark:text-red-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Pendentes</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className={`text-[28px] font-bold leading-none ${stats.pendentes > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-[#F0FDF4]'}`}>
                {stats.pendentes}
              </p>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 flex items-center justify-center mb-3">
              <Receipt size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Valor total</p>
            {loading ? <Skeleton className="h-7 w-24" /> : (
              <p className="text-[20px] font-bold leading-none text-emerald-700 dark:text-emerald-400">{formatCurrency(stats.total)}</p>
            )}
          </div>
        </div>

        {/* List */}
        <div className="card-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Registros</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                {proofs.length} comprovante{proofs.length !== 1 ? 's' : ''}
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
                  <Skeleton className="h-6 w-16 rounded-lg" />
                  <Skeleton className="h-6 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          ) : proofs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center mb-3">
                <Receipt size={18} className="text-gray-300 dark:text-[#00a02a]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]">Nenhum comprovante registrado</p>
              <p className="text-[12px] text-gray-300 dark:text-[#00a02a] mt-0.5">Clique em &quot;Adicionar&quot; para começar</p>
            </div>
          ) : (
            <div>
              {proofs.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 dark:border-[#181819] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#111114] transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                    <Receipt size={15} className="text-blue-600 dark:text-blue-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-[#00a02a] truncate">
                      {p.client_name}
                      {p.amount > 0 ? ` · ${formatCurrency(p.amount)}` : ''}
                      {p.payment_date ? ` · ${formatDate(p.payment_date)}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ProofBlock label="Início" url={p.start_file_url} />
                    <ProofBlock label="Finalização" url={p.end_file_url} />
                  </div>

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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? 'Editar Comprovante' : 'Novo Comprovante'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nome *</label>
              <input
                className="input-field"
                placeholder="Ex: Site Dra. Ana — Contrato 2025"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="proof-client" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliente *</label>
              <select
                id="proof-client"
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

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Valor (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field pl-10"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={set('amount')}
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data do pagamento</label>
              <input type="date" className="input-field" value={form.payment_date} onChange={set('payment_date')} />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Descrição</label>
              <input
                className="input-field"
                placeholder="Ex: Parcela 1, entrada..."
                value={form.description}
                onChange={set('description')}
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações</label>
              <input
                className="input-field"
                placeholder="Notas adicionais..."
                value={form.notes}
                onChange={set('notes')}
              />
            </div>

          </div>

          {/* File uploads */}
          <div className="pt-1 space-y-3 border-t border-gray-100 dark:border-[#181819]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Comprovantes</p>

            <FileInput
              id="start-file"
              label="Comprovante de Início"
              file={startFile}
              existingName={editing?.start_file_name}
              onChange={setStartFile}
              onClear={() => setStartFile(null)}
            />

            <FileInput
              id="end-file"
              label="Comprovante de Finalização"
              file={endFile}
              existingName={editing?.end_file_name}
              onChange={setEndFile}
              onClear={() => setEndFile(null)}
            />
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
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Comprovante" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.name}</strong>?
              Esta ação não pode ser desfeita.
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
