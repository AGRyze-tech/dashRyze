'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import {
  Calendar, Plus, CheckCircle2, Handshake,
  Trash2, Pencil, PhoneCall, ChevronDown, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Meeting, MeetingType, MeetingStatus } from '@/types'

const typeConfig: Record<MeetingType, { label: string; color: 'green' | 'blue' | 'purple'; icon: React.ElementType; bgClass: string; iconClass: string; activeClass: string }> = {
  reuniao:    { label: 'Reunião',    color: 'blue',   icon: Calendar,  bgClass: 'bg-blue-50 dark:bg-blue-900/25',        iconClass: 'text-blue-600 dark:text-blue-400',     activeClass: 'bg-blue-500 dark:bg-blue-600 text-white' },
  fechamento: { label: 'Fechamento', color: 'green',  icon: Handshake, bgClass: 'bg-[#32B86A]/10 dark:bg-[#32B86A]/20', iconClass: 'text-[#32B86A] dark:text-[#4EE88A]',   activeClass: 'bg-[#32B86A] dark:bg-[#1A5C35] text-white' },
  pos_call:   { label: 'Pós Call',   color: 'purple', icon: PhoneCall, bgClass: 'bg-purple-50 dark:bg-purple-900/20',    iconClass: 'text-purple-600 dark:text-purple-400', activeClass: 'bg-purple-500 dark:bg-purple-600 text-white' },
}

const statusConfig: Record<MeetingStatus, { label: string; selectClass: string }> = {
  agendada:  { label: 'Agendada',  selectClass: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  concluida: { label: 'Concluída', selectClass: 'bg-[#32B86A]/10 dark:bg-[#32B86A]/20 text-[#32B86A] dark:text-[#4EE88A] border-[#32B86A]/30 dark:border-[#32B86A]/40' },
  churned:   { label: 'Churned',   selectClass: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  no_show:   { label: 'No-show',   selectClass: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
}

const emptyForm = {
  client_name: '',
  date: new Date().toISOString().split('T')[0],
  scheduled_time: '',
  type: 'reuniao' as MeetingType,
  status: 'agendada' as MeetingStatus,
  notes: '',
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-[#252525] ${className}`} />
}

export default function ReunioesPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Meeting | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const db = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await db
          .from('meetings')
          .select('*')
          .order('date', { ascending: false })
        if (error) {
          if (error.code === '42P01') { setTableExists(false); return }
          throw error
        }
        setMeetings((data ?? []) as Meeting[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [db])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() =>
    meetings.filter(m => m.date.startsWith(monthFilter)),
    [meetings, monthFilter]
  )

  const { total, concluidas, fechamentos, churned, taxaNoShow } = useMemo(() => {
    let concluidas = 0, fechamentos = 0, churned = 0, noShows = 0
    for (const m of filtered) {
      if (m.status === 'concluida') concluidas++
      if (m.type === 'fechamento') fechamentos++
      if (m.status === 'churned') churned++
      if (m.status === 'no_show') noShows++
    }
    const taxaNoShow = filtered.length > 0 ? Math.round((noShows / filtered.length) * 100) : 0
    return { total: filtered.length, concluidas, fechamentos, churned, taxaNoShow }
  }, [filtered])

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      opts.push({ value, label })
    }
    return opts
  }, [])

  function handleOpenModal() {
    setEditingMeeting(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  function handleOpenEdit(m: Meeting) {
    setEditingMeeting(m)
    setForm({
      client_name: m.client_name,
      date: m.date,
      scheduled_time: m.scheduled_time ?? '',
      type: m.type,
      status: m.status,
      notes: m.notes ?? '',
    })
    setSaveError('')
    setShowModal(true)
  }

  const set = (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name.trim()) { setSaveError('Cliente é obrigatório.'); return }
    if (!form.date) { setSaveError('Data é obrigatória.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        client_name: form.client_name.trim(),
        date: form.date,
        scheduled_time: form.scheduled_time || null,
        type: form.type,
        status: form.status,
        notes: form.notes.trim() || null,
      }
      if (editingMeeting) {
        const { data, error } = await db.from('meetings').update(payload).eq('id', editingMeeting.id).select().single()
        if (error) throw error
        setMeetings(prev => prev.map(m => m.id === editingMeeting.id ? (data as Meeting) : m))
        setToast('Reunião atualizada!')
      } else {
        const { data, error } = await db.from('meetings').insert([payload]).select().single()
        if (error) throw error
        setMeetings(prev => [data as Meeting, ...prev])
        setToast('Reunião registrada!')
      }
      setShowModal(false)
      setEditingMeeting(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Erro ao salvar.'
      setSaveError(msg || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const { error } = await db.from('meetings').delete().eq('id', deleteModal.id)
      if (error) throw error
      setMeetings(prev => prev.filter(m => m.id !== deleteModal.id))
      setToast('Reunião removida.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusChange(meetingId: string, status: MeetingStatus) {
    const { data, error } = await db.from('meetings').update({ status }).eq('id', meetingId).select().single()
    if (error) return
    setMeetings(prev => prev.map(m => m.id === meetingId ? (data as Meeting) : m))
  }

  if (!tableExists) {
    return (
      <div>
        <Header title="Reuniões" subtitle="Gestão de reuniões e métricas de vendas" />
        <div className="p-4 sm:p-6">
          <div className="card-light p-8 flex flex-col items-center text-center gap-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Calendar size={20} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-800 dark:text-[#D1FAE5] mb-1">Tabela não encontrada</p>
              <p className="text-[13px] text-gray-500 dark:text-[#3E9E60]">
                Execute a migration abaixo no Supabase SQL Editor para ativar esta seção.
              </p>
            </div>
            <pre className="w-full text-left text-[11px] bg-gray-900 text-emerald-400 rounded-xl p-4 overflow-x-auto leading-relaxed">
{`create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text,
  client_name text not null default '',
  date date not null,
  scheduled_time time,
  type text not null check (
    type in ('reuniao', 'fechamento', 'pos_call')
  ),
  status text not null default 'agendada' check (
    status in ('agendada', 'concluida', 'churned', 'no_show')
  ),
  notes text,
  created_at timestamptz default now()
);
alter table meetings enable row level security;
create policy "allow all" on meetings
  for all using (true) with check (true);`}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Reuniões" subtitle="Gestão de reuniões e métricas de vendas" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="stat-card p-5 xl:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center mb-3">
              <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60] mb-1">Total</p>
            {loading ? <Skeleton className="h-7 w-12" /> : (
              <p className="text-[28px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{total}</p>
            )}
          </div>

          <div className="stat-card p-5 xl:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-[#32B86A]/10 dark:bg-[#32B86A]/20 flex items-center justify-center mb-3">
              <CheckCircle2 size={16} className="text-[#32B86A] dark:text-[#4EE88A]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60] mb-1">Concluídas</p>
            {loading ? <Skeleton className="h-7 w-12" /> : (
              <p className="text-[28px] font-bold leading-none text-[#32B86A] dark:text-[#4EE88A]">{concluidas}</p>
            )}
          </div>

          <div className="stat-card p-5 xl:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-[#32B86A]/10 dark:bg-[#32B86A]/20 flex items-center justify-center mb-3">
              <Handshake size={16} className="text-[#32B86A] dark:text-[#4EE88A]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60] mb-1">Fechamentos</p>
            {loading ? <Skeleton className="h-7 w-12" /> : (
              <p className="text-[28px] font-bold leading-none text-[#32B86A] dark:text-[#4EE88A]">{fechamentos}</p>
            )}
          </div>

          <div className="stat-card p-5 xl:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
              <XCircle size={16} className="text-red-500 dark:text-red-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60] mb-1">Churned</p>
            {loading ? <Skeleton className="h-7 w-12" /> : (
              <p className="text-[28px] font-bold leading-none text-red-600 dark:text-red-400">{churned}</p>
            )}
          </div>

          <div className="stat-card p-5 xl:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-3">
              <XCircle size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60] mb-1">Taxa No-show</p>
            {loading ? <Skeleton className="h-7 w-16" /> : (
              <p className="text-[28px] font-bold leading-none text-amber-700 dark:text-amber-300">{taxaNoShow}%</p>
            )}
          </div>
        </div>

        {/* ── Ledger ────────────────────────────────────────────────────── */}
        <div className="card-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#2a2a2a]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4d7a60]">Histórico</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="input-field w-auto py-1.5 text-[12px] cursor-pointer"
                aria-label="Filtrar por mês"
              >
                {monthOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleOpenModal}><Plus size={13} /> Registrar</Button>
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <Skeleton className="w-8 h-8 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#252525] flex items-center justify-center mb-3">
                <Calendar size={18} className="text-gray-300 dark:text-[#333333]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#4d7a60]">Nenhuma reunião neste mês</p>
              <p className="text-[12px] text-gray-300 dark:text-[#333333] mt-0.5">Clique em "Registrar" para adicionar</p>
            </div>
          ) : (
            <div>
              {filtered.map(m => {
                const cfg = typeConfig[m.type]
                const Icon = cfg.icon
                const sCfg = statusConfig[m.status]
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-[#2a2a2a] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#252525] transition-colors group">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bgClass}`}>
                      <Icon size={14} className={cfg.iconClass} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">
                        {m.client_name || '—'}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-[#4d7a60]">
                        {m.scheduled_time ? m.scheduled_time.slice(0, 5) : formatDate(m.date)}
                        {!m.scheduled_time && ''}
                        {m.scheduled_time && <span className="ml-1 opacity-70">· {formatDate(m.date)}</span>}
                        {m.notes && <span className="ml-1.5 opacity-70">· {m.notes}</span>}
                      </p>
                    </div>
                    <Badge color={cfg.color} dot={false}>{cfg.label}</Badge>
                    {/* Inline status select */}
                    <div className="relative flex-shrink-0">
                      <select
                        value={m.status}
                        onChange={e => handleStatusChange(m.id, e.target.value as MeetingStatus)}
                        className={`appearance-none text-[10px] font-semibold px-2 py-0.5 pr-5 rounded-full border cursor-pointer ${sCfg.selectClass}`}
                        aria-label="Status da reunião"
                      >
                        {(Object.entries(statusConfig) as [MeetingStatus, { label: string; selectClass: string }][]).map(([s, sc]) => (
                          <option key={s} value={s}>{sc.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(m)}
                        aria-label="Editar"
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-200 dark:text-[#2a2a2a] hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModal(m)}
                        aria-label="Remover"
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-200 dark:text-[#2a2a2a] hover:text-red-500 dark:hover:text-red-400 transition-colors"
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

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingMeeting(null) }} title={editingMeeting ? 'Editar Reunião' : 'Registrar Reunião'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Type toggle */}
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo *</label>
              <div className="flex rounded-xl border border-gray-200 dark:border-[#333333] overflow-hidden">
                {(Object.entries(typeConfig) as [MeetingType, typeof typeConfig[MeetingType]][]).map(([type, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type }))}
                      className={`flex-1 py-2 text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        form.type === type ? cfg.activeClass : 'bg-white dark:bg-[#1c1c1c] text-gray-500 dark:text-[#4d7a60] hover:bg-gray-50 dark:hover:bg-[#252525]'
                      }`}
                    >
                      <Icon size={13} /> {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="mtg-client" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliente / Contato *</label>
              <input id="mtg-client" className="input-field" placeholder="Dr. Nome..." value={form.client_name} onChange={set('client_name')} required />
            </div>

            <div>
              <label htmlFor="mtg-date" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data *</label>
              <input id="mtg-date" type="date" className="input-field" value={form.date} onChange={set('date')} required />
            </div>

            <div>
              <label htmlFor="mtg-time" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Horário</label>
              <input id="mtg-time" type="time" className="input-field" value={form.scheduled_time} onChange={set('scheduled_time')} />
            </div>

            <div>
              <label htmlFor="mtg-status" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
              <select id="mtg-status" className="input-field" value={form.status} onChange={set('status')}>
                {(Object.entries(statusConfig) as [MeetingStatus, { label: string; selectClass: string }][]).map(([s, sc]) => (
                  <option key={s} value={s}>{sc.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label htmlFor="mtg-notes" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações</label>
              <textarea id="mtg-notes" className="input-field resize-none" rows={2} placeholder="Notas sobre a reunião..." value={form.notes} onChange={set('notes')} />
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowModal(false); setEditingMeeting(null) }}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editingMeeting ? 'Salvar alterações' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Reunião" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover a reunião com <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.client_name || '—'}</strong>? Esta ação não pode ser desfeita.
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

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#1c1c1c] dark:border dark:border-[#333333] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#4EE88A] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
