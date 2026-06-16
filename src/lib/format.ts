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

export function firstOfMonthISO(offsetMonths = 0): string {
  const d = new Date()
  const t = new Date(d.getFullYear(), d.getMonth() - offsetMonths, 1)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
}
