'use client'
import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { createClient } from '@/lib/supabase'
import { projectRepository, clientRepository } from '@/lib/repositories'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, Clock, Plus, ExternalLink, User, Pencil, Trash2, Eye } from 'lucide-react'
import {
  formatDate, formatCurrency, daysUntil, isDeadlineWarning, isOverdue,
  projectTypeLabels, projectTypeOptions, deadlineLabel,
} from '@/lib/utils'
import { Project, ProjectStatus, Client } from '@/types'

const columns: { status: ProjectStatus; label: string; color: string }[] = [
  { status: 'briefing',        label: 'Briefing',        color: '#3B82F6' },
  { status: 'desenvolvimento', label: 'Desenvolvimento', color: '#7C3AED' },
  { status: 'revisao',         label: 'Revisão',         color: '#F59E0B' },
  { status: 'entregue',        label: 'Entregue',        color: '#10B981' },
  { status: 'concluido',       label: 'Concluído',       color: '#6B7280' },
  { status: 'pausado',         label: 'Pausado',         color: '#EF4444' },
]

const emptyForm = {
  client_id: '',
  name: '',
  type: 'site' as Project['type'],
  status: 'briefing' as ProjectStatus,
  responsible: 'isaac' as 'isaac' | 'vinicius',
  value: '',
  start_date: '',
  deadline: '',
  url: '',
  notes: '',
}

const ProjectCard = memo(function ProjectCard({
  project,
  onEdit,
  onDelete,
  onView,
}: {
  project: Project
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
  onView: (p: Project) => void
}) {
  const days = daysUntil(project.deadline)
  const warn = isDeadlineWarning(project.deadline)
  const over = isOverdue(project.deadline)
  const active = !['concluido', 'entregue'].includes(project.status)

  return (
    <div className="bg-white dark:bg-[#152218] border border-gray-200 dark:border-[#1E3020] rounded-xl p-4 shadow-sm dark:shadow-black/30 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-[#F0FDF4] text-[13px] leading-tight mb-1">{project.name}</p>
          <p className="text-[11px] text-gray-400 dark:text-[#4A6B52] truncate">{project.client?.name ?? '—'}</p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <span className="text-[10px] font-medium text-gray-400 dark:text-[#8BA891] bg-gray-100 dark:bg-[#1A2C1F] px-1.5 py-0.5 rounded">
            {projectTypeLabels[project.type]}
          </span>
          <button
            type="button"
            aria-label="Visualizar projeto"
            onClick={e => { e.stopPropagation(); onView(project) }}
            className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-300 dark:text-[#2A4030] hover:text-blue-500 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Eye size={11} />
          </button>
          <button
            type="button"
            aria-label="Editar projeto"
            onClick={e => { e.stopPropagation(); onEdit(project) }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#1A2C1F] text-gray-300 dark:text-[#2A4030] hover:text-gray-600 dark:hover:text-[#8BA891] transition-colors opacity-0 group-hover:opacity-100"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            aria-label="Excluir projeto"
            onClick={e => { e.stopPropagation(); onDelete(project) }}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 dark:text-[#2A4030] hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <User size={11} className="text-gray-400" />
          <span className="text-[11px] text-gray-500 dark:text-[#8BA891] capitalize">{project.responsible}</span>
        </div>
        <span className="tabular text-[12px] font-semibold text-[#40916C]">{formatCurrency(project.value)}</span>
      </div>

      {active && (
        <div className={`flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-[#1E3020] ${over ? 'text-red-500 dark:text-red-400' : warn ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-[#4A6B52]'}`}>
          {(over || warn) ? <AlertTriangle size={11} /> : <Clock size={11} />}
          <span className="text-[11px] font-medium">{deadlineLabel(days)}</span>
          <span className="ml-auto text-[10px]">{formatDate(project.deadline)}</span>
        </div>
      )}

      {project.url && (
        <a
          href={project.url.startsWith('http') ? project.url : `https://${project.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 mt-2 text-[11px] text-[#40916C] hover:underline"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={10} />
          {project.url}
        </a>
      )}
    </div>
  )
})

export default function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<ProjectStatus | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [viewTarget, setViewTarget] = useState<Project | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const projRepo = useMemo(() => projectRepository(createClient()), [])
  const clientRepo = useMemo(() => clientRepository(createClient()), [])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await projRepo.findAll()
    setProjects(data)
    setLoading(false)
  }, [projRepo])

  useEffect(() => {
    clientRepo.findForSelect().then(data => setClients(data as Client[]))
    load()
  }, [load])

  function openCreate() {
    setEditTarget(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = useCallback((project: Project) => {
    setEditTarget(project)
    setForm({
      client_id: project.client_id,
      name: project.name,
      type: project.type,
      status: project.status,
      responsible: project.responsible,
      value: String(project.value),
      start_date: project.start_date,
      deadline: project.deadline,
      url: project.url ?? '',
      notes: project.notes ?? '',
    })
    setError('')
    setModalOpen(true)
  }, [])

  async function handleSave() {
    if (!form.client_id || !form.start_date || !form.deadline) {
      setError('Preencha os campos obrigatórios.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      client_id: form.client_id,
      name: form.name,
      type: form.type,
      status: form.status,
      responsible: form.responsible,
      value: parseFloat(form.value) || 0,
      start_date: form.start_date,
      deadline: form.deadline,
      url: form.url || null,
      notes: form.notes || null,
    }

    if (editTarget) {
      try { await projRepo.update(editTarget.id, payload) }
      catch { setError('Erro ao salvar.'); setSaving(false); return }
    } else {
      try { await projRepo.create(payload) }
      catch { setError('Erro ao salvar.'); setSaving(false); return }
    }

    await load()
    setModalOpen(false)
    setSaving(false)
  }

  async function handleDelete(project: Project) {
    await projRepo.remove(project.id)
    setProjects(prev => prev.filter(p => p.id !== project.id))
    setDeleteTarget(null)
  }

  async function handleDrop(status: ProjectStatus) {
    if (!dragging) return
    const id = dragging
    const prev = projects.find(p => p.id === id)?.status
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status } : p))
    setDragging(null)
    setDragOver(null)
    try { await projRepo.updateStatus(id, status) }
    catch { if (prev) setProjects(ps => ps.map(p => p.id === id ? { ...p, status: prev } : p)) }
  }

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    const client = clients.find(c => c.id === id)
    if (client) {
      setForm(prev => ({
        ...prev,
        client_id: id,
        name: `${client.name} - ${projectTypeLabels[prev.type] || 'Projeto'}`,
      }))
    } else {
      setForm(prev => ({ ...prev, client_id: id }))
    }
  }

  const { projectsByStatus, totalValue } = useMemo(() => {
    const byStatus: Partial<Record<ProjectStatus, Project[]>> = {}
    let total = 0
    for (const p of projects) {
      ;(byStatus[p.status] ??= []).push(p)
      if (p.status !== 'concluido' && p.status !== 'entregue') total += p.value
    }
    return { projectsByStatus: byStatus, totalValue: total }
  }, [projects])

  return (
    <div>
      <Header
        title="Projetos"
        subtitle={loading ? 'Carregando...' : `${projects.length} projetos · ${formatCurrency(totalValue)} em aberto`}
      />

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex flex-wrap gap-4">
            {columns.map(col => {
              const count = projectsByStatus[col.status]?.length ?? 0
              return (
                <div key={col.status} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-[12px] text-gray-500 dark:text-[#8BA891]">
                    {col.label} <strong className="text-gray-700 dark:text-[#D1FAE5]">{count}</strong>
                  </span>
                </div>
              )
            })}
          </div>
          <Button onClick={openCreate}>
            <Plus size={14} /> Novo projeto
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {columns.map(col => {
            const colProjects = projectsByStatus[col.status] ?? []
            const isOver = dragOver === col.status

            return (
              <div
                key={col.status}
                className={`flex-shrink-0 w-[270px] rounded-xl transition-all duration-150 bg-gray-100 dark:bg-[#0F1A12] ${isOver ? 'ring-2 ring-[#40916C]/40 !bg-[#40916C]/5' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(col.status) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col.status)}
              >
                <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200/70 dark:border-[#1E3020]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="text-[12px] font-semibold text-gray-700 dark:text-[#D1FAE5]">{col.label}</span>
                    <span className="text-[11px] text-gray-400 dark:text-[#4A6B52] bg-white dark:bg-[#152218] border border-gray-200 dark:border-[#2A4030] rounded-full px-1.5 py-px font-medium">
                      {colProjects.length}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 space-y-2.5 min-h-[200px]">
                  {colProjects.map(project => (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={() => setDragging(project.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className={`transition-all ${dragging === project.id ? 'opacity-50 scale-[0.97]' : ''}`}
                    >
                      <ProjectCard
                        project={project}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onView={setViewTarget}
                      />
                    </div>
                  ))}
                  {colProjects.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 dark:border-[#1E3020] rounded-xl h-20 flex items-center justify-center">
                      <span className="text-[11px] text-gray-400 dark:text-[#2A4030]">Soltar aqui</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Editar projeto' : 'Novo projeto'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliente *</label>
            <select value={form.client_id} onChange={handleClientChange} className="input-field cursor-pointer" aria-label="Cliente">
              <option value="">Selecione um cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo</label>
            <select value={form.type} onChange={set('type')} className="input-field cursor-pointer" aria-label="Tipo">
              {projectTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Responsável</label>
            <select value={form.responsible} onChange={set('responsible')} className="input-field cursor-pointer" aria-label="Responsável">
              <option value="isaac">Isaac</option>
              <option value="vinicius">Vinicius</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data de início *</label>
            <input type="date" value={form.start_date} onChange={set('start_date')} className="input-field" aria-label="Data de início" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Prazo de entrega *</label>
            <input type="date" value={form.deadline} onChange={set('deadline')} className="input-field" aria-label="Prazo de entrega" />
          </div>

          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">URL do projeto</label>
            <input type="text" value={form.url} onChange={set('url')} placeholder="exemplo.com.br" className="input-field" />
          </div>

          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Detalhes adicionais..." className="input-field resize-none" />
          </div>

          {error && (
            <p className="col-span-2 text-[12px] text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="col-span-2 flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {editTarget ? 'Salvar alterações' : 'Criar projeto'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir projeto" size="sm">
        <div className="space-y-4">
          <p className="text-[14px] text-gray-600 dark:text-[#A7C4AF]">
            Tem certeza que deseja excluir <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Excluir</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} title="Detalhes do projeto" size="lg">
        {viewTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Projeto</p>
                <p className="text-[15px] font-semibold text-gray-900 dark:text-[#F0FDF4]">{viewTarget.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Cliente</p>
                <p className="text-[13px] text-gray-700 dark:text-[#D1FAE5]">{viewTarget.client?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Tipo</p>
                <p className="text-[13px] text-gray-700 dark:text-[#D1FAE5]">{projectTypeLabels[viewTarget.type]}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Status</p>
                <p className="text-[13px] text-gray-700 dark:text-[#D1FAE5]">
                  {columns.find(c => c.status === viewTarget.status)?.label ?? viewTarget.status}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Responsável</p>
                <p className="text-[13px] text-gray-700 dark:text-[#D1FAE5] capitalize">{viewTarget.responsible}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Valor</p>
                <p className="text-[13px] font-semibold text-[#40916C]">{formatCurrency(viewTarget.value)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Prazo</p>
                <p className="text-[13px] text-gray-700 dark:text-[#D1FAE5]">{formatDate(viewTarget.deadline)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Início</p>
                <p className="text-[13px] text-gray-700 dark:text-[#D1FAE5]">{formatDate(viewTarget.start_date)}</p>
              </div>
              {viewTarget.url && (
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">URL</p>
                  <a
                    href={viewTarget.url.startsWith('http') ? viewTarget.url : `https://${viewTarget.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-[#40916C] hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={11} />
                    {viewTarget.url}
                  </a>
                </div>
              )}
              {viewTarget.notes && (
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-gray-400 dark:text-[#4A6B52] uppercase tracking-wide mb-0.5">Observações</p>
                  <p className="text-[13px] text-gray-600 dark:text-[#A7C4AF] whitespace-pre-wrap">{viewTarget.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={() => setViewTarget(null)}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
