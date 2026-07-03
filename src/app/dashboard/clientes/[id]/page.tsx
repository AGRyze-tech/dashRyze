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
  Calendar, CalendarCheck, StickyNote, User, Wallet, TrendingUp, TrendingDown,
  Receipt, CheckCircle2, XCircle, Server, Wrench, MapPin, Star,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientStatusConfig, projectStatusConfig, installmentStatusConfig, formatDate, formatCurrency, projectTypeLabels, projectTypeOptions, projectStatusOptions } from '@/lib/utils'
import {
  Client, Project, ProjectStatus, Contract, ContractInstallment, Transaction,
  PaymentProof, Meeting, Hosting, Modification, GmbProfile,
} from '@/types'

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

const meetingTypeLabels: Record<string, string> = { reuniao: 'Reunião', fechamento: 'Fechamento', pos_call: 'Pós Call' }
const meetingStatusConfig: Record<string, { label: string; color: string }> = {
  agendada: { label: 'Agendada', color: 'blue' }, concluida: { label: 'Concluída', color: 'green' },
  churned: { label: 'Churned', color: 'red' }, no_show: { label: 'No-show', color: 'yellow' },
}
const hostingStatusConfig: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'green' }, inativo: { label: 'Inativo', color: 'gray' }, vencido: { label: 'Vencido', color: 'red' },
}
const modPriorityConfig: Record<string, { label: string; color: string }> = {
  alta: { label: 'Alta', color: 'red' }, media: { label: 'Média', color: 'yellow' }, baixa: { label: 'Baixa', color: 'gray' },
}
const modStatusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'blue' }, em_andamento: { label: 'Em andamento', color: 'yellow' }, concluida: { label: 'Concluída', color: 'green' },
}
const gmbStatusConfig: Record<string, { label: string; color: string }> = {
  verificado: { label: 'Verificado', color: 'green' }, ativo: { label: 'Ativo', color: 'blue' },
  pendente: { label: 'Pendente', color: 'yellow' }, suspenso: { label: 'Suspenso', color: 'red' },
}

type ContractWithInstallments = Contract & { installments: ContractInstallment[] }

function SectionCard({
  icon: Icon, title, count, children,
}: { icon: React.ElementType; title: string; count: number; children: React.ReactNode }) {
  return (
    <Card padding="none">
      <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#181819]">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-gray-400 dark:text-[#00a02a]" />
          <CardTitle>{title} ({count})</CardTitle>
        </div>
      </CardHeader>
      <div className="divide-y divide-gray-50 dark:divide-[#181819]">{children}</div>
    </Card>
  )
}

export default function ClientePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<ContractWithInstallments[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [proofs, setProofs] = useState<PaymentProof[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [hostings, setHostings] = useState<Hosting[]>([])
  const [mods, setMods] = useState<Modification[]>([])
  const [gmbProfiles, setGmbProfiles] = useState<GmbProfile[]>([])
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
        const [{ data: clientData }, { data: projectData }, { data: contractData }, { data: txData }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', id).single(),
          supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
          supabase.from('contracts').select('*, installments:contract_installments(*)').eq('client_id', id).order('created_at', { ascending: false }),
          supabase.from('transactions').select('*').eq('client_id', id).order('date', { ascending: false }),
        ])
        if (cancelled) return
        if (clientData) setClient(clientData)
        if (projectData) setProjects(projectData)
        if (contractData) setContracts(contractData as unknown as ContractWithInstallments[])
        if (txData) setTransactions(txData)

        if (clientData) {
          const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
          const targetName = normalize(clientData.name)
          const matchesClient = (row: { client_id?: string | null; client_name?: string | null }) =>
            row.client_id === id || (!!row.client_name && normalize(row.client_name) === targetName)

          // These tables link by client_name (or an optional client_id) rather than a
          // foreign key, and are small agency-scale tables — fetching all rows and
          // matching client-side avoids PostgREST filter syntax breaking on names that
          // contain parentheses/commas, and tolerates whitespace/case differences.
          const [{ data: proofData }, { data: meetingData }, { data: hostingData }, { data: modData }, { data: gmbData }] = await Promise.all([
            supabase.from('payment_proofs').select('*'),
            supabase.from('meetings').select('*').order('date', { ascending: false }),
            supabase.from('hosting').select('*'),
            supabase.from('modifications').select('*').order('created_at', { ascending: false }),
            supabase.from('gmb_profiles').select('*'),
          ])
          if (cancelled) return
          if (proofData) setProofs(proofData.filter(matchesClient))
          if (meetingData) setMeetings(meetingData.filter(matchesClient))
          if (hostingData) setHostings(hostingData.filter(matchesClient))
          if (modData) setMods(modData.filter(matchesClient))
          if (gmbData) setGmbProfiles(gmbData.filter(matchesClient))
        }
      } catch (err) {
        if (!cancelled) console.error('Erro ao carregar cliente:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, supabase])

  const financials = useMemo(() => {
    let contratado = 0, pago = 0, pendente = 0
    for (const c of contracts) {
      contratado += c.total_value
      for (const inst of c.installments ?? []) {
        if (inst.status === 'pago') pago += inst.value
        else pendente += inst.value
      }
    }
    return { contratado, pago, pendente }
  }, [contracts])

  function contractStatus(c: ContractWithInstallments) {
    const list = c.installments ?? []
    if (list.some(i => i.status === 'atrasado')) return installmentStatusConfig.atrasado
    if (list.some(i => i.status === 'pendente')) return installmentStatusConfig.pendente
    return installmentStatusConfig.pago
  }

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
                <div className="w-16 h-16 rounded-2xl bg-[#00FF41]/10 dark:bg-[#00FF41]/15 flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-[#00FF41]">{client.name.charAt(0)}</span>
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-[#F8FBF9] text-base leading-tight mb-0.5">{client.name}</h2>
                <p className="text-sm text-gray-500 dark:text-[#00a02a] mb-2">{client.specialty}</p>
                <Badge color={cfg.color as never}>{cfg.label}</Badge>
              </div>

              {/* Contact links */}
              <div className="space-y-2.5 text-sm">
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-[#00FF41] dark:hover:text-[#00FF41] transition-colors group">
                    <Mail size={14} className="text-gray-400 dark:text-[#00a02a] group-hover:text-[#00FF41] dark:group-hover:text-[#00FF41] flex-shrink-0 transition-colors" />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
                {client.whatsapp && (
                  <a href={`https://wa.me/55${client.whatsapp}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group">
                    <Phone size={14} className="text-gray-400 dark:text-[#00a02a] group-hover:text-emerald-600 flex-shrink-0 transition-colors" />
                    <span>{client.whatsapp}</span>
                  </a>
                )}
                {client.instagram && (
                  <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-purple-600 dark:hover:text-purple-400 transition-colors group">
                    <Instagram size={14} className="text-gray-400 dark:text-[#00a02a] group-hover:text-purple-600 flex-shrink-0 transition-colors" />
                    <span>{client.instagram}</span>
                  </a>
                )}
                {client.website && (
                  <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-gray-600 dark:text-[#A7C4AF] hover:text-blue-600 dark:hover:text-[#00FF41] transition-colors group">
                    <ExternalLink size={14} className="text-gray-400 dark:text-[#00a02a] group-hover:text-blue-600 flex-shrink-0 transition-colors" />
                    <span className="truncate">{client.website}</span>
                  </a>
                )}
              </div>

              {/* Dates grid */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#181819] space-y-2">
                {client.closed_at && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-[#00a02a]">
                      <Calendar size={12} />
                      <span>Fechamento</span>
                    </div>
                    <span className="font-medium text-gray-600 dark:text-[#00a02a]">{formatDate(client.closed_at)}</span>
                  </div>
                )}
                {client.delivery_date && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-[#00a02a]">
                      <CalendarCheck size={12} />
                      <span>Entrega</span>
                    </div>
                    <span className="font-medium text-gray-600 dark:text-[#00a02a]">{formatDate(client.delivery_date)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400 dark:text-[#00a02a]">
                    <User size={12} />
                    <span>Cliente desde</span>
                  </div>
                  <span className="font-medium text-gray-600 dark:text-[#00a02a]">{formatDate(client.created_at)}</span>
                </div>
              </div>
            </Card>

            {client.notes && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <StickyNote size={14} className="text-gray-400 dark:text-[#00a02a]" />
                    <CardTitle>Observações</CardTitle>
                  </div>
                </CardHeader>
                <p className="text-sm text-gray-600 dark:text-[#A7C4AF] leading-relaxed">{client.notes}</p>
              </Card>
            )}

            {client.whatsapp && (
              <Card>
                <p className="text-xs font-semibold text-gray-500 dark:text-[#00a02a] uppercase tracking-wide mb-3">Contato rápido</p>
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

          {/* Everything else */}
          <div className="col-span-2 space-y-4">
            {/* Financial summary */}
            {contracts.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div className="stat-card p-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center mb-2">
                    <Wallet size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Contratado</p>
                  <p className="text-[18px] font-bold leading-none text-gray-900 dark:text-[#F0FDF4] tabular">{formatCurrency(financials.contratado)}</p>
                </div>
                <div className="stat-card p-4">
                  <div className="w-8 h-8 rounded-lg bg-[#00FF41]/10 dark:bg-[#00FF41]/20 flex items-center justify-center mb-2">
                    <TrendingUp size={14} className="text-[#00FF41]" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Pago</p>
                  <p className="text-[18px] font-bold leading-none text-[#00FF41] tabular">{formatCurrency(financials.pago)}</p>
                </div>
                <div className="stat-card p-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-2">
                    <TrendingDown size={14} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#00a02a] mb-1">Pendente</p>
                  <p className={`text-[18px] font-bold leading-none tabular ${financials.pendente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-[#F0FDF4]'}`}>
                    {formatCurrency(financials.pendente)}
                  </p>
                </div>
              </div>
            )}

            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#181819]">
                <div className="flex items-center gap-2">
                  <FolderKanban size={15} className="text-gray-400 dark:text-[#00a02a]" />
                  <CardTitle>Projetos ({projects.length})</CardTitle>
                </div>
                <Button size="sm" onClick={openNewProject}><Plus size={13} />Novo projeto</Button>
              </CardHeader>
              {projects.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-[#00a02a] text-sm">Nenhum projeto ainda</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-[#181819]">
                  {projects.map(project => (
                    <div key={project.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px]">{project.name}</p>
                          <Badge color="gray" dot={false} className="text-[10px]">{projectTypeLabels[project.type]}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={projectStatusConfig[project.status].color as never} className="text-[10px]">
                            {projectStatusConfig[project.status].label}
                          </Badge>
                          <span className="text-[11px] text-gray-400 dark:text-[#00a02a]">
                            Responsável: {project.responsible === 'isaac' ? 'Isaac' : 'Vinícius'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-0.5">
                        {project.value > 0 && (
                          <p className="text-sm font-semibold text-gray-800 dark:text-[#D1FAE5] tabular">{formatCurrency(project.value)}</p>
                        )}
                        {project.start_date && (
                          <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">Início: {formatDate(project.start_date)}</p>
                        )}
                        {project.deadline && (
                          <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">Prazo: {formatDate(project.deadline)}</p>
                        )}
                        {project.url && (
                          <a href={`https://${project.url}`} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-[#00FF41] dark:text-[#00FF41] hover:underline flex items-center gap-1 justify-end">
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
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#181819]">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-gray-400 dark:text-[#00a02a]" />
                  <CardTitle>Contratos ({contracts.length})</CardTitle>
                </div>
              </CardHeader>
              {contracts.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-[#00a02a] text-sm">Nenhum contrato vinculado ainda</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-[#181819]">
                  {contracts.map(c => {
                    const sCfg = contractStatus(c)
                    const paidCount = (c.installments ?? []).filter(i => i.status === 'pago').length
                    return (
                      <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px]">{c.number}</p>
                          <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">
                            {c.payment_method === 'avista' ? 'À vista' : `${paidCount}/${c.installments_count} parcelas pagas`} · {formatDate(c.created_at)}
                          </p>
                        </div>
                        <Badge color={sCfg.color as never} className="text-[10px] flex-shrink-0">{sCfg.label}</Badge>
                        <p className="text-sm font-semibold text-gray-800 dark:text-[#D1FAE5] tabular flex-shrink-0">{formatCurrency(c.total_value)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {transactions.length > 0 && (
              <SectionCard icon={Wallet} title="Transações" count={transactions.length}>
                {transactions.map(t => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.type === 'entrada' ? 'bg-[#00FF41]/10 dark:bg-[#00FF41]/15' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      {t.type === 'entrada' ? <TrendingUp size={14} className="text-[#00FF41]" /> : <TrendingDown size={14} className="text-red-500 dark:text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px] truncate">{t.description}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">{formatDate(t.date)}</p>
                    </div>
                    <p className={`text-sm font-semibold tabular flex-shrink-0 ${t.type === 'entrada' ? 'text-[#00FF41]' : 'text-red-500 dark:text-red-400'}`}>
                      {t.type === 'entrada' ? '+' : '−'} {formatCurrency(t.amount)}
                    </p>
                  </div>
                ))}
              </SectionCard>
            )}

            {proofs.length > 0 && (
              <SectionCard icon={Receipt} title="Comprovantes" count={proofs.length}>
                {proofs.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px] truncate">{p.name}</p>
                      {p.amount > 0 && <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">{formatCurrency(p.amount)}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.start_file_url
                        ? <CheckCircle2 size={14} className="text-[#00FF41]" />
                        : <XCircle size={14} className="text-red-400" />}
                      {p.end_file_url
                        ? <CheckCircle2 size={14} className="text-[#00FF41]" />
                        : <XCircle size={14} className="text-red-400" />}
                    </div>
                  </div>
                ))}
              </SectionCard>
            )}

            {meetings.length > 0 && (
              <SectionCard icon={CalendarCheck} title="Reuniões" count={meetings.length}>
                {meetings.map(m => (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px]">{meetingTypeLabels[m.type] ?? m.type}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">{formatDate(m.date)}</p>
                    </div>
                    <Badge color={(meetingStatusConfig[m.status]?.color ?? 'gray') as never} className="text-[10px] flex-shrink-0">
                      {meetingStatusConfig[m.status]?.label ?? m.status}
                    </Badge>
                  </div>
                ))}
              </SectionCard>
            )}

            {hostings.length > 0 && (
              <SectionCard icon={Server} title="Hospedagem" count={hostings.length}>
                {hostings.map(h => (
                  <div key={h.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px] truncate">{h.domain}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">
                        {formatCurrency(h.monthly_value)}/mês{h.renewal_date ? ` · Renova em ${formatDate(h.renewal_date)}` : ''}
                      </p>
                    </div>
                    <Badge color={(hostingStatusConfig[h.status]?.color ?? 'gray') as never} className="text-[10px] flex-shrink-0">
                      {hostingStatusConfig[h.status]?.label ?? h.status}
                    </Badge>
                  </div>
                ))}
              </SectionCard>
            )}

            {mods.length > 0 && (
              <SectionCard icon={Wrench} title="Modificações" count={mods.length}>
                {mods.map(m => (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px] truncate">{m.title}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">
                        {modPriorityConfig[m.priority]?.label ?? m.priority}{m.deadline ? ` · Prazo: ${formatDate(m.deadline)}` : ''}
                      </p>
                    </div>
                    <Badge color={(modStatusConfig[m.status]?.color ?? 'gray') as never} className="text-[10px] flex-shrink-0">
                      {modStatusConfig[m.status]?.label ?? m.status}
                    </Badge>
                  </div>
                ))}
              </SectionCard>
            )}

            {gmbProfiles.length > 0 && (
              <SectionCard icon={MapPin} title="Google Meu Negócio" count={gmbProfiles.length}>
                {gmbProfiles.map(g => (
                  <div key={g.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-[#F8FBF9] text-[13px] truncate">{g.business_name}</p>
                      {g.rating != null && (
                        <p className="text-[11px] text-gray-400 dark:text-[#00a02a] flex items-center gap-1">
                          <Star size={10} className="text-amber-400 fill-amber-400" /> {g.rating.toFixed(1)}
                          {g.total_reviews != null ? ` (${g.total_reviews})` : ''}
                        </p>
                      )}
                    </div>
                    <Badge color={(gmbStatusConfig[g.status]?.color ?? 'gray') as never} className="text-[10px] flex-shrink-0">
                      {gmbStatusConfig[g.status]?.label ?? g.status}
                    </Badge>
                  </div>
                ))}
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo projeto" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="proj-name" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nome do projeto *</label>
            <input id="proj-name" type="text" value={form.name} onChange={setField('name')} placeholder="Ex: Site institucional" className="input-field" />
          </div>

          <div>
            <label htmlFor="proj-type" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Tipo</label>
            <select id="proj-type" value={form.type} onChange={setField('type')} className="input-field cursor-pointer">
              {projectTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="proj-status" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
            <select id="proj-status" value={form.status} onChange={setField('status')} className="input-field cursor-pointer">
              {projectStatusOptions.map(o => <option key={o.status} value={o.status}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="proj-responsible" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Responsável</label>
            <select id="proj-responsible" value={form.responsible} onChange={setField('responsible')} className="input-field cursor-pointer">
              <option value="isaac">Isaac</option>
              <option value="vinicius">Vinicius</option>
            </select>
          </div>

          <div>
            <label htmlFor="proj-value" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Valor (R$)</label>
            <input id="proj-value" type="number" value={form.value} onChange={setField('value')} placeholder="0,00" min="0" step="0.01" className="input-field" />
          </div>

          <div>
            <label htmlFor="proj-start-date" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Data de início *</label>
            <input id="proj-start-date" type="date" value={form.start_date} onChange={setField('start_date')} className="input-field" />
          </div>

          <div>
            <label htmlFor="proj-deadline" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Prazo de entrega *</label>
            <input id="proj-deadline" type="date" value={form.deadline} onChange={setField('deadline')} className="input-field" />
          </div>

          <div className="col-span-2">
            <label htmlFor="proj-url" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">URL do projeto</label>
            <input id="proj-url" type="text" value={form.url} onChange={setField('url')} placeholder="exemplo.com.br" className="input-field" />
          </div>

          <div className="col-span-2">
            <label htmlFor="proj-notes" className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Observações</label>
            <textarea id="proj-notes" value={form.notes} onChange={setField('notes')} rows={3} placeholder="Detalhes adicionais..." className="input-field resize-none" />
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
