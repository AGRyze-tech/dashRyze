const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFmt = new Intl.DateTimeFormat('pt-BR')
const dateShortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

// Date-only strings ("YYYY-MM-DD") are UTC midnight per the ISO spec. Passed
// straight to `new Date()` and then formatted/compared in a timezone behind
// UTC (all of Brazil), the calendar day shifts back by one. Parse the
// Y-M-D components as a local date instead; full timestamps (with a time
// component) are left to normal UTC-aware parsing.
export function parseLocalDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match) {
    const [, y, m, d] = match
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  return new Date(date)
}

export function formatCurrency(value: number): string {
  return currencyFmt.format(value)
}

export function formatDate(date: string): string {
  return dateFmt.format(parseLocalDate(date))
}

export function formatDateShort(date: string): string {
  return dateShortFmt.format(parseLocalDate(date))
}

export function firstOfMonthISO(offsetMonths = 0): string {
  const d = new Date()
  const t = new Date(d.getFullYear(), d.getMonth() - offsetMonths, 1)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
}
