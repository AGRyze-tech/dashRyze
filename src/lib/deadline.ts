import { parseLocalDate } from './format'
import type { InstallmentStatus, Hosting } from '@/types'

export function daysUntil(date: string): number {
  const target = parseLocalDate(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function deadlineLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''} em atraso`
  if (days === 0) return 'Prazo: hoje!'
  return `${days} dia${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`
}

export function isDeadlineWarning(deadline: string): boolean {
  const days = daysUntil(deadline)
  return days >= 0 && days <= 3
}

export function isOverdue(deadline: string): boolean {
  return daysUntil(deadline) < 0
}

// Deriva o status "de verdade" pra exibição sem escrever no banco: uma parcela
// que passou do vencimento sem ser paga é tratada como atrasada em toda a UI,
// mesmo que a coluna `status` ainda diga 'pendente' (nada muda ela automaticamente).
export function effectiveInstallmentStatus(installment: { status: InstallmentStatus; due_date: string }): InstallmentStatus {
  if (installment.status === 'pendente' && isOverdue(installment.due_date)) return 'atrasado'
  return installment.status
}

export function effectiveHostingStatus(hosting: Pick<Hosting, 'status' | 'renewal_date'>): Hosting['status'] {
  if (hosting.status === 'ativo' && hosting.renewal_date && isOverdue(hosting.renewal_date)) return 'vencido'
  return hosting.status
}
