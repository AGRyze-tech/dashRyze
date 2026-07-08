'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { FileText, Download, Plus, AlertCircle, CheckCircle2, Clock, Trash2, Calendar, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { contractRepository, projectRepository, clientRepository } from '@/lib/repositories'
import { formatCurrency, formatDate, effectiveInstallmentStatus } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import { Contract, InstallmentStatus, Client, Project, PaymentMethod } from '@/types'

const statusIcon: Record<InstallmentStatus, React.ElementType> = {
  pago: CheckCircle2,
  pendente: Clock,
  atrasado: AlertCircle,
}

const statusColor: Record<InstallmentStatus, string> = {
  pago: 'text-emerald-500',
  pendente: 'text-amber-500',
  atrasado: 'text-red-500',
}

function defaultDueDate(index: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 30 * (index + 1))
  return d.toISOString().split('T')[0]
}

const emptyForm = {
  client_id: '',
  project_id: '',
  total_value: '',
  payment_method: 'avista' as PaymentMethod,
  installments_count: 2,
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [dueDates, setDueDates] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<Contract | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()
  const db = useMemo(() => createClient(), [])
  const contractRepo = useMemo(() => contractRepository(db), [db])
  const clientRepo = useMemo(() => clientRepository(db), [db])
  const projectRepo = useMemo(() => projectRepository(db), [db])

  useEffect(() => {
    async function load() {
      try {
        const [contractsData, clientsData] = await Promise.all([
          contractRepo.findAll(),
          clientRepo.findForSelect(),
        ])
        setContracts(contractsData)
        setClients(clientsData as Client[])
      } catch (err) {
        console.error('Erro ao carregar contratos:', err)
        showToast('Erro ao carregar contratos. Tente recarregar a página.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])


  useEffect(() => {
    if (!form.client_id) { setProjects([]); return }
    projectRepo.findByClientId(form.client_id)
      .then(data => setProjects(data as Project[]))
  }, [form.client_id])

  useEffect(() => {
    const count = form.payment_method === 'avista' ? 1 : form.installments_count
    setDueDates(prev => {
      if (prev.length === count) return prev
      return Array.from({ length: count }, (_, i) => prev[i] ?? defaultDueDate(i))
    })
  }, [form.payment_method, form.installments_count])

  const totalValue = parseFloat(form.total_value) || 0
  const installmentsCount = form.payment_method === 'avista' ? 1 : form.installments_count
  const installmentValue = installmentsCount > 0 ? totalValue / installmentsCount : 0

  const { totalReceived, totalPending } = contracts
    .flatMap(c => c.installments ?? [])
    .reduce(
      (acc, i) => {
        if (i.status === 'pago') acc.totalReceived += i.value
        else if (i.status === 'pendente') acc.totalPending += i.value
        return acc
      },
      { totalReceived: 0, totalPending: 0 }
    )

  const totalVolume = contracts.reduce((sum, c) => sum + c.total_value, 0)

  function handleOpenModal() {
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id) { setSaveError('Selecione um cliente.'); return }
    if (!totalValue || totalValue <= 0) { setSaveError('Informe um valor total válido.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const count = form.payment_method === 'avista' ? 1 : form.installments_count
      const installmentsPayload = Array.from({ length: count }, (_, i) => ({
        number: i + 1,
        value: parseFloat((totalValue / count).toFixed(2)),
        due_date: dueDates[i] ?? defaultDueDate(i),
        status: 'pendente' as InstallmentStatus,
      }))

      const contract = await contractRepo.create(
        {
          client_id: form.client_id,
          project_id: form.project_id || null,
          total_value: totalValue,
          payment_method: form.payment_method,
          installments_count: count,
        },
        installmentsPayload,
      )

      await clientRepo.recalcFinancials(form.client_id)
      setContracts(prev => [contract, ...prev])
      showToast(`Contrato ${contract.number} criado com sucesso!`)
      setShowModal(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await contractRepo.remove(deleteModal.id)
      await clientRepo.recalcFinancials(deleteModal.client_id)
      setContracts(prev => prev.filter(c => c.id !== deleteModal.id))
      showToast(`Contrato ${deleteModal.number} removido.`)
      setDeleteModal(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <Header
        title="Contratos"
        subtitle={loading ? 'Carregando...' : `${contracts.length} contrato${contracts.length !== 1 ? 's' : ''}`}
      />

      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card p-4">
            <p className="text-xs text-gray-500 mb-1">Total Recebido</p>
            <p className="text-xl font-bold text-emerald-600 tabular">{formatCurrency(totalReceived)}</p>
          </div>
          <div className="stat-card p-4">
            <p className="text-xs text-gray-500 mb-1">A Receber</p>
            <p className="text-xl font-bold text-amber-600 tabular">{formatCurrency(totalPending)}</p>
          </div>
          <div className="stat-card p-4">
            <p className="text-xs text-gray-500 mb-1">Volume Total</p>
            <p className="text-xl font-bold text-gray-900 tabular">{formatCurrency(totalVolume)}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleOpenModal}><Plus size={14} /> Novo contrato</Button>
        </div>

        <Card padding="none">
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Valor total</th>
                <th>Pagamento</th>
                <th>Parcelas</th>
                <th>Criado em</th>
                <th>PDF</th>
                <th aria-label="Ações"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="h-3 w-28 bg-gray-200 animate-pulse rounded" /></td>
                    <td><div className="h-3 w-36 bg-gray-200 animate-pulse rounded" /></td>
                    <td><div className="h-3 w-20 bg-gray-200 animate-pulse rounded" /></td>
                    <td><div className="h-5 w-16 bg-gray-200 animate-pulse rounded-full" /></td>
                    <td><div className="h-3 w-24 bg-gray-200 animate-pulse rounded" /></td>
                    <td><div className="h-3 w-16 bg-gray-100 animate-pulse rounded" /></td>
                    <td><div className="h-6 w-6 bg-gray-100 animate-pulse rounded" /></td>
                    <td></td>
                  </tr>
                ))
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">Nenhum contrato cadastrado ainda</td>
                </tr>
              ) : contracts.map(contract => {
                const paidCount = (contract.installments ?? []).filter(i => i.status === 'pago').length
                return (
                  <Fragment key={contract.id}>
                    <tr>
                      <td>
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-gray-400" />
                          <span className="font-mono text-[12px] font-medium text-gray-700">{contract.number}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="text-[13px] font-medium text-gray-800">{contract.client?.name}</p>
                          <p className="text-[11px] text-gray-400">{contract.client?.specialty}</p>
                        </div>
                      </td>
                      <td><span className="tabular font-semibold text-gray-800">{formatCurrency(contract.total_value)}</span></td>
                      <td>
                        <Badge color={contract.payment_method === 'avista' ? 'blue' : 'purple'} dot={false}>
                          {contract.payment_method === 'avista' ? 'À vista' : 'Parcelado'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${contract.installments_count > 0 ? (paidCount / contract.installments_count) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[12px] text-gray-500">{paidCount}/{contract.installments_count}</span>
                        </div>
                      </td>
                      <td><span className="text-[12px] text-gray-400">{formatDate(contract.created_at)}</span></td>
                      <td>
                        {contract.pdf_url ? (
                          <a href={contract.pdf_url} target="_blank" rel="noopener noreferrer" aria-label="Baixar PDF"
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors inline-flex">
                            <Download size={13} />
                          </a>
                        ) : (
                          <span className="text-[11px] text-gray-300 px-1.5">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/contratos/${contract.id}`} aria-label="Ver detalhes do contrato"
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors inline-flex">
                            <Eye size={13} />
                          </Link>
                          <button type="button" onClick={() => setDeleteModal(contract)} aria-label="Remover contrato"
                            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {(contract.installments ?? []).length > 0 && (
                      <tr key={`${contract.id}-inst`} className="bg-gray-50/50">
                        <td colSpan={8} className="px-6 py-2">
                          <div className="flex gap-3 flex-wrap">
                            {(contract.installments ?? []).map(inst => {
                              const effStatus = effectiveInstallmentStatus(inst)
                              const StatusIcon = statusIcon[effStatus]
                              return (
                                <div key={inst.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[11px]">
                                  <StatusIcon size={11} className={statusColor[effStatus]} />
                                  <span className="font-medium text-gray-600">Parcela {inst.number}</span>
                                  <span className="text-gray-400">·</span>
                                  <span className="tabular font-semibold text-gray-700">{formatCurrency(inst.value)}</span>
                                  <span className="text-gray-400">·</span>
                                  <span className="text-gray-400">{formatDate(inst.due_date)}</span>
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Contrato" size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label>
              <select className="input-field cursor-pointer" value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value, project_id: '' }))} required aria-label="Cliente">
                <option value="">Selecione um cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.specialty}</option>)}
              </select>
            </div>

            {projects.length > 0 && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Projeto (opcional)</label>
                <select className="input-field cursor-pointer" value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} aria-label="Projeto">
                  <option value="">Nenhum projeto vinculado</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor total *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">R$</span>
                <input type="number" className="input-field pl-9" placeholder="0,00" min="0" step="0.01"
                  value={form.total_value} onChange={e => setForm(f => ({ ...f, total_value: e.target.value }))} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Forma de pagamento *</label>
              <select className="input-field cursor-pointer" value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as PaymentMethod }))} aria-label="Forma de pagamento">
                <option value="avista">À vista</option>
                <option value="parcelado">Parcelado</option>
              </select>
            </div>

            {form.payment_method === 'parcelado' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Número de parcelas *</label>
                <select className="input-field cursor-pointer" value={form.installments_count}
                  onChange={e => setForm(f => ({ ...f, installments_count: parseInt(e.target.value) }))} aria-label="Número de parcelas">
                  {Array.from({ length: 11 }, (_, i) => i + 2).map(n => (
                    <option key={n} value={n}>{n}x {totalValue > 0 ? `de ${formatCurrency(totalValue / n)}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {totalValue > 0 && dueDates.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                {form.payment_method === 'avista' ? 'Data de vencimento' : `${installmentsCount}x de ${formatCurrency(installmentValue)}`}
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 max-h-52 overflow-y-auto">
                {dueDates.map((date, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#00FF41]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-[#00FF41]">{i + 1}</span>
                    </div>
                    <span className="text-[13px] font-semibold tabular text-gray-700 flex-1">{formatCurrency(installmentValue)}</span>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400 flex-shrink-0" />
                      <input type="date"
                        className="text-[12px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#00FF41] bg-white"
                        value={date}
                        onChange={e => {
                          const next = [...dueDates]
                          next[i] = e.target.value
                          setDueDates(next)
                        }}
                        aria-label={`Vencimento da parcela ${i + 1}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {saveError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{saveError}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar contrato</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Contrato" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Tem certeza que deseja remover o contrato <strong>{deleteModal.number}</strong>? Todas as parcelas vinculadas também serão removidas.
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
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
