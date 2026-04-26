'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { MessageCircle, UserPlus, Globe, DollarSign, Users, ChevronDown } from 'lucide-react'
import { leadStatusConfig, formatDate } from '@/lib/utils'
import { Lead, LeadStatus } from '@/types'

const statusOptions: { value: LeadStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'novo', label: 'Novos' },
  { value: 'contatado', label: 'Contatados' },
  { value: 'qualificado', label: 'Qualificados' },
  { value: 'descartado', label: 'Descartados' },
  { value: 'convertido', label: 'Convertidos' },
]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'todos'>('todos')
  const [convertModal, setConvertModal] = useState<Lead | null>(null)

  const filtered = leads.filter(l => statusFilter === 'todos' || l.status === statusFilter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  function updateStatus(id: string, status: LeadStatus) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  function convertLead(lead: Lead) {
    updateStatus(lead.id, 'convertido')
    setConvertModal(null)
  }

  const counts = leads.reduce(
    (acc, l) => { acc[l.status]++; return acc },
    { todos: leads.length, novo: 0, contatado: 0, qualificado: 0, descartado: 0, convertido: 0 } as Record<LeadStatus | 'todos', number>
  )

  return (
    <div>
      <Header title="Leads" subtitle={`${counts.novo} novo${counts.novo !== 1 ? 's' : ''} · ${counts.qualificado} qualificado${counts.qualificado !== 1 ? 's' : ''}`} />

      <div className="p-6 space-y-5">
        {/* Status tabs */}
        <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1 w-fit">
          {statusOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                statusFilter === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                statusFilter === value ? 'bg-[#40916C]/10 text-[#40916C]' : 'bg-gray-200 text-gray-500'
              }`}>
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        {/* Leads table */}
        <Card padding="none">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Faturamento</th>
                <th>Pacientes/mês</th>
                <th>Tem site?</th>
                <th>Status</th>
                <th>Recebido em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">Nenhum lead encontrado</td>
                </tr>
              ) : (
                filtered.map(lead => {
                  const cfg = leadStatusConfig[lead.status]
                  return (
                    <tr key={lead.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#40916C]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[13px] font-bold text-[#40916C]">{lead.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-[13px]">{lead.name}</p>
                            <p className="text-[11px] text-gray-400">{lead.whatsapp}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                          <DollarSign size={11} className="text-gray-400" />
                          {lead.revenue}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                          <Users size={11} className="text-gray-400" />
                          {lead.patients_per_month}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                          <Globe size={11} className="text-gray-400" />
                          {lead.has_site}
                        </div>
                      </td>
                      <td>
                        <div className="relative group">
                          <button className="flex items-center gap-1">
                            <Badge color={cfg.color as never}>{cfg.label}</Badge>
                            <ChevronDown size={10} className="text-gray-400" />
                          </button>
                          <div className="absolute z-10 left-0 top-7 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                            {(['novo', 'contatado', 'qualificado', 'descartado', 'convertido'] as LeadStatus[]).map(s => (
                              <button
                                key={s}
                                onClick={() => updateStatus(lead.id, s)}
                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 ${lead.status === s ? 'font-semibold text-[#40916C]' : 'text-gray-700'}`}
                              >
                                {leadStatusConfig[s].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-[11px] text-gray-400">{formatDate(lead.created_at)}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://wa.me/55${lead.whatsapp}?text=Olá ${lead.name.split(' ')[0]}, vi seu contato em nosso site!`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                              <MessageCircle size={13} />
                            </Button>
                          </a>
                          {lead.status !== 'convertido' && lead.status !== 'descartado' && (
                            <Button variant="ghost" size="sm" className="text-[#40916C] hover:text-[#40916C] hover:bg-[#40916C]/8" onClick={() => setConvertModal(lead)}>
                              <UserPlus size={13} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Convert modal */}
      <Modal isOpen={!!convertModal} onClose={() => setConvertModal(null)} title="Converter em Cliente" size="sm">
        {convertModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Deseja converter <strong>{convertModal.name}</strong> em cliente? Isso marcará o lead como Convertido e abrirá o cadastro de cliente.
            </p>
            <div className="bg-[#F8FBF9] border border-[#40916C]/20 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">Faturamento:</span><span className="font-medium">{convertModal.revenue}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pacientes/mês:</span><span className="font-medium">{convertModal.patients_per_month}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">WhatsApp:</span><span className="font-medium">{convertModal.whatsapp}</span></div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConvertModal(null)}>Cancelar</Button>
              <Button onClick={() => convertLead(convertModal)}>
                <UserPlus size={13} /> Converter
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
