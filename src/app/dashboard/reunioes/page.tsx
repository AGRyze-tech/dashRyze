'use client'
import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import {
  Calendar, Plus, CheckCircle2, Handshake,
  Trash2, Pencil, PhoneCall, ChevronDown, XCircle,
  MessageCircle, Video,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Meeting, MeetingType, MeetingStatus, ClosingMethod } from '@/types'
import { useDateFilter } from '@/contexts/DateFilterContext'
import { useToast } from '@/hooks/useToast'

const typeConfig: Record<MeetingType, { label: string; color: 'green' | 'blue' | 'purple'; icon: React.ElementType; bgClass: string; iconClass: string; activeClass: string }> = {
  reuniao:    { label: 'Reunião',    color: 'blue',   icon: Calendar,  bgClass: 'bg-blue-50 dark:bg-blue-900/25',        iconClass: 'text-blue-600 dark:text-blue-400',     activeClass: 'bg-blue-500 dark:bg-blue-600 text-white' },
  fechamento: { label: 'Fechamento', color: 'green',  icon: Handshake, bgClass: 'bg-[#00FF41]/10 dark:bg-[#00FF41]/20', iconClass: 'text-[#00FF41] dark:text-[#00FF41]',   activeClass: 'bg-[#00FF41] dark:bg-[#003810] text-white' },
  pos_call:   { label: 'Pós Call',   color: 'purple', icon: PhoneCall, bgClass: 'bg-purple-50 dark:bg-purple-900/20',    iconClass: 'text-purple-600 dark:text-purple-400', activeClass: 'bg-purple-500 dark:bg-purple-600 text-white' },
}

const statusConfig: Record<MeetingStatus, { label: string; selectClass: string }> = {
  agendada:  { label: 'Agendada',  selectClass: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  concluida: { label: 'Concluída', selectClass: 'bg-[#00FF41]/10 dark:bg-[#00FF41]/20 text-[#00FF41] dark:text-[#00FF41] border-[#00FF41]/30 dark:border-[#00FF41]/40' },
  churned:   { label: 'Churned',   selectClass: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  no_show:   { label: 'No-show',   selectClass: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
}

type Tab = 'todas' | 'marcadas' | 'concluidas' | 'noshow' | 'poscall'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'todas',     label: 'Todas',     icon: Calendar },
  { id: 'marcadas',  label: 'Marcadas',  icon: Calendar },
  { id: 'concluidas',label: 'Concluídas',icon: CheckCircle2 },
  { id: 'noshow',    label: 'No Show',   icon: XCircle },
  { id: 'poscall',   label: 'Pós Call',  icon: PhoneCall },
]

const emptyForm = {
  client_name: '',
  phone: '',
  date: new Date().toISOString().split('T')[0],
  scheduled_time: '',
  type: 'reuniao' as MeetingType,
  status: 'agendada' as MeetingStatus,
  closing_method: '' as ClosingMethod | '',
  notes: '',
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-[#181819] ${className}`} />
}

type MeetingRowProps = {
  meeting: Meeting
  onStatusChange: (id: string, status: MeetingStatus) => void
  onEdit: (m: Meeting) => void
  onDelete: (m: Meeting) => void
}

const MeetingRow = memo(function MeetingRow({ meeting: m, onStatusChange, onEdit, onDelete }: MeetingRowProps) {
  const cfg = typeConfig[m.type]
  const Icon = cfg.icon
  const sCfg = statusConfig[m.status]
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-[#181819] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#111114] transition-colors group">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bgClass}`}>
        <Icon size={14} className={cfg.iconClass} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">
            {m.client_name || '—'}
          </p>
          {m.closing_method && (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#00FF41]/10 dark:bg-[#00FF41]/15 text-[#00FF41]">
              {m.closing_method === 'whatsapp' ? <MessageCircle size={9} /> : <Video size={9} />}
              {m.closing_method === 'whatsapp' ? 'WhatsApp' : 'Reunião'}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-[#00a02a] flex items-center gap-1.5 flex-wrap">
          {m.scheduled_time ? m.scheduled_time.slice(0, 5) : formatDate(m.date)}
          {m.scheduled_time && <span className="opacity-70">· {formatDate(m.date)}</span>}
          {m.phone && <span className="opacity-70">· {m.phone}</span>}
          {m.notes && <span className="opacity-70 truncate max-w-[160px]">· {m.notes}</span>}
        </p>
      </div>
      <Badge color={cfg.color} dot={false}>{cfg.label}</Badge>
      <div className="relative flex-shrink-0">
        <select
          value={m.status}
          onChange={e => onStatusChange(m.id, e.target.value as MeetingStatus)}
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
          onClick={() => onEdit(m)}
          aria-label="Editar"
          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-[#00FF41]/10 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-[#00FF41] transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(m)}
          aria-label="Remover"
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
})

export default function ReunioesPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [tab, setTab] = useState<Tab>('todas')
  const [showModal, setShowModal] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Meeting | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()
  const db = useMemo(() => createClient(), [])
  const { range } = useDateFilter()

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
      } catch (err) {
        console.error('Erro ao carregar reuniões:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [db])

  const filtered = useMemo(() =>
    meetings.filter(m => (!range.from || m.date >= range.from) && (!range.to || m.date <= range.to)),
    [meetings, range.from, range.to]
  )

  const stats = useMemo(() => {
    let marcadas = 0, concluidas = 0, noshow = 0, poscall = 0
    for (const m of filtered) {
      if (m.status === 'agendada')  marcadas++
      if (m.status === 'concluida') concluidas++
      if (m.status === 'no_show')   noshow++
      if (m.type   === 'pos_call')  poscall++
    }
    const total = filtered.length
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
    return { total, marcadas, concluidas, noshow, poscall, pct }
  }, [filtered])

  const tabMeetings = useMemo(() => {
    switch (tab) {
      case 'marcadas':   return filtered.filter(m => m.status === 'agendada')
      case 'concluidas': return filtered.filter(m => m.status === 'concluida')
      case 'noshow':     return filtered.filter(m => m.status === 'no_show')
      case 'poscall':    return filtered.filter(m => m.type === 'pos_call')
      default:           return filtered
    }
  }, [filtered, tab])

  function handleOpenModal() {
    setEditingMeeting(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  const handleOpenEdit = useCallback((m: Meeting) => {
    setEditingMeeting(m)
    setForm({
      client_name: m.client_name,
      phone: m.phone ?? '',
      date: m.date,
      scheduled_time: m.scheduled_time ?? '',
      type: m.type,
      status: m.status,
      closing_method: m.closing_method ?? '',
      notes: m.notes ?? '',
    })
    setSaveError('')
    setShowModal(true)
  }, [])

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
      type MeetingPayload = {
        client_name: string; phone: string | null; date: string
        scheduled_time: string | null; type: MeetingType; status: MeetingStatus
        closing_method: ClosingMethod | null; notes: string | null
      }
      const fullPayload: MeetingPayload = {
        client_name: form.client_name.trim(),
        phone: form.phone.trim() || null,
        date: form.date,
        scheduled_time: form.scheduled_time || null,
        type: form.type,
        status: form.status,
        closing_method: (form.closing_method as ClosingMethod) || null,
        notes: form.notes.trim() || null,
      }

      const trySave = (p: Partial<MeetingPayload>) =>
        editingMeeting
          ? db.from('meetings').update(p).eq('id', editingMeeting.id).select().single()
          : db.from('meetings').insert([p]).select().single()

      const errMsg = (err: unknown) =>
        err instanceof Error ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message) : String(err)

      let result = await trySave(fullPayload)

      if (result.error) {
        const msg = errMsg(result.error)
        const isSchemaCacheError = msg.includes('phone') || msg.includes('closing_method')
        if (isSchemaCacheError) {
          // Both columns were added via ALTER TABLE — strip both in one retry
          // to avoid a second cache miss if PostgREST rebuilt its cache mid-session
          const { phone: _p, closing_method: _c, ...stripped } = fullPayload
          void _p; void _c
          result = await trySave(stripped)
        }
        if (result.error) throw result.error
      }

      const saved = result.data as Meeting
      if (editingMeeting) {
        setMeetings(prev => prev.map(m => m.id === editingMeeting.id ? saved : m))
        showToast('Reunião atualizada!')
      } else {
        setMeetings(prev => [saved, ...prev])
        showToast('Reunião registrada!')
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
      showToast('Reunião removida.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = useCallback(async (meetingId: string, status: MeetingStatus) => {
    const { data, error } = await db.from('meetings').update({ status }).eq('id', meetingId).select().single()
    if (error) return
    setMeetings(prev => prev.map(m => m.id === meetingId ? (data as Meeting) : m))
  }, [db])

  if (!tableExists) {
    return (
      <div>
        <Header title="Reuniões" subtitle="Gestão de reuniões e métricas de vendas" />
        <div className="p-4 sm:p-6">
          <div className="card-light p-8 flex flex-col items-center text-center gap-4 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Calendar size={20} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-800 dark:text-[#D1FAE5] mb-1">Tabela não encontrada</p>
              <p className="text-[13px] text-gray-500 dark:text-[#00a02a]">
                Execute o SQL abaixo no Supabase SQL Editor para ativar esta seção.
              </p>
            </div>
            <pre className="w-full text-left text-[11px] bg-gray-900 text-emerald-400 rounded-xl p-4 overflow-x-auto leading-relaxed">
{`create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text,
  client_name text not null default '',
  phone text,
  date date not null,
  scheduled_time time,
  type text not null check (type in ('reuniao', 'fechamento', 'pos_call')),
  status text not null default 'agendada' check (
    status in ('agendada', 'concluida', 'churned', 'no_show')
  ),
  closing_method text check (closing_method in ('whatsapp', 'reuniao')),
  notes text,
  created_at timestamptz default now()
);
alter table meetings enable row level security;
create policy "allow all" on meetings
  for all using (true) with check (true);

-- Se a tabela já existe, adicione as novas colunas:
-- alter table meetings add column if not exists phone text;
-- alter table meetings add column if not exists closing_method text check (closing_method in ('whatsapp', 'reuniao'));`}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  const tabCountMap: Record<Tab, number> = {
    todas:     stats.total,
    marcadas:  stats.marcadas,
    concluidas:stats.concluidas,
    noshow:    stats.noshow,
    poscall:   stats.poscall,
  }
  const tabPctMap: Record<Tab, number> = {
    todas:     100,
    marcadas:  stats.pct(stats.marcadas),
    concluidas:stats.pct(stats.concluidas),
    noshow:    stats.pct(stats.noshow),
    poscall:   stats.pct(stats.poscall),
  }

  return (
    <div>
      <Header title="Reuniões" subtitle="Gestão de reuniões e métricas de vendas" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center mb-3">
              <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Total</p>
            {loading ? <Skeleton className="h-7 w-12" /> : (
              <p className="text-[28px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{stats.total}</p>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-[#00FF41]/10 dark:bg-[#00FF41]/20 flex items-center justify-center mb-3">
              <CheckCircle2 size={16} className="text-[#00FF41]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Concluídas</p>
            {loading ? <Skeleton className="h-7 w-12" /> : (
              <div className="flex items-end gap-2">
                <p className="text-[28px] font-bold leading-none text-[#00FF41]">{stats.concluidas}</p>
                <p className="text-[13px] font-semibold text-gray-400 dark:text-[#00a02a] mb-0.5">{stats.pct(stats.concluidas)}%</p>
              </div>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-3">
              <XCircle size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">No Show</p>
            {loading ? <Skeleton className="h-7 w-16" /> : (
              <div className="flex items-end gap-2">
                <p className="text-[28px] font-bold leading-none text-amber-700 dark:text-amber-300">{stats.noshow}</p>
                <p className="text-[13px] font-semibold text-gray-400 dark:text-[#00a02a] mb-0.5">{stats.pct(stats.noshow)}%</p>
              </div>
            )}
          </div>

          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-3">
              <PhoneCall size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Pós Call</p>
            {loading ? <Skeleton className="h-7 w-12" /> : (
              <div className="flex items-end gap-2">
                <p className="text-[28px] font-bold leading-none text-purple-700 dark:text-purple-300">{stats.poscall}</p>
                <p className="text-[13px] font-semibold text-gray-400 dark:text-[#00a02a] mb-0.5">{stats.pct(stats.poscall)}%</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabbed List ───────────────────────────────────────────────── */}
        <div className="card-light overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Histórico</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">
                {tabMeetings.length} reunião{tabMeetings.length !== 1 ? 'ões' : ''}
                {tab !== 'todas' && stats.total > 0 && (
                  <span className="ml-1.5 text-[11px] font-medium text-gray-400 dark:text-[#00a02a]">
                    · {tabPctMap[tab]}% do total
                  </span>
                )}
              </p>
            </div>
            <Button size="sm" onClick={handleOpenModal}><Plus size={13} /> Registrar</Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-100 dark:border-[#181819] overflow-x-auto">
            {tabs.map(t => {
              const isActive = tab === t.id
              const count = tabCountMap[t.id]
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-[#00FF41] text-gray-900 dark:text-[#F0FDF4]'
                      : 'border-transparent text-gray-400 dark:text-[#00a02a] hover:text-gray-600 dark:hover:text-[#D1FAE5]'
                  }`}
                >
                  {t.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-[#00FF41]/15 text-[#00FF41]'
                      : 'bg-gray-100 dark:bg-[#181819] text-gray-400 dark:text-[#00a02a]'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* List */}
          {loading ? (
            <div className="divide-y divide-gray-50 dark:divide-[#181819]">
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
          ) : tabMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center mb-3">
                <Calendar size={18} className="text-gray-300 dark:text-[#00a02a]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]">Nenhuma reunião nesta aba</p>
              <p className="text-[12px] text-gray-300 dark:text-[#00a02a] mt-0.5">Clique em &quot;Registrar&quot; para adicionar</p>
            </div>
          ) : (
            <div>
              {tabMeetings.map(m => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  onStatusChange={handleStatusChange}
                  onEdit={handleOpenEdit}
                  onDelete={setDeleteModal}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Register / Edit Modal ──────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingMeeting(null) }} title={editingMeeting ? 'Editar Reunião' : 'Registrar Reunião'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Type toggle */}
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo *</label>
              <div className="flex rounded-xl border border-gray-200 dark:border-[#28282d] overflow-hidden">
                {(Object.entries(typeConfig) as [MeetingType, typeof typeConfig[MeetingType]][]).map(([type, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type }))}
                      className={`flex-1 py-2 text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        form.type === type ? cfg.activeClass : 'bg-white dark:bg-[#111114] text-gray-500 dark:text-[#00a02a] hover:bg-gray-50 dark:hover:bg-[#181819]'
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
              <label htmlFor="mtg-phone" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Telefone / WhatsApp</label>
              <input id="mtg-phone" type="tel" inputMode="numeric" className="input-field" placeholder="11999990000" value={form.phone} onChange={set('phone')} />
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

            {/* Closing method — shown when status is concluída */}
            {form.status === 'concluida' && (
              <div>
                <label htmlFor="mtg-closing" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Como fechou?</label>
                <select id="mtg-closing" className="input-field" value={form.closing_method} onChange={set('closing_method')}>
                  <option value="">Não informado</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="reuniao">Reunião</option>
                </select>
              </div>
            )}

            <div className={form.status === 'concluida' ? '' : 'col-span-2'}>
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
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#111114] dark:border dark:border-[#28282d] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
