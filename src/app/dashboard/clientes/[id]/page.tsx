'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  ArrowLeft, Phone, Mail, Instagram, ExternalLink,
  FolderKanban, FileText, Edit2, Trash2, MessageCircle, Plus, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientStatusConfig, projectStatusConfig, formatDate, formatCurrency, projectTypeLabels } from '@/lib/utils'
import { Client, Project } from '@/types'

export default function ClientePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
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
  }, [id])

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
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-16 h-16 rounded-2xl bg-[#40916C]/10 flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-[#40916C]">{client.name.charAt(0)}</span>
                </div>
                <h2 className="font-semibold text-gray-900 text-base leading-tight mb-1">{client.name}</h2>
                <p className="text-sm text-gray-500">{client.specialty}</p>
                <Badge color={cfg.color as never} className="mt-2">{cfg.label}</Badge>
              </div>

              <div className="space-y-3 text-sm">
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-2.5 text-gray-600 hover:text-[#40916C] transition-colors">
                    <Mail size={14} className="text-gray-400" />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
                {client.whatsapp && (
                  <a href={`https://wa.me/55${client.whatsapp}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 hover:text-emerald-600 transition-colors">
                    <Phone size={14} className="text-gray-400" />
                    <span>{client.whatsapp}</span>
                  </a>
                )}
                {client.instagram && (
                  <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 hover:text-purple-600 transition-colors">
                    <Instagram size={14} className="text-gray-400" />
                    <span>{client.instagram}</span>
                  </a>
                )}
                {client.website && (
                  <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 hover:text-blue-600 transition-colors">
                    <ExternalLink size={14} className="text-gray-400" />
                    <span className="truncate">{client.website}</span>
                  </a>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                <span>Cliente desde</span>
                <span className="font-medium text-gray-600">{formatDate(client.created_at)}</span>
              </div>
            </Card>

            {client.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Observações</CardTitle>
                </CardHeader>
                <p className="text-sm text-gray-600 leading-relaxed">{client.notes}</p>
              </Card>
            )}

            {client.whatsapp && (
              <Card>
                <CardTitle className="mb-3">Contato rápido</CardTitle>
                <a
                  href={`https://wa.me/55${client.whatsapp}?text=Olá ${client.name.split(' ')[0]}, tudo bem?`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600">
                    <MessageCircle size={15} />
                    WhatsApp
                  </Button>
                </a>
              </Card>
            )}
          </div>

          {/* Projects + History */}
          <div className="col-span-2 space-y-4">
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <FolderKanban size={15} className="text-gray-400" />
                  <CardTitle>Projetos ({projects.length})</CardTitle>
                </div>
                <Button size="sm"><Plus size={13} />Novo projeto</Button>
              </CardHeader>
              {projects.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Nenhum projeto ainda</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {projects.map(project => (
                    <div key={project.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 text-[13px]">{project.name}</p>
                          <Badge color="gray" dot={false} className="text-[10px]">{projectTypeLabels[project.type]}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={projectStatusConfig[project.status].color as never} className="text-[10px]">
                            {projectStatusConfig[project.status].label}
                          </Badge>
                          <span className="text-[11px] text-gray-400">
                            Responsável: {project.responsible === 'isaac' ? 'Isaac' : 'Vinícius'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-800 tabular">{formatCurrency(project.value)}</p>
                        {project.deadline && <p className="text-[11px] text-gray-400">Prazo: {formatDate(project.deadline)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-gray-400" />
                  <CardTitle>Contratos</CardTitle>
                </div>
              </CardHeader>
              <div className="text-center py-10 text-gray-400 text-sm">Nenhum contrato vinculado ainda</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
