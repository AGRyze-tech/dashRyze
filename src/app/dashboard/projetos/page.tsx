'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const supabase = createClient()
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, Clock, Plus, ExternalLink, User, Pencil, Trash2 } from 'lucide-react'
import {
  formatDate, formatCurrency, daysUntil, isDeadlineWarning, isOverdue,
  projectTypeLabels, deadlineLabel,
} from '@/lib/utils'
import { Project, ProjectStatus, Client } from '@/types'

const columns: { status: ProjectStatus; label: string; color: string }[] = [
  { status: 'briefing',       label: 'Briefing',       color: '#3B82F6' },
  { status: 'desenvolvimento', label: 'Desenvolvimento', color: '#7C3AED' },
  { status: 'revisao',        label: 'Revisão',        color: '#F59E0B' },
  { status: 'entregue',       label: 'Entregue',       color: '#10B981' },
  { status: 'concluido',      label: 'Concluído',      color: '#6B7280' },
  { status: 'pausado',        label: 'Pausado',        color: '#EF4444' },
]

const typeOptions = Object.entries(projectTypeLabels).map(([value, label]) => ({ value, label }))

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

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
}) {
  const days = daysUntil(project.deadline)
  const warn = isDeadlineWarning(project.deadline)
  const over = isOverdue(project.deadline)
  const active = !['concluido', 'entregue'].includes(project.status)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-[13px] leading-tight mb-1">{project.name}</p>
          <p className="text-[11px] text-gray-400 truncate">{project.client?.name ?? '—'}</p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {projectTypeLabels[project.type]}
          </span>
          <button
            type="button"
            aria-label="Editar projeto"
            onClick={e => { e.stopPropagation(); onEdit(project) }}
            className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            aria-label="Excluir projeto"
            onClick={e => { e.stopPropagation(); onDelete(project) }}
            className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <User size={11} className="text-gray-400" />
          <span className="text-[11px] text-gray-500 capitalize">{project.responsible}</span>
        </div>
        <span className="tabular text-[12px] font-semibold text-[#40916C]">{formatCurrency(project.value)}</span>
      </div>

      {active && (
        <div className={`flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 ${over ? 'text-red-500' : warn ? 'text-amber-500' : 'text-gray-400'}`}>
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
}

export default function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<ProjectStatus | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: proj } = await supabase
      .from('projects')
      .select('*, client:clients(id, name)')
      .order('created_at', { ascending: false })
    setProjects((proj as Project[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.from('clients').select('id, name, specialty').order('name')
      .then(({ data }) => setClients((data as Client[]) ?? []))
    load()
  }, [load])

  function openCreate() {
    setEditTarget(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(project: Project) {
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
  }

  async function handleSave() {
    if (!form.client_id || !form.name || !form.start_date || !form.deadline) {
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
      const { error: err } = await supabase.from('projects').update(payload).eq('id', editTarget.id)
      if (err) { setError('Erro ao salvar.'); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('projects').insert(payload)
      if (err) { setError('Erro ao salvar.'); setSaving(false); return }
    }

    await load()
    setModalOpen(false)
    setSaving(false)
  }

  async function handleDelete(project: Project) {
    await supabase.from('projects').delete().eq('id', project.id)
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
    const { error } = await supabase.from('projects').update({ status }).eq('id', id)
    if (error && prev) setProjects(ps => ps.map(p => p.id === id ? { ...p, status: prev } : p))
  }

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const totalValue = projects.filter(p => !['concluido', 'entregue'].includes(p.status)).reduce((s, p) => s + p.value, 0)

  return (
    <div>
      <Header
        title="Projetos"
        subtitle={loading ? 'Carregando...' : `${projects.length} projetos · ${formatCurrency(totalValue)} em aberto`}
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex flex-wrap gap-4">
            {columns.map(col => {
              const count = projects.filter(p => p.status === col.status).length
              return (
                <div key={col.status} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-[12px] text-gray-500">
                    {col.label} <strong className="text-gray-700">{count}</strong>
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
            const colProjects = projects.filter(p => p.status === col.status)
            const isOver = dragOver === col.status

            return (
              <div
                key={col.status}
                className={`flex-shrink-0 w-[270px] rounded-xl transition-all duration-150 ${isOver ? 'ring-2 ring-[#40916C]/40' : ''}`}
                style={{ background: isOver ? 'rgba(64,145,108,0.04)' : '#F3F4F6' }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.status) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col.status)}
              >
                <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200/70">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="text-[12px] font-semibold text-gray-700">{col.label}</span>
                    <span className="text-[11px] text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 py-px font-medium">
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
                      />
                    </div>
                  ))}
                  {colProjects.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center">
                      <span className="text-[11px] text-gray-400">Soltar aqui</span>
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
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Cliente *</label>
            <select value={form.client_id} onChange={set('client_id')} title="Cliente"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] bg-white">
              <option value="">Selecione um cliente</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nome do projeto *</label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="Ex: Site institucional"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Tipo</label>
            <select value={form.type} onChange={set('type')} title="Tipo"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] bg-white">
              {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Status</label>
            <select value={form.status} onChange={set('status')} title="Status"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] bg-white">
              {columns.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Responsável</label>
            <select value={form.responsible} onChange={set('responsible')} title="Responsável"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] bg-white">
              <option value="isaac">Isaac</option>
              <option value="vinicius">Vinicius</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Valor (R$)</label>
            <input type="number" value={form.value} onChange={set('value')} placeholder="0,00" min="0" step="0.01"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Data de início *</label>
            <input type="date" value={form.start_date} onChange={set('start_date')} title="Data de início"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prazo de entrega *</label>
            <input type="date" value={form.deadline} onChange={set('deadline')} title="Prazo de entrega"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10" />
          </div>

          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">URL do projeto</label>
            <input type="text" value={form.url} onChange={set('url')} placeholder="exemplo.com.br"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10" />
          </div>

          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Observações</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Detalhes adicionais..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10 resize-none" />
          </div>

          {error && (
            <p className="col-span-2 text-[12px] text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
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
          <p className="text-[14px] text-gray-600">
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
