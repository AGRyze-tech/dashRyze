'use client'
import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BarChart2, Eye, MousePointer, DollarSign, TrendingUp, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { MetaCampaign } from '@/types'

const STORAGE_KEY = 'ryze_meta_campaigns'

function loadCampaigns(): MetaCampaign[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

const emptyForm = {
  name: '',
  status: 'ACTIVE',
  daily_budget: '',
  spend: '',
  impressions: '',
  clicks: '',
  reach: '',
}

export default function MetaPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<MetaCampaign | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<MetaCampaign | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setCampaigns(loadCampaigns())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns))
  }, [campaigns, hydrated])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const spendData = campaigns.map(c => ({ name: c.name.length > 16 ? c.name.slice(0, 16) + '…' : c.name, spend: c.spend }))

  function handleOpenCreate() {
    setEditTarget(null)
    setForm(emptyForm)
    setSaveError('')
    setShowModal(true)
  }

  function handleOpenEdit(c: MetaCampaign) {
    setEditTarget(c)
    setForm({
      name: c.name,
      status: c.status,
      daily_budget: String(c.daily_budget),
      spend: String(c.spend),
      impressions: String(c.impressions),
      clicks: String(c.clicks),
      reach: String(c.reach),
    })
    setSaveError('')
    setShowModal(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setSaveError('Informe o nome da campanha.'); return }
    setSaving(true)
    setSaveError('')
    const impressions = parseInt(form.impressions) || 0
    const spend = parseFloat(form.spend) || 0
    const payload: MetaCampaign = {
      id: editTarget?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      status: form.status,
      daily_budget: parseFloat(form.daily_budget) || 0,
      spend,
      impressions,
      clicks: parseInt(form.clicks) || 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      reach: parseInt(form.reach) || 0,
    }
    if (editTarget) {
      setCampaigns(prev => prev.map(c => c.id === editTarget.id ? payload : c))
      setToast(`${payload.name} atualizada!`)
    } else {
      setCampaigns(prev => [payload, ...prev])
      setToast(`${payload.name} adicionada!`)
    }
    setShowModal(false)
    setSaving(false)
  }

  function handleDelete() {
    if (!deleteModal) return
    setCampaigns(prev => prev.filter(c => c.id !== deleteModal.id))
    setToast(`${deleteModal.name} removida.`)
    setDeleteModal(null)
  }

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div>
      <Header title="Meta Ads" subtitle="Campanhas Facebook / Instagram" />

      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge color="purple" dot={false}>Modo Manual</Badge>
            <span className="text-[12px] text-gray-400">Dados inseridos manualmente</span>
          </div>
          <Button onClick={handleOpenCreate}><Plus size={14} /> Nova campanha</Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Gasto Total', value: formatCurrency(totalSpend), icon: DollarSign, iconClass: 'text-red-500', bgClass: 'bg-red-50' },
            { label: 'Impressões', value: totalImpressions.toLocaleString('pt-BR'), icon: Eye, iconClass: 'text-violet-700', bgClass: 'bg-violet-50' },
            { label: 'Cliques', value: totalClicks.toLocaleString('pt-BR'), icon: MousePointer, iconClass: 'text-[#40916C]', bgClass: 'bg-[#40916C]/10' },
            { label: 'CPM Médio', value: formatCurrency(avgCPM), icon: BarChart2, iconClass: 'text-blue-600', bgClass: 'bg-blue-50' },
            { label: 'CTR', value: `${ctr.toFixed(2)}%`, icon: TrendingUp, iconClass: 'text-amber-500', bgClass: 'bg-amber-50' },
          ].map(({ label, value, icon: Icon, iconClass, bgClass }) => (
            <div key={label} className="stat-card p-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${bgClass}`}>
                <Icon size={15} className={iconClass} />
              </div>
              <div className="tabular text-lg font-bold text-gray-900">{value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-2">
                <CardTitle>Gasto por Campanha</CardTitle>
              </CardHeader>
              <div className="px-2 pb-4 pt-2">
                {campaigns.length === 0 ? (
                  <div className="flex items-center justify-center h-[220px] text-gray-300 text-sm">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={spendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="spend" name="Gasto" fill="#40916C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
              <CardTitle>Campanhas ({campaigns.length})</CardTitle>
            </CardHeader>
            <div className="divide-y divide-gray-50 overflow-y-auto max-h-[300px]">
              {campaigns.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Nenhuma campanha</div>
              ) : campaigns.map(c => (
                <div key={c.id} className="px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[12px] font-medium text-gray-800 leading-tight flex-1 mr-2">{c.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge color={c.status === 'ACTIVE' ? 'green' : 'gray'} className="text-[9px]">
                        {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                      </Badge>
                      <button type="button" onClick={() => handleOpenEdit(c)} aria-label="Editar"
                        className="p-0.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100">
                        <Pencil size={10} />
                      </button>
                      <button type="button" onClick={() => setDeleteModal(c)} aria-label="Remover"
                        className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2">
                    <div><span className="text-[10px] text-gray-400">Gasto</span><div className="text-[12px] font-semibold tabular text-red-500">{formatCurrency(c.spend)}</div></div>
                    <div><span className="text-[10px] text-gray-400">CPM</span><div className="text-[12px] font-semibold tabular text-gray-700">{formatCurrency(c.cpm)}</div></div>
                    <div><span className="text-[10px] text-gray-400">Impressões</span><div className="text-[12px] font-semibold tabular text-gray-700">{c.impressions.toLocaleString('pt-BR')}</div></div>
                    <div><span className="text-[10px] text-gray-400">Cliques</span><div className="text-[12px] font-semibold tabular text-gray-700">{c.clicks.toLocaleString('pt-BR')}</div></div>
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] text-gray-400">Budget/dia: {formatCurrency(c.daily_budget)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Editar Campanha' : 'Nova Campanha'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da campanha *</label>
              <input className="input-field" placeholder="Ex: Clínica XY — Captação Outubro" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select className="input-field cursor-pointer" value={form.status} onChange={set('status')} aria-label="Status">
                <option value="ACTIVE">Ativa</option>
                <option value="PAUSED">Pausada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget diário (R$)</label>
              <input type="number" className="input-field" placeholder="0,00" min="0" step="0.01" value={form.daily_budget} onChange={set('daily_budget')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Gasto total (R$)</label>
              <input type="number" className="input-field" placeholder="0,00" min="0" step="0.01" value={form.spend} onChange={set('spend')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Impressões</label>
              <input type="number" className="input-field" placeholder="0" min="0" value={form.impressions} onChange={set('impressions')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliques</label>
              <input type="number" className="input-field" placeholder="0" min="0" value={form.clicks} onChange={set('clicks')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Alcance</label>
              <input type="number" className="input-field" placeholder="0" min="0" value={form.reach} onChange={set('reach')} />
            </div>
          </div>

          {saveError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{saveError}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editTarget ? 'Salvar alterações' : 'Adicionar campanha'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Campanha" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Remover a campanha <strong>{deleteModal.name}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Button>
              <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
                <Trash2 size={13} /> Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#52B788] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
