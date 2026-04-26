import { ClientStatus, ProjectStatus, LeadStatus, InstallmentStatus } from '@/types'

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFmt = new Intl.DateTimeFormat('pt-BR')
const dateShortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

export function formatCurrency(value: number): string {
  return currencyFmt.format(value)
}

export function formatDate(date: string): string {
  return dateFmt.format(new Date(date))
}

export function formatDateShort(date: string): string {
  return dateShortFmt.format(new Date(date))
}

export function deadlineLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''} em atraso`
  if (days === 0) return 'Prazo: hoje!'
  return `${days} dia${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`
}

export function daysUntil(date: string): number {
  const target = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function isDeadlineWarning(deadline: string): boolean {
  const days = daysUntil(deadline)
  return days >= 0 && days <= 3
}

export function isOverdue(deadline: string): boolean {
  return daysUntil(deadline) < 0
}

export const clientStatusConfig: Record<ClientStatus, { label: string; color: string }> = {
  prospecto: { label: 'Prospecto', color: 'yellow' },
  ativo: { label: 'Ativo', color: 'green' },
  inativo: { label: 'Inativo', color: 'gray' },
  churned: { label: 'Churned', color: 'red' },
}

export const projectStatusConfig: Record<ProjectStatus, { label: string; color: string }> = {
  briefing: { label: 'Briefing', color: 'blue' },
  desenvolvimento: { label: 'Desenvolvimento', color: 'purple' },
  revisao: { label: 'Revisão', color: 'yellow' },
  entregue: { label: 'Entregue', color: 'green' },
  concluido: { label: 'Concluído', color: 'gray' },
  pausado: { label: 'Pausado', color: 'red' },
}

export const leadStatusConfig: Record<LeadStatus, { label: string; color: string }> = {
  novo: { label: 'Novo', color: 'blue' },
  contatado: { label: 'Contatado', color: 'yellow' },
  qualificado: { label: 'Qualificado', color: 'green' },
  descartado: { label: 'Descartado', color: 'red' },
  convertido: { label: 'Convertido', color: 'purple' },
}

export const installmentStatusConfig: Record<InstallmentStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'yellow' },
  pago: { label: 'Pago', color: 'green' },
  atrasado: { label: 'Atrasado', color: 'red' },
}

export const projectTypeLabels: Record<string, string> = {
  site: 'Site',
  landing: 'Landing Page',
  smartpage: 'SmartPage',
  sistema: 'Sistema',
  outro: 'Outro',
}

export const specialties = [
  'Nutricionista',
  'Psicólogo',
  'Médico',
  'Clínica',
  'Dentista',
  'Fisioterapeuta',
  'Terapeuta',
  'Enfermeiro',
  'Farmacêutico',
  'Outro',
]
