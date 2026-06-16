import { ClientStatus, ProjectStatus, LeadStatus, InstallmentStatus } from '@/types'

export const clientStatusConfig: Record<ClientStatus, { label: string; color: string }> = {
  prospecto: { label: 'Prospecção', color: 'yellow' },
  ativo:     { label: 'Ativo',      color: 'green' },
  inativo:   { label: 'Inativo',    color: 'gray' },
  churned:   { label: 'Churned',    color: 'red' },
}

export const activeClientStatuses: ClientStatus[] = ['prospecto', 'ativo', 'inativo']

export const projectStatusConfig: Record<ProjectStatus, { label: string; color: string }> = {
  briefing:       { label: 'Briefing',       color: 'blue' },
  desenvolvimento:{ label: 'Desenvolvimento', color: 'purple' },
  revisao:        { label: 'Revisão',        color: 'yellow' },
  entregue:       { label: 'Entregue',       color: 'green' },
  concluido:      { label: 'Concluído',      color: 'gray' },
  pausado:        { label: 'Pausado',        color: 'red' },
}

export const leadStatusConfig: Record<LeadStatus, { label: string; color: string }> = {
  novo:       { label: 'Novo',       color: 'blue' },
  contatado:  { label: 'Contatado',  color: 'yellow' },
  qualificado:{ label: 'Qualificado',color: 'green' },
  descartado: { label: 'Descartado', color: 'red' },
  convertido: { label: 'Convertido', color: 'purple' },
}

export const installmentStatusConfig: Record<InstallmentStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'yellow' },
  pago:     { label: 'Pago',     color: 'green' },
  atrasado: { label: 'Atrasado', color: 'red' },
}

export const projectTypeLabels: Record<string, string> = {
  site:              'Site',
  landing:           'Landing Page',
  smartpage:         'Smart Page',
  sistema:           'Sistema',
  gmb:               'Google Meu Negócio',
  google_ads:        'Google Ads',
  meta_ads:          'Meta Ads',
  identidade_visual: 'Identidade Visual',
  outro:             'Outro',
}

export const projectTypeOptions = Object.entries(projectTypeLabels).map(
  ([value, label]) => ({ value, label })
)

import type { AcquisitionSource } from '@/types'

export const acquisitionSourceConfig: Record<AcquisitionSource, { label: string; color: string }> = {
  indicacao:  { label: 'Indicação',  color: 'green' },
  anuncio:    { label: 'Anúncio',    color: 'blue' },
  prospeccao: { label: 'Prospecção', color: 'purple' },
  organico:   { label: 'Orgânico',   color: 'yellow' },
}

export const acquisitionSourceOptions: { value: AcquisitionSource; label: string }[] = [
  { value: 'indicacao',  label: 'Indicação' },
  { value: 'anuncio',    label: 'Anúncio' },
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'organico',   label: 'Orgânico' },
]

export const projectStatusOptions = (
  Object.entries(projectStatusConfig) as [ProjectStatus, { label: string; color: string }][]
).map(([status, { label }]) => ({ status, label }))

export const specialties = [
  'Psicólogo',
  'Psicanalista',
  'Psicoterapeuta',
  'Terapeuta',
  'Sexólogo',
  'Nutricionista',
  'Médico',
  'Clínica',
  'Dentista',
  'Fisioterapeuta',
  'Enfermeiro',
  'Farmacêutico',
  'Outro',
]
