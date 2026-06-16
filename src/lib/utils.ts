export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export * from './format'
export * from './deadline'
export * from './domain-config'
