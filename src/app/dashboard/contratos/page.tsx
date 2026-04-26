'use client'
import { Fragment, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FileText, Download, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Contract, InstallmentStatus } from '@/types'

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

export default function ContratosPage() {
  const [contracts] = useState<Contract[]>([])

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

  return (
    <div>
      <Header title="Contratos" subtitle={`${contracts.length} contratos ativos`} />

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
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
          <Button><Plus size={14} /> Novo contrato</Button>
        </div>

        <Card padding="none">
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
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">Nenhum contrato cadastrado ainda</td>
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
                      <td>
                        <span className="tabular font-semibold text-gray-800">{formatCurrency(contract.total_value)}</span>
                      </td>
                      <td>
                        <Badge color={contract.payment_method === 'avista' ? 'blue' : 'purple'} dot={false}>
                          {contract.payment_method === 'avista' ? 'À vista' : 'Parcelado'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(paidCount / contract.installments_count) * 100}%` }} />
                          </div>
                          <span className="text-[12px] text-gray-500">{paidCount}/{contract.installments_count}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-[12px] text-gray-400">{formatDate(contract.created_at)}</span>
                      </td>
                      <td>
                        <button type="button" aria-label="Baixar PDF" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <Download size={13} />
                        </button>
                      </td>
                    </tr>
                    <tr key={`${contract.id}-installments`} className="bg-gray-50/50">
                      <td colSpan={7} className="px-6 py-2">
                        <div className="flex gap-3 flex-wrap">
                          {(contract.installments ?? []).map(inst => {
                            const StatusIcon = statusIcon[inst.status]
                            return (
                              <div key={inst.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[11px]">
                                <StatusIcon size={11} className={statusColor[inst.status]} />
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
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
