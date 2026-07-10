'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, Flame, Check, Minus, Trash2, Pencil, CheckCircle2, Trophy,
  Target, Phone, PenLine, Users, Video, Mail, Briefcase, TrendingUp,
  BookOpen, Megaphone, Search, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { habitRepository, HabitInput } from '@/lib/repositories'
import { parseLocalDate } from '@/lib/utils'
import { useTheme } from '@/components/layout/ThemeProvider'
import { useToast } from '@/hooks/useToast'
import { Habit, HabitLog, HabitType } from '@/types'

// ── Date helpers (local, sem fuso — string YYYY-MM-DD) ───────────────────────
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDaysISO(iso: string, n: number): string {
  const d = parseLocalDate(iso)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}
const TODAY = isoOf(new Date())

// ── Cores e ícones dos hábitos ───────────────────────────────────────────────
const HABIT_COLORS: Record<string, string> = {
  green: '#00FF41', blue: '#3B82F6', amber: '#F59E0B',
  purple: '#8B5CF6', red: '#EF4444', cyan: '#06B6D4',
}
const COLOR_ORDER = ['green', 'blue', 'amber', 'purple', 'red', 'cyan']

const HABIT_ICONS: Record<string, React.ElementType> = {
  target: Target, phone: Phone, pen: PenLine, users: Users, video: Video,
  mail: Mail, briefcase: Briefcase, trending: TrendingUp, book: BookOpen,
  megaphone: Megaphone, search: Search, flame: Flame,
}
const ICON_ORDER = ['target', 'search', 'phone', 'megaphone', 'video', 'mail', 'users', 'pen', 'book', 'briefcase', 'trending', 'flame']
function iconFor(name?: string | null): React.ElementType {
  return (name && HABIT_ICONS[name]) || Flame
}

const CATEGORY_SUGGESTIONS = ['Prospecção', 'Conteúdo', 'Vendas', 'Gestão', 'Estudo', 'Pessoal']

const SUGGESTED_HABITS: HabitInput[] = [
  { name: 'Prospectar', category: 'Prospecção', type: 'numeric', target: 20, unit: 'leads', color: 'green', icon: 'search' },
  { name: 'Follow-up', category: 'Vendas', type: 'numeric', target: 10, unit: 'contatos', color: 'blue', icon: 'phone' },
  { name: 'Postar conteúdo', category: 'Conteúdo', type: 'boolean', color: 'amber', icon: 'megaphone' },
  { name: 'Reunião de fechamento', category: 'Vendas', type: 'boolean', color: 'purple', icon: 'video' },
]

const HEAT_RANGES: { key: string; label: string; days: number }[] = [
  { key: 'ano', label: 'Anual', days: 371 },
  { key: '6m', label: '6 meses', days: 183 },
  { key: '3m', label: '3 meses', days: 92 },
  { key: 'mes', label: 'Mês', days: 31 },
]
const LEVEL_COLORS = ['', '#003810', '#006620', '#00a02a', '#00FF41']

const emptyForm = {
  name: '', category: '', type: 'boolean' as HabitType,
  target: '', unit: '', color: 'green', icon: 'target',
}

export default function RotinaPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [rangeStart, setRangeStart] = useState(addDaysISO(TODAY, -371))
  const [loading, setLoading] = useState(true)
  const [heatRange, setHeatRange] = useState('ano')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null)

  const { toast, showToast } = useToast()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const db = useMemo(() => createClient(), [])
  const repo = useMemo(() => habitRepository(db), [db])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: auth } = await db.auth.getUser()
      const uid = auth.user?.id ?? null
      setUserId(uid)
      const from = addDaysISO(TODAY, -371)
      setRangeStart(from)
      const [habitsData, logsData] = await Promise.all([
        repo.findAll(),
        repo.logsInRange(from, TODAY),
      ])
      setHabits(habitsData)
      setLogs(logsData)
    } catch (err) {
      console.error('Erro ao carregar rotina:', err)
      showToast('Erro ao carregar a rotina. Tente recarregar a página.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, repo])

  useEffect(() => { load() }, [load])

  const habitById = useMemo(() => {
    const m = new Map<string, Habit>()
    for (const h of habits) m.set(h.id, h)
    return m
  }, [habits])

  const logMap = useMemo(() => {
    const m = new Map<string, HabitLog>()
    for (const l of logs) m.set(`${l.habit_id}|${l.date}`, l)
    return m
  }, [logs])

  const isDone = useCallback((h: Habit, dateISO: string): boolean => {
    const l = logMap.get(`${h.id}|${dateISO}`)
    if (!l) return false
    return h.type === 'numeric' ? l.value >= (h.target ?? 1) : l.value >= 1
  }, [logMap])

  // Contagem de hábitos concluídos por dia (para heatmap e total)
  const countByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of logs) {
      const h = habitById.get(l.habit_id)
      if (!h) continue
      const done = h.type === 'numeric' ? l.value >= (h.target ?? 1) : l.value >= 1
      if (done) m.set(l.date, (m.get(l.date) ?? 0) + 1)
    }
    return m
  }, [logs, habitById])

  const totalActivities = useMemo(() => {
    let s = 0
    countByDate.forEach(v => { s += v })
    return s
  }, [countByDate])

  // ── Heatmap (colunas = semanas, linhas = dom→sáb) ──────────────────────────
  const heatWeeks = useMemo(() => {
    const days = HEAT_RANGES.find(r => r.key === heatRange)?.days ?? 371
    let start = addDaysISO(TODAY, -(days - 1))
    start = addDaysISO(start, -parseLocalDate(start).getDay()) // alinha em domingo
    const weeks: (string | null)[][] = []
    let cur: (string | null)[] = []
    let iso = start
    while (iso <= TODAY) {
      if (parseLocalDate(iso).getDay() === 0 && cur.length) { weeks.push(cur); cur = [] }
      cur.push(iso)
      iso = addDaysISO(iso, 1)
    }
    if (cur.length) { while (cur.length < 7) cur.push(null); weeks.push(cur) }
    return weeks
  }, [heatRange])

  function heatLevel(count: number): number {
    if (count <= 0) return 0
    return Math.min(count, 4)
  }

  // ── Mês corrente (grade + gráfico) ─────────────────────────────────────────
  const monthInfo = useMemo(() => {
    const now = parseLocalDate(TODAY)
    const y = now.getFullYear(), m = now.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const dates: string[] = []
    for (let d = 1; d <= daysInMonth; d++) dates.push(isoOf(new Date(y, m, d)))
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(now)
    return { dates, label, todayDay: now.getDate() }
  }, [])

  const chartData = useMemo(() => {
    const total = habits.length
    if (total === 0) return []
    return monthInfo.dates
      .filter(d => d <= TODAY)
      .map(d => {
        let done = 0
        for (const h of habits) if (isDone(h, d)) done++
        return { dia: parseLocalDate(d).getDate(), pct: Math.round((done / total) * 100) }
      })
  }, [habits, monthInfo, isDone])

  // ── Streaks ────────────────────────────────────────────────────────────────
  const streaks = useMemo(() => {
    const m = new Map<string, { current: number; record: number }>()
    for (const h of habits) {
      let current = 0
      let d = TODAY
      if (!isDone(h, d)) d = addDaysISO(d, -1)
      while (isDone(h, d)) { current++; d = addDaysISO(d, -1) }
      let record = 0, run = 0, scan = rangeStart
      while (scan <= TODAY) {
        if (isDone(h, scan)) { run++; if (run > record) record = run } else run = 0
        scan = addDaysISO(scan, 1)
      }
      m.set(h.id, { current, record })
    }
    return m
  }, [habits, isDone, rangeStart])

  const doneTodayCount = useMemo(
    () => habits.reduce((n, h) => n + (isDone(h, TODAY) ? 1 : 0), 0),
    [habits, isDone]
  )

  // ── Escrita de log (otimista) ──────────────────────────────────────────────
  const writeLog = useCallback(async (habit: Habit, dateISO: string, value: number) => {
    if (!userId) return
    const key = `${habit.id}|${dateISO}`
    const prev = logMap.get(key)
    const optimistic: HabitLog = {
      id: prev?.id ?? `tmp-${key}`, habit_id: habit.id, user_id: userId,
      date: dateISO, value, created_at: prev?.created_at ?? new Date().toISOString(),
    }
    setLogs(ls => [...ls.filter(l => !(l.habit_id === habit.id && l.date === dateISO)), optimistic])
    try {
      const saved = await repo.setLog(userId, habit.id, dateISO, value)
      setLogs(ls => ls.map(l => (l.habit_id === habit.id && l.date === dateISO) ? saved : l))
    } catch {
      setLogs(ls => {
        const others = ls.filter(l => !(l.habit_id === habit.id && l.date === dateISO))
        return prev ? [...others, prev] : others
      })
      showToast('Não deu pra salvar. Tente de novo.')
    }
  }, [userId, logMap, repo, showToast])

  function valueOf(habit: Habit, dateISO: string): number {
    return logMap.get(`${habit.id}|${dateISO}`)?.value ?? 0
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }
  function openEdit(h: Habit) {
    setEditing(h)
    setForm({
      name: h.name, category: h.category ?? '', type: h.type,
      target: h.target != null ? String(h.target) : '', unit: h.unit ?? '',
      color: h.color, icon: h.icon ?? 'target',
    })
    setSaveError('')
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setSaveError('Dê um nome pro hábito.'); return }
    if (form.type === 'numeric' && !(parseFloat(form.target) > 0)) {
      setSaveError('Defina uma meta numérica maior que zero.'); return
    }
    if (!userId) { setSaveError('Sessão não encontrada. Recarregue a página.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const input: HabitInput = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        type: form.type,
        target: form.type === 'numeric' ? parseFloat(form.target) : null,
        unit: form.type === 'numeric' ? (form.unit.trim() || null) : null,
        color: form.color,
        icon: form.icon,
      }
      if (editing) {
        const updated = await repo.update(editing.id, input)
        setHabits(hs => hs.map(h => h.id === editing.id ? updated : h))
        showToast('Hábito atualizado!')
      } else {
        const created = await repo.create(userId, { ...input, sort_order: habits.length })
        setHabits(hs => [...hs, created])
        showToast('Hábito criado!')
      }
      setShowModal(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await repo.remove(deleteTarget.id)
      setHabits(hs => hs.filter(h => h.id !== deleteTarget.id))
      showToast('Hábito removido.')
      setDeleteTarget(null)
    } catch {
      showToast('Não deu pra remover. Tente de novo.')
    }
  }

  async function quickAddSuggested() {
    if (!userId) return
    setSaving(true)
    try {
      const created: Habit[] = []
      for (let i = 0; i < SUGGESTED_HABITS.length; i++) {
        created.push(await repo.create(userId, { ...SUGGESTED_HABITS[i], sort_order: i }))
      }
      setHabits(created)
      showToast('Hábitos sugeridos adicionados!')
    } catch {
      showToast('Não deu pra adicionar os sugeridos.')
    } finally {
      setSaving(false)
    }
  }

  const gridColor = isDark ? '#181819' : '#F3F4F6'
  const tickColor = isDark ? '#006620' : '#9CA3AF'
  const cellBase = isDark ? '#181819' : '#E8ECEB'

  return (
    <div>
      <Header title="Rotina" subtitle="Seus hábitos de trabalho e progresso" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-[#00FF41]/10 dark:bg-[#00FF41]/20 flex items-center justify-center mb-3">
              <Sparkles size={16} className="text-[#00FF41]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Atividades no ano</p>
            <p className="tabular text-[26px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{totalActivities}</p>
          </div>
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center mb-3">
              <Check size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Hoje</p>
            <p className="tabular text-[26px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{doneTodayCount}<span className="text-[15px] text-gray-400 dark:text-[#00a02a]">/{habits.length}</span></p>
          </div>
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-3">
              <Flame size={16} className="text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Maior sequência</p>
            <p className="tabular text-[26px] font-bold leading-none text-amber-600 dark:text-amber-400">
              {habits.reduce((mx, h) => Math.max(mx, streaks.get(h.id)?.current ?? 0), 0)}<span className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]"> dias</span>
            </p>
          </div>
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-3">
              <Target size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Hábitos ativos</p>
            <p className="tabular text-[26px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{habits.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="card-light p-6 flex items-center justify-center py-20">
            <Flame size={22} className="animate-pulse text-[#00a02a]" />
          </div>
        ) : habits.length === 0 ? (
          /* ── Empty state ──────────────────────────────────────────────────── */
          <div className="card-light p-10 flex flex-col items-center text-center gap-4 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#00FF41]/10 flex items-center justify-center">
              <Flame size={24} className="text-[#00FF41]" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-gray-800 dark:text-[#F0FDF4] mb-1">Comece sua rotina</p>
              <p className="text-[13px] text-gray-500 dark:text-[#00a02a] max-w-sm">
                Crie hábitos de trabalho pra acompanhar todo dia — prospecção, follow-up, conteúdo — e veja sua constância crescer ao longo do ano.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={quickAddSuggested} loading={saving}>
                <Sparkles size={15} /> Adicionar hábitos sugeridos
              </Button>
              <Button variant="outline" onClick={openCreate}>
                <Plus size={15} /> Criar do zero
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Heatmap anual ──────────────────────────────────────────────── */}
            <div className="card-light overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Sua atividade</h3>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5 tabular">{totalActivities} atividades</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-[#111114] rounded-lg p-0.5">
                  {HEAT_RANGES.map(r => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setHeatRange(r.key)}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        heatRange === r.key
                          ? 'bg-white dark:bg-[#181819] text-gray-900 dark:text-[#F0FDF4] shadow-sm'
                          : 'text-gray-500 dark:text-[#00a02a] hover:text-gray-700 dark:hover:text-[#D1FAE5]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 pb-5 overflow-x-auto">
                <div className="flex gap-[3px] w-max">
                  {heatWeeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((iso, di) => {
                        if (!iso) return <div key={di} className="w-[11px] h-[11px]" />
                        const count = countByDate.get(iso) ?? 0
                        const lvl = heatLevel(count)
                        const bg = lvl === 0 ? cellBase : LEVEL_COLORS[lvl]
                        return (
                          <div
                            key={di}
                            className="w-[11px] h-[11px] rounded-[2px]"
                            style={{ backgroundColor: bg }}
                            title={`${parseLocalDate(iso).toLocaleDateString('pt-BR')} · ${count} hábito${count !== 1 ? 's' : ''}`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[10px] text-gray-400 dark:text-[#00a02a]">
                  <span>Menos</span>
                  {[0, 1, 2, 3, 4].map(l => (
                    <div key={l} className="w-[11px] h-[11px] rounded-[2px]" style={{ backgroundColor: l === 0 ? cellBase : LEVEL_COLORS[l] }} />
                  ))}
                  <span>Mais</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* ── Checklist do dia ──────────────────────────────────────────── */}
              <div className="lg:col-span-2 card-light overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Hoje</h3>
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">{doneTodayCount}/{habits.length} concluídos</p>
                  </div>
                  <Button size="sm" onClick={openCreate}><Plus size={13} /> Hábito</Button>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-[#181819]">
                  {habits.map(h => {
                    const Icon = iconFor(h.icon)
                    const color = HABIT_COLORS[h.color] ?? HABIT_COLORS.green
                    const val = valueOf(h, TODAY)
                    const done = isDone(h, TODAY)
                    const st = streaks.get(h.id)
                    return (
                      <div key={h.id} className="flex items-center gap-3 px-5 py-3 group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1a` }}>
                          <Icon size={15} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{h.name}</p>
                            {st && st.current > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 dark:text-amber-400 flex-shrink-0">
                                <Flame size={10} />{st.current}
                              </span>
                            )}
                          </div>
                          {h.type === 'numeric' && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#181819] rounded-full overflow-hidden max-w-[140px]">
                                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (val / (h.target || 1)) * 100)}%`, backgroundColor: color }} />
                              </div>
                              <span className="text-[11px] text-gray-400 dark:text-[#00a02a] tabular">{val}/{h.target} {h.unit ?? ''}</span>
                            </div>
                          )}
                        </div>

                        {h.type === 'boolean' ? (
                          <button
                            type="button"
                            onClick={() => writeLog(h, TODAY, done ? 0 : 1)}
                            aria-label={done ? 'Desmarcar' : 'Marcar como feito'}
                            className="w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer"
                            style={done
                              ? { backgroundColor: color, borderColor: color }
                              : { borderColor: isDark ? '#28282d' : '#E8ECEB' }}
                          >
                            {done && <Check size={15} className="text-black" strokeWidth={3} />}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => writeLog(h, TODAY, Math.max(0, val - 1))}
                              aria-label="Diminuir"
                              className="w-6 h-6 rounded-md border border-gray-200 dark:border-[#28282d] flex items-center justify-center text-gray-500 dark:text-[#00a02a] hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors cursor-pointer"
                            >
                              <Minus size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => writeLog(h, TODAY, val + 1)}
                              aria-label="Aumentar"
                              className="w-6 h-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer"
                              style={done
                                ? { backgroundColor: color, borderColor: color, color: '#000' }
                                : { borderColor: isDark ? '#28282d' : '#E8ECEB' }}
                            >
                              <Plus size={13} className={done ? '' : 'text-gray-500 dark:text-[#00a02a]'} />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity">
                          <button type="button" onClick={() => openEdit(h)} aria-label="Editar" className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-[#00FF41] transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(h)} aria-label="Remover" className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Gráfico de progresso do mês ───────────────────────────────── */}
              <div className="lg:col-span-3 card-light overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Progresso do mês</h3>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5 capitalize">{monthInfo.label}</p>
                </div>
                <div className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#111114' : '#fff',
                          border: `1px solid ${isDark ? '#28282d' : '#E8ECEB'}`,
                          borderRadius: 12, fontSize: 12,
                        }}
                        labelFormatter={d => `Dia ${d}`}
                        formatter={(v: number) => [`${v}%`, 'Concluído']}
                      />
                      <Line type="monotone" dataKey="pct" stroke="#00FF41" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#00FF41' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Grade mensal + streaks ────────────────────────────────────── */}
            <div className="card-light overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Grade de hábitos</h3>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5 capitalize">{monthInfo.label}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white dark:bg-[#0c0c0e] text-left px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Hábito</th>
                      {monthInfo.dates.map(d => {
                        const day = parseLocalDate(d).getDate()
                        const isToday = d === TODAY
                        return (
                          <th key={d} className={`px-0 py-2 text-[9px] font-medium w-6 ${isToday ? 'text-[#00FF41]' : 'text-gray-300 dark:text-[#28282d]'}`}>{day}</th>
                        )
                      })}
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] text-right">Recorde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {habits.map(h => {
                      const color = HABIT_COLORS[h.color] ?? HABIT_COLORS.green
                      const Icon = iconFor(h.icon)
                      const st = streaks.get(h.id)
                      return (
                        <tr key={h.id} className="border-t border-gray-50 dark:border-[#181819]">
                          <td className="sticky left-0 z-10 bg-white dark:bg-[#0c0c0e] px-5 py-2">
                            <div className="flex items-center gap-2 min-w-[130px]">
                              <Icon size={13} style={{ color }} className="flex-shrink-0" />
                              <span className="text-[12px] font-medium text-gray-700 dark:text-[#D1FAE5] truncate">{h.name}</span>
                            </div>
                          </td>
                          {monthInfo.dates.map(d => {
                            const future = d > TODAY
                            const done = isDone(h, d)
                            const val = valueOf(h, d)
                            const partial = h.type === 'numeric' && val > 0 && !done
                            return (
                              <td key={d} className="px-0 py-1 text-center">
                                <div
                                  className="w-[18px] h-[18px] rounded-[4px] mx-auto"
                                  style={{
                                    backgroundColor: done ? color : partial ? `${color}55` : (isDark ? '#181819' : '#F1F3F2'),
                                    opacity: future ? 0.3 : 1,
                                  }}
                                  title={`${parseLocalDate(d).toLocaleDateString('pt-BR')}${h.type === 'numeric' ? ` · ${val}/${h.target}` : done ? ' · feito' : ''}`}
                                />
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right">
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-600 dark:text-[#D1FAE5] tabular">
                              <Trophy size={11} className="text-amber-500" />{st?.record ?? 0}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal criar/editar ─────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar hábito' : 'Novo hábito'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="hab-name" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nome *</label>
            <input id="hab-name" className="input-field" placeholder="Ex: Prospectar, Postar conteúdo…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>

          <div>
            <label htmlFor="hab-cat" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Categoria</label>
            <input id="hab-cat" list="hab-cats" className="input-field" placeholder="Ex: Prospecção" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} autoComplete="off" />
            <datalist id="hab-cats">{CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}</datalist>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo *</label>
            <div className="flex rounded-xl border border-gray-200 dark:border-[#28282d] overflow-hidden">
              {([
                { v: 'boolean', l: 'Feito / não feito' },
                { v: 'numeric', l: 'Meta numérica' },
              ] as { v: HabitType; l: string }[]).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: opt.v }))}
                  className={`flex-1 py-2.5 text-[12px] font-semibold transition-all cursor-pointer ${
                    form.type === opt.v
                      ? 'bg-[#00FF41] dark:bg-[#003810] text-white'
                      : 'bg-white dark:bg-[#111114] text-gray-500 dark:text-[#00a02a] hover:bg-gray-50 dark:hover:bg-[#181819]'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'numeric' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="hab-target" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Meta por dia *</label>
                <input id="hab-target" type="number" min="1" step="1" className="input-field" placeholder="20" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="hab-unit" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Unidade</label>
                <input id="hab-unit" className="input-field" placeholder="leads, ligações…" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cor</label>
            <div className="flex gap-2">
              {COLOR_ORDER.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  aria-label={`Cor ${c}`}
                  className={`w-7 h-7 rounded-lg transition-all cursor-pointer ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#111114]' : ''}`}
                  style={{ backgroundColor: HABIT_COLORS[c], ...(form.color === c ? { boxShadow: `0 0 0 2px ${HABIT_COLORS[c]}` } : {}) }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Ícone</label>
            <div className="flex flex-wrap gap-2">
              {ICON_ORDER.map(key => {
                const Icon = HABIT_ICONS[key]
                const active = form.icon === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon: key }))}
                    aria-label={`Ícone ${key}`}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      active
                        ? 'border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                        : 'border-gray-200 dark:border-[#28282d] text-gray-400 dark:text-[#00a02a] hover:border-gray-300 dark:hover:border-[#3a3a40]'
                    }`}
                  >
                    <Icon size={15} />
                  </button>
                )
              })}
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">{saveError}</div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editing ? 'Salvar' : 'Criar hábito'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal excluir ──────────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover hábito" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteTarget.name}</strong> da sua rotina? O histórico não aparece mais, mas nada é apagado permanentemente.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
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
