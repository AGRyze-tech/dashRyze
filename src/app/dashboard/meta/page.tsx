'use client'
import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useTheme } from '@/components/layout/ThemeProvider'
import { BarChart2, Eye, MousePointer, DollarSign, TrendingUp, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { MetaCampaign } from '@/types'
import { loadMetaCampaigns, saveMetaCampaign, deleteMetaCampaign } from '@/lib/meta'

const emptyForm = {
  name: '',
  status: 'ACTIVE',
  daily_budget: '',
  spend: '',
  impressions: '',
  clicks: '',
  reach: '',
}

function ChartTooltip({ active, payload, label, isDark }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; isDark: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl border px-3 py-2.5 shadow-xl text-[12px] ${isDark ? 'bg-[#111114] border-[#28282d] text-[#D1FAE5]' : 'bg-white border-gray-100 text-gray-700'}`}>
      {label && <p className={`font-semibold mb-1 ${isDark ? 'text-[#00a02a]' : 'text-gray-500'}`}>{label}</p>}
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className={isDark ? 'text-[#00a02a]' : 'text-gray-500'}>{p.name}:</span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function MetaPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<MetaCampaign | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteModal, setDeleteModal] = useState<MetaCampaign | null>(null)
  const { toast, showToast } = useToast()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    loadMetaCampaigns().then(setCampaigns)
  }, [])


  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const spendData = campaigns.map(c => ({ name: c.name.length > 16 ? c.name.slice(0, 16) + '…' : c.name, spend: c.spend }))

  const gridColor = isDark ? '#181819' : '#F3F4F6'
  const tickColor = isDark ? '#006620' : '#9CA3AF'

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setSaveError('Informe o nome da campanha.'); return }
    setSaving(true)
    setSaveError('')
    try {
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
      await saveMetaCampaign(payload)
      if (editTarget) {
        setCampaigns(prev => prev.map(c => c.id === editTarget.id ? payload : c))
        showToast(`${payload.name} atualizada!`)
      } else {
        setCampaigns(prev => [payload, ...prev])
        showToast(`${payload.name} adicionada!`)
      }
      setShowModal(false)
    } catch {
      setSaveError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    await deleteMetaCampaign(deleteModal.id)
    setCampaigns(prev => prev.filter(c => c.id !== deleteModal.id))
    showToast(`${deleteModal.name} removida.`)
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
            <span className="text-[12px] text-gray-400 dark:text-[#00a02a]">Dados inseridos manualmente</span>
          </div>
          <Button onClick={handleOpenCreate}><Plus size={14} /> Nova campanha</Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Gasto Total', value: formatCurrency(totalSpend), icon: DollarSign, iconCls: 'text-red-500 dark:text-red-400', bgCls: 'bg-red-50 dark:bg-red-900/25' },
            { label: 'Impressões', value: totalImpressions.toLocaleString('pt-BR'), icon: Eye, iconCls: 'text-violet-700 dark:text-violet-400', bgCls: 'bg-violet-50 dark:bg-violet-900/25' },
            { label: 'Cliques', value: totalClicks.toLocaleString('pt-BR'), icon: MousePointer, iconCls: 'text-[#00FF41] dark:text-[#00FF41]', bgCls: 'bg-[#00FF41]/10 dark:bg-[#00FF41]/20' },
            { label: 'CPM Médio', value: formatCurrency(avgCPM), icon: BarChart2, iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-900/25' },
            { label: 'CTR', value: `${ctr.toFixed(2)}%`, icon: TrendingUp, iconCls: 'text-amber-500 dark:text-amber-400', bgCls: 'bg-amber-50 dark:bg-amber-900/25' },
          ].map(({ label, value, icon: Icon, iconCls, bgCls }) => (
            <div key={label} className="stat-card p-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${bgCls}`}>
                <Icon size={15} className={iconCls} />
              </div>
              <div className="tabular text-lg font-bold text-gray-900 dark:text-[#F0FDF4]">{value}</div>
              <div className="text-[11px] text-gray-500 dark:text-[#00a02a] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <div className="lg:col-span-2">
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-2">
                <CardTitle>Gasto por Campanha</CardTitle>
              </CardHeader>
              <div className="px-2 pb-4 pt-2">
                {campaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-[#181819] flex items-center justify-center">
                      <BarChart2 size={18} className="text-gray-300 dark:text-[#00a02a]" />
                    </div>
                    <p className="text-[13px] text-gray-400 dark:text-[#00a02a]">Nenhuma campanha ainda</p>
                    <p className="text-[12px] text-gray-300 dark:text-[#00a02a]">Adicione campanhas para ver o gráfico</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={spendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                      <Tooltip content={<ChartTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(64,145,108,0.06)' : 'rgba(0,0,0,0.03)' }} />
                      <Bar dataKey="spend" name="Gasto" fill="#00FF41" radius={[5, 5, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Campaign list */}
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#181819]">
              <CardTitle>Campanhas ({campaigns.length})</CardTitle>
            </CardHeader>
            <div className="divide-y divide-gray-50 dark:divide-[#181819] overflow-y-auto max-h-[300px]">
              {campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-1">
                  <p className="text-[13px] text-gray-400 dark:text-[#00a02a]">Nenhuma campanha</p>
                </div>
              ) : campaigns.map(c => (
                <div key={c.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#181819] transition-colors group">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[12px] font-medium text-gray-800 dark:text-[#D1FAE5] leading-tight flex-1 mr-2">{c.name}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge color={c.status === 'ACTIVE' ? 'green' : 'gray'} className="text-[9px]">
                        {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                      </Badge>
                      {/* Touch targets: min 32px for these small action buttons */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        aria-label={`Editar ${c.name}`}
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-[#00FF41]/8 text-gray-300 dark:text-[#00a02a] hover:text-blue-600 dark:hover:text-[#00FF41] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModal(c)}
                        aria-label={`Remover ${c.name}`}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 dark:text-[#00a02a] hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-[#00a02a]">Gasto</span>
                      <div className="text-[12px] font-semibold tabular text-red-500 dark:text-red-400">{formatCurrency(c.spend)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-[#00a02a]">CPM</span>
                      <div className="text-[12px] font-semibold tabular text-gray-700 dark:text-[#A7C4AF]">{formatCurrency(c.cpm)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-[#00a02a]">Impressões</span>
                      <div className="text-[12px] font-semibold tabular text-gray-700 dark:text-[#A7C4AF]">{c.impressions.toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-[#00a02a]">Cliques</span>
                      <div className="text-[12px] font-semibold tabular text-gray-700 dark:text-[#A7C4AF]">{c.clicks.toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <span className="text-[10px] text-gray-400 dark:text-[#00a02a]">Budget/dia: {formatCurrency(c.daily_budget)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Editar Campanha' : 'Nova Campanha'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="meta-name" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Nome da campanha *</label>
              <input id="meta-name" className="input-field" placeholder="Ex: Clínica XY — Captação Outubro" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label htmlFor="meta-status" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Status</label>
              <select id="meta-status" className="input-field cursor-pointer" value={form.status} onChange={set('status')}>
                <option value="ACTIVE">Ativa</option>
                <option value="PAUSED">Pausada</option>
              </select>
            </div>
            <div>
              <label htmlFor="meta-budget" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Budget diário (R$)</label>
              <input id="meta-budget" type="number" className="input-field" placeholder="0,00" min="0" step="0.01" value={form.daily_budget} onChange={set('daily_budget')} />
            </div>
            <div>
              <label htmlFor="meta-spend" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Gasto total (R$)</label>
              <input id="meta-spend" type="number" className="input-field" placeholder="0,00" min="0" step="0.01" value={form.spend} onChange={set('spend')} />
            </div>
            <div>
              <label htmlFor="meta-impressions" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Impressões</label>
              <input id="meta-impressions" type="number" className="input-field" placeholder="0" min="0" value={form.impressions} onChange={set('impressions')} />
            </div>
            <div>
              <label htmlFor="meta-clicks" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Cliques</label>
              <input id="meta-clicks" type="number" className="input-field" placeholder="0" min="0" value={form.clicks} onChange={set('clicks')} />
            </div>
            <div>
              <label htmlFor="meta-reach" className="block text-sm font-medium text-gray-700 dark:text-[#A7C4AF] mb-1.5">Alcance</label>
              <input id="meta-reach" type="number" className="input-field" placeholder="0" min="0" value={form.reach} onChange={set('reach')} />
            </div>
          </div>

          {saveError && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editTarget ? 'Salvar alterações' : 'Adicionar campanha'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remover Campanha" size="sm">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-[#A7C4AF]">
              Remover a campanha <strong className="text-gray-900 dark:text-[#F8FBF9]">{deleteModal.name}</strong>? Esta ação não pode ser desfeita.
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
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gray-900 dark:bg-[#111114] dark:border dark:border-[#28282d] text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-[#00FF41] flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
