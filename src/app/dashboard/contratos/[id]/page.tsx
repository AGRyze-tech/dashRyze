'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  ArrowLeft, FileText, User, FolderKanban, Calendar, CheckCircle2,
  Clock, AlertCircle, Upload, Download, CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { contractRepository, clientRepository } from '@/lib/repositories'
import { installmentStatusConfig, formatCurrency, formatDate, effectiveInstallmentStatus } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import type { Contract, ContractInstallment } from '@/types'

type ContractFull = Contract & { installments: ContractInstallment[] }

const statusIcon = { pago: CheckCircle2, pendente: Clock, atrasado: AlertCircle } as const

function AttachmentSlot({
  id, label, url, name, uploading, onUpload,
}: {
  id: string
  label: string
  url?: string | null
  name?: string | null
  uploading: boolean
  onUpload: (file: File) => void
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">{label}</label>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        id={id}
        disabled={uploading}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className={`flex-1 flex items-center gap-3 input-field cursor-pointer hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <Upload size={14} className="text-gray-400 flex-shrink-0" />
          <span className={`text-sm truncate flex-1 ${url ? 'text-gray-800 dark:text-[#D1FAE5]' : 'text-gray-400'}`}>
            {uploading ? 'Enviando...' : name ? name : 'Selecionar PDF'}
          </span>
        </label>
        {url && !uploading && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Baixar ${label}`}
            className="p-2.5 rounded-lg border border-gray-200 dark:border-[#28282d] text-gray-400 hover:text-[#00FF41] hover:border-[#00FF41]/50 transition-colors flex-shrink-0"
          >
            <Download size={14} />
          </a>
        )}
      </div>
      {url && !uploading && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
          <CheckCircle2 size={10} /> Anexado
        </p>
      )}
    </div>
  )
}

export default function ContratoPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [contract, setContract] = useState<ContractFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const { toast, showToast } = useToast()
  const db = useMemo(() => createClient(), [])
  const contractRepo = useMemo(() => contractRepository(db), [db])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await contractRepo.findById(id)
      setContract(data as ContractFull)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [contractRepo, id])

  useEffect(() => { load() }, [load])

  async function markInstallmentPaid(installmentId: string) {
    setMarkingPaid(installmentId)
    try {
      const { error } = await db
        .from('contract_installments')
        .update({ status: 'pago', paid_at: new Date().toISOString() })
        .eq('id', installmentId)
      if (error) throw error
      if (contract?.client_id) {
        await clientRepository(db).recalcFinancials(contract.client_id)
      }
      await load()
      showToast('Parcela marcada como paga — transação criada em Financeiro e cliente atualizado.')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao marcar parcela como paga.')
    } finally {
      setMarkingPaid(null)
    }
  }

  async function handleUpload(slot: 'pdf' | 'initial' | 'final', file: File) {
    setUploadingSlot(slot)
    try {
      const { url, name } = await contractRepo.uploadFile(file, slot)
      const attachmentInput = slot === 'pdf'
        ? { pdf_url: url, pdf_name: name }
        : slot === 'initial'
        ? { initial_payment_proof_url: url, initial_payment_proof_name: name }
        : { final_payment_proof_url: url, final_payment_proof_name: name }
      const updated = await contractRepo.updateAttachments(id, attachmentInput)
      setContract(prev => prev ? { ...prev, ...updated } : prev)
      showToast('Arquivo anexado com sucesso!')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao anexar arquivo.')
    } finally {
      setUploadingSlot(null)
    }
  }

  if (notFound) {
    return (
      <div>
        <Header title="Detalhe do Contrato" />
        <div className="p-6">
          <Link href="/dashboard/contratos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-[#00a02a] dark:hover:text-[#F8FBF9] mb-4">
            <ArrowLeft size={14} /> Voltar para Contratos
          </Link>
          <p className="text-gray-500 dark:text-[#00a02a]">Contrato não encontrado.</p>
        </div>
      </div>
    )
  }

  const paidCount = (contract?.installments ?? []).filter(i => i.status === 'pago').length

  return (
    <div>
      <Header
        title={loading ? 'Carregando...' : `Contrato ${contract?.number}`}
        subtitle={contract?.client?.name}
      />

      <div className="p-4 sm:p-6 space-y-5 max-w-4xl">
        <Link href="/dashboard/contratos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-[#00a02a] dark:hover:text-[#F8FBF9] transition-colors">
          <ArrowLeft size={14} /> Voltar para Contratos
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : contract && (
          <>
            {/* Info geral */}
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#181819]">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-gray-400 dark:text-[#00a02a]" />
                  <CardTitle>Informações do contrato</CardTitle>
                </div>
              </CardHeader>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-[#00a02a] flex items-center gap-1 mb-1"><User size={11} /> Cliente</p>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5]">{contract.client?.name ?? '—'}</p>
                </div>
                {contract.project?.name && (
                  <div>
                    <p className="text-[11px] text-gray-400 dark:text-[#00a02a] flex items-center gap-1 mb-1"><FolderKanban size={11} /> Projeto</p>
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5]">{contract.project.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-[#00a02a] flex items-center gap-1 mb-1"><CreditCard size={11} /> Valor total</p>
                  <p className="text-[13px] font-semibold tabular text-gray-800 dark:text-[#D1FAE5]">{formatCurrency(contract.total_value)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-[#00a02a] flex items-center gap-1 mb-1"><Calendar size={11} /> Criado em</p>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-[#D1FAE5]">{formatDate(contract.created_at)}</p>
                </div>
                <div className="col-span-2 sm:col-span-4 flex items-center gap-3">
                  <Badge color={contract.payment_method === 'avista' ? 'blue' : 'purple'} dot={false}>
                    {contract.payment_method === 'avista' ? 'À vista' : 'Parcelado'}
                  </Badge>
                  <span className="text-[12px] text-gray-500 dark:text-[#00a02a]">
                    {paidCount}/{contract.installments_count} parcelas pagas
                  </span>
                </div>
              </div>
            </Card>

            {/* Parcelas */}
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#181819]">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-gray-400 dark:text-[#00a02a]" />
                  <CardTitle>Parcelas ({contract.installments?.length ?? 0})</CardTitle>
                </div>
              </CardHeader>
              <div className="divide-y divide-gray-50 dark:divide-[#181819]">
                {(contract.installments ?? []).map(inst => {
                  const effStatus = effectiveInstallmentStatus(inst)
                  const cfg = installmentStatusConfig[effStatus]
                  const StatusIcon = statusIcon[effStatus]
                  return (
                    <div key={inst.id} className="flex items-center gap-4 px-5 py-4">
                      <StatusIcon size={16} className={
                        effStatus === 'pago' ? 'text-emerald-500' : effStatus === 'atrasado' ? 'text-red-500' : 'text-amber-500'
                      } />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 dark:text-[#D1FAE5]">Parcela {inst.number}</p>
                        <p className="text-[11px] text-gray-400 dark:text-[#00a02a]">Vencimento {formatDate(inst.due_date)}</p>
                      </div>
                      <span className="text-sm font-semibold tabular text-gray-800 dark:text-[#D1FAE5]">{formatCurrency(inst.value)}</span>
                      <Badge color={cfg.color as never} className="text-[10px]">{cfg.label}</Badge>
                      {inst.status !== 'pago' && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={markingPaid === inst.id}
                          onClick={() => markInstallmentPaid(inst.id)}
                        >
                          Marcar como paga
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Anexos */}
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#181819]">
                <div className="flex items-center gap-2">
                  <Upload size={15} className="text-gray-400 dark:text-[#00a02a]" />
                  <CardTitle>Anexos</CardTitle>
                </div>
              </CardHeader>
              <div className="p-5 space-y-4">
                <AttachmentSlot
                  id="contract-pdf"
                  label="Contrato (PDF)"
                  url={contract.pdf_url}
                  name={contract.pdf_name}
                  uploading={uploadingSlot === 'pdf'}
                  onUpload={file => handleUpload('pdf', file)}
                />
                <AttachmentSlot
                  id="initial-proof-pdf"
                  label="Comprovante — Valor Inicial"
                  url={contract.initial_payment_proof_url}
                  name={contract.initial_payment_proof_name}
                  uploading={uploadingSlot === 'initial'}
                  onUpload={file => handleUpload('initial', file)}
                />
                <AttachmentSlot
                  id="final-proof-pdf"
                  label="Comprovante — Valor Final"
                  url={contract.final_payment_proof_url}
                  name={contract.final_payment_proof_name}
                  uploading={uploadingSlot === 'final'}
                  onUpload={file => handleUpload('final', file)}
                />
              </div>
            </Card>
          </>
        )}
      </div>

      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#111114] dark:border dark:border-[#28282d] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
