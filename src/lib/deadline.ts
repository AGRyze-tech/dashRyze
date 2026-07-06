import { parseLocalDate } from './format'

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
