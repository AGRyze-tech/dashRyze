'use client'
import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import {
  Wrench, Plus, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientRepository } from '@/lib/repositories'
import { formatDate } from '@/lib/utils'
import { Modification, ModificationPriority, ModificationStatus, Client } from '@/types'
import { useToast } from '@/hooks/useToast'

const priorityConfig: Record<ModificationPriority, { label: string; color: 'red' | 'yellow' | 'green'; icon: React.ElementType; rowClass: string }> = {
  alta:  { label: 'Alta',  color: 'red',    icon: AlertTriangle, rowClass: 'border-l-2 border-red-400 dark:border-red-600' },
  media: { label: 'Média', color: 'yellow', icon: Clock,         rowClass: 'border-l-2 border-amber-400 dark:border-amber-600' },
  baixa: { label: 'Baixa', color: 'green',  icon: CheckCircle2,  rowClass: 'border-l-2 border-gray-200 dark:border-[#28282d]' },
}

const statusConfig: Record<ModificationStatus, { label: string; color: 'blue' | 'yellow' | 'green' }> = {
  pendente:     { label: 'Pendente',      color: 'blue' },
  em_andamento: { label: 'Em andamento',  color: 'yellow' },
  concluida:    { label: 'Concluída',     color: 'green' },
}

type TabStatus = ModificationStatus | 'todas'

const tabs: { id: TabStatus; label: string }[] = [
  { id: 'todas',        label: 'Todas' },
  { id: 'pendente',     label: 'Pendentes' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluida',    label: 'Concluídas' },
]

const emptyForm = {
  title: '',
  description: '',
  client_id: '',
  client_name: '',
  project_id: '' as string,
  priority: 'media' as ModificationPriority,
  status: 'pendente' as ModificationStatus,
  deadline: '',
  assigned_to: 'isaac' as 'isaac' | 'vinicius',
}

interface ProjectOption {
  id: string
  name: string
  client_id?: string
  client_name?: string
  responsible: 'isaac' | 'vinicius'
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-[#181819] ${className}`} />
}

function daysUntil(date: string): number {
  const target = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ModificacoesPage() {
  const [mods, setMods] = useState<Modification[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [tab, setTab] = useState<TabStatus>('todas')
  const [priorityFilter, setPriorityFilter] = useState<ModificationPriority | 'todas'>('todas')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Modification | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Modification | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()
  const db = useMemo(() => createClient(), [])
  const clientRepo = useMemo(() => clientRepository(db), [db])
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name' | 'specialty'>[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [{ data, error }, { data: projData }] = await Promise.all([
          db.from('modifications').select('*').order('created_at', { ascending: false }),
          db.from('projects').select('id, name, client_id, responsible, client:clients(name)').order('created_at', { ascending: false }),
        ])
        if (error) {
          if (error.code === '42P01') { setTableExists(false); return }
          throw error
        }
        setMods((data ?? []) as Modification[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProjects((projData ?? [] as any[]).map((p: any) => ({
          id: p.id as string,
          name: p.name as string,
          client_id: p.client_id as string | undefined,
          client_name: (Array.isArray(p.client) ? p.client[0]?.name : p.client?.name) as string | undefined,
          responsible: p.responsible as 'isaac' | 'vinicius',
        })))
      } catch (err) {
        console.error('Erro ao carregar modificações:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
    clientRepo.findForSelect()
      .then(data => setClients(data))
      .catch(err => console.error('Erro ao carregar clientes:', err))
  }, [db, clientRepo])

  const filtered = useMemo(() => {
    return mods.filter(m => {
      const matchTab = tab === 'todas' || m.status === tab
      const matchPriority = priorityFilter === 'todas' || m.priority === priorityFilter
      return matchTab && matchPriority
    })
  }, [mods, tab, priorityFilter])

  const stats = useMemo(() => {
    let pendentes = 0, andamento = 0, concluidas = 0
    for (const m of mods) {
      if (m.status === 'pendente')     pendentes++
      if (m.status === 'em_andamento') andamento++
      if (m.status === 'concluida')    concluidas++
    }
    return { total: mods.length, pendentes, andamento, concluidas }
  }, [mods])

  const tabCounts: Record<TabStatus, number> = {
    todas: stats.total,
    pendente: stats.pendentes,
    em_andamento: stats.andamento,
    concluida: stats.concluidas,
  }

  function handleOpenModal() {
    setEditing(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  function handleOpenEdit(m: Modification) {
    setEditing(m)
    setForm({
      title: m.title,
      description: m.description ?? '',
      client_id: m.client_id ?? '',
      client_name: m.client_name ?? '',
      project_id: m.project_id ?? '',
      priority: m.priority,
      status: m.status,
      deadline: m.deadline ?? '',
      assigned_to: m.assigned_to,
    })
    setSaveError('')
    setShowModal(true)
  }

  const projectsById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  const set = (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setForm(f => {
        const next = { ...f, [field]: value }
        // Auto-fill assigned_to and client from selected project
        if (field === 'project_id' && value) {
          const proj = projectsById.get(value)
          if (proj) {
            next.assigned_to = proj.responsible
            if (!next.client_id && proj.client_id) next.client_id = proj.client_id
            if (!next.client_name && proj.client_name) next.client_name = proj.client_name
          }
        }
        return next
      })
    }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setSaveError('Título é obrigatório.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        client_id: form.client_id || null,
        client_name: form.client_name.trim() || null,
        project_id: form.project_id || null,
        priority: form.priority,
        status: form.status,
        deadline: form.deadline || null,
        assigned_to: form.assigned_to,
      }
      if (editing) {
        const { data, error } = await db.from('modifications').update(payload).eq('id', editing.id).select().single()
        if (error) throw error
        setMods(prev => prev.map(m => m.id === editing.id ? (data as Modification) : m))
        showToast('Modificação atualizada!')
      } else {
        const { data, error } = await db.from('modifications').insert([payload]).select().single()
        if (error) throw error
        setMods(prev => [data as Modification, ...prev])
        showToast('Modificação registrada!')
      }
      setShowModal(false)
      setEditing(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const { error } = await db.from('modifications').delete().eq('id', deleteModal.id)
      if (error) throw error
      setMods(prev => prev.filter(m => m.id !== deleteModal.id))
      showToast('Modificação removida.')
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusChange(id: string, status: ModificationStatus) {
    const { data, error } = await db.from('modifications').update({ status }).eq('id', id).select().single()
    if (error) return
    setMods(prev => prev.map(m => m.id === id ? (data as Modification) : m))
  }

  if (!tableExists) {
    return (
      <div>
        <Header title="Modificações" subtitle="Tarefas e ajustes de projetos" />
        <div className="p-4 sm:p-6">
          <div className="card-light p-8 flex flex-col items-center text-center gap-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Wrench size={20} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-800 dark:text-[#D1FAE5] mb-1">Tabela não encontrada</p>
              <p className="text-[13px] text-gray-500 dark:text-[#00a02a]">Execute o SQL abaixo no Supabase para ativar esta seção.</p>
            </div>
            <pre className="w-full text-left text-[11px] bg-gray-900 text-emerald-400 rounded-xl p-4 overflow-x-auto leading-relaxed">
{`create table if not exists modifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  client_name text,
  project_id uuid references projects(id) on delete set null,
  priority text not null default 'media'
    check (priority in ('alta', 'media', 'baixa')),
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluida')),
  deadline date,
  assigned_to text not null default 'isaac'
    check (assigned_to in ('isaac', 'vinicius')),
  labels text[],
  created_at timestamptz default now()
);
alter table modifications enable row level security;
create policy "allow all" on modifications
  for all using (true) with check (true);`}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Modificações" subtitle="Tarefas, ajustes e solicitações de clientes" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center mb-3">
              <Wrench size={16} className="text-gray-500 dark:text-[#00a02a]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Total</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4]">{stats.total}</p>
            )}
          </div>
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center mb-3">
              <Clock size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Pendentes</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-blue-700 dark:text-blue-300">{stats.pendentes}</p>
            )}
          </div>
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-3">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Em andamento</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-amber-700 dark:text-amber-300">{stats.andamento}</p>
            )}
          </div>
          <div className="stat-card p-5">
            <div className="w-9 h-9 rounded-xl bg-[#00FF41]/10 dark:bg-[#00FF41]/20 flex items-center justify-center mb-3">
              <CheckCircle2 size={16} className="text-[#00FF41]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Concluídas</p>
            {loading ? <Skeleton className="h-7 w-10" /> : (
              <p className="text-[28px] font-bold leading-none text-[#00FF41]">{stats.concluidas}</p>
            )}
          </div>
        </div>

        {/* Tabbed list */}
        <div className="card-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#181819]">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a]">Tarefas</h3>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5] mt-0.5">{filtered.length} item{filtered.length !== 1 ? 'ns' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value as ModificationPriority | 'todas')}
                  className="input-field py-1.5 pr-7 text-[12px] cursor-pointer"
                  aria-label="Filtrar por prioridade"
                >
                  <option value="todas">Todas prioridades</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
              <Button size="sm" onClick={handleOpenModal}><Plus size={13} /> Nova</Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-100 dark:border-[#181819] overflow-x-auto">
            {tabs.map(t => {
              const isActive = tab === t.id
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
                    isActive ? 'bg-[#00FF41]/15 text-[#00FF41]' : 'bg-gray-100 dark:bg-[#181819] text-gray-400 dark:text-[#00a02a]'
                  }`}>
                    {tabCounts[t.id]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* List */}
          {loading ? (
            <div className="divide-y divide-gray-50 dark:divide-[#181819]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <Skeleton className="w-1 h-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center mb-3">
                <Wrench size={18} className="text-gray-300 dark:text-[#00a02a]" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-[#00a02a]">Nenhuma modificação nesta aba</p>
              <p className="text-[12px] text-gray-300 dark:text-[#00a02a] mt-0.5">Clique em &quot;Nova&quot; para adicionar</p>
            </div>
          ) : (
            <div>
              {filtered.map(m => {
                const pCfg = priorityConfig[m.priority]
                const sCfg = statusConfig[m.status]
                const daysLeft = m.deadline ? daysUntil(m.deadline) : null
                const isOverdue = daysLeft !== null && daysLeft < 0
                const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
                return (
                  <div key={m.id} className={`flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-[#181819] last:border-0 hover:bg-gray-50/70 dark:hover:bg-[#111114] transition-colors group ${pCfg.rowClass}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5] truncate">{m.title}</p>
                        <Badge color={pCfg.color} dot={false}>{pCfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {m.client_name && (
                          <span className="text-[11px] text-gray-400 dark:text-[#00a02a]">{m.client_name}</span>
                        )}
                        {m.deadline && (
                          <span className={`text-[11px] font-medium ${isOverdue ? 'text-red-500 dark:text-red-400' : isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-[#00a02a]'}`}>
                            · {isOverdue ? `Atrasado ${Math.abs(daysLeft!)}d` : daysLeft === 0 ? 'Prazo: hoje!' : `${formatDate(m.deadline)}`}
                          </span>
                        )}
                        {m.description && (
                          <span className="text-[11px] text-gray-300 dark:text-[#00a02a] truncate max-w-[200px]">· {m.description}</span>
                        )}
                      </div>
                    </div>
                    {/* Assigned to */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="w-6 h-6 rounded-full bg-[#00FF41]/15 dark:bg-[#00FF41]/20 flex items-center justify-center">
                        <User size={11} className="text-[#00FF41]" />
                      </div>
                      <span className="text-[11px] font-medium text-gray-500 dark:text-[#00a02a] capitalize">{m.assigned_to}</span>
                    </div>
                    {/* Inline status */}
                    <div className="relative flex-shrink-0">
                      <select
                        value={m.status}
                        onChange={e => handleStatusChange(m.id, e.target.value as ModificationStatus)}
                        className="appearance-none text-[10px] font-semibold px-2 py-0.5 pr-5 rounded-full border cursor-pointer bg-gray-50 dark:bg-[#181819] border-gray-200 dark:border-[#28282d] text-gray-600 dark:text-[#A7C4AF]"
                        aria-label="Status da modificação"
                      >
                        <option value="pendente">Pendente</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="concluida">Concluída</option>
                      </select>
                      <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>
                    <Badge color={sCfg.color} dot={false}>{sCfg.label}</Badge>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(m)}
                        aria-label="Editar"
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-[#00FF41]/10 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-[#00FF41] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModal(m)}
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

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? 'Editar Modificação' : 'Nova Modificação'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="mod-title" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Título *</label>
              <input id="mod-title" className="input-field" placeholder="Ex: Ajustar botão do hero..." value={form.title} onChange={set('title')} required />
            </div>
            <div>
              <label htmlFor="mod-project" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Projeto</label>
              <select id="mod-project" className="input-field cursor-pointer" value={form.project_id} onChange={set('project_id')}>
                <option value="">Sem projeto vinculado</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.client_name ? ` — ${p.client_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mod-client" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliente</label>
              <select
                id="mod-client"
                className="input-field cursor-pointer"
                value={form.client_id}
                onChange={e => {
                  const clientId = e.target.value
                  const client = clients.find(c => c.id === clientId)
                  setForm(f => ({ ...f, client_id: clientId, client_name: client?.name ?? '' }))
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
              <label htmlFor="mod-priority" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Prioridade</label>
              <select id="mod-priority" className="input-field cursor-pointer" value={form.priority} onChange={set('priority')}>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label htmlFor="mod-status" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
              <select id="mod-status" className="input-field cursor-pointer" value={form.status} onChange={set('status')}>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
            <div>
              <label htmlFor="mod-deadline" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Prazo</label>
              <input id="mod-deadline" type="date" className="input-field" value={form.deadline} onChange={set('deadline')} />
            </div>
            <div>
              <label htmlFor="mod-assigned" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Responsável</label>
              <select id="mod-assigned" className="input-field cursor-pointer" value={form.assigned_to} onChange={set('assigned_to')}>
                <option value="isaac">Isaac</option>
                <option value="vinicius">Vinicius</option>
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="mod-desc" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Descrição</label>
              <textarea id="mod-desc" className="input-field resize-none" rows={3} placeholder="Detalhe o que precisa ser feito..." value={form.description} onChange={set('description')} />
            </div>
          </div>
          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">{saveError}</div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowModal(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Modificação" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.title}</strong>?
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
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#111114] dark:border dark:border-[#28282d] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
