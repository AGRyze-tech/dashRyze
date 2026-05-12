'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import {
  ArrowLeft, Phone, Mail, Instagram, ExternalLink,
  FolderKanban, FileText, Edit2, Trash2, MessageCircle, Plus, Loader2,
  Calendar, CalendarCheck, StickyNote, User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientStatusConfig, projectStatusConfig, formatDate, formatCurrency, projectTypeLabels, projectTypeOptions, projectStatusOptions } from '@/lib/utils'
import { Client, Project, ProjectStatus } from '@/types'

const emptyProjectForm = {
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

export default function ClientePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyProjectForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: clientData }, { data: projectData }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', id).single(),
          supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        ])
        if (cancelled) return
        if (clientData) setClient(clientData)
        if (projectData) setProjects(projectData)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, supabase])

  function openNewProject() {
    setForm(emptyProjectForm)
    setFormError('')
    setModalOpen(true)
  }

  async function handleSaveProject() {
    if (!form.name || !form.start_date || !form.deadline) {
      setFormError('Preencha os campos obrigatórios.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const { data: newProject, error } = await supabase.from('projects').insert({
        client_id: id,
        name: form.name,
        type: form.type,
        status: form.status,
        responsible: form.responsible,
        value: parseFloat(form.value) || 0,
        start_date: form.start_date,
        deadline: form.deadline,
        url: form.url || null,
        notes: form.notes || null,
      }).select().single()
      if (error) { setFormError('Erro ao salvar.'); return }
      setProjects(prev => [newProject as Project, ...prev])
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const setField = (field: keyof typeof emptyProjectForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  if (loading) {
    return (
      <div>
        <Header title="Cliente" />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div>
        <Header title="Cliente não encontrado" />
        <div className="p-6">
          <Link href="/dashboard/clientes">
            <Button variant="outline"><ArrowLeft size={14} /> Voltar</Button>
          </Link>
        </div>
      </div>
    )
  }

  const cfg = clientStatusConfig[client.status]

  return (
    <div>
      <Header title={client.name} subtitle={client.specialty} />

      <div className="p-6 space-y-5">
        {/* Back + Actions */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard/clientes">
            <Button variant="outline" size="sm"><ArrowLeft size={13} /> Voltar</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Edit2 size={13} /> Editar</Button>
            <Button variant="danger" size="sm"><Trash2 size={13} /> Excluir</Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Profile card */}
          <div className="col-span-1 space-y-4">
            <Card>
              {/* Avatar + name */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-16 h-16 rounded-2xl bg-[#40916C]/10 dark:bg-[#40916C]/15 flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-[#40916C]">{client.name.charAt(0)}</span>
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-[#F8FBF9] text-base leading-tight mb-0.5">{client.name}</h2>
                <p className="text-sm text-gray-500 dark:text-[#8BA891] mb-2">{client.specialty}</p>
                <Badge color={cfg.color as never}>{cfg.label}</Badge>
              </div>

              {/* Contact links */}
              <div className="space-y-2.5 text-sm">
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-[#40916C] dark:hover:text-[#52B788] transition-colors group">
                    <Mail size={14} className="text-gray-400 dark:text-[#4A6B52] group-hover:text-[#40916C] dark:group-hover:text-[#52B788] flex-shrink-0 transition-colors" />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
                {client.whatsapp && (
                  <a href={`https://wa.me/55${client.whatsapp}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group">
                    <Phone size={14} className="text-gray-400 dark:text-[#4A6B52] group-hover:text-emerald-600 flex-shrink-0 transition-colors" />
                    <span>{client.whatsapp}</span>
                  </a>
                )}
                {client.instagram && (
                  <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-purple-600 dark:hover:text-purple-400 transition-colors group">
                    <Instagram size={14} className="text-gray-400 dark:text-[#4A6B52] group-hover:text-purple-600 flex-shrink-0 transition-colors" />
                    <span>{client.instagram}</span>
                  </a>
                )}
                {client.website && (
                  <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
                    <ExternalLink size={14} className="text-gray-400 dark:text-[#4A6B52] group-hover:text-blue-600 flex-shrink-0 transition-colors" />
                    <span className="truncate">{client.website}</span>
                  </a>
                )}
              </div>

              {/* Dates grid */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#1E3020] space-y-2">
                {client.closed_at && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-[#4A6B52]">
                      <Calendar size={12} />
                      <span>Fechamento</span>
                    </div>
                    <span className="font-medium text-gray-600 dark:text-[#8BA891]">{formatDate(client.closed_at)}</span>
                  </div>
                )}
                {client.delivery_date && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-[#4A6B52]">
                      <CalendarCheck size={12} />
                      <span>Entrega</span>
                    </div>
                    <span className="font-medium text-gray-600 dark:text-[#8BA891]">{formatDate(client.delivery_date)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400 dark:text-[#4A6B52]">
                    <User size={12} />
                    <span>Cliente desde</span>
                  </div>
                  <span className="font-medium text-gray-600 dark:text-[#8BA891]">{formatDate(client.created_at)}</span>
                </div>
              </div>
            </Card>

            {client.notes && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <StickyNote size={14} className="text-gray-400 dark:text-[#4A6B52]" />
                    <CardTitle>Observações</CardTitle>
                  </div>
                </CardHeader>
                <p className="text-sm text-gray-600 dark:text-[#A7C4AF] leading-relaxed">{client.notes}</p>
              </Card>
            )}

            {client.whatsapp && (
              <Card>
                <p className="text-xs font-semibold text-gray-500 dark:text-[#4A6B52] uppercase tracking-wide mb-3">Contato rápido</p>
                <a
                  href={`https://wa.me/55${client.whatsapp}?text=Olá ${client.name.split(' ')[0]}, tudo bem?`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700">
                    <MessageCircle size={15} />
                    WhatsApp
                  </Button>
                </a>
              </Card>
            )}
          </div>

          {/* Projects + Contracts */}
          <div className="col-span-2 space-y-4">
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#1E3020]">
                <div className="flex items-center gap-2">
                  <FolderKanban size={15} className="text-gray-400 dark:text-[#4A6B52]" />
                  <CardTitle>Projetos ({projects.length})</CardTitle>
                </div>
                <Button size="sm" onClick={openNewProject}><Plus size={13} />Novo projeto</Button>
              </CardHeader>
              {projects.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-[#4A6B52] text-sm">Nenhum projeto ainda</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-[#1E3020]">
                  {projects.map(project => (
                    <div key={project.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#1A2C1F] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px]">{project.name}</p>
                          <Badge color="gray" dot={false} className="text-[10px]">{projectTypeLabels[project.type]}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={projectStatusConfig[project.status].color as never} className="text-[10px]">
                            {projectStatusConfig[project.status].label}
                          </Badge>
                          <span className="text-[11px] text-gray-400 dark:text-[#8BA891]">
                            Responsável: {project.responsible === 'isaac' ? 'Isaac' : 'Vinícius'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-0.5">
                        {project.value > 0 && (
                          <p className="text-sm font-semibold text-gray-800 dark:text-[#D1FAE5] tabular">{formatCurrency(project.value)}</p>
                        )}
                        {project.start_date && (
                          <p className="text-[11px] text-gray-400 dark:text-[#8BA891]">Início: {formatDate(project.start_date)}</p>
                        )}
                        {project.deadline && (
                          <p className="text-[11px] text-gray-400 dark:text-[#8BA891]">Prazo: {formatDate(project.deadline)}</p>
                        )}
                        {project.url && (
                          <a href={`https://${project.url}`} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-[#40916C] dark:text-[#52B788] hover:underline flex items-center gap-1 justify-end">
                            <ExternalLink size={10} />
                            Ver site
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#1E3020]">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-gray-400 dark:text-[#4A6B52]" />
                  <CardTitle>Contratos</CardTitle>
                </div>
              </CardHeader>
              <div className="text-center py-10 text-gray-400 dark:text-[#4A6B52] text-sm">Nenhum contrato vinculado ainda</div>
            </Card>
          </div>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo projeto" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nome do projeto *</label>
            <input type="text" value={form.name} onChange={setField('name')} placeholder="Ex: Site institucional" className="input-field" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo</label>
            <select value={form.type} onChange={setField('type')} className="input-field cursor-pointer" aria-label="Tipo">
              {projectTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
            <select value={form.status} onChange={setField('status')} className="input-field cursor-pointer" aria-label="Status">
              {projectStatusOptions.map(o => <option key={o.status} value={o.status}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Responsável</label>
            <select value={form.responsible} onChange={setField('responsible')} className="input-field cursor-pointer" aria-label="Responsável">
              <option value="isaac">Isaac</option>
              <option value="vinicius">Vinicius</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Valor (R$)</label>
            <input type="number" value={form.value} onChange={setField('value')} placeholder="0,00" min="0" step="0.01" className="input-field" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data de início *</label>
            <input type="date" value={form.start_date} onChange={setField('start_date')} className="input-field" aria-label="Data de início" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Prazo de entrega *</label>
            <input type="date" value={form.deadline} onChange={setField('deadline')} className="input-field" aria-label="Prazo de entrega" />
          </div>

          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">URL do projeto</label>
            <input type="text" value={form.url} onChange={setField('url')} placeholder="exemplo.com.br" className="input-field" />
          </div>

          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações</label>
            <textarea value={form.notes} onChange={setField('notes')} rows={3} placeholder="Detalhes adicionais..." className="input-field resize-none" />
          </div>

          {formError && (
            <p className="col-span-2 text-[12px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="col-span-2 flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProject} loading={saving}>Criar projeto</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
