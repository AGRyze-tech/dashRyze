'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import {
  ChevronLeft, ChevronRight, Plus, CheckCircle2,
  Handshake, PhoneCall, Calendar, Pencil, Trash2, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Meeting, MeetingType, MeetingStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── Constants ────────────────────────────────────────────────────────
const SLOT_H = 52       // px per 30-min slot
const START_H = 8       // 08:00
const END_H = 22        // 22:00
const SLOTS = (END_H - START_H) * 2  // 28 half-hour slots
const GRID_H = SLOTS * SLOT_H        // total grid height px

const DAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']

const typeConfig: Record<MeetingType, {
  label: string
  icon: React.ElementType
  blockLight: string
  blockDark: string
  textLight: string
  textDark: string
  color: 'blue' | 'green' | 'purple'
}> = {
  reuniao:    { label: 'Reunião',    icon: Calendar,  color: 'blue',   blockLight: 'bg-blue-100 border-blue-300',        blockDark: 'bg-blue-950/60 border-blue-700',   textLight: 'text-blue-800',   textDark: 'text-blue-300' },
  fechamento: { label: 'Fechamento', icon: Handshake, color: 'green',  blockLight: 'bg-emerald-100 border-emerald-300',  blockDark: 'bg-emerald-950/60 border-emerald-700', textLight: 'text-emerald-800', textDark: 'text-emerald-300' },
  pos_call:   { label: 'Pós Call',   icon: PhoneCall, color: 'purple', blockLight: 'bg-purple-100 border-purple-300',    blockDark: 'bg-purple-950/60 border-purple-700', textLight: 'text-purple-800', textDark: 'text-purple-300' },
}

const statusConfig: Record<MeetingStatus, { label: string; selectClass: string }> = {
  agendada:  { label: 'Agendada',  selectClass: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  concluida: { label: 'Concluída', selectClass: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  churned:   { label: 'Churned',   selectClass: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  no_show:   { label: 'No-show',   selectClass: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
}

const emptyForm = {
  client_name: '',
  date: '',
  scheduled_time: '',
  type: 'reuniao' as MeetingType,
  status: 'agendada' as MeetingStatus,
  notes: '',
}

// ── Time helpers ─────────────────────────────────────────────────────
function getWeekStart(d: Date): Date {
  const date = new Date(d)
  date.setDate(date.getDate() - date.getDay()) // back to Sunday
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeToTop(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return ((h * 60 + m) - START_H * 60) / 30 * SLOT_H
}

function currentTimeTop(): number {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  if (h < START_H || h >= END_H) return -1
  return ((h * 60 + m) - START_H * 60) / 30 * SLOT_H
}

function slotToTime(slotIndex: number): string {
  const totalMin = START_H * 60 + slotIndex * 30
  const h = Math.floor(totalMin / 60)
  const mn = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const startStr = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  const endStr = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

// ── Component ────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const [nowTop, setNowTop] = useState(currentTimeTop)

  const db = useMemo(() => createClient(), [])

  // Live current-time indicator
  useEffect(() => {
    const id = setInterval(() => setNowTop(currentTimeTop()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Load meetings for the week
  const loadMeetings = useCallback(async (ws: Date) => {
    setLoading(true)
    const start = toDateKey(ws)
    const end = toDateKey(addDays(ws, 6))
    const { data } = await db.from('meetings').select('*').gte('date', start).lte('date', end).order('date')
    setMeetings((data ?? []) as Meeting[])
    setLoading(false)
  }, [db])

  useEffect(() => { loadMeetings(weekStart) }, [weekStart, loadMeetings])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Days for the grid
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Meetings grouped by date
  const meetingsByDay = useMemo(() => {
    const map: Record<string, Meeting[]> = {}
    for (const m of meetings) {
      if (!map[m.date]) map[m.date] = []
      map[m.date].push(m)
    }
    return map
  }, [meetings])

  const todayKey = toDateKey(new Date())
  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart])

  // Time slot labels (every hour on the left)
  const timeLabels = useMemo(() =>
    Array.from({ length: END_H - START_H }, (_, i) => {
      const h = START_H + i
      return `${String(h).padStart(2, '0')}:00`
    }),
    []
  )

  // Navigation
  function prevWeek() { setWeekStart(d => addDays(d, -7)) }
  function nextWeek() { setWeekStart(d => addDays(d, 7)) }
  function goToday() { setWeekStart(getWeekStart(new Date())) }

  // Modal helpers
  function openCreate(date: string, time = '') {
    setEditingMeeting(null)
    setForm({ ...emptyForm, date, scheduled_time: time })
    setSaveError('')
    setShowModal(true)
  }

  function openEdit(m: Meeting, e: React.MouseEvent) {
    e.stopPropagation()
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
        setMeetings(prev => [...prev, data as Meeting])
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
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db.from('meetings').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setMeetings(prev => prev.filter(m => m.id !== deleteTarget.id))
      setToast('Reunião removida.')
      setDeleteTarget(null)
      setShowModal(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusChange(meetingId: string, status: MeetingStatus) {
    const { data } = await db.from('meetings').update({ status }).eq('id', meetingId).select().single()
    if (data) setMeetings(prev => prev.map(m => m.id === meetingId ? (data as Meeting) : m))
  }

  function handleSlotClick(dateKey: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const slotIndex = Math.max(0, Math.min(SLOTS - 1, Math.floor(y / SLOT_H)))
    openCreate(dateKey, slotToTime(slotIndex))
  }

  return (
    <div>
      <Header title="Agenda" subtitle="Calendário semanal de reuniões" />

      <div className="p-4 sm:p-6 space-y-4">

        {/* ── Week navigation ───────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={goToday}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-gray-200 dark:border-[#33333a] text-gray-600 dark:text-[#01992e] hover:bg-gray-50 dark:hover:bg-[#252528] transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={prevWeek}
              aria-label="Semana anterior"
              className="p-1.5 rounded-lg border border-gray-200 dark:border-[#33333a] text-gray-500 dark:text-[#01992e] hover:bg-gray-50 dark:hover:bg-[#252528] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextWeek}
              aria-label="Próxima semana"
              className="p-1.5 rounded-lg border border-gray-200 dark:border-[#33333a] text-gray-500 dark:text-[#01992e] hover:bg-gray-50 dark:hover:bg-[#252528] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <span className="ml-2 text-[14px] font-semibold text-gray-800 dark:text-[#E6F2EB]">{weekLabel}</span>
          </div>
          <Button size="sm" onClick={() => openCreate(todayKey)}>
            <Plus size={13} /> Registrar
          </Button>
        </div>

        {/* ── Calendar grid ─────────────────────────────────────────── */}
        <div className="card-light overflow-hidden">

          {/* Day headers */}
          <div className="grid border-b border-gray-100 dark:border-[#2a2a2e]" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="border-r border-gray-100 dark:border-[#2a2a2e]" />
            {days.map(day => {
              const key = toDateKey(day)
              const isToday = key === todayKey
              return (
                <div key={key} className="py-3 text-center border-r border-gray-100 dark:border-[#2a2a2e] last:border-r-0">
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 dark:text-[#017e26] uppercase">
                    {DAY_LABELS[day.getDay()]}
                  </p>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-0.5 text-[13px] font-bold tabular',
                    isToday
                      ? 'bg-[#01CA3C] text-white shadow-[0_0_12px_rgba(78,232,138,0.4)]'
                      : 'text-gray-800 dark:text-[#E6F2EB]'
                  )}>
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* All-day row: meetings without scheduled_time */}
          {(() => {
            const hasAnyAllDay = days.some(d => {
              const key = toDateKey(d)
              return (meetingsByDay[key] ?? []).some(m => !m.scheduled_time)
            })
            if (!hasAnyAllDay) return null
            return (
              <div className="grid border-b border-gray-100 dark:border-[#2a2a2e]" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                <div className="flex items-center justify-end pr-2 border-r border-gray-100 dark:border-[#2a2a2e]">
                  <span className="text-[9px] font-semibold text-gray-300 dark:text-[#33333a] uppercase tracking-wider">dia todo</span>
                </div>
                {days.map(day => {
                  const key = toDateKey(day)
                  const allDay = (meetingsByDay[key] ?? []).filter(m => !m.scheduled_time)
                  return (
                    <div key={key} className="px-1 py-1.5 min-h-[32px] border-r border-gray-100 dark:border-[#2a2a2e] last:border-r-0 flex flex-wrap gap-1">
                      {allDay.map(m => {
                        const cfg = typeConfig[m.type]
                        return (
                          <button
                            key={m.id}
                            onClick={e => openEdit(m, e)}
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-full cursor-pointer',
                              cfg.blockLight, cfg.textLight,
                              'dark:' + cfg.blockDark.split(' ')[0],
                              'dark:' + cfg.blockDark.split(' ')[1],
                              'dark:' + cfg.textDark,
                            )}
                          >
                            {m.client_name || cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Time grid */}
          <div
            className="grid overflow-y-auto"
            style={{ gridTemplateColumns: '52px repeat(7, 1fr)', maxHeight: '600px' }}
          >
            {/* Time labels */}
            <div className="relative border-r border-gray-100 dark:border-[#2a2a2e]" style={{ height: GRID_H }}>
              {timeLabels.map((label, i) => (
                <div
                  key={label}
                  className="absolute right-2 text-[10px] tabular text-gray-300 dark:text-[#33333a] select-none"
                  style={{ top: i * SLOT_H * 2 - 6 }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map(day => {
              const key = toDateKey(day)
              const isToday = key === todayKey
              const timed = (meetingsByDay[key] ?? []).filter(m => m.scheduled_time)

              return (
                <div
                  key={key}
                  className="relative border-r border-gray-100 dark:border-[#2a2a2e] last:border-r-0 cursor-pointer hover:bg-gray-50/40 dark:hover:bg-[#252528]/40 transition-colors"
                  style={{ height: GRID_H }}
                  onClick={e => handleSlotClick(key, e)}
                >
                  {/* Slot lines */}
                  {Array.from({ length: SLOTS }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'absolute w-full pointer-events-none',
                        i % 2 === 0
                          ? 'border-t border-gray-100 dark:border-[#2a2a2e]'
                          : 'border-t border-dashed border-gray-50 dark:border-[#252528]'
                      )}
                      style={{ top: i * SLOT_H }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isToday && nowTop >= 0 && (
                    <div
                      className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                      style={{ top: nowTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
                      <div className="flex-1 h-px bg-red-500 opacity-60" />
                    </div>
                  )}

                  {/* Meeting blocks */}
                  {timed.map(m => {
                    const cfg = typeConfig[m.type]
                    const top = timeToTop(m.scheduled_time!)
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'absolute left-0.5 right-0.5 rounded-md border px-1.5 py-1 z-10 overflow-hidden group',
                          cfg.blockLight, cfg.textLight,
                          'dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-300',
                          m.type === 'fechamento' && 'dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300',
                          m.type === 'pos_call' && 'dark:bg-purple-950/60 dark:border-purple-700 dark:text-purple-300',
                        )}
                        style={{ top: top + 1, height: SLOT_H - 3 }}
                        onClick={e => openEdit(m, e)}
                      >
                        <p className="text-[10px] font-semibold leading-tight truncate">{m.client_name || '—'}</p>
                        <p className="text-[9px] opacity-70 leading-tight">{m.scheduled_time?.slice(0, 5)}</p>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(m) }}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition-all"
                          aria-label="Remover"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {loading && (
          <p className="text-center text-[12px] text-gray-400 dark:text-[#017e26] py-2">Carregando reuniões...</p>
        )}
      </div>

      {/* ── Create / Edit Modal ───────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingMeeting(null) }}
        title={editingMeeting ? 'Editar Reunião' : 'Registrar Reunião'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Type toggle */}
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 dark:text-[#01992e] mb-1.5">Tipo *</label>
              <div className="flex rounded-xl border border-gray-200 dark:border-[#33333a] overflow-hidden">
                {(Object.entries(typeConfig) as [MeetingType, typeof typeConfig[MeetingType]][]).map(([type, cfg]) => {
                  const Icon = cfg.icon
                  const activeMap: Record<MeetingType, string> = {
                    reuniao:    'bg-blue-500 dark:bg-blue-700 text-white',
                    fechamento: 'bg-emerald-600 dark:bg-emerald-700 text-white',
                    pos_call:   'bg-purple-500 dark:bg-purple-700 text-white',
                  }
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type }))}
                      className={cn(
                        'flex-1 py-2 text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1',
                        form.type === type
                          ? activeMap[type]
                          : 'bg-white dark:bg-[#121214] text-gray-500 dark:text-[#017e26] hover:bg-gray-50 dark:hover:bg-[#252528]'
                      )}
                    >
                      <Icon size={13} /> {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="ag-client" className="block text-[12px] font-medium text-gray-700 dark:text-[#01992e] mb-1.5">Cliente / Contato *</label>
              <input id="ag-client" className="input-field" placeholder="Dr. Nome..." value={form.client_name} onChange={set('client_name')} required />
            </div>

            <div>
              <label htmlFor="ag-date" className="block text-[12px] font-medium text-gray-700 dark:text-[#01992e] mb-1.5">Data *</label>
              <input id="ag-date" type="date" className="input-field" value={form.date} onChange={set('date')} required />
            </div>

            <div>
              <label htmlFor="ag-time" className="block text-[12px] font-medium text-gray-700 dark:text-[#01992e] mb-1.5">Horário</label>
              <input id="ag-time" type="time" className="input-field" value={form.scheduled_time} onChange={set('scheduled_time')} />
            </div>

            <div>
              <label htmlFor="ag-status" className="block text-[12px] font-medium text-gray-700 dark:text-[#01992e] mb-1.5">Status</label>
              <div className="relative">
                <select id="ag-status" className="input-field appearance-none pr-8" value={form.status} onChange={set('status')}>
                  {(Object.entries(statusConfig) as [MeetingStatus, { label: string; selectClass: string }][]).map(([s, sc]) => (
                    <option key={s} value={s}>{sc.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-[#017e26]" />
              </div>
            </div>

            <div className="col-span-2">
              <label htmlFor="ag-notes" className="block text-[12px] font-medium text-gray-700 dark:text-[#01992e] mb-1.5">Observações</label>
              <textarea id="ag-notes" className="input-field resize-none" rows={2} placeholder="Notas..." value={form.notes} onChange={set('notes')} />
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {editingMeeting ? (
              <button
                type="button"
                onClick={() => setDeleteTarget(editingMeeting)}
                className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={13} /> Remover
              </button>
            ) : <div />}
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={() => { setShowModal(false); setEditingMeeting(null) }}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editingMeeting ? 'Salvar' : 'Registrar'}</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ───────────────────────────────────────────── */}
      <Modal isOpen={!!deleteTarget && !showModal} onClose={() => setDeleteTarget(null)} title="Remover Reunião" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#01992e]">
              Remover a reunião com <strong className="text-gray-900 dark:text-[#E6F2EB]">{deleteTarget.client_name || '—'}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button onClick={handleDelete} loading={deleting} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
                <Trash2 size={13} /> Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#1c1c1f] dark:border dark:border-[#33333a] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#01CA3C] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
